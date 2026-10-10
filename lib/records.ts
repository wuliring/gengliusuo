import { z } from "zod";
export const categories = ["人物与二创", "游戏圈", "弹幕语言", "生活情绪"] as const;
export const sourceTypes = ["原始素材", "代表二创", "平台记录", "媒体报道", "研究资料"] as const;
export const statuses = ["draft", "published", "archived"] as const;
const safeUrl = z.string().max(2000).url().refine(value => { try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } }, "来源链接需要使用 HTTPS，且不能含登录信息");
export const recordSchema = z.object({
  id: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "档案地址只使用小写字母、数字和连字符"),
  name: z.string().trim().min(1, "请填写梗名").max(60), aliases: z.array(z.string().trim().min(1).max(60)).max(20), category: z.enum(categories),
  period: z.string().trim().max(120), year: z.number().int().min(1990).max(2100).nullable(), summary: z.string().trim().max(240),
  definition: z.string().trim().max(12000), origin: z.string().trim().max(12000), spread: z.string().trim().max(12000),
  usage: z.array(z.string().trim().min(1).max(1000)).max(20), cautions: z.string().trim().max(4000), related: z.array(z.string().max(80)).max(20),
  sources: z.array(z.object({ title: z.string().trim().max(200), url: z.string().max(2000), type: z.enum(sourceTypes), note: z.string().max(1500) })).max(30),
  evidence: z.array(z.object({ label: z.string().trim().max(240), value: z.string().max(240).nullable(), period: z.string().max(120), sourceUrl: z.string().max(2000) })).max(20),
  status: z.enum(statuses).default("draft"),
}).superRefine((r,ctx) => { if (r.status !== "published") return;
  for (const f of ["summary","definition","origin","spread"] as const) if (!r[f]) ctx.addIssue({code:"custom",path:[f],message:"发布前请补全摘要、含义、来源和传播记录"});
  if (!r.sources.length || !r.evidence.length) ctx.addIssue({code:"custom",path:["sources"],message:"发布前至少添加一个来源和一项传播证据"});
  r.sources.forEach((s,i)=>{if(!s.title||!safeUrl.safeParse(s.url).success)ctx.addIssue({code:"custom",path:["sources",i],message:"发布前请补全来源标题和有效的 HTTPS 链接"});});
  r.evidence.forEach((s,i)=>{if(!s.label||!safeUrl.safeParse(s.sourceUrl).success)ctx.addIssue({code:"custom",path:["evidence",i],message:"发布前请补全传播证据名称和有效的 HTTPS 来源链接"});});
});
export type Meme = z.infer<typeof recordSchema>;
export type StoredMeme = Meme & {revision:number;updatedAt:string;views:number};
export type ArchiveQuery = {q?:string;category?:string;year?:string;sort?:string;page?:number;status?:string};
export const statusLabels = {draft:"草稿",published:"已发布",archived:"已归档"};
export function searchText(r:Meme) {return [r.name,...r.aliases,r.summary,r.definition,r.origin,r.spread,...r.usage].join(" ").normalize("NFKC").toLowerCase();}
export function cardTone(r:Meme) {return ({"人物与二创":"yellow","游戏圈":"blue","弹幕语言":"pink","生活情绪":"green"})[r.category];}
export function dateLabel(v:string) {return new Date(v).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});}
