import type {MetadataRoute} from "next";
import {archiveStats,database} from "@/lib/archive-db";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{await archiveStats();const rows=await database().prepare("SELECT id,updated_at FROM records WHERE status='published' ORDER BY updated_at DESC LIMIT 49997").all<{id:string;updated_at:string}>(),base="https://gengliusuo-archive.yebai.chatgpt.site";return [{url:base,changeFrequency:"weekly",priority:1},{url:`${base}/timeline`,changeFrequency:"weekly",priority:.7},{url:`${base}/about`,changeFrequency:"monthly",priority:.5},...rows.results.map(r=>({url:`${base}/meme/${r.id}`,lastModified:r.updated_at,changeFrequency:"monthly" as const,priority:.8}))];}
