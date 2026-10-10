"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import {requestJson,RequestError} from "@/lib/client-request";
import {readerEntrySchema,READER_ENTRY_LIMIT,type ReaderEntry,type ReaderLibrary,type ReaderMergeResult,type ReaderPatch} from "@/lib/reader-types";
import type {StoredMeme} from "@/lib/records";

const storageKey="gengliusuo:reader:guest:v1";
type ReaderContextValue={
 ready:boolean;authenticated:boolean;entries:ReaderEntry[];records:StoredMeme[];guestCount:number;busy:boolean;catalogLoading:boolean;error:string;
 refresh:()=>Promise<void>;patchRecord:(record:StoredMeme,patch:ReaderPatch)=>Promise<void>;visit:(record:StoredMeme)=>Promise<void>;
 remove:(id:string)=>Promise<void>;clearHistory:()=>Promise<void>;mergeGuest:()=>Promise<{merged:number;skipped:number}>;
 importGuestEntries:(entries:ReaderEntry[])=>Promise<void>;clearGuestEntries:()=>Promise<void>;
 getGuestEntries:()=>ReaderEntry[];
};
const ReaderContext=createContext<ReaderContextValue|null>(null);
const active=(entry:ReaderEntry)=>entry.favorite||entry.read||!!entry.lastVisitedAt;
const blankEntry=(id:string):ReaderEntry=>({id,favorite:false,favoritedAt:null,read:false,readAt:null,lastVisitedAt:null});
const latest=(a:string|null,b:string|null)=>!a?b:!b?a:Date.parse(a)>=Date.parse(b)?a:b;
const sameEntry=(a:ReaderEntry,b:ReaderEntry)=>a.id===b.id&&a.favorite===b.favorite&&a.favoritedAt===b.favoritedAt&&a.read===b.read&&a.readAt===b.readAt&&a.lastVisitedAt===b.lastVisitedAt;
function unionEntries(first:ReaderEntry[],second:ReaderEntry[]):ReaderEntry[]{
 const map=new Map(first.map(entry=>[entry.id,{...entry}]));
 for(const incoming of second){const current=map.get(incoming.id)??blankEntry(incoming.id);map.set(incoming.id,{id:incoming.id,favorite:current.favorite||incoming.favorite,favoritedAt:latest(current.favoritedAt,incoming.favoritedAt),read:current.read||incoming.read,readAt:latest(current.readAt,incoming.readAt),lastVisitedAt:latest(current.lastVisitedAt,incoming.lastVisitedAt)});}
 return [...map.values()].filter(active);
}
function validateEntries(value:unknown):ReaderEntry[]{
 if(!Array.isArray(value)||value.length>READER_ENTRY_LIMIT)throw new Error("档案夹记录格式有误，最多保留 500 份档案。");
 const entries:ReaderEntry[]=[];
 for(const item of value){const parsed=readerEntrySchema.safeParse(item);if(!parsed.success)throw new Error("档案夹中有无效的地址或记录时间，请检查文件和设备时间后重试。");const entry=parsed.data;entries.push({...entry,favoritedAt:entry.favorite?entry.favoritedAt:null,readAt:entry.read?entry.readAt:null});}
 return unionEntries([],entries);
}

export function ReaderProvider({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(false),[authenticated,setAuthenticated]=useState(false),[entries,setEntries]=useState<ReaderEntry[]>([]),[recordMap,setRecordMap]=useState(new Map<string,StoredMeme>()),[guestCount,setGuestCount]=useState(0),[busy,setBusy]=useState(false),[catalogLoading,setCatalogLoading]=useState(false),[error,setError]=useState("");
 const authRef=useRef<boolean|null>(null),entryRef=useRef<ReaderEntry[]>([]),guestRef=useRef<ReaderEntry[]>([]),locked=useRef(false),alive=useRef(true);
 const guestDisk=useRef<ReaderEntry[]>([]),guestChanges=useRef<((current:ReaderEntry[])=>ReaderEntry[])[]>([]),guestCorrupt=useRef(false);
 const sessionEpoch=useRef(0),needsIdentityRefresh=useRef(false),refreshRef=useRef<(()=>Promise<void>)|null>(null);
 const applyEntries=useCallback((next:ReaderEntry[])=>{entryRef.current=next;if(alive.current)setEntries(next);},[]);
 const readGuest=useCallback(()=>{
  try{const raw=localStorage.getItem(storageKey);if(!raw)guestDisk.current=[];else{const envelope=JSON.parse(raw);if(envelope?.format!=="gengliusuo-reader"||envelope.formatVersion!==1)throw new Error("format");guestDisk.current=validateEntries(envelope.entries);}guestCorrupt.current=false;}catch{guestCorrupt.current=true;setError("无法读取本浏览器的游客记录。原始存储不会被自动覆盖，新操作仅暂存于本页；请导出留底，或登录合并。需要重置时可明确清理游客记录。");}
  try{return guestChanges.current.reduce((current,change)=>change(current),guestDisk.current);}catch{setError("其他标签的新记录使本机合并超过容量。本页尚未保存的记录仍保留，请先导出，再清理或合并到账号。");return guestRef.current;}
 },[]);
 const publishGuest=useCallback((next:ReaderEntry[])=>{
  guestRef.current=next;setGuestCount(next.length);if(authRef.current===false)applyEntries(next);
 },[applyEntries]);
 const withGuestLock=useCallback(async<T,>(operation:()=>T|Promise<T>):Promise<T>=>{
  const task=()=>{guestRef.current=readGuest();return operation();};
  return navigator.locks?.request?navigator.locks.request(storageKey,{mode:"exclusive"},task):await task();
 },[readGuest]);
 const changeGuest=useCallback((change:(current:ReaderEntry[])=>ReaderEntry[])=>{
  const next=change(guestRef.current);
  try{if(guestCorrupt.current)throw new Error("unreadable");localStorage.setItem(storageKey,JSON.stringify({format:"gengliusuo-reader",formatVersion:1,entries:next}));guestDisk.current=next;guestChanges.current=[];}catch{guestChanges.current.push(change);setError("本机持久保存尚未完成。新状态仅暂存于本页，刷新载入也会保留本页增量；请在离开前导出，或登录后合并到账号。本机清理也可能尚未持久生效。");}
  publishGuest(next);
 },[publishGuest]);
 const applyLibrary=useCallback((library:ReaderLibrary)=>{
  if(!library||typeof library.authenticated!=="boolean"||!Array.isArray(library.records))throw new Error("服务器没有返回可读取的档案夹，请稍后重试。");
  const nextEntries=library.authenticated?validateEntries(library.entries):guestRef.current,nextRecords=new Map(library.records.filter(record=>record.status==="published").map(record=>[record.id,record]));
  authRef.current=library.authenticated;setAuthenticated(library.authenticated);applyEntries(nextEntries);setRecordMap(nextRecords);
  setReady(true);
 },[applyEntries]);
 const resetCloud=useCallback(()=>{authRef.current=null;setAuthenticated(false);setReady(false);applyEntries([]);setRecordMap(new Map());},[applyEntries]);
 const run=useCallback(async<T,>(operation:()=>Promise<T>):Promise<T>=>{
  if(locked.current)throw new Error("档案夹正在保存，请稍后再操作。");
  locked.current=true;setBusy(true);setError("");
  try{return await operation();}catch(cause){if(cause instanceof RequestError&&cause.status===401)resetCloud();const message=cause instanceof Error?cause.message:"档案夹操作未完成，请稍后重试。";if(alive.current)setError(message);throw new Error(message);}finally{locked.current=false;if(alive.current){setBusy(false);if(needsIdentityRefresh.current){resetCloud();if(document.visibilityState==="visible"){needsIdentityRefresh.current=false;void Promise.resolve().then(()=>{if(alive.current&&!locked.current)void refreshRef.current?.().catch(()=>{});});}}}}
 },[resetCloud]);
 const lookup=useCallback(async(ids:string[])=>{
  if(!ids.length)return;
  setCatalogLoading(true);
  try{const result=await requestJson<{records:StoredMeme[]}>("/api/archive/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})});if(!Array.isArray(result.records))throw new Error("档案资料暂时无法载入，请重试。");setRecordMap(current=>{const next=new Map(current);for(const id of ids)next.delete(id);for(const record of result.records)if(record.status==="published")next.set(record.id,record);return next;});}finally{if(alive.current)setCatalogLoading(false);}
 },[]);
 const refresh=useCallback(()=>run(async()=>{
  resetCloud();
  const local=readGuest();guestRef.current=local;setGuestCount(local.length);
  const library=await requestJson<ReaderLibrary>("/api/me/library");applyLibrary(library);
  if(!library.authenticated)await lookup(local.map(entry=>entry.id));
 }),[run,readGuest,applyLibrary,lookup,resetCloud]);
 refreshRef.current=refresh;
 useEffect(()=>{
  alive.current=true;void refresh().catch(()=>{});
  function changed(event:StorageEvent){if(event.key!==storageKey)return;const local=readGuest();guestRef.current=local;setGuestCount(local.length);if(authRef.current===false){applyEntries(local);void lookup(local.map(entry=>entry.id)).catch(cause=>setError(cause instanceof Error?cause.message:"本机档案资料未完成更新。"));}}
  function suspended(){sessionEpoch.current++;needsIdentityRefresh.current=true;}
  function focused(){if(document.visibilityState!=="visible"){suspended();return;}if(locked.current){needsIdentityRefresh.current=true;return;}needsIdentityRefresh.current=false;void refresh().catch(()=>{});}
  window.addEventListener("storage",changed);
  window.addEventListener("focus",focused);window.addEventListener("blur",suspended);document.addEventListener("visibilitychange",focused);
  return()=>{alive.current=false;window.removeEventListener("storage",changed);window.removeEventListener("focus",focused);window.removeEventListener("blur",suspended);document.removeEventListener("visibilitychange",focused);};
 },[refresh,readGuest,applyEntries,lookup]);
 function requireReady(){if(authRef.current===null)throw new Error("档案夹尚未载入，请先重试加载。");}
 function rememberRecord(record:StoredMeme){setRecordMap(current=>new Map(current).set(record.id,record));}
 function localEntry(current:ReaderEntry[],entry:ReaderEntry){let next=current.filter(item=>item.id!==entry.id);if(active(entry))next.push(entry);if(next.length>READER_ENTRY_LIMIT){const disposable=next.filter(item=>!item.favorite&&!item.read&&item.id!==entry.id).sort((a,b)=>Date.parse(a.lastVisitedAt??"")-Date.parse(b.lastVisitedAt??""))[0];if(disposable)next=next.filter(item=>item.id!==disposable.id);else throw new Error("本机档案夹已达到 500 份上限，请先移除一些记录。");}return next;}
 async function pullCloud(){resetCloud();const library=await requestJson<ReaderLibrary>("/api/me/library");applyLibrary(library);if(!library.authenticated)throw new Error("登录状态已改变，请重新登录后确认档案夹。");}
 const patchRecord=useCallback((record:StoredMeme,patch:ReaderPatch)=>run(async()=>{
  requireReady();
  if(authRef.current){const result=await requestJson<{entry:ReaderEntry}>(`/api/me/records/${encodeURIComponent(record.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});const entry=readerEntrySchema.parse(result.entry);if(entry.id!==record.id)throw new Error("保存结果与档案不一致，请刷新后重试。");await pullCloud();}else{const stamp=new Date().toISOString();await withGuestLock(()=>changeGuest(items=>{const current=items.find(entry=>entry.id===record.id)??blankEntry(record.id);return localEntry(items,{...current,...patch,favoritedAt:patch.favorite===undefined?current.favoritedAt:patch.favorite?current.favoritedAt??stamp:null,readAt:patch.read===undefined?current.readAt:patch.read?current.readAt??stamp:null});}));}
  rememberRecord(record);
 }),[run,withGuestLock,changeGuest]);
 const visit=useCallback((record:StoredMeme)=>run(async()=>{
  requireReady();
  if(authRef.current){const result=await requestJson<{entry:ReaderEntry}>(`/api/me/records/${encodeURIComponent(record.id)}/visit`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const entry=readerEntrySchema.parse(result.entry);if(entry.id!==record.id)throw new Error("足迹结果与档案不一致，请重试。");await pullCloud();}else{const stamp=new Date().toISOString();await withGuestLock(()=>changeGuest(items=>{const current=items.find(entry=>entry.id===record.id)??blankEntry(record.id);return localEntry(items,{...current,lastVisitedAt:latest(current.lastVisitedAt,stamp)});}));}
  rememberRecord(record);
 }),[run,withGuestLock,changeGuest]);
 const remove=useCallback((id:string)=>run(async()=>{
  requireReady();if(authRef.current){await requestJson(`/api/me/records/${encodeURIComponent(id)}`,{method:"DELETE"});await pullCloud();}else await withGuestLock(()=>changeGuest(items=>items.filter(entry=>entry.id!==id)));
  setRecordMap(current=>{const next=new Map(current);next.delete(id);return next;});
 }),[run,withGuestLock,changeGuest]);
 const clearHistory=useCallback(()=>run(async()=>{
  requireReady();if(authRef.current){await requestJson<{library:ReaderLibrary}>("/api/me/library/history",{method:"DELETE"});await pullCloud();}else await withGuestLock(()=>{const snapshot=new Map(guestRef.current.map(entry=>[entry.id,entry.lastVisitedAt]));changeGuest(items=>items.map(entry=>({...entry,lastVisitedAt:snapshot.get(entry.id)===entry.lastVisitedAt?null:entry.lastVisitedAt})).filter(active));});
 }),[run,withGuestLock,changeGuest]);
 const mergeGuest=useCallback(()=>run(async()=>{
  requireReady();if(!authRef.current)throw new Error("请先登录，再把本浏览器游客记录合并到账号。");
  const epoch=sessionEpoch.current,pending=await withGuestLock(()=>[...guestRef.current]);let merged=0,skipped=0;
  for(let index=0;index<pending.length;index+=20){if(epoch!==sessionEpoch.current||document.visibilityState!=="visible")throw new Error("页面离开期间暂停了后续合并。已完成的批次会保留；请刷新并确认当前账号，再合并剩余游客记录。");const batch=pending.slice(index,index+20),result=await requestJson<ReaderMergeResult>("/api/me/library/merge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:batch})});if(!Array.isArray(result.acceptedIds)||!Number.isInteger(result.merged)||!Number.isInteger(result.skipped))throw new Error("服务器没有返回完整合并结果。已保存的内容会保留，可重复合并去重。");applyLibrary(result.library);const sent=new Map(batch.map(entry=>[entry.id,entry])),accepted=new Set(result.acceptedIds.filter(id=>sent.has(id)));await withGuestLock(()=>changeGuest(items=>items.filter(entry=>{const original=sent.get(entry.id);return !accepted.has(entry.id)||!original||entry.favorite!==original.favorite||entry.favoritedAt!==original.favoritedAt||entry.read!==original.read||entry.readAt!==original.readAt||entry.lastVisitedAt!==original.lastVisitedAt;})));merged+=result.merged;skipped+=result.skipped;}
  return {merged,skipped};
 }),[run,applyLibrary,withGuestLock,changeGuest]);
 const importGuestEntries=useCallback((incoming:ReaderEntry[])=>run(async()=>{
  const parsed=validateEntries(incoming);await withGuestLock(()=>changeGuest(items=>{const next=unionEntries(items,parsed);if(next.length>READER_ENTRY_LIMIT)throw new Error("合并后将超过 500 份本机档案，请先清理再导入。");return next;}));if(authRef.current===false)await lookup(guestRef.current.map(entry=>entry.id)).catch(cause=>setError(cause instanceof Error?cause.message:"档案资料未完成载入，请刷新重试。"));
 }),[run,withGuestLock,changeGuest,lookup]);
 const clearGuestEntries=useCallback(()=>run(async()=>{await withGuestLock(()=>{const snapshot=new Map(guestRef.current.map(entry=>[entry.id,{...entry}]));try{localStorage.removeItem(storageKey);guestDisk.current=[];guestChanges.current=[];guestCorrupt.current=false;}catch{guestChanges.current.push(items=>items.filter(entry=>{const original=snapshot.get(entry.id);return !original||!sameEntry(entry,original);}));setError("游客记录已从本页清理，但浏览器拒绝持久删除，其他标签可能仍能读取原记录。后续新增或变化的记录会保留。");}publishGuest([]);});}),[run,withGuestLock,publishGuest]);
 const getGuestEntries=useCallback(()=>guestRef.current.map(entry=>({...entry})),[]);
 return <ReaderContext.Provider value={{ready,authenticated,entries,records:[...recordMap.values()],guestCount,busy,catalogLoading,error,refresh,patchRecord,visit,remove,clearHistory,mergeGuest,importGuestEntries,clearGuestEntries,getGuestEntries}}>{children}</ReaderContext.Provider>;
}
export function useReader(){const context=useContext(ReaderContext);if(!context)throw new Error("档案夹组件需要 ReaderProvider。");return context;}
