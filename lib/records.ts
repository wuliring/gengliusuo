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
  for (const f of ["summary","definition","origin","spread"] as const) if (!r[f]) ctx.addIssue({code:"custom",path:[f],message:"发布前请补全此项内容"});
  if (!r.sources.length) ctx.addIssue({code:"custom",path:["sources"],message:"发布前至少添加一个来源"});
  if (!r.evidence.length) ctx.addIssue({code:"custom",path:["evidence"],message:"发布前至少添加一项传播证据"});
  r.sources.forEach((s,i)=>{if(!s.title)ctx.addIssue({code:"custom",path:["sources",i,"title"],message:"发布前请填写来源标题"});if(!safeUrl.safeParse(s.url).success)ctx.addIssue({code:"custom",path:["sources",i,"url"],message:"发布前请填写有效的 HTTPS 链接，且不能含登录信息"});});
  r.evidence.forEach((s,i)=>{if(!s.label)ctx.addIssue({code:"custom",path:["evidence",i,"label"],message:"发布前请填写证据名称"});if(!safeUrl.safeParse(s.sourceUrl).success)ctx.addIssue({code:"custom",path:["evidence",i,"sourceUrl"],message:"发布前请填写有效的 HTTPS 来源链接，且不能含登录信息"});});
});
export type RecordIssue={path:(string|number)[];message:string};
const fieldLabels:Record<string,string>={id:"档案地址",name:"梗名",aliases:"别名",category:"分类",period:"流行时期与口径",year:"流行记录年份",summary:"一句话摘要",definition:"含义",origin:"来历",spread:"传播记录",usage:"用法示例",cautions:"读梗小注",related:"关联档案",sources:"来源",evidence:"传播证据",title:"标题",url:"来源链接",type:"来源类型",note:"来源说明",label:"证据名称",value:"数值或结果",sourceUrl:"证据链接",status:"状态",expectedRevision:"修订版本",format:"文件格式",formatVersion:"格式版本"};
export function formatRecordIssues(issues:z.ZodIssue[]):RecordIssue[]{return issues.map(issue=>{
 const path=issue.path[0]==="record"?issue.path.slice(1):issue.path,labels:string[]=[];
 for(let i=0;i<path.length;i++){const key=path[i];if(key==="records"&&typeof path[i+1]==="number"){labels.push(`第 ${Number(path[++i])+1} 份档案`);continue;}if(typeof key==="string"&&fieldLabels[key]){let label=fieldLabels[key];if(typeof path[i+1]==="number")label+=` ${Number(path[++i])+1}`;labels.push(label);}}
 let message=issue.message;
 if(issue.code==="too_big")message=issue.type==="array"?`最多 ${issue.maximum} 项，请减少后再保存。`:issue.type==="number"?`不能大于 ${issue.maximum}。`:`最多 ${issue.maximum} 字，请缩短后再保存。`;
 else if(issue.code==="too_small")message=issue.type==="array"?`至少需要 ${issue.minimum} 项。`:issue.type==="number"?`不能小于 ${issue.minimum}。`:`请填写内容（至少 ${issue.minimum} 字）。`;
 else if(issue.code==="invalid_type")message=issue.expected==="number"?"请填写有效的整数年份或留空。":"字段缺失或格式不正确，请重新填写。";
 else if(issue.code==="invalid_enum_value")message="请选择列表中的有效选项。";
 else if(issue.code==="invalid_literal")message="备份文件格式或版本不受支持。";
 else if(issue.code==="invalid_string"&&!/[\u4e00-\u9fff]/.test(message))message="格式不正确，请检查后重试。";
 return {path,message:`${labels.join(" · ")||"档案内容"}：${message}`};
});}
export function sourceHref(value:string):string|null {try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export type Meme = z.infer<typeof recordSchema>;
export type StoredMeme = Meme & {revision:number;updatedAt:string;views:number};
export type ArchiveQuery = {q?:string;category?:string;year?:string;sort?:string;page?:number;status?:string};
export const statusLabels = {draft:"草稿",published:"已发布",archived:"已归档"};
export function searchText(r:Meme) {return [r.name,...r.aliases,r.summary,r.definition,r.origin,r.spread,...r.usage].join(" ").normalize("NFKC").toLowerCase();}
export function cardTone(r:Meme) {return ({"人物与二创":"yellow","游戏圈":"blue","弹幕语言":"pink","生活情绪":"green"})[r.category];}
export function dateLabel(v:string) {return new Date(v).toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"});}
