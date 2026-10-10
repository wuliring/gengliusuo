import {env} from "cloudflare:workers";
import seeds from "@/data/seed.json";
import {categories,recordSchema,searchText,type Meme,type StoredMeme,type ArchiveQuery} from "./records";
type Row={id:string;body:string;revision:number;updated_at:string;views:number};
export class ArchiveError extends Error {constructor(message:string,public status=503){super(message);}}
export function database():D1Database {const db=env.DB as D1Database|undefined;if(!db)throw new ArchiveError("档案库暂时无法连接，请稍后再试。");return db;}
function decode(row:Row):StoredMeme{return {...recordSchema.parse(JSON.parse(row.body)),revision:row.revision,updatedAt:row.updated_at,views:row.views};}
export async function initializeArchive(){
 const db=database();
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(seeds.map(record=>record.id).sort().join("\n")));
 const seedKey="corpus-"+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
 if(await db.prepare("SELECT value FROM settings WHERE key=?1").bind(seedKey).first())return db;
 const stamp=new Date().toISOString();
 const statements=seeds.map(seed=>{const r=recordSchema.parse({...seed,status:"published"});return db.prepare("INSERT INTO records (id,body,name,category,year,status,search_text,revision,views,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,1,0,?8,?8) ON CONFLICT(id) DO NOTHING").bind(r.id,JSON.stringify(r),r.name,r.category,r.year,r.status,searchText(r),stamp);});
 statements.push(db.prepare("INSERT INTO revisions (record_id,version,body,updated_at) SELECT id,revision,body,updated_at FROM records WHERE NOT EXISTS (SELECT 1 FROM revisions WHERE record_id=records.id AND version=records.revision)"));
 statements.push(db.prepare("INSERT INTO settings (key,value) VALUES (?1,?2) ON CONFLICT(key) DO NOTHING").bind(seedKey,stamp));await db.batch(statements);return db;
}
const initialized=initializeArchive;
export async function listRecords(query:ArchiveQuery={},admin=false){
 const db=await initialized(),conditions:string[]=[],bindings:(string|number)[]=[];
 const add=(sql:string,value:string|number)=>{bindings.push(value);conditions.push(sql.replace("?",`?${bindings.length}`));};
 if(!admin)add("status=?","published");else if(["draft","published","archived"].includes(query.status??""))add("status=?",query.status!);
 if(categories.includes(query.category as typeof categories[number]))add("category=?",query.category!);
 if(/^\d{4}$/.test(query.year??""))add("year=?",Number(query.year));
 const q=(query.q??"").slice(0,100).normalize("NFKC").toLowerCase().trim();
 for(const term of q.split(/\s+/).filter(Boolean).slice(0,8))add("search_text LIKE ? ESCAPE '\\'",`%${term.replace(/[\\%_]/g,c=>`\\${c}`)}%`);
 const where=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
 const order=query.sort==="oldest"?"year IS NULL,year ASC,name ASC":query.sort==="reads"?"views DESC,name ASC":query.sort==="updated"?"updated_at DESC,id ASC":"year IS NULL,year DESC,name ASC";
 const size=admin?100:24,total=(await db.prepare(`SELECT COUNT(*) AS total FROM records ${where}`).bind(...bindings).first<{total:number}>())?.total??0;
 const pages=Math.max(1,Math.ceil(total/size)),page=Math.max(1,Math.min(pages,Math.floor(query.page??1)||1));
 const result=await db.prepare(`SELECT id,body,revision,updated_at,views FROM records ${where} ORDER BY ${order} LIMIT ?${bindings.length+1} OFFSET ?${bindings.length+2}`).bind(...bindings,size,(page-1)*size).all<Row>();
 return {records:result.results.map(decode),total,page,pages,q};
}
export async function archiveStats(){const db=await initialized();const grouped=await db.prepare("SELECT category,COUNT(*) AS count FROM records WHERE status='published' GROUP BY category").all<{category:string;count:number}>();const years=await db.prepare("SELECT DISTINCT year FROM records WHERE status='published' AND year IS NOT NULL ORDER BY year DESC").all<{year:number}>();return {counts:Object.fromEntries(grouped.results.map(r=>[r.category,r.count])),total:grouped.results.reduce((s,r)=>s+r.count,0),years:years.results.map(r=>r.year)};}
export async function getRecord(id:string,admin=false){const db=await initialized();const row=await db.prepare(`SELECT id,body,revision,updated_at,views FROM records WHERE id=?1 ${admin?"":"AND status='published'"}`).bind(id).first<Row>();return row?decode(row):null;}
export async function getPublishedByIds(input:string[]):Promise<StoredMeme[]>{
 const ids=[...new Set(input)].filter(id=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&id.length<=80).slice(0,500);
 if(!ids.length)return [];
 const db=await initialized(),found=new Map<string,StoredMeme>();
 for(let start=0;start<ids.length;start+=80){const group=ids.slice(start,start+80),placeholders=group.map((_,index)=>`?${index+1}`).join(","),result=await db.prepare(`SELECT id,body,revision,updated_at,views FROM records WHERE status='published' AND id IN (${placeholders})`).bind(...group).all<Row>();for(const row of result.results)found.set(row.id,decode(row));}
 return ids.flatMap(id=>found.has(id)?[found.get(id)!]:[]);
}
export async function saveRecord(r:Meme,expected:number|null){
 const db=await initialized(),stamp=new Date().toISOString(),body=JSON.stringify(r);
 if(expected===null){if(await getRecord(r.id,true))throw new ArchiveError("这个档案地址已存在，请换一个地址。",409);await db.batch([
 db.prepare("INSERT INTO records (id,body,name,category,year,status,search_text,revision,views,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,1,0,?8,?8)").bind(r.id,body,r.name,r.category,r.year,r.status,searchText(r),stamp),
 db.prepare("INSERT INTO revisions (record_id,version,body,updated_at) VALUES (?1,1,?2,?3)").bind(r.id,body,stamp)]);
 }else{const result=await db.batch([
 db.prepare("UPDATE records SET body=?1,name=?2,category=?3,year=?4,status=?5,search_text=?6,revision=revision+1,updated_at=?7 WHERE id=?8 AND revision=?9").bind(body,r.name,r.category,r.year,r.status,searchText(r),stamp,r.id,expected),
 db.prepare("INSERT INTO revisions (record_id,version,body,updated_at) SELECT id,revision,body,updated_at FROM records WHERE id=?1 AND revision=?2 AND updated_at=?3 ON CONFLICT(record_id,version) DO NOTHING").bind(r.id,expected+1,stamp)]);
 if(!result[0].meta.changes)throw new ArchiveError("这份档案已有新版本。当前输入仍在，请先另开页面查看最新版本，再合并修改。",409);}
 return getRecord(r.id,true);
}
export async function history(id:string){const db=await initialized();return(await db.prepare("SELECT version,body,updated_at FROM revisions WHERE record_id=?1 ORDER BY version DESC LIMIT 50").bind(id).all<{version:number;body:string;updated_at:string}>()).results.map(r=>({version:r.version,updatedAt:r.updated_at,record:recordSchema.parse(JSON.parse(r.body))}));}
export async function exportRecords(){const db=await initialized();return {format:"gengliusuo-archive",formatVersion:1,exportedAt:new Date().toISOString(),records:(await db.prepare("SELECT id,body,revision,updated_at,views FROM records ORDER BY id").all<Row>()).results.map(decode)};}
export async function importRecords(records:Meme[]){const db=await initialized(),stamp=new Date().toISOString();const operations:D1PreparedStatement[]=[];for(const original of records){const r={...original,status:"draft" as const};operations.push(db.prepare("INSERT INTO records (id,body,name,category,year,status,search_text,revision,views,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'draft',?6,1,0,?7,?7) ON CONFLICT(id) DO NOTHING").bind(r.id,JSON.stringify(r),r.name,r.category,r.year,searchText(r),stamp));operations.push(db.prepare("INSERT INTO revisions (record_id,version,body,updated_at) SELECT id,revision,body,updated_at FROM records WHERE id=?1 AND created_at=?2 AND revision=1 ON CONFLICT(record_id,version) DO NOTHING").bind(r.id,stamp));}const results=await db.batch(operations);const imported=results.reduce((sum,result,i)=>i%2===0?sum+result.meta.changes:sum,0);return {imported,skipped:records.length-imported};}
export async function recordView(id:string,visitor:string){const db=await initialized(),day=new Date(Date.now()+28800000).toISOString().slice(0,10);const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${visitor}:${day}`));const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");await db.batch([
 db.prepare("INSERT INTO visits (record_id,visitor,day) SELECT id,?2,?3 FROM records WHERE id=?1 AND status='published' ON CONFLICT(record_id,visitor,day) DO NOTHING").bind(id,hash,day),
 db.prepare("UPDATE records SET views=(SELECT COUNT(*) FROM visits WHERE record_id=?1) WHERE id=?1 AND status='published'").bind(id)]);return(await db.prepare("SELECT views FROM records WHERE id=?1 AND status='published'").bind(id).first<{views:number}>())?.views??0;}
