/**
 * Error mapping — normalizes IB and application errors to stable server codes.
 */
import { v4 as uuid } from 'uuid';
import type { ErrorCode, ErrorDetail, ApiResponse, Meta } from '../schemas/common';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly ibErrorCode: number | null = null,
    public readonly retriable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      ib_error_code: this.ibErrorCode,
      retriable: this.retriable,
    };
  }
}

/** Map common IB error codes to our error codes */
export function mapIBErrorCode(ibCode: number, ibMessage: string): AppError {
  // Common IB error codes
  if (ibCode === 200) {
    return new AppError('IB_CONTRACT_NOT_FOUND', ibMessage, {}, ibCode, false);
  }
  if (ibCode === 162) {
    return new AppError('IB_PACING_VIOLATION', ibMessage, {}, ibCode, true);
  }
  if (ibCode === 201 || ibCode === 202) {
    return new AppError('IB_ORDER_REJECTED', ibMessage, {}, ibCode, false);
  }
  if (ibCode === 354 || ibCode === 10090) {
    return new AppError('IB_MARKET_DATA_UNAVAILABLE', ibMessage, {}, ibCode, false);
  }
  if (ibCode === 502 || ibCode === 504) {
    return new AppError('IB_NOT_CONNECTED', ibMessage, {}, ibCode, true);
  }
  if (ibCode === 10187 || ibCode === 10197) {
    return new AppError('IB_PERMISSION_DENIED', ibMessage, {}, ibCode, false);
  }
  if (ibCode === 1100 || ibCode === 1300) {
    return new AppError('IB_CONNECTION_FAILED', ibMessage, {}, ibCode, true);
  }

  // Default
  return new AppError('INTERNAL_ERROR', ibMessage, {}, ibCode, false);
}

export function buildMeta(requestId: string, startTime: number): Meta {
  return {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - startTime,
  };
}

export function buildSuccessResponse<T>(data: T, requestId: string, startTime: number): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: buildMeta(requestId, startTime),
  };
}

export function buildErrorResponse(error: AppError | ErrorDetail, requestId: string, startTime: number): ApiResponse<null> {
  const errorDetail = error instanceof AppError ? error.toErrorDetail() : error;
  return {
    success: false,
    data: null,
    error: errorDetail,
    meta: buildMeta(requestId, startTime),
  };
}

/** Wrap a tool handler to automatically produce envelope responses */
export async function withEnvelope<T>(
  fn: (requestId: string) => Promise<T>,
): Promise<ApiResponse<T>> {
  const requestId = uuid();
  const startTime = Date.now();
  try {
    const data = await fn(requestId);
    return buildSuccessResponse(data, requestId, startTime);
  } catch (err) {
    if (err instanceof AppError) {
      return buildErrorResponse(err, requestId, startTime) as ApiResponse<T>;
    }
    const appErr = new AppError(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : String(err),
    );
    return buildErrorResponse(appErr, requestId, startTime) as ApiResponse<T>;
  }
}
