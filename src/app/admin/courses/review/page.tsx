import Link from "next/link";
import Layout from "@/components/Layout";

export default function CourseReviewPage() {
  return <Layout activeMenu="/admin"><div className="space-y-4 p-6">
    <h1 className="text-xl font-semibold">课程管理</h1>
    <p>教师可直接发布到自己的班级，当前不启用课程审核。</p>
    <Link href="/admin/courses" className="text-blue-600">返回课程管理</Link>
  </div></Layout>;
}
