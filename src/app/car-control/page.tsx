"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CircleStop,
  Gamepad2,
  Radar,
  RefreshCw,
  Save,
  Send,
  Server,
  Video,
  Wifi,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getLatestScan,
  getRosStatus,
  heartbeatManualControl,
  type LatestScan,
  type ManualControlAction,
  type RosStatusResponse,
  startManualControl,
  stopManualControl,
  stopRobot,
} from "@/lib/api/car-control";
import { normalizeScanPoints, projectScanPoint } from "@/lib/api/scan-view";
import { Switch } from "@/components/ui/switch";

const FALLBACK_CAR_API_BASE = "http://127.0.0.1:8000";
const STORAGE_KEY = "aerolark_car_api_base";
const HEARTBEAT_INTERVAL_MS = 600;
const SCAN_POLL_INTERVAL_MS = 1200;
const STATUS_POLL_INTERVAL_MS = 1500;
const quickAgentCommands = ["停止小车", "前进一点", "原地左转", "检查前方障碍"];

type AssistantMessage = {
  id: number;
  role: "user" | "system";
  content: string;
};

const actionLabels: Record<ManualControlAction, string> = {
  forward: "前进",
  backward: "后退",
  left: "左转",
  right: "右转",
};

const controlButtons: Array<{
  action: ManualControlAction;
  label: string;
  icon: typeof ArrowUp;
  className: string;
}> = [
  {
    action: "forward",
    label: "前进",
    icon: ArrowUp,
    className: "col-start-2 row-start-1",
  },
  {
    action: "left",
    label: "左转",
    icon: ArrowLeft,
    className: "col-start-1 row-start-2",
  },
  {
    action: "right",
    label: "右转",
    icon: ArrowRight,
    className: "col-start-3 row-start-2",
  },
  {
    action: "backward",
    label: "后退",
    icon: ArrowDown,
    className: "col-start-2 row-start-3",
  },
];

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "") || FALLBACK_CAR_API_BASE;
}

function resolveInitialBaseUrl(): string {
  if (typeof window === "undefined") return FALLBACK_CAR_API_BASE;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) return normalizeBaseUrl(saved);

  const runtimeConfig = (
    window as unknown as { __APP_CONFIG__?: { CAR_API_BASE?: string } }
  ).__APP_CONFIG__;

  return normalizeBaseUrl(runtimeConfig?.CAR_API_BASE ?? FALLBACK_CAR_API_BASE);
}

function buildCarUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function getModeLabel(mode?: string): string {
  if (isSimulatorMode(mode)) {
    return "FSGP 仿真器";
  }
  return "真实小车";
}

function isSimulatorMode(mode?: string): boolean {
  const normalized = mode?.trim().toLowerCase();
  return (
    normalized === "fsgp" ||
    normalized === "sim" ||
    normalized === "simulation" ||
    normalized === "fsgp_sim"
  );
}

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "无响应内容";
  if (typeof payload === "string") return payload;

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function ScanPreview({ scan, frontDegrees, displayRange }: {
  scan: LatestScan | null; frontDegrees: number; displayRange: number;
}) {
  const points = useMemo(() => normalizeScanPoints(scan), [scan]);

  return (
    <svg
      viewBox="-120 -120 240 240"
      className="h-full w-full rounded-lg border bg-slate-950"
      role="img"
      aria-label="雷达点云观察区域"
    >
      <circle cx="0" cy="0" r="38" fill="none" stroke="#334155" />
      <circle cx="0" cy="0" r="76" fill="none" stroke="#334155" />
      <circle cx="0" cy="0" r="114" fill="none" stroke="#334155" />
      <line x1="-116" y1="0" x2="116" y2="0" stroke="#1e293b" />
      <line x1="0" y1="-116" x2="0" y2="116" stroke="#1e293b" />
      <path d="M -12 14 L 0 -18 L 12 14 Z" fill="#2386FF" />
      <text x="0" y="-107" textAnchor="middle" fill="#cbd5e1" fontSize="8">前方</text>
      {[1, 2, 3].map((ring) => (
        <text key={ring} x="4" y={ring * 38 - 3} fill="#94a3b8" fontSize="8">
          {(displayRange * ring / 3).toFixed(1)} m
        </text>
      ))}
      {points.filter((point) => Math.hypot(point.x, point.y) <= displayRange).map((point, index) => {
        const { x, y } = projectScanPoint(point, frontDegrees, 114 / displayRange);
        return (
          <circle
            key={`${point.x}-${point.y}-${index}`}
            cx={x}
            cy={y}
            r="1.8"
            fill="#22c55e"
            opacity="0.9"
          />
        );
      })}
      {points.length === 0 && (
        <text
          x="0"
          y="48"
          textAnchor="middle"
          className="fill-slate-400 text-[10px]"
        >
          暂无雷达数据
        </text>
      )}
    </svg>
  );
}

export default function CarControlPage() {
  const [baseUrlInput, setBaseUrlInput] = useState(FALLBACK_CAR_API_BASE);
  const [activeBaseUrl, setActiveBaseUrl] = useState(FALLBACK_CAR_API_BASE);
  const [activeAction, setActiveAction] = useState<ManualControlAction | null>(
    null,
  );
  const [messageTitle, setMessageTitle] = useState("等待连接");
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const [logEntries, setLogEntries] = useState<string[]>([
    "[--:--:--] Demo 模式\n机器人控制主机未连接，页面可用于学校现场界面展示。",
  ]);
  const [agentInput, setAgentInput] = useState("");
  const [agentMessages, setAgentMessages] = useState<AssistantMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [scan, setScan] = useState<LatestScan | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanUpdatedAt, setScanUpdatedAt] = useState<string | null>(null);
  const [radarLive, setRadarLive] = useState(true);
  const [scanRefresh, setScanRefresh] = useState(0);
  const [frontDegrees, setFrontDegrees] = useState(180);
  const [displayRange, setDisplayRange] = useState(6);
  const [rosStatus, setRosStatus] = useState<RosStatusResponse | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const activeActionRef = useRef<ManualControlAction | null>(null);
  const activeBaseUrlRef = useRef(activeBaseUrl);
  const logContainerRef = useRef<HTMLPreElement | null>(null);
  const [autoScrollLog, setAutoScrollLog] = useState(true);

  useEffect(() => {
    const initialBaseUrl = resolveInitialBaseUrl();
    setBaseUrlInput(initialBaseUrl);
    setActiveBaseUrl(initialBaseUrl);
    activeBaseUrlRef.current = initialBaseUrl;
  }, []);

  useEffect(() => {
    activeBaseUrlRef.current = activeBaseUrl;
  }, [activeBaseUrl]);

  useEffect(() => {
    if (!autoScrollLog) return;

    const logContainer = logContainerRef.current;
    if (!logContainer) return;

    logContainer.scrollTop = logContainer.scrollHeight;
  }, [autoScrollLog, logEntries]);

  const reportSuccess = useCallback((title: string, payload: unknown) => {
    const body = formatPayload(payload);
    const timestamp = new Date().toLocaleTimeString();
    setMessageTone("default");
    setMessageTitle(title);
    setLogEntries((prev) => [
      ...prev,
      `[${timestamp}] ${title}\n${body}`,
    ].slice(-80));
  }, []);

  const reportError = useCallback((title: string, error: unknown) => {
    const body = error instanceof Error ? error.message : String(error);
    const timestamp = new Date().toLocaleTimeString();
    setMessageTone("destructive");
    setMessageTitle(title);
    setLogEntries((prev) => [
      ...prev,
      `[${timestamp}] ${title}\n${body}`,
    ].slice(-80));
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const stopCurrentControl = useCallback(async () => {
    const action = activeActionRef.current;
    if (!action) return;

    clearHeartbeat();
    activeActionRef.current = null;
    setActiveAction(null);

    try {
      const result = await stopManualControl(activeBaseUrlRef.current);
      reportSuccess(`已停止${actionLabels[action]}`, result);
    } catch (error) {
      reportError("停止手动控制失败", error);
    }
  }, [clearHeartbeat, reportError, reportSuccess]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        void stopCurrentControl();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stopCurrentControl);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stopCurrentControl);
      void stopCurrentControl();
    };
  }, [stopCurrentControl]);

  useEffect(() => {
    let cancelled = false;

    async function pollStatus() {
      try {
        const result = await getRosStatus(activeBaseUrlRef.current);
        if (!cancelled) setRosStatus(result);
      } catch {
        if (!cancelled) setRosStatus(null);
      }
    }

    void pollStatus();
    const timer = window.setInterval(pollStatus, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let timer: number | undefined;
    setScan(null);
    setScanUpdatedAt(null);

    async function pollScan() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      setScanLoading(true);
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 4000);
      try {
        const result = await getLatestScan(activeBaseUrl, controller.signal);
        if (!cancelled && !document.hidden) {
          setScan(result);
          setScanError(result.available === false || result.success === false
            ? result.message ?? "暂无雷达数据" : null);
          setScanUpdatedAt(new Date().toLocaleTimeString());
        }
      } catch (error) {
        if (!cancelled) {
          setScan(null);
          setScanError(error instanceof Error ? error.message : "雷达请求失败");
        }
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (!cancelled) setScanLoading(false);
      }
    }

    function syncVisibility() {
      window.clearInterval(timer);
      if (document.hidden) {
        controller?.abort();
        setScan(null);
      } else {
        void pollScan();
        if (radarLive) timer = window.setInterval(pollScan, SCAN_POLL_INTERVAL_MS);
      }
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [activeBaseUrl, radarLive, scanRefresh]);

  function handleSaveBaseUrl() {
    const nextBaseUrl = normalizeBaseUrl(baseUrlInput);
    window.localStorage.setItem(STORAGE_KEY, nextBaseUrl);
    setBaseUrlInput(nextBaseUrl);
    setActiveBaseUrl(nextBaseUrl);
    activeBaseUrlRef.current = nextBaseUrl;
    reportSuccess("已保存 FastAPI 地址", { baseUrl: nextBaseUrl });
  }

  async function handleTestConnection() {
    const nextBaseUrl = normalizeBaseUrl(baseUrlInput);
    setIsBusy(true);
    try {
      const result = await getRosStatus(nextBaseUrl);
      setActiveBaseUrl(nextBaseUrl);
      activeBaseUrlRef.current = nextBaseUrl;
      setRosStatus(result);
      reportSuccess("连接测试成功", result);
    } catch (error) {
      reportError("连接测试失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEmergencyStop() {
    setIsBusy(true);
    await stopCurrentControl();

    try {
      const result = await stopRobot(activeBaseUrlRef.current);
      reportSuccess("停止指令已发送", result);
    } catch (error) {
      reportError("停止指令失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function startControl(action: ManualControlAction) {
    if (activeActionRef.current === action) return;
    await stopCurrentControl();

    activeActionRef.current = action;
    setActiveAction(action);

    try {
      const result = await startManualControl(action, activeBaseUrlRef.current);
      reportSuccess(`开始${actionLabels[action]}`, result);

      clearHeartbeat();
      heartbeatTimerRef.current = window.setInterval(() => {
        void heartbeatManualControl(action, activeBaseUrlRef.current).catch(
          (error) => {
            reportError("手动控制心跳失败", error);
            void stopCurrentControl();
          },
        );
      }, HEARTBEAT_INTERVAL_MS);
    } catch (error) {
      activeActionRef.current = null;
      setActiveAction(null);
      reportError(`启动${actionLabels[action]}失败`, error);
    }
  }

  function handleAgentSend(command?: string) {
    const text = (command ?? agentInput).trim();
    if (!text) return;

    const timestamp = Date.now();
    setAgentMessages((prev) => [
      ...prev,
      { id: timestamp, role: "user", content: text },
    ]);
    setAgentInput("");
  }

  const videoStreamUrl = buildCarUrl(activeBaseUrl, "/api/video/stream");
  const controlHostConnected = Boolean(rosStatus?.ros_available);
  const currentMode = getModeLabel(rosStatus?.ros_control_mode);
  const cmdVelTopic = rosStatus?.cmd_vel_topic ?? "未连接";
  const statusItems = [
    {
      label: "控制主机",
      value: controlHostConnected ? activeBaseUrl : "Demo 模式",
      tone: controlHostConnected
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : "bg-amber-50 text-amber-700 border-amber-100",
      icon: Server,
    },
    {
      label: "ROS",
      value: controlHostConnected ? "连接正常" : "未连接",
      tone:
        controlHostConnected
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-slate-50 text-slate-600 border-slate-200",
      icon: Wifi,
    },
    {
      label: "模式",
      value: currentMode,
      tone:
        currentMode === "FSGP 仿真器"
          ? "bg-violet-50 text-violet-700 border-violet-100"
          : "bg-slate-50 text-slate-600 border-slate-200",
      icon: Gamepad2,
    },
    {
      label: "控制话题",
      value: cmdVelTopic,
      tone: "bg-slate-50 text-slate-600 border-slate-200",
      icon: Server,
    },
    {
      label: "视频",
      value: "MJPEG 监看",
      tone: "bg-slate-50 text-slate-600 border-slate-200",
      icon: Video,
    },
    {
      label: "雷达",
      value: scan ? `${normalizeScanPoints(scan).length} 点` : "Demo 占位",
      tone: scan
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-50 text-slate-600 border-slate-200",
      icon: Radar,
    },
    {
      label: "AI Agent",
      value: "助手",
      tone: "bg-blue-50 text-blue-700 border-blue-100",
      icon: Bot,
    },
  ];

  return (
    <Layout activeMenu="/car-control">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  实时控制
                </Badge>
                <span className="text-xs text-gray-500">
                  安全优先 · 长按控制 · 感知监看
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-950 sm:text-3xl">
                智能小车控制平台
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                可选连接实车控制主机；未连接时默认展示 Demo 模式，不影响平台演示。
              </p>
            </div>

            <Button
              variant="destructive"
              size="lg"
              onClick={handleEmergencyStop}
              disabled={isBusy || !controlHostConnected}
              className="h-12 w-full text-base font-semibold shadow-sm xl:w-40"
            >
              <CircleStop className="h-5 w-5" />
              停止
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {statusItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`min-w-0 rounded-lg border px-3 py-3 ${item.tone}`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {controlHostConnected ? (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertTitle>真实小车控制链路</AlertTitle>
            <AlertDescription>
              当前页面调用 /api/ros/manual/*，发布到 {cmdVelTopic}；FSGP 仿真器请在“仿真器”页面操作。
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Demo 模式 / 机器人控制主机未连接</AlertTitle>
            <AlertDescription>
              当前展示电脑未启动 FastAPI，也未连接机器人。控制、急停、视频和雷达会保持展示占位；连接实车控制主机并测试成功后可正常使用。
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          <section className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5 text-blue-600" />
                  连接配置
                </CardTitle>
                <CardDescription>
                  实车控制主机地址优先使用本地保存值。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="car-api-base"
                    className="text-sm font-medium text-gray-700"
                  >
                    控制主机地址
                  </label>
                  <Input
                    id="car-api-base"
                    value={baseUrlInput}
                    onChange={(event) => setBaseUrlInput(event.target.value)}
                    placeholder="http://127.0.0.1:8000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveBaseUrl}
                  >
                    <Save className="h-4 w-4" />
                    保存
                  </Button>
                  <Button
                    className="bg-[#2386FF] hover:bg-blue-600"
                    onClick={handleTestConnection}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4" />
                    )}
                    测试连接
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gamepad2 className="h-5 w-5 text-blue-600" />
                      手动控制
                    </CardTitle>
                    <CardDescription>
                      连接实车控制主机后，可使用方向按键控制小车移动。
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-gray-50">
                    {!controlHostConnected
                      ? "Demo 模式"
                      : activeAction
                        ? actionLabels[activeAction]
                        : "待命"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mx-auto grid max-w-[320px] grid-cols-3 grid-rows-3 gap-3">
                  {controlButtons.map((item) => {
                    const Icon = item.icon;
                    const pressed = activeAction === item.action;

                    return (
                      <Button
                        key={item.action}
                        type="button"
                        size="lg"
                        className={`${item.className} h-20 select-none touch-none ${
                          pressed
                            ? "bg-[#25D366] hover:bg-[#25D366]"
                            : "bg-[#2386FF] hover:bg-blue-600"
                        }`}
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                          void startControl(item.action);
                        }}
                        onPointerUp={() => void stopCurrentControl()}
                        onPointerCancel={() => void stopCurrentControl()}
                        onPointerLeave={() => void stopCurrentControl()}
                        disabled={isBusy || !controlHostConnected}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Button>
                    );
                  })}
                  <div className="col-start-2 row-start-2 flex items-center justify-center rounded-lg border bg-gray-50 text-xs font-medium text-gray-500">
                    {!controlHostConnected
                      ? "未连接"
                      : activeAction
                        ? actionLabels[activeAction]
                        : "待命"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  运行日志
                </CardTitle>
                <CardDescription>
                  持续保留控制接口返回和错误历史。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant={messageTone} className="py-3">
                  <AlertTitle>{messageTitle}</AlertTitle>
                  <AlertDescription>
                    <pre
                      ref={logContainerRef}
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        const distanceToBottom =
                          target.scrollHeight - target.scrollTop - target.clientHeight;
                        setAutoScrollLog(distanceToBottom < 24);
                      }}
                      className="mt-2 h-[360px] overflow-y-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs leading-relaxed text-gray-700"
                    >
                      {logEntries.join("\n\n")}
                    </pre>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-5">
            <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)]">
              <Card className="flex h-full flex-col shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Video className="h-5 w-5 text-blue-600" />
                    视频监看
                  </CardTitle>
                  <CardDescription className="truncate">
                    {controlHostConnected ? videoStreamUrl : "Demo 视频占位"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1">
                  <div className="aspect-video w-full overflow-hidden rounded-lg border bg-gray-950">
                    {controlHostConnected ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={videoStreamUrl}
                        alt="小车视频流"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-300">
                        <Video className="h-10 w-10 text-slate-500" />
                        <div>
                          <div className="text-sm font-medium text-white">Demo 模式</div>
                          <div className="mt-1 text-xs text-slate-400">
                            机器人控制主机未连接，视频流暂不加载。
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="flex h-full flex-col shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Radar className="h-5 w-5 text-blue-600" />
                    雷达观察
                  </CardTitle>
                  <CardDescription>{scan?.topic ?? "/scan"} · {scan?.frame_id ?? "未知坐标系"} · {scanError ? "未连接 / 数据不可用" : scanUpdatedAt ? "已接收" : "等待数据"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch checked={radarLive} onCheckedChange={setRadarLive} />实时更新
                    </label>
                    <Button variant="outline" size="sm" disabled={scanLoading} onClick={() => setScanRefresh((value) => value + 1)}>
                      <RefreshCw className={`h-4 w-4 ${scanLoading ? "animate-spin" : ""}`} />刷新雷达
                    </Button>
                    <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2">前方角度
                      <select className="max-w-full rounded border bg-background p-1" value={frontDegrees} onChange={(event) => setFrontDegrees(Number(event.target.value))}>
                        <option value={180}>180°（当前实车）</option><option value={0}>0°（标准安装）</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2">量程
                      <select className="rounded border bg-background p-1" value={displayRange} onChange={(event) => setDisplayRange(Number(event.target.value))}>
                        {[3, 6, 12].map((range) => <option key={range} value={range}>{range} m</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="aspect-video w-full">
                    <ScanPreview scan={scan} frontDegrees={frontDegrees} displayRange={displayRange} />
                  </div>
                  {scanError && <p role="alert" className="text-sm text-red-600">{scanError} · 请检查 FastAPI、ROS 雷达节点与 /scan</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>原始点数：{scan?.count ?? "--"}</span><span>采样步长：{scan?.sample_step ?? "--"}</span>
                    <span>有效点数：{normalizeScanPoints(scan).length}</span>
                    <span>传感器范围：{scan?.range_min ?? "--"}–{scan?.range_max ?? "--"} m</span>
                    <span>接收时间：{scanUpdatedAt ?? "--"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot className="h-5 w-5 text-blue-600" />
                      AI 控制助手
                    </CardTitle>
                    <CardDescription>自然语言控制入口</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-44 flex-col gap-3 overflow-y-auto rounded-lg border bg-slate-50 p-3">
                  {agentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[86%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm ${
                          message.role === "user"
                            ? "bg-[#2386FF] text-white"
                            : "border bg-white text-gray-600"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {quickAgentCommands.map((command) => (
                    <Button
                      key={command}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleAgentSend(command)}
                    >
                      {command}
                    </Button>
                  ))}
                </div>

                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleAgentSend();
                  }}
                >
                  <Input
                    value={agentInput}
                    onChange={(event) => setAgentInput(event.target.value)}
                    placeholder="输入自然语言控制指令"
                  />
                  <Button
                    type="submit"
                    className="shrink-0 bg-[#2386FF] hover:bg-blue-600"
                  >
                    <Send className="h-4 w-4" />
                    发送
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>

      </div>
    </Layout>
  );
}
