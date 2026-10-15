/**
 * withApi 高阶函数：包装 route handler，自动实现
 *   - 统一响应包装
 *   - 统一错误处理（ApiError -> JSON）
 *   - 请求日志（X-Request-ID、耗时）
 *   - OPTIONS 预检
 *   - CORS 头
 */

import type { NextRequest } from 'next/server';
import { ApiError } from './errors';
import { buildMeta, CORS_HEADERS, fail, fromError, generateRequestId, ok } from './response';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

export interface HandlerOptions {
  /** 允许的 HTTP 方法，不传则放行所有 */
  methods?: Method[];
  /** API 版本，默认 v1 */
  version?: string;
  /** 是否跳过 OPTIONS 预检 */
  skipOptions?: boolean;
}

/** Handler 函数签名：业务实现只关心成功路径，错误抛 ApiError */
export type ApiHandler<T = unknown, P = Record<string, string>> = (
  req: NextRequest,
  context: RouteContext<P>,
) => Promise<T> | T;

/** withApi 包装器：把任意业务 handler 包装成 Next.js Route Handler */
export function withApi<T = unknown, P = Record<string, string>>(
  handler: ApiHandler<T, P>,
  options: HandlerOptions = {},
) {
  return async function wrapped(req: NextRequest, context: RouteContext<P>): Promise<Response> {
    const start = Date.now();
    const requestId = req.headers.get('x-request-id')?.trim() || generateRequestId();
    const version = options.version ?? 'v1';
    const meta = buildMeta(requestId, start, version);

    // 通用响应头
    const baseHeaders: HeadersInit = {
      ...CORS_HEADERS,
      'X-Request-ID': requestId,
      'X-API-Version': version,
    };

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseHeaders });
    }

    // 方法限制
    if (options.methods && options.methods.length > 0 && !options.methods.includes(req.method as Method)) {
      return fail(10005, `Method ${req.method} Not Allowed`, {
        httpStatus: 405,
        meta,
        headers: { ...baseHeaders, Allow: options.methods.join(', ') },
      });
    }

    try {
      const data = await handler(req, context);
      return ok(data, { meta, headers: baseHeaders });
    } catch (err) {
      // 业务 ApiError
      if (err instanceof ApiError) {
        return fromError(err, meta, baseHeaders);
      }
      // 非业务异常：500
      console.error(`[api:${requestId}]`, req.method, req.url, err);
      return fail(10500, err instanceof Error ? err.message : '服务器内部错误', {
        httpStatus: 500,
        meta,
        headers: baseHeaders,
      });
    }
  };
}
