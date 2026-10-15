export type ManualControlAction = "forward" | "backward" | "left" | "right";
type BackendManualControlAction =
  | "forward"
  | "backward"
  | "rotate_left"
  | "rotate_right";

export interface ScanPoint {
  x: number;
  y: number;
  distance?: number;
  angle?: number;
}

export interface LatestScan {
  success?: boolean;
  available?: boolean;
  message?: string;
  topic?: string;
  frame_id?: string;
  count?: number;
  sample_step?: number;
  age?: number;
  points?: ScanPoint[];
  ranges?: Array<number | null | { angle: number; range: number | null }>;
  angle_min?: number;
  angle_max?: number;
  angle_increment?: number;
  range_min?: number;
  range_max?: number;
  [key: string]: unknown;
}

export interface RosStatusResponse {
  success: boolean;
  message?: string;
  ros_available?: boolean;
  ros_control_mode?: string;
  cmd_vel_topic?: string;
  last_action?: string;
  manual_active?: boolean;
  manual_action?: string | null;
  manual_last_heartbeat_age?: number | null;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface OdomResponse {
  success: boolean;
  available: boolean;
  message?: string;
  topic: "/odom" | string;
  stamp?: number;
  frame_id?: string;
  child_frame_id?: string;
  position?: Vector3;
  orientation?: Quaternion;
  linear_velocity?: Vector3;
  angular_velocity?: Vector3;
}

export interface SimulatorStatusResponse {
  success: boolean;
  running: boolean;
  mode: "fsgp" | string;
  message?: string;
  pid?: number | null;
  launch_command?: string;
  ros_control_mode?: string;
  cmd_vel_topic?: string;
}

export class CarControlError extends Error {
  public readonly status: number;
  public readonly raw: unknown;

  constructor(message: string, status: number, raw?: unknown) {
    super(message);
    this.name = "CarControlError";
    this.status = status;
    this.raw = raw;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function carControlFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(buildUrl(baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseResponse(response);

  if (!response.ok || (
    path.startsWith("/api/simulator/manual/") &&
    typeof body === "object" && body !== null &&
    "success" in body && body.success === false
  )) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : `请求失败 (HTTP ${response.status})`;
    throw new CarControlError(message, response.status, body);
  }

  return body as T;
}

function toBackendManualAction(
  action: ManualControlAction,
): BackendManualControlAction {
  if (action === "left") return "rotate_left";
  if (action === "right") return "rotate_right";
  return action;
}

export function getRosStatus(baseUrl: string) {
  return carControlFetch<RosStatusResponse>(baseUrl, "/api/ros/status");
}

export function stopRobot(baseUrl: string) {
  return carControlFetch<unknown>(baseUrl, "/api/ros/stop", {
    method: "POST",
  });
}

export function startManualControl(
  action: ManualControlAction,
  baseUrl: string,
) {
  return carControlFetch<unknown>(baseUrl, "/api/ros/manual/start", {
    method: "POST",
    body: JSON.stringify({ action: toBackendManualAction(action) }),
  });
}

export function heartbeatManualControl(
  action: ManualControlAction,
  baseUrl: string,
) {
  return carControlFetch<unknown>(baseUrl, "/api/ros/manual/heartbeat", {
    method: "POST",
    body: JSON.stringify({ action: toBackendManualAction(action) }),
  });
}

export function stopManualControl(baseUrl: string) {
  return carControlFetch<unknown>(baseUrl, "/api/ros/manual/stop", {
    method: "POST",
  });
}

export function startSimulatorManualControl(
  action: ManualControlAction,
  baseUrl: string,
) {
  return carControlFetch<unknown>(baseUrl, "/api/simulator/manual/start", {
    method: "POST",
    body: JSON.stringify({ action: toBackendManualAction(action) }),
  });
}

export function heartbeatSimulatorManualControl(
  action: ManualControlAction,
  baseUrl: string,
) {
  return carControlFetch<unknown>(baseUrl, "/api/simulator/manual/heartbeat", {
    method: "POST",
    body: JSON.stringify({ action: toBackendManualAction(action) }),
  });
}

export function stopSimulatorManualControl(baseUrl: string) {
  return carControlFetch<unknown>(baseUrl, "/api/simulator/manual/stop", {
    method: "POST",
  });
}

export function getLatestScan(baseUrl: string, signal?: AbortSignal) {
  return carControlFetch<LatestScan>(baseUrl, "/api/scan/latest", {
    signal, cache: "no-store",
  });
}

export function getLatestOdom(baseUrl: string) {
  return carControlFetch<OdomResponse>(baseUrl, "/api/odom/latest");
}

export function getSimulatorStatus(baseUrl: string) {
  return carControlFetch<SimulatorStatusResponse>(
    baseUrl,
    "/api/simulator/status",
  );
}

export function startSimulator(baseUrl: string) {
  return carControlFetch<SimulatorStatusResponse>(
    baseUrl,
    "/api/simulator/start",
    {
      method: "POST",
    },
  );
}

export function stopSimulator(baseUrl: string) {
  return carControlFetch<SimulatorStatusResponse>(
    baseUrl,
    "/api/simulator/stop",
    {
      method: "POST",
    },
  );
}
