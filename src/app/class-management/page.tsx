"use client";
import Layout from "@/components/Layout";
import { BookOpen } from "lucide-react";

const tests = [{
    name: "Python基础测验",
    date: "2024-01-20",
    type: "在线试卷",
    status: "未开始"
}, {
    name: "视觉算法考核",
    date: "2024-01-25",
    type: "实操考核",
    status: "未开始"
}, {
    name: "模型训练测试",
    date: "2024-01-15",
    type: "在线试卷",
    status: "未开始"
}];

const trainings = [{
    name: "智能小车入门培训",
    enrolled: false,
    progress: 0,
    hours: 24
}, {
    name: "计算机视觉实训",
    enrolled: false,
    progress: 0,
    hours: 32
}, {
    name: "强化学习专项",
    enrolled: false,
    progress: 0,
    hours: 16
}];

export default function ClassManagementPage() {
    return (
        <Layout activeMenu="/class-management">
            {}
            <header
                className="px-12 pt-8 pb-6 border-b"
                style={{
                    borderColor: "#E5E7EB"
                }}>
                <h2
                    className="text-2xl font-bold"
                    style={{
                        color: "#151E2B"
                    }}>实训班级管理
                                                </h2>
                <p className="mt-2 text-sm text-amber-700">以下测验与培训为示例数据，报名和考核尚未开放。</p>
                <p
                    className="text-sm mt-1"
                    style={{
                        color: "#6B7280"
                    }}>班级信息、学员管理与考核培训
                                                </p>
            </header>
            {}
            <section className="px-12 py-6">
                <h3
                    className="text-base font-semibold mb-4"
                    style={{
                        color: "#151E2B"
                    }}>考察测验
                                                </h3>
                <div
                    className="rounded-lg overflow-hidden"
                    style={{
                        backgroundColor: "white"
                    }}>
                    <table className="w-full">
                        <thead>
                            <tr
                                style={{
                                    backgroundColor: "#F9FAFB"
                                }}>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium"
                                    style={{
                                        color: "#6B7280"
                                    }}>测验名称
                                                                                        </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium"
                                    style={{
                                        color: "#6B7280"
                                    }}>类型
                                                                                        </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium"
                                    style={{
                                        color: "#6B7280"
                                    }}>日期
                                                                                        </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium"
                                    style={{
                                        color: "#6B7280"
                                    }}>状态
                                                                                        </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium"
                                    style={{
                                        color: "#6B7280"
                                    }}>操作
                                                                                        </th>
                            </tr>
                        </thead>
                        <tbody>
                            {tests.map((test, idx) => <tr
                                key={idx}
                                className="border-t"
                                style={{
                                    borderColor: "#E5E7EB"
                                }}>
                                <td
                                    className="px-4 py-3 text-sm font-medium"
                                    style={{
                                        color: "#151E2B"
                                    }}>
                                    {test.name}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className="px-2 py-1 rounded text-xs"
                                        style={{
                                            backgroundColor: test.type === "在线试卷" ? "#E8F4FD" : "#FEF3C7",
                                            color: test.type === "在线试卷" ? "#2386FF" : "#F59E0B"
                                        }}>
                                        {test.type}
                                    </span>
                                </td>
                                <td
                                    className="px-4 py-3 text-sm"
                                    style={{
                                        color: "#6B7280"
                                    }}>{test.date}（示例）
                                                                    </td>
                                <td className="px-4 py-3">
                                    <span
                                        className="flex items-center gap-1 text-xs"
                                        style={{
                                            color: "#F59E0B"
                                        }}>{test.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        className="px-3 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                                        style={{
                                            backgroundColor: "#2386FF",
                                            color: "white"
                                        }} disabled>进入测试（尚未开放）
                                                                            </button>
                                </td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </section>
            {}
            <section
                className="px-12 py-6 border-t"
                style={{
                    borderColor: "#E5E7EB"
                }}>
                <h3
                    className="text-base font-semibold mb-4"
                    style={{
                        color: "#151E2B"
                    }}>我的培训
                                                </h3>
                <div className="space-y-3">
                    {trainings.map((train, idx) => <div
                        key={idx}
                        className="rounded-lg p-4 flex items-center justify-between transition-all hover:shadow"
                        style={{
                            backgroundColor: "white",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                        }}>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{
                                    backgroundColor: train.enrolled ? "#D1FAE5" : "#F3F4F6"
                                }}>
                                <BookOpen
                                    className="w-5 h-5"
                                    style={{
                                        color: train.enrolled ? "#10B981" : "#9CA3AF"
                                    }} />
                            </div>
                            <div>
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: "#151E2B"
                                    }}>
                                    {train.name}
                                </p>
                                <p
                                    className="text-xs mt-1"
                                    style={{
                                        color: "#9CA3AF"
                                    }}>共{train.hours}课时
                                                                                          </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {train.enrolled ? <>
                                <div className="text-right">
                                    <p
                                        className="text-xs"
                                        style={{
                                            color: "#6B7280"
                                        }}>学习进度
                                                                                                      </p>
                                    <p
                                        className="text-sm font-semibold"
                                        style={{
                                            color: "#2386FF"
                                        }}>
                                        {train.progress}%
                                                                                                      </p>
                                </div>
                                <button
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: "#2386FF",
                                        color: "white"
                                    }} disabled>继续学习（尚未开放）
                                                                                            </button>
                            </> : <button
                                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50"
                                style={{
                                    borderColor: "#D1D5DB",
                                    color: "#374151"
                                }} disabled>立即报名（尚未开放）
                                                                                  </button>}
                        </div>
                    </div>)}
                </div>
            </section>
            {}
            <footer
                className="px-12 py-6 border-t"
                style={{
                    borderColor: "#E5E7EB"
                }}>
                <p
                    className="text-xs"
                    style={{
                        color: "#9CA3AF"
                    }}>示例培训数据，尚未接入教务系统。
                                                </p>
            </footer>
        </Layout>
    );
}
