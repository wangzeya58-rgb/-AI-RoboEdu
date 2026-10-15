"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { ElementType } from "react";
import { Video, FileText, BookOpen, Image, ChevronRight, AlertCircle, GraduationCap } from "lucide-react";
import {
    getCourseAssetBlob,
    listTeacherCourses,
    type CourseAsset,
    type CourseAssetType,
} from "@/lib/course/teacher-course-store";

interface Resource {
    id: string;
    name: string;
    type: string;
    icon: ElementType;
    count: string;
    href?: string;
    uploadedAsset?: CourseAsset;
    courseTitle?: string;
}

const UPLOADED_ASSET_ICON: Record<CourseAssetType, ElementType> = {
    presentation: FileText,
    document: BookOpen,
    image: Image,
    video: Video,
};

function UploadedAssetPreview({ asset }: { asset: CourseAsset }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;

        if (asset.type !== "image" && asset.type !== "video") return undefined;

        getCourseAssetBlob(asset.id).then((blob) => {
            if (!active || !blob) return;
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
        });

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [asset.id, asset.type]);

    if (asset.type === "image" && url) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={asset.name} className="h-full w-full object-cover" />
        );
    }

    if (asset.type === "video" && url) {
        return <video src={url} controls className="h-full w-full object-cover" />;
    }

    const Icon = UPLOADED_ASSET_ICON[asset.type];
    return <Icon className="w-5 h-5" style={{ color: "#2386FF" }} />;
}

export default function TeachingResourcesGrid() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        function loadResources(showLoading: boolean) {
            if (showLoading) setLoading(true);

            const builtInResources: Resource[] = [{
                id: "course-ai-car-face-docking-01",
                name: "AI小车认识与识人停靠",
                type: "互动课程",
                icon: GraduationCap,
                count: "第一课",
                href: "/course/player?courseId=ai-car-face-docking-01"
            }, {
                id: "1",
                name: "智能小车入门教程",
                type: "视频课件",
                icon: Video,
                count: "12课时"
            }, {
                id: "2",
                name: "Python编程基础手册",
                type: "PDF教案",
                icon: FileText,
                count: "86页"
            }, {
                id: "3",
                name: "RoboMaster实训手册",
                type: "实训手册",
                icon: BookOpen,
                count: "完整版"
            }, {
                id: "4",
                name: "代码示例素材包",
                type: "配套素材",
                icon: Image,
                count: "128个文件"
            }];

            listTeacherCourses()
                .then((courses) => {
                    if (cancelled) return;

                    const uploadedResources = courses
                        .filter((course) => course.resources.length > 0)
                        .map((course) => {
                            const previewAsset =
                                course.resources.find((asset) => asset.type === "image" || asset.type === "video") ??
                                course.resources[0];

                            return {
                                id: course.id,
                                name: course.title,
                                type: "自建课程",
                                icon: UPLOADED_ASSET_ICON[previewAsset.type],
                                count: `${course.resources.length} 个课程文件`,
                                href: `/course/player?courseId=${course.id}`,
                                uploadedAsset: previewAsset,
                                courseTitle: course.title,
                            };
                        });

                    setResources([...uploadedResources, ...builtInResources]);
                })
                .catch(() => {
                    if (!cancelled) setResources(builtInResources);
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }

        setLoading(true);

        const timer = setTimeout(() => {
            loadResources(false);
        }, 600);

        function handleAssetsUpdated() {
            loadResources(false);
        }

        window.addEventListener("course-assets-updated", handleAssetsUpdated);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            window.removeEventListener("course-assets-updated", handleAssetsUpdated);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div
                    className="flex items-center gap-3"
                    style={{
                        color: "#6B7280"
                    }}>
                    <div
                        className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                        style={{
                            borderColor: "#2386FF",
                            borderTopColor: "transparent"
                        }} />
                    <span className="text-sm">加载中...</span>
                </div>
            </div>
        );
    }

    if (resources.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center py-20"
                style={{
                    color: "#9CA3AF"
                }}>
                <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">暂无教学资源</p>
                <p className="text-xs mt-1">当前没有可用的教学资源</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-4 gap-4">
            {resources.map(res => {
                const Icon = res.icon;
                const card = (
                    <div
                        className="rounded-lg p-4 transition-all hover:shadow-lg cursor-pointer h-full"
                        style={{
                            backgroundColor: "white",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                        }}>
                        <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 overflow-hidden ${
                                res.uploadedAsset?.type === "video" ? "w-full h-28" : ""
                            }`}
                            style={{
                                backgroundColor: "#F3F4F6"
                            }}>
                            {res.uploadedAsset ? (
                                <UploadedAssetPreview asset={res.uploadedAsset} />
                            ) : (
                                <Icon
                                    className="w-5 h-5"
                                    style={{
                                        color: "#2386FF"
                                    }} />
                            )}
                        </div>
                        <p
                            className="text-sm font-medium mb-1"
                            style={{
                                color: "#151E2B"
                            }}>
                            {res.name}
                        </p>
                        <p
                            className="text-xs mb-3"
                            style={{
                                color: "#9CA3AF"
                            }}>
                            {res.type} · {res.count}
                        </p>
                        <span
                            className="flex items-center gap-1 text-xs font-medium transition-all hover:gap-2"
                            style={{
                                color: "#2386FF"
                            }}>
                            {res.href ? "进入课程" : res.uploadedAsset ? "已上传" : "查看详情"}
                            <ChevronRight className="w-3 h-3" />
                        </span>
                    </div>
                );

                return res.href ? (
                    <Link key={res.id} href={res.href}>
                        {card}
                    </Link>
                ) : (
                    <div key={res.id}>{card}</div>
                );
            })}
        </div>
    );
}
