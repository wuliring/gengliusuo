import type { Metadata } from "next";
import "./globals.css";
import {ReaderProvider} from "@/components/archive/reader-provider";
import {publicSiteOrigin} from "@/lib/public-url";

export const metadata: Metadata = {
  title: {default:"梗留所 · 中文互联网热梗档案馆",template:"%s · 梗留所"},
  description: "收留曾经刷屏的互联网记忆。读懂热梗的含义、来源、传播过程与代表作品，每份档案都保留出处和传播证据。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  alternates: {types:{"application/rss+xml":`${publicSiteOrigin()}/feed.xml`}},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><ReaderProvider>{children}</ReaderProvider></body>
    </html>
  );
}
