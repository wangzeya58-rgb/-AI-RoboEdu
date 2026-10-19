"use client";

import { useEffect, useState } from "react";
import { Wifi, Usb, Radio, RefreshCw, Power, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Device {
  id: string;
  name: string;
  status: "simulated" | "offline";
  connectionType?: "usb" | "wifi" | "hotspot";
  ip?: string;
  port?: number;
}

const mockDevices: Device[] = [
  { id: "CAR-001", name: "智能小车-001", status: "offline" },
  { id: "CAR-002", name: "智能小车-002", status: "offline" },
  { id: "CAR-003", name: "智能小车-003", status: "offline" },
  { id: "CAR-004", name: "智能小车-004", status: "offline" },
];

export function DeviceConnection() {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [currentTime, setCurrentTime] = useState("--");
  const [notice, setNotice] = useState("示例设备列表，未进行真实设备探测。");
  useEffect(() => {
    const update = () => setCurrentTime(new Date().toLocaleString("zh-CN"));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConnect = (device: Device) => {
    setSelectedDevice(device);
    setShowConnectModal(true);
  };

  const handleConnectionType = async (type: "usb" | "wifi" | "hotspot") => {
    if (!selectedDevice) return;

    setConnecting(true);

    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id
          ? {
              ...d,
              status: "simulated",
              connectionType: type,
              ip: type === "usb" ? "USB" : "192.168.1.100",
              port: type === "usb" ? undefined : 8080,
            }
          : d
      )
    );

    setConnecting(false);
    setShowConnectModal(false);
    setSelectedDevice(null);
    setNotice("模拟连接已完成，未连接真实小车。真实状态请在控制平台检查。");
  };

  const handleDisconnect = async (device: Device) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === device.id
          ? { ...d, status: "offline", connectionType: undefined, ip: undefined, port: undefined }
          : d
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">设备连接管理</h2>
        <Button variant="outline" size="sm" onClick={() => { setDevices(mockDevices); setNotice(`已刷新示例设备列表（${new Date().toLocaleTimeString("zh-CN")}），未执行真实设备探测。`); }} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          刷新设备
        </Button>
      </div>

      <p role="status" className="text-sm text-amber-700">{notice}</p>
      {/* 设备列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm font-medium text-gray-600">{device.id}</div>
              <div
                className={`w-3 h-3 rounded-full ${
                  device.status === "simulated" ? "bg-amber-500" : "bg-gray-400"
                }`}
              />
            </div>

            <div className="font-medium text-gray-900 mb-2">{device.name}</div>

            {device.status === "simulated" && (
              <div className="text-xs text-gray-500 mb-3 space-y-1">
                <div className="flex items-center gap-1">
                  {device.connectionType === "usb" && <Usb className="h-3 w-3" />}
                  {device.connectionType === "wifi" && <Wifi className="h-3 w-3" />}
                  {device.connectionType === "hotspot" && <Radio className="h-3 w-3" />}
                  <span>
                    {device.connectionType === "usb" && "USB连接"}
                    {device.connectionType === "wifi" && `WiFi: ${device.ip}:${device.port}`}
                    {device.connectionType === "hotspot" && `热点: ${device.ip}:${device.port}`}
                  </span>
                </div>
              </div>
            )}

            <div
              className={`text-sm font-medium mb-3 ${
                device.status === "simulated" ? "text-amber-700" : "text-gray-500"
              }`}
            >
              {device.status === "simulated" ? "模拟已连接（非真实在线）" : "未模拟连接"}
            </div>

            <Button
              variant={device.status === "simulated" ? "outline" : "default"}
              size="sm"
              className="w-full"
              onClick={() =>
                device.status === "simulated"
                  ? handleDisconnect(device)
                  : handleConnect(device)
              }
            >
              {device.status === "simulated" ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  断开模拟
                </>
              ) : (
                <>
                  <Power className="h-3 w-3 mr-1" />
                  模拟连接
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>本区域仅演示设备连接流程，实际小车连接请使用控制平台。</p>
        <p>当前时间: {currentTime}</p>
      </div>

      {/* 连接方式选择弹窗 */}
      {showConnectModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">选择模拟连接方式</h3>
            <p className="text-sm text-gray-600 mb-4">
              为 {selectedDevice.name} 选择连接方式
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleConnectionType("usb")}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Usb className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">USB有线连接</div>
                  <div className="text-xs text-gray-500">通过USB数据线直接连接小车</div>
                </div>
              </button>

              <button
                onClick={() => handleConnectionType("wifi")}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Wifi className="h-5 w-5 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">WiFi无线连接</div>
                  <div className="text-xs text-gray-500">通过局域网WiFi连接小车</div>
                </div>
              </button>

              <button
                onClick={() => handleConnectionType("hotspot")}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Radio className="h-5 w-5 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">热点连接</div>
                  <div className="text-xs text-gray-500">连接小车开启的热点网络</div>
                </div>
              </button>
            </div>

            {connecting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                正在连接...
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConnectModal(false);
                  setSelectedDevice(null);
                }}
                disabled={connecting}
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
