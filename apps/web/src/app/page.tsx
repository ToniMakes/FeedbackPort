import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="shell text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-sm">
          F
        </div>
        <h1 className="text-3xl">FeedbackPort</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-500 dark:text-slate-400">
          面向独立开发者的多产品用户反馈管理系统——一个人，多个产品，一个统一收件箱。
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/board" className="btn-primary">
            公开面板
          </Link>
          <Link href="/login" className="btn-secondary">
            管理后台登录
          </Link>
        </div>

        <p className="mt-10 text-sm text-slate-400 dark:text-slate-500">
          进度见{" "}
          <a
            className="link"
            href="https://github.com/isToniLiu/feedbackport/blob/main/docs/ROADMAP.md"
          >
            docs/ROADMAP.md
          </a>{" "}
          的 Phase 0 checklist
        </p>
      </div>
    </main>
  );
}
