"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionInfo } from "./client";

export function useCurrentSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    setSession(null);
    setError(null);
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch("/api/v1/auth/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null;
        const body = await response.json() as { success: boolean; data?: SessionInfo };
        if (!response.ok || !body.success || !body.data) throw new Error("读取登录状态失败，请重试。");
        return body.data;
      })
      .then((user) => { if (!controller.signal.aborted) setSession(user); })
      .catch(() => { if (!controller.signal.aborted) setError("读取登录状态失败，请重试。"); })
      .finally(() => { clearTimeout(timeout); if (!controller.signal.aborted) setReady(true); });
    // The timeout also needs a visible error; unmount cancellation must not update state.
    const onTimeout = () => { setError("读取登录状态超时，请重试。"); setReady(true); };
    controller.signal.addEventListener("abort", onTimeout, { once: true });
    window.addEventListener("al-session-change", retry);
    const onStorage = (event: StorageEvent) => { if (event.key === "al_session" || event.key === null) retry(); };
    window.addEventListener("storage", onStorage);
    return () => {
      controller.signal.removeEventListener("abort", onTimeout);
      clearTimeout(timeout);
      controller.abort();
      window.removeEventListener("al-session-change", retry);
      window.removeEventListener("storage", onStorage);
    };
  }, [revision, retry]);
  return { session, ready, error, retry };
}
