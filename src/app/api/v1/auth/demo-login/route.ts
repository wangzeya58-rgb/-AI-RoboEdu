import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, string } from "@/lib/api/validation";
import { findDemoUser, isDemoAuthAllowed } from "@/lib/auth/demo-users";
import {
  buildAuthCookie,
  createAuthSession,
  serializeAuthSession,
} from "@/lib/auth/server-session";

export const runtime = "nodejs";

interface DemoLoginBody {
  username: string;
  password: string;
}

export const POST = withApi(async (request) => {
  if (!isDemoAuthAllowed()) {
    throw ApiError.forbidden("当前环境未开启 Demo 登录。");
  }

  const body = await parseJson<DemoLoginBody>(request, {
    username: required(string),
    password: required(string),
  });
  const matched = findDemoUser(body.username, body.password);

  if (!matched) {
    throw ApiError.unauthorized("Demo 账号或密码错误。");
  }

  const session = {
    ...matched.session,
    createdAt: new Date().toISOString(),
  };
  const authSession = createAuthSession({
    userId: session.id,
    username: session.username,
    name: session.name,
    role: session.role,
  });
  const cookieStore = await cookies();
  cookieStore.set(buildAuthCookie(serializeAuthSession(authSession)));

  return session;
}, { methods: ["POST"] });

