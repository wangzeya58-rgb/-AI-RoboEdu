import { ApiError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { getAuthSessionFromRequest } from "@/lib/auth/server-session";

export const runtime = "nodejs";

export const GET = withApi((request) => {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    throw ApiError.unauthorized();
  }

  return {
    id: session.userId,
    username: session.username,
    name: session.name,
    phone: session.username,
    role: session.role,
    createdAt: new Date(session.issuedAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}, { methods: ["GET"] });

