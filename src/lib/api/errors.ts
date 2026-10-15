/**
 * 统一业务错误码体系
 * 命名规范：模块_场景_序号
 * 错误响应使用 ApiError 抛出，由 withApi 包装器统一捕获
 */

/** 业务错误码枚举 */
export const ErrorCode = {
  // ========== 通用 1xxxx ==========
  SUCCESS: 0,
  UNKNOWN_ERROR: 10000,
  INVALID_PARAMS: 10001,
  UNAUTHORIZED: 10002,
  FORBIDDEN: 10003,
  NOT_FOUND: 10004,
  METHOD_NOT_ALLOWED: 10005,
  RATE_LIMIT: 10006,
  CONFLICT: 10007,
  INTERNAL_ERROR: 10500,
  UPSTREAM_ERROR: 10502,
  SERVICE_UNAVAILABLE: 10503,

  // ========== 鉴权模块 11xxx ==========
  AUTH_INVALID_CREDENTIALS: 11001,
  AUTH_CODE_EXPIRED: 11002,
  AUTH_CODE_INVALID: 11003,
  AUTH_CODE_FREQUENT: 11004,
  AUTH_PHONE_REGISTERED: 11005,
  AUTH_PHONE_INVALID: 11006,
  AUTH_INVALID_ROLE: 11007,
  AUTH_SESSION_EXPIRED: 11008,

  // ========== 用户模块 12xxx ==========
  USER_NOT_FOUND: 12001,
  USER_ALREADY_EXISTS: 12002,
  USER_PERMISSION_DENIED: 12003,
  USER_DISABLED: 12004,

  // ========== 课程模块 13xxx ==========
  COURSE_NOT_FOUND: 13001,
  COURSE_FORBIDDEN: 13002,
  COURSE_INVALID_STATUS: 13003,
  COURSE_REVIEW_FORBIDDEN: 13004,
  COURSE_TOGGLE_FORBIDDEN: 13005,
  COURSE_DELETE_FORBIDDEN: 13006,
  COURSE_DUPLICATE: 13007,
  COURSE_PUBLISH_FORBIDDEN: 13008,

  // ========== 程序文件模块 14xxx ==========
  PROGRAM_NOT_FOUND: 14001,
  PROGRAM_DUPLICATE: 14002,
  PROGRAM_UPLOAD_FAILED: 14003,

  // ========== 教学资源模块 15xxx ==========
  RESOURCE_NOT_FOUND: 15001,
  RESOURCE_ACCESS_DENIED: 15002,

  // ========== 培训模块 16xxx ==========
  TRAINING_NOT_FOUND: 16001,
  TRAINING_ALREADY_ENROLLED: 16002,
  TRAINING_FULL: 16003,

  // ========== AI 模型模块 17xxx ==========
  MODEL_NOT_FOUND: 17001,
  MODEL_TRAINING: 17002,
  MODEL_TRAIN_FAILED: 17003,

  // ========== 设备模块 18xxx ==========
  DEVICE_NOT_FOUND: 18001,
  DEVICE_OFFLINE: 18002,
  DEVICE_CONNECT_FAILED: 18003,
  DEVICE_BUSY: 18004,

  // ========== 反馈/帮助模块 19xxx ==========
  FEEDBACK_NOT_FOUND: 19001,
  HELP_NOT_FOUND: 19501,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP 状态码与业务错误码映射 */
export const HTTP_STATUS: Record<number, number> = {
  200: ErrorCode.SUCCESS,
  400: ErrorCode.INVALID_PARAMS,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  405: ErrorCode.METHOD_NOT_ALLOWED,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.RATE_LIMIT,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.UPSTREAM_ERROR,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

/**
 * 业务异常类
 * 抛出后会被 withApi 统一捕获并返回标准 JSON 响应
 */
export class ApiError extends Error {
  public readonly code: number;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: number, message: string, options?: { httpStatus?: number; details?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = options?.httpStatus ?? 400;
    this.details = options?.details;
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  /**
   * 400 业务参数错误
   */
  static badRequest(message: string, code: number = ErrorCode.INVALID_PARAMS, details?: unknown) {
    return new ApiError(code, message, { httpStatus: 400, details });
  }

  /**
   * 401 未登录
   */
  static unauthorized(message: string = '未登录或登录已过期', code: number = ErrorCode.UNAUTHORIZED) {
    return new ApiError(code, message, { httpStatus: 401 });
  }

  /**
   * 403 权限不足
   */
  static forbidden(message: string = '无权访问该资源', code: number = ErrorCode.FORBIDDEN) {
    return new ApiError(code, message, { httpStatus: 403 });
  }

  /**
   * 404 资源不存在
   */
  static notFound(message: string = '资源不存在', code: number = ErrorCode.NOT_FOUND) {
    return new ApiError(code, message, { httpStatus: 404 });
  }

  /**
   * 409 资源冲突
   */
  static conflict(message: string, code: number = ErrorCode.CONFLICT) {
    return new ApiError(code, message, { httpStatus: 409 });
  }

  /**
   * 500 内部错误
   */
  static internal(message: string = '服务器内部错误', code: number = ErrorCode.INTERNAL_ERROR, cause?: unknown) {
    return new ApiError(code, message, { httpStatus: 500, cause });
  }

  /**
   * 405 方法不允许
   */
  static methodNotAllowed(message: string = 'HTTP 方法不被允许', code: number = ErrorCode.METHOD_NOT_ALLOWED) {
    return new ApiError(code, message, { httpStatus: 405 });
  }

  /**
   * 501 未实现（占位接口使用）
   */
  static notImplemented(message: string = '该功能尚未实现', code: number = ErrorCode.SERVICE_UNAVAILABLE) {
    return new ApiError(code, message, { httpStatus: 501 });
  }
}
