/**
 * CREA DDF Client
 * Handles authentication and data fetching from CREA DDF RETS endpoints.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import xml2js from 'xml2js';
import { logger } from './logger';
import { SimpleRateLimiter } from './rate-limiter';
import { withRetry } from './retry';

export interface DDFCredentials {
  username: string;
  password: string;
  userAgent?: string;
}

interface RETSSession {
  sessionId: string;
  cookies: string[];
  serverVersion?: string;
  loginUrl: string;
}

interface SearchParams {
  status?: string[];
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  modifiedSince?: Date;
  limit?: number;
}

export interface Listing {
  ListingKey: string;
  MlsNumber: string;
  StandardStatus: string;
  ListPrice: string;
  StreetAddress: string;
  City: string;
  StateOrProvince: string;
  PostalCode: string;
  BedroomsTotal: string;
  BathroomsTotalInteger: string;
  LivingArea: string;
  PropertyType: string;
  PropertySubType: string;
  ListingContractDate: string;
  ModificationTimestamp: string;
  [key: string]: string;
}

interface RetsEnvelope {
  RETS?: {
    $?: {
      ReplyCode?: string;
      ReplyText?: string;
      'RETS-Version'?: string;
    };
    COUNT?: {
      $?: {
        Records?: string;
      };
    };
    DATA?: {
      COLUMNS?: string;
      DATA?: string | string[];
    };
  };
}

const DEFAULT_ENDPOINTS = [
  'https://replication.crea.ca/Login.ashx',
  'https://data.crea.ca/Login.ashx',
  'https://replication.crea.ca/Server/Login.svc',
  'https://ddf.crea.ca/Login.ashx',
] as const;

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRetryableAxiosError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  if (!status) {
    return true;
  }

  return status === 429 || status >= 500;
}

export class DDFClient {
  private session: RETSSession | null = null;
  private readonly client: AxiosInstance;
  private readonly credentials: DDFCredentials;
  private readonly endpoints: readonly string[];
  private readonly rateLimiter: SimpleRateLimiter;

  constructor(credentials: DDFCredentials, endpoints: readonly string[] = DEFAULT_ENDPOINTS) {
    const userAgent = credentials.userAgent || 'Realist.ca/1.0';
    this.credentials = {
      ...credentials,
      userAgent,
    };

    this.endpoints = endpoints;
    this.rateLimiter = new SimpleRateLimiter(5, 1000);

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': this.credentials.userAgent,
        'RETS-Version': 'RETS/1.7.2',
      },
    });
  }

  private async requestWithPolicy<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.rateLimiter.schedule(() =>
      withRetry(
        () => this.client.request<T>({ ...config, validateStatus: () => true }),
        {
          attempts: 4,
          baseDelayMs: 250,
          maxDelayMs: 2500,
          shouldRetry: (error) => isRetryableAxiosError(error),
        },
      ),
    );
  }

  private async parseXml(data: unknown): Promise<RetsEnvelope> {
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const xml = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
    return parser.parseStringPromise(xml) as Promise<RetsEnvelope>;
  }

  private getAuthenticatedUrl(suffix: 'GetMetadata' | 'Search' | 'GetObject' | 'Logout'): string {
    if (!this.session) {
      throw new Error('Not authenticated. Call login() first.');
    }
    return this.session.loginUrl.replace('/Login.', `/${suffix}.`);
  }

  private extractReply(result: RetsEnvelope): { replyCode: number; replyText: string; serverVersion?: string } {
    const rets = result.RETS?.$;
    const replyCode = Number.parseInt(rets?.ReplyCode || '-1', 10);
    const replyText = rets?.ReplyText || 'Unknown reply';
    return { replyCode, replyText, serverVersion: rets?.['RETS-Version'] };
  }

  async login(): Promise<boolean> {
    logger.info('Attempting CREA DDF authentication');

    for (const endpoint of this.endpoints) {
      try {
        const response = await this.requestWithPolicy<string>({
          method: 'GET',
          url: endpoint,
          auth: {
            username: this.credentials.username,
            password: this.credentials.password,
          },
        });

        const result = await this.parseXml(response.data);
        const { replyCode, replyText, serverVersion } = this.extractReply(result);

        logger.info('Authentication reply received', {
          endpoint,
          statusCode: response.status,
          replyCode,
          replyText,
        });

        if (replyCode === 0) {
          const setCookie = response.headers['set-cookie'];
          const cookies = Array.isArray(setCookie) ? setCookie : [];

          this.session = {
            sessionId: crypto.randomUUID(),
            cookies,
            loginUrl: endpoint,
            serverVersion,
          };

          logger.info('Authenticated with CREA DDF', { endpoint, serverVersion });
          return true;
        }

        if (replyCode === 20037 || response.status === 401) {
          logger.warn('CREA DDF rejected credentials', { endpoint, replyCode, replyText });
          return false;
        }
      } catch (error) {
        logger.warn('CREA DDF endpoint failed', {
          endpoint,
          error: asErrorMessage(error),
        });
      }
    }

    throw new Error('Failed to authenticate with all configured CREA DDF endpoints.');
  }

  async getMetadata(resourceType = 'Property'): Promise<RetsEnvelope> {
    const metadataUrl = this.getAuthenticatedUrl('GetMetadata');

    const response = await this.requestWithPolicy<string>({
      method: 'GET',
      url: metadataUrl,
      params: {
        Type: 'METADATA-RESOURCE',
        ID: '0',
        Resource: resourceType,
      },
      headers: {
        Cookie: this.session?.cookies.join('; '),
      },
    });

    return this.parseXml(response.data);
  }

  async searchListings(params: SearchParams = {}): Promise<Listing[]> {
    const searchUrl = this.getAuthenticatedUrl('Search');
    const conditions: string[] = [];

    if (params.status && params.status.length > 0) {
      conditions.push(`(StandardStatus=${params.status.join(',')})`);
    }
    if (params.city) {
      conditions.push(`(City=${params.city})`);
    }
    if (typeof params.minPrice === 'number') {
      conditions.push(`(ListPrice=${params.minPrice}+ )`.replace(' ', ''));
    }
    if (typeof params.maxPrice === 'number') {
      conditions.push(`(ListPrice=${params.maxPrice}-)`);
    }
    if (params.propertyType) {
      conditions.push(`(PropertyType=${params.propertyType})`);
    }
    if (params.modifiedSince) {
      conditions.push(`(ModificationTimestamp=${params.modifiedSince.toISOString()}+)`);
    }

    const response = await this.requestWithPolicy<string>({
      method: 'POST',
      url: searchUrl,
      params: {
        SearchType: 'Property',
        Class: 'ResidentialProperty',
        Query: conditions.length > 0 ? conditions.join(',') : '*',
        QueryType: 'DMQL2',
        Count: 1,
        Format: 'COMPACT-DECODED',
        Limit: params.limit || 100,
        Select: [
          'ListingKey',
          'MlsNumber',
          'StandardStatus',
          'ListPrice',
          'StreetAddress',
          'City',
          'StateOrProvince',
          'PostalCode',
          'BedroomsTotal',
          'BathroomsTotalInteger',
          'LivingArea',
          'PropertyType',
          'PropertySubType',
          'ListingContractDate',
          'ModificationTimestamp',
        ].join(','),
      },
      headers: {
        Cookie: this.session?.cookies.join('; '),
      },
    });

    const result = await this.parseXml(response.data);
    const count = Number.parseInt(result.RETS?.COUNT?.$?.Records || '0', 10);
    logger.info('Listing search completed', { count });

    return this.parseCompactData(result);
  }

  async getPhotos(listingKey: string): Promise<string[]> {
    const objectUrl = this.getAuthenticatedUrl('GetObject');

    try {
      const response = await this.requestWithPolicy<ArrayBuffer>({
        method: 'GET',
        url: objectUrl,
        params: {
          Type: 'Photo',
          Resource: 'Property',
          ID: `${listingKey}:*`,
        },
        headers: {
          Cookie: this.session?.cookies.join('; '),
        },
        responseType: 'arraybuffer',
      });

      return this.parseMultipartPhotos(Buffer.from(response.data), String(response.headers['content-type'] || ''));
    } catch (error) {
      logger.warn('Failed to fetch listing photos', { listingKey, error: asErrorMessage(error) });
      return [];
    }
  }

  private parseCompactData(result: RetsEnvelope): Listing[] {
    const columnsRaw = result.RETS?.DATA?.COLUMNS;
    const rowsRaw = result.RETS?.DATA?.DATA;

    if (!columnsRaw || !rowsRaw) {
      return [];
    }

    const columns = columnsRaw
      .split('\t')
      .map((col) => col.trim())
      .filter(Boolean);

    const rows = Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw];

    return rows.map((row) => {
      const rawValues = row.split('\t');
      const values = rawValues[0] === '' ? rawValues.slice(1) : rawValues;
      const listing: Record<string, string> = {};
      columns.forEach((column, index) => {
        listing[column] = values[index] || '';
      });
      return listing as Listing;
    });
  }

  private parseMultipartPhotos(data: Buffer, contentType: string): string[] {
    if (!contentType.includes('multipart')) {
      return [];
    }

    // Placeholder parser for future binary extraction support.
    // Keeping return value empty avoids storing partial/invalid media references.
    void data;
    return [];
  }

  async logout(): Promise<void> {
    if (!this.session) {
      return;
    }

    const logoutUrl = this.getAuthenticatedUrl('Logout');

    try {
      await this.requestWithPolicy({
        method: 'GET',
        url: logoutUrl,
        headers: {
          Cookie: this.session.cookies.join('; '),
        },
      });
      logger.info('Logged out from CREA DDF');
    } catch (error) {
      logger.warn('CREA DDF logout request failed', {
        error: asErrorMessage(error),
      });
    } finally {
      this.session = null;
    }
  }

  static async testConnection(credentials: DDFCredentials): Promise<boolean> {
    const client = new DDFClient(credentials);
    try {
      const success = await client.login();
      if (success) {
        await client.logout();
      }
      return success;
    } catch (error) {
      const details = axios.isAxiosError(error)
        ? `${error.message} (${error.response?.status || 'no-status'})`
        : asErrorMessage(error);
      logger.error('Connection test failed', { error: details });
      return false;
    }
  }
}

export default DDFClient;
