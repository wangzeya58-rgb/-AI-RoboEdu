/**
 * 客户端 API 封装
 * ----------------------------------------------------------------
 * 用法：
 *   import { api } from '@/lib/api/client';
 *   const res = await api.get('/courses', { status: 'pending' });
 *   const created = await api.post('/courses', { title: 'xxx' });
 *
 * 特性：
 *   - 统一基础前缀 /api/v1（可被运行时 window.__APP_CONFIG__.API_BASE 覆盖）
 *   - 自动注入登录态：x-user-id
 *   - 统一响应格式：{ success, code, message, data }
 *   - 失败抛出 ApiClientError（含 code/message/raw）
 *   - 支持 beforeRequest / afterResponse 拦截器
 *
 * 静态部署后端配置：
 *   部署后编辑 /assets/runtime-config.js 里的 window.__APP_CONFIG__.API_BASE，
 *   不需要重新构建。
 */
import { ApiError } from './errors';

const DEFAULT_PREFIX = '/api/v1';

export interface ApiClientOptions {
  /** 自定义基础前缀，默认 /api/v1 */
  prefix?: string;
  /** 自定义 header */
  headers?: Record<string, string>;
  /** 鉴权用的 userId；默认从 localStorage 读取 */
  userId?: string;
  /** 超时毫秒，默认 30000 */
  timeoutMs?: number;
}

export type RequestInterceptor = (input: { url: string; init: RequestInit }) => { url: string; init: RequestInit } | Promise<{ url: string; init: RequestInit }>;
export type ResponseInterceptor = (input: { response: Response; body: ApiResponse | null }) => { response: Response; body: ApiResponse | null } | Promise<{ response: Response; body: ApiResponse | null }>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

export function addRequestInterceptor(fn: RequestInterceptor) { requestInterceptors.push(fn); }
export function addResponseInterceptor(fn: ResponseInterceptor) { responseInterceptors.push(fn); }

export class ApiClientError extends Error {
  public readonly code: number;
  public readonly httpStatus: number;
  public readonly raw: unknown;
  constructor(message: string, code: number, httpStatus: number, raw?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.raw = raw;
  }
}

function resolveUserId(override?: string): string | undefined {
  if (override) return override;
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem('aerolark_session');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id;
  } catch {
    return undefined;
  }
}

/**
 * 解析 API 基础地址优先级：
 *   1. 调用时传入的 options.prefix
 *   2. 运行时配置 window.__APP_CONFIG__.API_BASE
 *   3. 默认 /api/v1
 */
function resolveApiBase(override?: string): string {
  if (override) return override;
  if (typeof window !== 'undefined') {
    const cfg = (window as unknown as { __APP_CONFIG__?: { API_BASE?: string } }).__APP_CONFIG__;
    if (cfg?.API_BASE) return cfg.API_BASE;
  }
  return DEFAULT_PREFIX;
}

async function parseBody(res: Response): Promise<ApiResponse | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    return null;
  }
}

async function runRequest<T>(method: string, path: string, body: unknown, query: Record<string, unknown> | undefined, options: ApiClientOptions): Promise<T> {
  const userId = resolveUserId(options.userId);
  const qs = query && Object.keys(query).length > 0
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]).toString()
    : '';
  const baseUrl = resolveApiBase(options.prefix);
  let url = `${baseUrl}${path}${qs}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (userId) headers['x-user-id'] = userId;

  let init: RequestInit = {
    method,
    headers,
    ...(body !== undefined && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  };

  for (const fn of requestInterceptors) {
    const next = await fn({ url, init });
    url = next.url as unknown as string;
    init = next.init;
  }

  // 超时
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 30000;
  const timer = setTimeout(() => controller.abort(), timeout);
  init.signal = controller.signal;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (e) {
    clearTimeout(timer);
    throw new ApiClientError((e as Error).message || '网络错误', -1, 0);
  }
  clearTimeout(timer);

  let parsed: ApiResponse | null = await parseBody(response);
  for (const fn of responseInterceptors) {
    const next = await fn({ response, body: parsed });
    response = next.response;
    parsed = next.body;
  }

  if (!response.ok || !parsed) {
    const msg = parsed?.message || `请求失败 (HTTP ${response.status})`;
    throw new ApiClientError(msg, parsed?.code ?? response.status, response.status, parsed);
  }
  if (!parsed.success) {
    throw new ApiClientError(parsed.message, parsed.code, response.status, parsed);
  }
  return parsed.data as T;
}

export interface ApiClient {
  get<T = unknown>(path: string, query?: Record<string, unknown>, options?: ApiClientOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: ApiClientOptions): Promise<T>;
  delete<T = unknown>(path: string, query?: Record<string, unknown>, options?: ApiClientOptions): Promise<T>;
}

function createClient(): ApiClient {
  return {
    get: (p, q, o) => runRequest('GET', p, undefined, q, o ?? {}),
    post: (p, b, o) => runRequest('POST', p, b ?? {}, undefined, o ?? {}),
    patch: (p, b, o) => runRequest('PATCH', p, b ?? {}, undefined, o ?? {}),
    put: (p, b, o) => runRequest('PUT', p, b ?? {}, undefined, o ?? {}),
    delete: (p, q, o) => runRequest('DELETE', p, undefined, q, o ?? {}),
  };
}

export const api = createClient();
export { ApiError };
