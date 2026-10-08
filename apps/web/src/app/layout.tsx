import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { LanguageProvider } from "@/components/language-provider";
import { resolveLocale } from "@/lib/ui-copy";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "FeedbackPort",
  description: "A lightweight feedback platform for independent developers to collect ideas, gather votes, and manage feedback across products.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("accept-language"));

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} className={inter.variable}>
      <body className="font-sans">
        <LanguageProvider locale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
