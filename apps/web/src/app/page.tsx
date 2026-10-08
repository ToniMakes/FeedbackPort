"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function HomePage() {
  const { copy } = useLanguage();
  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-6 sm:px-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">F</span>
        <span className="font-semibold tracking-tight">FeedbackPort</span>
      </header>
      <div className="shell page-enter flex flex-1 flex-col justify-center !py-16">
        <p className="eyebrow mb-5">{copy.homeEyebrow}</p>
        <h1 className="max-w-2xl text-4xl leading-tight sm:text-5xl">{copy.homeTitle}</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          {copy.homeDescription}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/board" className="btn-primary">
            {copy.homeBoard}
          </Link>
          <Link href="/login" className="btn-secondary">
            {copy.adminSignIn}
          </Link>
        </div>

        <p className="mt-12 text-sm text-slate-500">
          {copy.homeRoadmap}{" "}
          <a
            className="link"
            href="https://github.com/isToniLiu/feedbackport/blob/main/docs/ROADMAP.md"
          >
            docs/ROADMAP.md
          </a>{" "}
          {copy.homeRoadmapSuffix}
        </p>
      </div>
    </main>
  );
}
