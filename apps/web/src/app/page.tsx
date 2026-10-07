import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-6 sm:px-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">F</span>
        <span className="font-semibold tracking-tight">FeedbackPort</span>
      </header>
      <div className="shell page-enter flex flex-1 flex-col justify-center !py-16">
        <p className="eyebrow mb-5">Feedback for independent products</p>
        <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">多个产品的反馈，<br className="hidden sm:block" />在一个地方处理。</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          面向独立开发者的轻量反馈平台。收集用户想法、查看投票，并在统一收件箱里跟进每个产品。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/board" className="btn-primary">
            公开面板
          </Link>
          <Link href="/login" className="btn-secondary">
            管理后台登录
          </Link>
        </div>

        <p className="mt-12 text-sm text-slate-500">
          项目进度见{" "}
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
