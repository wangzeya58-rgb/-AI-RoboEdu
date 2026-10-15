/**
 * 通用入参校验工具
 * 替代 zod/yup 等重型库，保持轻量、零依赖
 */

import { ApiError } from './errors';

export type Validator<T> = (value: unknown, path: string) => T;

/** 必填：值不能为 undefined / null / 空字符串 */
export function required<T = unknown>(validator: Validator<T> = identity): Validator<T> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') {
      throw ApiError.badRequest(`${path} 不能为空`);
    }
    return validator(value, path);
  };
}

/** 字符串 */
export const string: Validator<string> = (v, path) => {
  if (typeof v !== 'string') throw ApiError.badRequest(`${path} 必须是字符串`);
  return v;
};

/** 数字 */
export const number: Validator<number> = (v, path) => {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  throw ApiError.badRequest(`${path} 必须是数字`);
};

/** 整数 */
export const integer: Validator<number> = (v, path) => {
  const n = number(v, path);
  if (!Number.isInteger(n)) throw ApiError.badRequest(`${path} 必须是整数`);
  return n;
};

/** 布尔 */
export const boolean: Validator<boolean> = (v, path) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  throw ApiError.badRequest(`${path} 必须是布尔值`);
};

/** 枚举 */
export function oneOf<T extends string>(values: readonly T[]): Validator<T> {
  return (v, path) => {
    if (typeof v !== 'string' || !values.includes(v as T)) {
      throw ApiError.badRequest(`${path} 取值必须是 ${values.join('|')} 之一`);
    }
    return v as T;
  };
}

/** 手机号（中国大陆 11 位） */
export const phone: Validator<string> = (v, path) => {
  const s = string(v, path);
  if (!/^1[3-9]\d{9}$/.test(s)) throw ApiError.badRequest(`${path} 手机号格式不正确`);
  return s;
};

/** UUID 字符串 */
export const uuid: Validator<string> = (v, path) => {
  const s = string(v, path);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw ApiError.badRequest(`${path} UUID 格式不正确`);
  }
  return s;
};

/** 数组 */
export function array<T>(item?: Validator<T>): Validator<T[]> {
  return (v, path) => {
    if (!Array.isArray(v)) throw ApiError.badRequest(`${path} 必须是数组`);
    if (item) return v.map((x, i) => item(x, `${path}[${i}]`));
    return v as T[];
  };
}

/** 对象 */
export function object<T extends Record<string, unknown>>(shape: { [K in keyof T]: Validator<T[K]> }, opts?: { allowUnknown?: boolean }): Validator<T> {
  return (v, path) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      throw ApiError.badRequest(`${path} 必须是对象`);
    }
    const out: Record<string, unknown> = {};
    const obj = v as Record<string, unknown>;
    for (const key of Object.keys(shape)) {
      out[key] = shape[key](obj[key], `${path}.${key}`);
    }
    if (!opts?.allowUnknown) {
      for (const key of Object.keys(obj)) {
        if (!(key in shape)) {
          throw ApiError.badRequest(`${path}.${key} 是未知字段`);
        }
      }
    }
    return out as T;
  };
}

/** 可选字段（undefined 时直接返回 undefined） */
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value, path) => {
    if (value === undefined) return undefined;
    return validator(value, path);
  };
}

/** 默认值 */
export function withDefault<T>(validator: Validator<T>, defaultValue: T): Validator<T> {
  return (value, path) => {
    if (value === undefined || value === null) return defaultValue;
    return validator(value, path);
  };
}

/** 分页参数 */
export interface Pagination {
  page: number;
  pageSize: number;
}

export const pagination: Validator<Pagination> = (v, path) => {
  const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    page: Math.max(1, integer(obj.page ?? 1, `${path}.page`)),
    pageSize: Math.min(100, Math.max(1, integer(obj.pageSize ?? 20, `${path}.pageSize`))),
  };
};

function identity<T>(v: unknown): T {
  return v as T;
}

/**
 * 解析并校验请求体（如果解析失败抛 ApiError）。
 * 业务路由的推荐用法：
 *   const body = await parseJson<MyBody>(req, myValidator);
 *   const body = await parseJson<MyBody>(req, shape as never);
 */
export async function parseJson<T>(req: Request, validator: Validator<T>): Promise<T>;
export async function parseJson<T>(
  req: Request,
  shape: Record<string, Validator<unknown>>,
): Promise<T>;
export async function parseJson(req: Request, arg: unknown): Promise<unknown> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest('请求体必须为合法 JSON');
  }
  if (typeof arg === 'function') {
    return (arg as Validator<unknown>)(raw, 'body');
  }
  // 当传入的是 shape 对象时，用 object() 包装一层
  // 默认允许未知字段（避免新增字段时影响老接口）
  return object(arg as { [k: string]: Validator<unknown> }, { allowUnknown: true })(raw, 'body');
}

/** 解析 URLSearchParams 并校验 */
export function parseSearchParams<T>(req: Request, validator: Validator<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return validator(obj, 'query');
}
