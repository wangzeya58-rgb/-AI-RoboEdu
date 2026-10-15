import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, string } from "@/lib/api/validation";
import { verifyPassword } from "@/lib/auth/password";
import {
  buildAuthCookie,
  createAuthSession,
  serializeAuthSession,
} from "@/lib/auth/server-session";
import type { Role } from "@/lib/auth/roles";
import { getDatabase } from "@/storage/database/db";
import { users } from "@/storage/database/shared/schema";

export const runtime = "nodejs";

interface LoginBody {
  username: string;
  password: string;
}

export const POST = withApi(async (request) => {
  const body = await parseJson<LoginBody>(request, {
    username: required(string),
    password: required(string),
  });
  const username = body.username.trim();

  let matchedUser:
    | {
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: Role;
        createdAt: string;
      }
    | undefined;

  try {
    const db = getDatabase();
    matchedUser = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: {
        id: true,
        username: true,
        passwordHash: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  } catch (error) {
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "数据库尚未配置，正式登录暂不可用", {
      httpStatus: 503,
      cause: error,
    });
  }

  if (!matchedUser || !verifyPassword(body.password, matchedUser.passwordHash)) {
    throw ApiError.unauthorized("用户名或密码错误", ErrorCode.AUTH_INVALID_CREDENTIALS);
  }

  const session = createAuthSession({
    userId: matchedUser.id,
    username: matchedUser.username,
    name: matchedUser.name,
    role: matchedUser.role,
  });
  const cookieStore = await cookies();
  cookieStore.set(buildAuthCookie(serializeAuthSession(session)));

  return {
    id: matchedUser.id,
    username: matchedUser.username,
    name: matchedUser.name,
    phone: matchedUser.username,
    role: matchedUser.role,
    createdAt: matchedUser.createdAt,
  };
}, { methods: ["POST"] });
