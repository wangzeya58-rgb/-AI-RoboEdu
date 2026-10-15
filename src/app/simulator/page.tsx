"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleStop,
  Gamepad2,
  Monitor,
  Play,
  RefreshCw,
  Save,
  Server,
  Square,
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
  getLatestOdom,
  getRosStatus,
  getSimulatorStatus,
  heartbeatSimulatorManualControl,
  type ManualControlAction,
  type OdomResponse,
  type RosStatusResponse,
  type SimulatorStatusResponse,
  startSimulatorManualControl,
  startSimulator,
  stopSimulatorManualControl,
  stopSimulator,
} from "@/lib/api/car-control";

const FALLBACK_CAR_API_BASE = "http://127.0.0.1:8000";
const STORAGE_KEY = "aerolark_car_api_base";
const HEARTBEAT_INTERVAL_MS = 250;
const STATUS_POLL_INTERVAL_MS = 1200;
const ODOM_POLL_INTERVAL_MS = 700;

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

type LogTone = "default" | "destructive";

interface LogEntry {
  id: number;
  time: string;
  title: string;
  detail?: string;
  tone: LogTone;
}

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

function formatNumber(value: unknown, digits = 3): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return numeric.toFixed(digits);
}

function getRecordValue(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  return (payload as Record<string, unknown>)[key];
}

function formatPayloadSummary(payload: unknown): string {
  if (payload === null || payload === undefined) return "无响应内容";
  if (typeof payload === "string") return payload;

  const lines: string[] = [];
  const success = getRecordValue(payload, "success");
  const message = getRecordValue(payload, "message");
  const baseUrl = getRecordValue(payload, "baseUrl");
  const running = getRecordValue(payload, "running");
  const mode = getRecordValue(payload, "mode");
  const pid = getRecordValue(payload, "pid");
  const cmdVelTopic = getRecordValue(payload, "cmd_vel_topic");
  const ros = getRecordValue(payload, "ros") as RosStatusResponse | undefined;
  const simulator = getRecordValue(payload, "simulator") as
    | SimulatorStatusResponse
    | undefined;

  if (typeof success === "boolean") {
    lines.push(`操作结果：${success ? "成功" : "失败"}`);
  }
  if (typeof message === "string" && message.trim()) {
    lines.push(`系统消息：${message}`);
  }
  if (typeof baseUrl === "string") {
    lines.push(`FastAPI 地址：${baseUrl}`);
  }
  if (typeof running === "boolean") {
    lines.push(`仿真器状态：${running ? "运行中" : "未启动"}`);
  }
  if (typeof mode === "string") {
    lines.push(`模式：${mode}`);
  }
  if (typeof cmdVelTopic === "string") {
    lines.push(`控制话题：${cmdVelTopic}`);
  }
  if (typeof pid === "number") {
    lines.push(`进程 PID：${pid}`);
  }
  if (ros) {
    lines.push(`ROS：${ros.ros_available ? "连接正常" : "待检测"}`);
  }
  if (simulator) {
    lines.push(`仿真器：${simulator.running ? "运行中" : "未启动"}`);
    if (simulator.cmd_vel_topic) {
      lines.push(`控制话题：${simulator.cmd_vel_topic}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "接口已返回，暂无可展示摘要";
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

export default function SimulatorPage() {
  const [baseUrlInput, setBaseUrlInput] = useState(FALLBACK_CAR_API_BASE);
  const [activeBaseUrl, setActiveBaseUrl] = useState(FALLBACK_CAR_API_BASE);
  const [activeAction, setActiveAction] = useState<ManualControlAction | null>(
    null,
  );
  const [rosStatus, setRosStatus] = useState<RosStatusResponse | null>(null);
  const [simulatorStatus, setSimulatorStatus] =
    useState<SimulatorStatusResponse | null>(null);
  const [odom, setOdom] = useState<OdomResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([
    {
      id: 1,
      time: "--:--:--",
      title: "等待连接",
      detail: "尚未调用仿真器接口。",
      tone: "default",
    },
  ]);
  const heartbeatTimerRef = useRef<number | null>(null);
  const activeActionRef = useRef<ManualControlAction | null>(null);
  const controlGenerationRef = useRef(0);
  const pendingStartRef = useRef<Promise<unknown> | null>(null);
  const controlBaseUrlRef = useRef(activeBaseUrl);
  const activeBaseUrlRef = useRef(activeBaseUrl);
  const odomStampRef = useRef<number | null>(null);
  const logEntryIdRef = useRef(1);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const logAutoScrollRef = useRef(true);
  const logShouldScrollRef = useRef<boolean | null>(null);
  const logDidMountRef = useRef(false);

  function isLogNearBottom() {
    const scrollEl = logScrollRef.current;
    if (!scrollEl) return true;

    const distanceToBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    return distanceToBottom < 64;
  }

  const appendLog = useCallback(
    (title: string, detail?: string, tone: LogTone = "default") => {
      logShouldScrollRef.current = isLogNearBottom();
      const timestamp = new Date().toLocaleTimeString();
      logEntryIdRef.current += 1;
      const nextEntry: LogEntry = {
        id: logEntryIdRef.current,
        time: timestamp,
        title,
        detail,
        tone,
      };

      setLogEntries((prev) => {
        const base = prev.length === 1 && prev[0].time === "--:--:--" ? [] : prev;
        return [...base, nextEntry].slice(-80);
      });
    },
    [],
  );

  const reportSuccess = useCallback((title: string, payload: unknown) => {
    appendLog(title, formatPayloadSummary(payload));
  }, [appendLog]);

  const reportError = useCallback((title: string, error: unknown) => {
    appendLog(
      title,
      error instanceof Error ? error.message : String(error),
      "destructive",
    );
  }, [appendLog]);

  function handleLogScroll() {
    const scrollEl = logScrollRef.current;
    if (!scrollEl) return;

    const distanceToBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    logAutoScrollRef.current = distanceToBottom < 64;
  }

  useEffect(() => {
    if (!logDidMountRef.current) {
      logDidMountRef.current = true;
      return;
    }

    const shouldScroll =
      logShouldScrollRef.current ?? logAutoScrollRef.current;
    logShouldScrollRef.current = null;

    if (!shouldScroll) return;

    const scrollEl = logScrollRef.current;
    if (!scrollEl) return;

    window.requestAnimationFrame(() => {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      logAutoScrollRef.current = true;
    });
  }, [logEntries]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const stopCurrentControl = useCallback(async () => {
    controlGenerationRef.current += 1;
    const action = activeActionRef.current;
    if (!action) return;

    clearHeartbeat();
    activeActionRef.current = null;
    setActiveAction(null);

    try {
      appendLog("系统", `收到停止指令\n控制动作：${actionLabels[action]}`);
      const baseUrl = controlBaseUrlRef.current;
      // A release must stop after an in-flight start, never before it.
      await pendingStartRef.current?.catch(() => undefined);
      const result = await stopSimulatorManualControl(baseUrl);
      appendLog("系统状态", formatPayloadSummary(result));
    } catch (error) {
      appendLog(
        "系统",
        `停止指令发送失败\n${
          error instanceof Error ? error.message : String(error)
        }`,
        "destructive",
      );
      reportError("停止仿真控制失败", error);
    }
  }, [appendLog, clearHeartbeat, reportError]);

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
    return () => {
      void stopCurrentControl();
    };
  }, [stopCurrentControl]);

  useEffect(() => {
    let cancelled = false;

    async function pollStatus() {
      try {
        const [ros, simulator] = await Promise.all([
          getRosStatus(activeBaseUrlRef.current),
          getSimulatorStatus(activeBaseUrlRef.current),
        ]);
        if (!cancelled) {
          setRosStatus(ros);
          setSimulatorStatus(simulator);
        }
      } catch {
        if (!cancelled) {
          setRosStatus(null);
          setSimulatorStatus(null);
        }
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

    async function pollOdom() {
      try {
        const result = await getLatestOdom(activeBaseUrlRef.current);
        if (!cancelled) {
          setOdom(result);
          if (result.success && result.available && result.stamp) {
            const previousStamp = odomStampRef.current;
            if (previousStamp !== result.stamp) {
              odomStampRef.current = result.stamp;
              appendLog(
                "机器人状态",
                `odom 更新\nstamp=${formatNumber(result.stamp, 3)} x=${formatNumber(
                  result.position?.x,
                )} y=${formatNumber(result.position?.y)} oz=${formatNumber(
                  result.orientation?.z,
                )} ow=${formatNumber(result.orientation?.w)}`,
              );
            }
          }
        }
      } catch {
        if (!cancelled) setOdom(null);
      }
    }

    void pollOdom();
    const timer = window.setInterval(pollOdom, ODOM_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appendLog]);

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
      const [ros, simulator] = await Promise.all([
        getRosStatus(nextBaseUrl),
        getSimulatorStatus(nextBaseUrl),
      ]);
      setActiveBaseUrl(nextBaseUrl);
      activeBaseUrlRef.current = nextBaseUrl;
      setRosStatus(ros);
      setSimulatorStatus(simulator);
      reportSuccess("连接测试成功", { ros, simulator });
    } catch (error) {
      reportError("连接测试失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartSimulator() {
    setIsBusy(true);
    try {
      const result = await startSimulator(activeBaseUrlRef.current);
      setSimulatorStatus(result);
      reportSuccess("仿真器启动指令已发送", result);
    } catch (error) {
      reportError("启动仿真器失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStopSimulator() {
    setIsBusy(true);
    await stopCurrentControl();
    try {
      const result = await stopSimulator(activeBaseUrlRef.current);
      setSimulatorStatus(result);
      reportSuccess("仿真器已停止", result);
    } catch (error) {
      reportError("停止仿真器失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEmergencyStop() {
    if (!isSimulatorMode(simulatorStatus?.mode)) {
      reportError(
        "仿真器控制已禁用",
        "当前 FastAPI 未提供 FSGP 仿真器控制状态，仿真控制已禁用。",
      );
      return;
    }

    setIsBusy(true);
    await stopCurrentControl();
    try {
      const result = await stopSimulatorManualControl(activeBaseUrlRef.current);
      reportSuccess("停止运动指令已发送", result);
    } catch (error) {
      reportError("停止运动失败", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function startControl(action: ManualControlAction) {
    if (!isSimulatorMode(simulatorStatus?.mode)) {
      reportError(
        "仿真器控制已禁用",
        "当前 FastAPI 未提供 FSGP 仿真器控制状态，仿真控制已禁用。",
      );
      return;
    }

    if (activeActionRef.current === action) return;
    const previousStop = stopCurrentControl();
    const generation = ++controlGenerationRef.current;
    activeActionRef.current = action;
    const baseUrl = activeBaseUrlRef.current;
    controlBaseUrlRef.current = baseUrl;
    setActiveAction(action);

    try {
      await previousStop;
      if (controlGenerationRef.current !== generation) return;
      appendLog("控制指令", `${actionLabels[action]}\naction=${action}`);
      const pending = startSimulatorManualControl(action, baseUrl);
      pendingStartRef.current = pending;
      const result = await pending;
      if (pendingStartRef.current === pending) pendingStartRef.current = null;
      if (controlGenerationRef.current !== generation) return;
      appendLog(
        "系统状态",
        `控制指令已发送\n${formatPayloadSummary(result)}`,
      );

      clearHeartbeat();
      heartbeatTimerRef.current = window.setInterval(() => {
        void heartbeatSimulatorManualControl(action, baseUrl)
          .then(() => {})
          .catch((error) => {
            if (controlGenerationRef.current !== generation) return;
            appendLog(
              "系统",
              `控制心跳失败 action=${action}\n${
                error instanceof Error ? error.message : String(error)
              }`,
              "destructive",
            );
            reportError("仿真控制心跳失败", error);
            void stopCurrentControl();
          });
      }, HEARTBEAT_INTERVAL_MS);
    } catch (error) {
      if (controlGenerationRef.current !== generation) return;
      pendingStartRef.current = null;
      activeActionRef.current = null;
      setActiveAction(null);
      appendLog(
        "控制指令",
        `启动${actionLabels[action]}失败 action=${action}\n${
          error instanceof Error ? error.message : String(error)
        }`,
        "destructive",
      );
      reportError(`启动${actionLabels[action]}失败`, error);
    }
  }

  function handlePressStart(action: ManualControlAction) {
    void startControl(action);
  }

  function handlePressEnd() {
    void stopCurrentControl();
  }

  const simulatorRunning = Boolean(simulatorStatus?.running);
  const simulatorBackendConnected = Boolean(simulatorStatus);
  const odomAvailable = Boolean(odom?.success && odom.available);
  const cmdVelTopic = simulatorStatus?.cmd_vel_topic ?? "--";
  const simulatorModeReady = isSimulatorMode(simulatorStatus?.mode);
  const simulatorControlEnabled = simulatorModeReady && simulatorRunning;
  const modeLabel = simulatorBackendConnected
    ? simulatorModeReady
      ? "FSGP 仿真器"
      : "非仿真模式"
    : "Demo 模式";
  const latestLogTone = logEntries[logEntries.length - 1]?.tone ?? "default";

  const statusItems = [
    {
      label: "仿真后端",
      value: simulatorBackendConnected ? activeBaseUrl : "Demo 模式",
      tone: simulatorBackendConnected
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : "bg-amber-50 text-amber-700 border-amber-100",
      icon: Server,
    },
    {
      label: "仿真器",
      value: simulatorBackendConnected
        ? simulatorRunning
          ? "运行中"
          : "未启动"
        : "后端未连接",
      tone: simulatorRunning
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-50 text-slate-600 border-slate-200",
      icon: Monitor,
    },
    {
      label: "控制话题",
      value: cmdVelTopic,
      tone: "bg-violet-50 text-violet-700 border-violet-100",
      icon: Gamepad2,
    },
    {
      label: "当前模式",
      value: modeLabel,
      tone: simulatorModeReady
        ? "bg-violet-50 text-violet-700 border-violet-100"
        : "bg-amber-50 text-amber-700 border-amber-100",
      icon: Monitor,
    },
    {
      label: "ROS",
      value: rosStatus?.ros_available ? "连接正常" : "未连接",
      tone: rosStatus?.ros_available
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-50 text-slate-600 border-slate-200",
      icon: Wifi,
    },
    {
      label: "里程计",
      value: odomAvailable ? "有数据" : "暂无数据",
      tone: odomAvailable
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-slate-50 text-slate-600 border-slate-200",
      icon: RefreshCw,
    },
  ];

  return (
    <Layout activeMenu="/simulator">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-violet-50 text-violet-700">
                  <Monitor className="h-3.5 w-3.5" />
                  FSGP 仿真器
                </Badge>
                <span className="text-xs text-gray-500">
                  独立仿真控制 · /cmd_vel · /odom
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-950 sm:text-3xl">
                仿真器平台
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                可选连接仿真后端；未连接时默认展示 Demo 模式，不触发真实小车控制链路。
              </p>
            </div>

            <Button
              variant="destructive"
              size="lg"
              onClick={handleEmergencyStop}
              disabled={isBusy || !simulatorControlEnabled}
              className="h-12 w-full text-base font-semibold shadow-sm xl:w-40"
            >
              <CircleStop className="h-5 w-5" />
              急停
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
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

        {!simulatorBackendConnected && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Demo 模式 / 仿真后端未连接</AlertTitle>
            <AlertDescription>
              当前展示电脑未启动 FastAPI 或 ROS 仿真后端。页面保留控制台、状态卡片和里程计区域用于演示，控制按钮已禁用。
            </AlertDescription>
          </Alert>
        )}

        {simulatorBackendConnected && !simulatorModeReady && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>当前 FastAPI 未运行在仿真器模式</AlertTitle>
            <AlertDescription>
              当前页面的方向控制已禁用。请确认后端提供 /api/simulator/status，并使用独立仿真控制出口。
            </AlertDescription>
          </Alert>
        )}

        {simulatorBackendConnected && simulatorModeReady && (
          <Alert className="border-violet-200 bg-violet-50 text-violet-900">
            <AlertTitle>仿真器控制链路</AlertTitle>
            <AlertDescription>
              当前页面调用 /api/simulator/manual/*，发布到 {cmdVelTopic}；真实小车请在“控制平台”页面操作。
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5 text-blue-600" />
                  连接配置
                </CardTitle>
                <CardDescription>
                  仿真后端需要提供独立的 simulator 控制接口。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="simulator-api-base"
                    className="text-sm font-medium text-gray-700"
                  >
                    仿真后端地址
                  </label>
                  <Input
                    id="simulator-api-base"
                    value={baseUrlInput}
                    onChange={(event) => setBaseUrlInput(event.target.value)}
                    placeholder="http://127.0.0.1:8000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleSaveBaseUrl}>
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <Monitor className="h-5 w-5 text-blue-600" />
                  仿真器管理
                </CardTitle>
                <CardDescription>
                  后端连接后，网页可启动/停止 FSGP 仿真器。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-[#25D366] hover:bg-emerald-600"
                  onClick={handleStartSimulator}
                  disabled={isBusy || simulatorRunning || !simulatorBackendConnected}
                >
                  <Play className="h-4 w-4" />
                  启动仿真器
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStopSimulator}
                  disabled={isBusy || !simulatorBackendConnected}
                >
                  <Square className="h-4 w-4" />
                  停止仿真器
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gamepad2 className="h-5 w-5 text-blue-600" />
                      仿真器方向控制
                    </CardTitle>
                    <CardDescription>
                      仿真后端连接并启动后，持续发布仿真专用速度话题。
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-gray-50">
                    {!simulatorModeReady
                      ? "控制已禁用"
                      : !simulatorRunning
                        ? "仿真器未启动"
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
                          event.currentTarget.setPointerCapture(event.pointerId);
                          handlePressStart(item.action);
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerCancel={handlePressEnd}
                        onLostPointerCapture={handlePressEnd}
                        onMouseDown={() => {
                          if (!("PointerEvent" in window)) {
                            handlePressStart(item.action);
                          }
                        }}
                        onMouseUp={() => {
                          if (!("PointerEvent" in window)) {
                            handlePressEnd();
                          }
                        }}
                        onMouseLeave={() => {
                          if (!("PointerEvent" in window)) {
                            handlePressEnd();
                          }
                        }}
                        onTouchStart={(event) => {
                          if (!("PointerEvent" in window)) {
                            event.preventDefault();
                            handlePressStart(item.action);
                          }
                        }}
                        onTouchEnd={() => {
                          if (!("PointerEvent" in window)) {
                            handlePressEnd();
                          }
                        }}
                        onTouchCancel={() => {
                          if (!("PointerEvent" in window)) {
                            handlePressEnd();
                          }
                        }}
                        disabled={isBusy || !simulatorControlEnabled}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="col-start-2 row-start-2 h-20"
                    onClick={handleEmergencyStop}
                    disabled={isBusy || !simulatorControlEnabled}
                  >
                    停止
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  里程计状态
                </CardTitle>
                <CardDescription>
                  轮询 /api/odom/latest，展示 FSGP /odom 最新状态。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {odomAvailable ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-xs text-gray-500">x</div>
                      <div className="mt-1 text-lg font-semibold text-gray-950">
                        {formatNumber(odom?.position?.x)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-xs text-gray-500">y</div>
                      <div className="mt-1 text-lg font-semibold text-gray-950">
                        {formatNumber(odom?.position?.y)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-xs text-gray-500">orientation z / w</div>
                      <div className="mt-1 text-sm font-semibold text-gray-950">
                        {formatNumber(odom?.orientation?.z)} /{" "}
                        {formatNumber(odom?.orientation?.w)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-xs text-gray-500">vx / wz</div>
                      <div className="mt-1 text-sm font-semibold text-gray-950">
                        {formatNumber(odom?.linear_velocity?.x)} /{" "}
                        {formatNumber(odom?.angular_velocity?.z)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-slate-50 p-4 text-sm text-gray-500">
                    暂无里程计数据
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  运行日志
                </CardTitle>
                <CardDescription>
                  按时间记录仿真器、控制指令与 odom 更新事件。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant={latestLogTone} className="w-full min-w-0 py-3">
                  <AlertTitle>实验日志</AlertTitle>
                  <AlertDescription className="w-full min-w-0 justify-items-stretch">
                    <div
                      ref={logScrollRef}
                      onScroll={handleLogScroll}
                      className="mt-3 h-96 w-full min-w-0 overflow-y-auto rounded-md border bg-white p-3 font-mono text-xs leading-relaxed text-gray-700"
                    >
                      <div className="space-y-2">
                        {logEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="border-b border-gray-100 px-1 pb-2 last:border-b-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-gray-500">
                                {entry.time}
                              </span>
                              <span className="text-gray-700">
                                {entry.title}
                              </span>
                            </div>
                            {entry.detail && (
                              <div className="mt-1 whitespace-pre-wrap text-gray-700">
                                {entry.detail}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </Layout>
  );
}
