/**
 * Supabase 客户端封装（服务端）
 * 通过环境变量读取连接信息，统一管理连接
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.COZE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.COZE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

/** 懒加载服务端 Supabase 客户端（使用 service role 绕过 RLS） */
let _serviceClient: SupabaseClient | null = null;
export function getSupabaseServiceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service env not configured (COZE_SUPABASE_URL / COZE_SUPABASE_SERVICE_ROLE_KEY)');
  }
  if (!_serviceClient) {
    _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _serviceClient;
}

/** 懒加载匿名 Supabase 客户端（用于读取公共数据） */
let _anonClient: SupabaseClient | null = null;
export function getSupabaseAnonClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase anon env not configured');
  }
  if (!_anonClient) {
    _anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _anonClient;
}

/** 当前会话的客户端（带 user id 模拟身份） */
export function getSupabaseAsUser(userId: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-user-id': userId } },
  });
}
