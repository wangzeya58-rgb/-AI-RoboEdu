"use client";

const EVENT = "ai-roboedu-formal-courses-updated";
const CHANGE_SOURCE = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : `window-${Date.now()}-${Math.random()}`;

export function notifyFormalCoursesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(EVENT);
    channel.postMessage({ source: CHANGE_SOURCE });
    channel.close();
  }
}

export function subscribeFormalCourses(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(EVENT) : null;
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data === "object" && event.data !== null && "source" in event.data && event.data.source === CHANGE_SOURCE) return;
    listener();
  };
  return () => { window.removeEventListener(EVENT, listener); channel?.close(); };
}
