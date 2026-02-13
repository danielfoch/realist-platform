import { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

interface TrackedError {
  id: string;
  route: string;
  method: string;
  message: string;
  stack?: string;
  timestamp: string;
}

const recentErrors: TrackedError[] = [];
const MAX_ERRORS = 100;

function pushError(error: TrackedError): void {
  recentErrors.unshift(error);
  if (recentErrors.length > MAX_ERRORS) {
    recentErrors.pop();
  }
}

export function getRecentErrors(): TrackedError[] {
  return recentErrors;
}

export function errorTrackingMiddleware(error: unknown, req: Request, res: Response, next: NextFunction): void {
  const tracked: TrackedError = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    route: req.originalUrl,
    method: req.method,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  pushError(tracked);

  logger.error('Unhandled request error', {
    errorId: tracked.id,
    route: tracked.route,
    method: tracked.method,
    message: tracked.message,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    errorId: tracked.id,
  });
  void next;
}
