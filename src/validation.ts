import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

const listingQuerySchema = z.object({
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().length(2).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  maxBedrooms: z.coerce.number().int().min(0).optional(),
  propertyType: z.string().trim().max(50).optional(),
  status: z.string().trim().max(20).optional(),
  sortBy: z.enum(['list_date', 'list_price', 'cap_rate', 'gross_yield', 'cash_flow_monthly', 'bedrooms', 'square_footage']).optional(),
  sortOrder: z.enum(['ASC', 'DESC']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  investmentFocus: z.union([z.boolean(), z.string()]).optional(),
  minCapRate: z.coerce.number().min(0).max(100).optional(),
  maxCapRate: z.coerce.number().min(0).max(100).optional(),
});

const investmentTopSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().length(2).optional(),
});

const mapSchema = z.object({
  bounds: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  propertyType: z.string().trim().max(50).optional(),
  status: z.string().trim().max(20).optional(),
  minCapRate: z.coerce.number().min(0).max(100).optional(),
  maxCapRate: z.coerce.number().min(0).max(100).optional(),
});

const statsSchema = z.object({
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().length(2).optional(),
});

const listingByMlsSchema = z.object({
  mlsNumber: z.string().trim().min(1).max(64),
});

function parseValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}

function buildQueryValidator<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parseValidationError(parsed.error),
      });
      return;
    }

    req.query = parsed.data as Request['query'];
    next();
  };
}

function buildParamValidator<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parseValidationError(parsed.error),
      });
      return;
    }

    req.params = parsed.data as Request['params'];
    next();
  };
}

export const validateListingQuery = buildQueryValidator(listingQuerySchema);
export const validateTopInvestmentQuery = buildQueryValidator(investmentTopSchema);
export const validateMapQuery = buildQueryValidator(mapSchema);
export const validateStatsQuery = buildQueryValidator(statsSchema);
export const validateListingParams = buildParamValidator(listingByMlsSchema);
