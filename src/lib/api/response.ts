/**
 * 统一响应封装
 * 所有 API 返回的 JSON 格式固定为：
 * {
 *   success: boolean,
 *   code: number,
 *   message: string,
 *   data?: T,
 *   error?: { code, message, details? },
 *   meta?: { requestId, timestamp, durationMs, version }
 * }
 */

import { NextResponse } from 'next/server';
import { ErrorCode } from './errors';

/** 当前 API 主版本号 */
export const API_VERSION = 'v1';
/** API 全局前缀 */
export const API_PREFIX = '/api/' + API_VERSION;

/** 统一成功响应 */
export interface ApiSuccessResponse<T> {
  success: true;
  code: 0;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}

/** 统一失败响应 */
export interface ApiErrorResponse {
  success: false;
  code: number;
  message: string;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
  meta: ApiResponseMeta;
}

export interface ApiResponseMeta {
  /** 请求唯一 ID，方便排查日志 */
  requestId: string;
  /** 响应时间戳（毫秒） */
  timestamp: number;
  /** 处理耗时（毫秒） */
  durationMs: number;
  /** API 版本 */
  version: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** 创建响应元数据 */
export function buildMeta(requestId: string, startMs: number, version: string): ApiResponseMeta {
  return {
    requestId,
    timestamp: Date.now(),
    durationMs: Date.now() - startMs,
    version,
  };
}

/** 成功响应 NextResponse */
export function ok<T>(data: T, options?: { message?: string; meta?: ApiResponseMeta; status?: number; headers?: HeadersInit }): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    success: true,
    code: 0,
    message: options?.message ?? 'ok',
    data,
    meta: options?.meta ?? buildMeta(generateRequestId(), Date.now(), 'v1'),
  };
  return NextResponse.json(body, { status: options?.status ?? 200, headers: options?.headers });
}

/** 失败响应 NextResponse */
export function fail(code: number, message: string, options?: { httpStatus?: number; details?: unknown; meta?: ApiResponseMeta; headers?: HeadersInit }): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    code,
    message,
    error: { code, message, details: options?.details },
    meta: options?.meta ?? buildMeta(generateRequestId(), Date.now(), 'v1'),
  };
  return NextResponse.json(body, { status: options?.httpStatus ?? 400, headers: options?.headers });
}

/** 从 ApiError / Error 转 NextResponse */
export function fromError(err: unknown, meta?: ApiResponseMeta, headers?: HeadersInit): NextResponse<ApiErrorResponse> {
  // ApiError
  if (err && typeof err === 'object' && 'code' in err && 'httpStatus' in err) {
    const e = err as { code: number; message: string; httpStatus: number; details?: unknown };
    return fail(e.code, e.message, { httpStatus: e.httpStatus, details: e.details, meta, headers });
  }
  // 通用 Error
  if (err instanceof Error) {
    return fail(ErrorCode.INTERNAL_ERROR, err.message || '服务器内部错误', {
      httpStatus: 500,
      meta,
      headers,
    });
  }
  return fail(ErrorCode.UNKNOWN_ERROR, '未知错误', { httpStatus: 500, meta, headers });
}

/** 简单请求 ID（可按需替换为 uuid/nanoid） */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 标准 CORS 头 */
export const CORS_HEADERS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-session, x-request-id',
  'Access-Control-Max-Age': '86400',
};
