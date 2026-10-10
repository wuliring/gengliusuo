import {listRecords} from "@/lib/archive-db";
import {publicSiteOrigin} from "@/lib/public-url";

export const dynamic = "force-dynamic";

const entities: Record<string, string> = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"};

function escapeXml(value: string): string {
  const clean = Array.from(value).filter(character => {
    const point = character.codePointAt(0)!;
    return point === 0x9 || point === 0xa || point === 0xd ||
      (point >= 0x20 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) ||
      (point >= 0x10000 && point <= 0x10ffff);
  }).join("");
  return clean.replace(/[&<>"']/g, character => entities[character]);
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function GET(request: Request) {
  try {
    const {records} = await listRecords({sort: "updated", page: 1});
    const origin = publicSiteOrigin();
    const homeUrl = new URL("/", origin).href;
    const feedUrl = new URL("/feed.xml", origin).href;
    const latest = records.reduce<Date | null>((current, record) => {
      const date = validDate(record.updatedAt);
      return date && (!current || date.getTime() > current.getTime()) ? date : current;
    }, null);
    const items = records.map(record => {
      const link = new URL(`/meme/${encodeURIComponent(record.id)}`, origin).href;
      const date = validDate(record.updatedAt);
      return [
        "<item>",
        `<title>${escapeXml(record.name)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="false">${escapeXml(`urn:gengliusuo:meme:${encodeURIComponent(record.id)}:revision:${record.revision}`)}</guid>`,
        `<description>${escapeXml(record.summary)}</description>`,
        `<category>${escapeXml(record.category)}</category>`,
        ...(date ? [`<pubDate>${escapeXml(date.toUTCString())}</pubDate>`] : []),
        "</item>",
      ].join("\n");
    });
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "<channel>",
      "<title>梗留所 · 最近修订</title>",
      `<link>${escapeXml(homeUrl)}</link>`,
      "<description>最近修订的已发布热梗档案，每份档案仅提供当前版本摘要与正文链接。</description>",
      "<language>zh-CN</language>",
      `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
      ...(latest ? [`<lastBuildDate>${escapeXml(latest.toUTCString())}</lastBuildDate>`] : []),
      ...items,
      "</channel>",
      "</rss>",
    ].join("\n");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(xml));
    const etag = `"${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")}"`;
    const headers = {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "ETag": etag,
    };
    const condition = request.headers.get("if-none-match");
    if (condition?.split(",").some(value => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag)) {
      return new Response(null, {status: 304, headers});
    }
    return new Response(xml, {headers});
  } catch (error) {
    console.error("archive_feed_failed", error);
    return new Response("RSS 暂时无法读取，请稍后重试。", {
      status: 503,
      headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60", "X-Content-Type-Options": "nosniff"},
    });
  }
}
