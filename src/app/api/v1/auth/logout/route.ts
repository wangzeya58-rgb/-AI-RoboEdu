import { cookies } from "next/headers";
import { withApi } from "@/lib/api/handler";
import { buildExpiredAuthCookie } from "@/lib/auth/server-session";

export const runtime = "nodejs";

export const POST = withApi(async () => {
  const cookieStore = await cookies();
  cookieStore.set(buildExpiredAuthCookie());
  return { loggedOut: true };
}, { methods: ["POST"] });
