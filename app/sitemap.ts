import type {MetadataRoute} from "next";
import {archiveStats,database} from "@/lib/archive-db";
import {collections} from "@/lib/collections";
import {publicSiteOrigin} from "@/lib/public-url";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{await archiveStats();const rows=await database().prepare("SELECT id,updated_at FROM records WHERE status='published' ORDER BY updated_at DESC LIMIT 49980").all<{id:string;updated_at:string}>(),base=publicSiteOrigin();return [{url:base,changeFrequency:"weekly",priority:1},{url:`${base}/timeline`,changeFrequency:"weekly",priority:.7},{url:`${base}/collections`,changeFrequency:"weekly",priority:.8},{url:`${base}/updates`,changeFrequency:"daily",priority:.6},{url:`${base}/about`,changeFrequency:"monthly",priority:.5},...collections.map(collection=>({url:`${base}/collections/${collection.slug}`,changeFrequency:"weekly" as const,priority:.7})),...rows.results.map(r=>({url:`${base}/meme/${encodeURIComponent(r.id)}`,lastModified:r.updated_at,changeFrequency:"monthly" as const,priority:.8}))];}
