import {z} from "zod";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {boundedJson,requireSameOrigin} from "./admin-auth";
import {ArchiveError,initializeArchive,getPublishedByIds} from "./archive-db";
import {READER_ENTRY_LIMIT,readerEmptyBodySchema,type ReaderEntry,type ReaderLibrary,type ReaderPatch,type ReaderMergeResult} from "./reader-types";

type ReaderRow={record_id:string;favorite:number;favorited_at:string|null;is_read:number;read_at:string|null;last_visited_at:string|null};
type TargetRow={status:string;owned:number;total:number};
const readerColumns="record_id,favorite,favorited_at,is_read,read_at,last_visited_at";
const limitMessage="个人记录已达到 500 条上限。请先移除不需要的记录，或清理仅含足迹的记录，再重试；未合并的游客记录仍可保留。";

export async function readerOwner():Promise<string|null>{
 const user=await getChatGPTUser();
 if(!user)return null;
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`gengliusuo-reader-v1:${user.userId}`));
 return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
}
export async function requireReaderOwner(req:Request){
 const owner=await readerOwner();
 if(!owner)throw new ArchiveError("请先使用 ChatGPT 登录，再保存到账号；本浏览器的游客记录仍然保留。",401);
 requireSameOrigin(req);
 return owner;
}
export function readerJson(value:unknown,status=200){return Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});}
export function readerRouteError(error:unknown){
 if(error instanceof z.ZodError){
  const issues=error.issues.map(issue=>({path:issue.path,message:/[\u4e00-\u9fff]/.test(issue.message)?issue.message:"提交字段缺失、超出限额或格式不正确，请按页面提示修改后重试。"}));
  return readerJson({error:[...new Set(issues.map(issue=>issue.message))].join("\n"),issues},400);
 }
 if(error instanceof ArchiveError)return readerJson({error:error.message},error.status);
 console.error("reader_request_failed");
 return readerJson({error:"暂时无法保存或读取个人记录。已有记录仍然保留，请稍后重试。"},503);
}
export async function readReaderEmptyBody(req:Request){
 const body=req.body?await boundedJson(req,1024):{};
 readerEmptyBodySchema.parse(body);
}
function entryFromRow(row:ReaderRow):ReaderEntry{
 return {id:row.record_id,favorite:row.favorite===1,favoritedAt:row.favorited_at,read:row.is_read===1,readAt:row.read_at,lastVisitedAt:row.last_visited_at};
}
function emptyEntry(id:string):ReaderEntry{return {id,favorite:false,favoritedAt:null,read:false,readAt:null,lastVisitedAt:null};}

export async function readerLibrary(owner:string|null):Promise<ReaderLibrary>{
 if(!owner)return {authenticated:false,entries:[],records:[]};
 const db=await initializeArchive();
 const rows=await db.prepare(`SELECT ${readerColumns} FROM reader_records WHERE owner_key=?1 ORDER BY COALESCE(last_visited_at,read_at,favorited_at,'') DESC,record_id ASC LIMIT ${READER_ENTRY_LIMIT}`).bind(owner).all<ReaderRow>();
 const entries=rows.results.map(entryFromRow);
 // Hidden references remain removable, while their unpublished content is never returned.
 const records=await getPublishedByIds(entries.map(entry=>entry.id));
 return {authenticated:true,entries,records};
}
function targetStatement(db:D1Database,owner:string,id:string){
 return db.prepare(`SELECT status,
  EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=?2) AS owned,
  (SELECT COUNT(*) FROM reader_records WHERE owner_key=?1) AS total
  FROM records WHERE id=?2`).bind(owner,id);
}
function cleanupStatement(db:D1Database,owner:string,id:string){
 return db.prepare("DELETE FROM reader_records WHERE owner_key=?1 AND record_id=?2 AND favorite=0 AND is_read=0 AND last_visited_at IS NULL").bind(owner,id);
}
function entryStatement(db:D1Database,owner:string,id:string){
 return db.prepare(`SELECT ${readerColumns} FROM reader_records WHERE owner_key=?1 AND record_id=?2`).bind(owner,id);
}
function requireWritableTarget(target:TargetRow|undefined,adding:boolean){
 if(!target||(target.status!=="published"&&(adding||!target.owned)))throw new ArchiveError("档案暂不可用，当前个人记录没有改变。",404);
}

export async function patchReaderEntry(owner:string,id:string,patch:ReaderPatch):Promise<ReaderEntry>{
 const db=await initializeArchive(),stamp=new Date().toISOString();
 const favorite=patch.favorite===undefined?null:Number(patch.favorite),read=patch.read===undefined?null:Number(patch.read);
 const adding=patch.favorite===true||patch.read===true;
 const results=await db.batch([
  targetStatement(db,owner,id),
  db.prepare(`INSERT INTO reader_records (owner_key,record_id,favorite,favorited_at,is_read,read_at,last_visited_at,updated_at)
   SELECT ?1,r.id,COALESCE(?3,0),CASE WHEN ?3=1 THEN ?5 ELSE NULL END,COALESCE(?4,0),CASE WHEN ?4=1 THEN ?5 ELSE NULL END,NULL,?5
   FROM records r WHERE r.id=?2
   AND (r.status='published' OR (?3 IS NOT 1 AND ?4 IS NOT 1 AND EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=?2)))
   AND (?3=1 OR ?4=1 OR EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=?2))
   AND (EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=?2) OR (SELECT COUNT(*) FROM reader_records WHERE owner_key=?1)<${READER_ENTRY_LIMIT})
   ON CONFLICT(owner_key,record_id) DO UPDATE SET
   favorite=COALESCE(?3,reader_records.favorite),
   favorited_at=CASE WHEN ?3 IS NULL THEN reader_records.favorited_at WHEN ?3=0 THEN NULL WHEN reader_records.favorite=1 THEN COALESCE(reader_records.favorited_at,?5) ELSE ?5 END,
   is_read=COALESCE(?4,reader_records.is_read),
   read_at=CASE WHEN ?4 IS NULL THEN reader_records.read_at WHEN ?4=0 THEN NULL WHEN reader_records.is_read=1 THEN COALESCE(reader_records.read_at,?5) ELSE ?5 END,
   updated_at=?5`).bind(owner,id,favorite,read,stamp),
  cleanupStatement(db,owner,id),
  entryStatement(db,owner,id),
 ]);
 const target=(results[0].results as TargetRow[])[0];
 requireWritableTarget(target,adding);
 if(!results[1].meta.changes&&adding&&!target!.owned)throw new ArchiveError(limitMessage,409);
 const row=(results[3].results as ReaderRow[])[0];
 return row?entryFromRow(row):emptyEntry(id);
}

export async function visitReaderEntry(owner:string,id:string):Promise<ReaderEntry>{
 const db=await initializeArchive(),stamp=new Date().toISOString();
 const results=await db.batch([
  targetStatement(db,owner,id),
  db.prepare(`INSERT INTO reader_records (owner_key,record_id,favorite,favorited_at,is_read,read_at,last_visited_at,updated_at)
   SELECT ?1,r.id,0,NULL,0,NULL,?3,?3 FROM records r WHERE r.id=?2 AND r.status='published'
   AND (EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=?2) OR (SELECT COUNT(*) FROM reader_records WHERE owner_key=?1)<${READER_ENTRY_LIMIT})
   ON CONFLICT(owner_key,record_id) DO UPDATE SET
   last_visited_at=CASE WHEN reader_records.last_visited_at IS NULL OR excluded.last_visited_at>reader_records.last_visited_at THEN excluded.last_visited_at ELSE reader_records.last_visited_at END,
   updated_at=excluded.updated_at`).bind(owner,id,stamp),
  entryStatement(db,owner,id),
 ]);
 const target=(results[0].results as TargetRow[])[0];
 requireWritableTarget(target,true);
 if(!results[1].meta.changes)throw new ArchiveError(limitMessage,409);
 const row=(results[2].results as ReaderRow[])[0];
 if(!row)throw new ArchiveError("本次足迹暂未保存，请稍后重试。",503);
 return entryFromRow(row);
}

export async function removeReaderEntry(owner:string,id:string){
 const db=await initializeArchive();
 await db.prepare("DELETE FROM reader_records WHERE owner_key=?1 AND record_id=?2").bind(owner,id).run();
}
export async function clearReaderHistory(owner:string):Promise<ReaderLibrary>{
 const db=await initializeArchive(),stamp=new Date().toISOString();
 await db.batch([
  db.prepare("UPDATE reader_records SET last_visited_at=NULL,updated_at=?2 WHERE owner_key=?1 AND last_visited_at IS NOT NULL").bind(owner,stamp),
  db.prepare("DELETE FROM reader_records WHERE owner_key=?1 AND favorite=0 AND is_read=0 AND last_visited_at IS NULL").bind(owner),
 ]);
 return readerLibrary(owner);
}

function canonicalDate(value:string|null){return value===null?null:new Date(value).toISOString();}
function newer(a:string|null,b:string|null){return a===null?b:b===null?a:a>b?a:b;}
function normalizeMergeEntries(entries:ReaderEntry[]){
 const unique=new Map<string,ReaderEntry>();
 for(const entry of entries){
  const next:ReaderEntry={id:entry.id,favorite:entry.favorite,favoritedAt:entry.favorite?canonicalDate(entry.favoritedAt):null,read:entry.read,readAt:entry.read?canonicalDate(entry.readAt):null,lastVisitedAt:canonicalDate(entry.lastVisitedAt)};
  const previous=unique.get(next.id);
  unique.set(next.id,previous?{id:next.id,favorite:previous.favorite||next.favorite,favoritedAt:newer(previous.favoritedAt,next.favoritedAt),read:previous.read||next.read,readAt:newer(previous.readAt,next.readAt),lastVisitedAt:newer(previous.lastVisitedAt,next.lastVisitedAt)}:next);
 }
 return [...unique.values()];
}
const mergeCte=`WITH incoming AS (
 SELECT json_extract(value,'$.id') AS record_id,json_extract(value,'$.favorite') AS favorite,
 json_extract(value,'$.favoritedAt') AS favorited_at,json_extract(value,'$.read') AS is_read,
 json_extract(value,'$.readAt') AS read_at,json_extract(value,'$.lastVisitedAt') AS last_visited_at
 FROM json_each(?2)
), public_entries AS (
 SELECT incoming.* FROM incoming JOIN records ON records.id=incoming.record_id WHERE records.status='published'
), eligible AS (
 SELECT * FROM public_entries WHERE favorite=1 OR is_read=1 OR last_visited_at IS NOT NULL
 OR EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=public_entries.record_id)
), capacity AS (
 SELECT ((SELECT COUNT(*) FROM reader_records WHERE owner_key=?1)+
 (SELECT COUNT(*) FROM eligible WHERE NOT EXISTS(SELECT 1 FROM reader_records WHERE owner_key=?1 AND record_id=eligible.record_id)))<=${READER_ENTRY_LIMIT} AS allowed
)`;
function mergeLatest(column:string){
 return `CASE WHEN reader_records.${column} IS NULL THEN excluded.${column} WHEN excluded.${column} IS NULL THEN reader_records.${column} ELSE MAX(reader_records.${column},excluded.${column}) END`;
}

export async function mergeReaderEntries(owner:string,entries:ReaderEntry[]):Promise<ReaderMergeResult>{
 const db=await initializeArchive();
 const unique=normalizeMergeEntries(entries);
 const published=await getPublishedByIds(unique.map(entry=>entry.id));
 const publishedIds=new Set(published.map(record=>record.id));
 const valid=unique.filter(entry=>publishedIds.has(entry.id));
 if(!valid.length)return {merged:0,skipped:entries.length,acceptedIds:[],library:await readerLibrary(owner)};
 const payload=JSON.stringify(valid),stamp=new Date().toISOString();
 // A single JSON binding keeps every statement below the parameter limit.
 // The INSERT checks the whole incoming set's capacity atomically, so it cannot partly fill an over-capacity batch.
 const results=await db.batch([
  db.prepare(`${mergeCte} SELECT allowed,(SELECT json_group_array(record_id) FROM public_entries) AS public_ids FROM capacity`).bind(owner,payload),
  db.prepare(`${mergeCte}
   INSERT INTO reader_records (owner_key,record_id,favorite,favorited_at,is_read,read_at,last_visited_at,updated_at)
   SELECT ?1,record_id,favorite,favorited_at,is_read,read_at,last_visited_at,?3 FROM eligible WHERE (SELECT allowed FROM capacity)=1
   ON CONFLICT(owner_key,record_id) DO UPDATE SET
   favorite=MAX(reader_records.favorite,excluded.favorite),favorited_at=${mergeLatest("favorited_at")},
   is_read=MAX(reader_records.is_read,excluded.is_read),read_at=${mergeLatest("read_at")},
   last_visited_at=${mergeLatest("last_visited_at")},
   updated_at=CASE WHEN excluded.favorite>reader_records.favorite OR excluded.is_read>reader_records.is_read
   OR (excluded.favorited_at IS NOT NULL AND (reader_records.favorited_at IS NULL OR excluded.favorited_at>reader_records.favorited_at))
   OR (excluded.read_at IS NOT NULL AND (reader_records.read_at IS NULL OR excluded.read_at>reader_records.read_at))
   OR (excluded.last_visited_at IS NOT NULL AND (reader_records.last_visited_at IS NULL OR excluded.last_visited_at>reader_records.last_visited_at))
   THEN excluded.updated_at ELSE reader_records.updated_at END
   RETURNING record_id`).bind(owner,payload,stamp),
 ]);
 const diagnostic=(results[0].results as {allowed:number;public_ids:string}[])[0];
 if(!diagnostic?.allowed)throw new ArchiveError(limitMessage,409);
 const returnedIds=new Set((results[1].results as {record_id:string}[]).map(row=>row.record_id));
 const publicIds=new Set<string>(JSON.parse(diagnostic.public_ids));
 const acceptedIds=valid.filter(entry=>publicIds.has(entry.id)&&(returnedIds.has(entry.id)||(!entry.favorite&&!entry.read&&entry.lastVisitedAt===null))).map(entry=>entry.id);
 if(valid.some(entry=>publicIds.has(entry.id)&&(entry.favorite||entry.read||entry.lastVisitedAt!==null)&&!returnedIds.has(entry.id)))throw new ArchiveError(limitMessage,409);
 return {merged:acceptedIds.length,skipped:entries.length-acceptedIds.length,acceptedIds,library:await readerLibrary(owner)};
}
