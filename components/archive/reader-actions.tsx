"use client";

import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {Bookmark,Check,FolderOpen,Shuffle} from "lucide-react";
import type {StoredMeme} from "@/lib/records";
import type {ReaderPatch} from "@/lib/reader-types";
import {useReader} from "./reader-provider";

type Action="favorite"|"read"|"visit"|"refresh"|null;
type FailedPatch={kind:"favorite"|"read";patch:ReaderPatch};

function errorMessage(error:unknown,fallback:string){
 return error instanceof Error&&error.message?error.message:fallback;
}

export function ReaderActions({record,signInUrl}:{record:StoredMeme;signInUrl:string}){
 return <RecordReaderActions key={record.id} record={record} signInUrl={signInUrl}/>;
}

function RecordReaderActions({record,signInUrl}:{record:StoredMeme;signInUrl:string}){
 const {ready,authenticated,entries,busy,error,refresh,patchRecord,visit}=useReader();
 const entry=entries.find(item=>item.id===record.id);
 const favorite=Boolean(entry?.favorite),read=Boolean(entry?.read);
 const [pending,setPending]=useState<Action>(null);
 const [feedback,setFeedback]=useState("");
 const [actionError,setActionError]=useState("");
 const [visitError,setVisitError]=useState("");
 const [failedPatch,setFailedPatch]=useState<FailedPatch|null>(null);
 const actionRef=useRef(false);
 const visitedId=useRef<string|null>(null);

 const begin=useCallback((action:Action,requiresReady=true)=>{
  if(actionRef.current||busy||(requiresReady&&!ready))return false;
  actionRef.current=true;
  setPending(action);
  setFeedback("");
  return true;
 },[busy,ready]);
 const finish=useCallback(()=>{
  actionRef.current=false;
  setPending(null);
 },[]);

 const saveVisit=useCallback(async(retry=false)=>{
  if(!begin("visit"))return;
  visitedId.current=record.id;
  setVisitError("");
  try{
   await visit(record);
   setFeedback(retry?"足迹已重新保存。":"足迹已保存。");
  }catch(cause){
   setVisitError(errorMessage(cause,"足迹未能保存，请重试。"));
  }finally{finish();}
 },[begin,finish,record,visit]);

 useEffect(()=>{
  if(!ready||busy||actionRef.current||visitedId.current===record.id)return;
  // Mark the attempt before starting: provider busy changes must not repeat it.
  visitedId.current=record.id;
  void saveVisit();
 },[ready,busy,pending,record.id,saveVisit]);

 async function savePatch(kind:"favorite"|"read",patch:ReaderPatch){
  if(!begin(kind))return;
  setActionError("");
  setFailedPatch(null);
  try{
   await patchRecord(record,patch);
   setFeedback(kind==="favorite"
    ? patch.favorite?"已加入收藏。":"已取消收藏。"
    : patch.read?"已标记为已读。":"已标记为未读。");
  }catch(cause){
   setActionError(errorMessage(cause,"档案夹未能保存，请重试。"));
   setFailedPatch({kind,patch});
  }finally{finish();}
 }

 async function reload(){
  if(!begin("refresh",false))return;
  setActionError("");
  try{
   await refresh();
   setFailedPatch(null);
   setFeedback("档案夹已重新载入。");
  }catch(cause){
   setActionError(errorMessage(cause,"档案夹未能载入，请重试。"));
  }finally{finish();}
 }

 const disabled=!ready||busy||pending!==null;
 const loading=busy||pending!==null;
 const status=pending==="visit"?"正在保存足迹…"
  :pending==="refresh"?"正在载入档案夹…"
  :pending==="favorite"?"正在保存收藏状态…"
  :pending==="read"?"正在保存已读状态…"
  :feedback;
 const storageNote=authenticated
  ?"档案夹保存到当前登录账号。"
  :<>收藏、已读和足迹保存在此浏览器。<a href={signInUrl} target="_top">登录后使用账号档案夹</a></>;

 if(!ready)return <section className="reader-actions reader-actions-loading" aria-label="我的档案夹操作" aria-busy={loading}>
  <h2>把这份记忆放进档案夹</h2>
  <p className="reader-status" role="status">{loading?"正在打开档案夹…":"档案夹尚未载入。"}</p>
  <p className="reader-storage-note">{storageNote}</p>
  {(actionError||error)&&<p className="reader-feedback reader-feedback-error" role="alert">{actionError||error}</p>}
  <button className="button secondary" type="button" onClick={()=>void reload()} disabled={loading}>{pending==="refresh"?"正在重试…":"重试加载档案夹"}</button>
 </section>;

 return <section className="reader-actions" aria-label="我的档案夹操作" aria-busy={loading}>
  <div className="reader-action-buttons">
   <button className="reader-action-button" type="button" aria-pressed={favorite} onClick={()=>void savePatch("favorite",{favorite:!favorite})} disabled={disabled}>
    <Bookmark size={16} aria-hidden="true"/>{pending==="favorite"?"正在保存…":favorite?"取消收藏":"收藏档案"}
   </button>
   <button className="reader-action-button" type="button" aria-pressed={read} onClick={()=>void savePatch("read",{read:!read})} disabled={disabled}>
    <Check size={16} aria-hidden="true"/>{pending==="read"?"正在保存…":read?"标为未读":"标为已读"}
   </button>
   <Link className="reader-action-link" href="/library"><FolderOpen size={16} aria-hidden="true"/>我的档案夹</Link>
   <a className="reader-action-link" href={"/random?exclude="+encodeURIComponent(record.id)}><Shuffle size={16} aria-hidden="true"/>随机再逛</a>
  </div>
  <p className="reader-storage-note">{storageNote}</p>
  <p className="reader-visit-note">打开档案只保存足迹；已读由你主动标记。</p>
  {status&&<p className="reader-feedback" role="status">{status}</p>}
  {actionError&&<div className="reader-action-retry">
   <p className="reader-feedback reader-feedback-error" role="alert">{actionError}</p>
   {failedPatch
    ?<button className="button secondary" type="button" disabled={disabled} onClick={()=>void savePatch(failedPatch.kind,failedPatch.patch)}>{failedPatch.kind==="favorite"?"重试保存收藏":"重试保存已读标记"}</button>
    :<button className="button secondary" type="button" disabled={loading} onClick={()=>void reload()}>重试加载档案夹</button>}
  </div>}
  {visitError&&<div className="reader-visit-retry">
   <p className="reader-feedback reader-feedback-error" role="alert">足迹未保存：{visitError}</p>
   <button className="button secondary" type="button" disabled={disabled} onClick={()=>void saveVisit(true)}>{pending==="visit"?"正在保存…":"重试保存足迹"}</button>
  </div>}
  {!actionError&&!visitError&&error&&<div className="reader-action-retry">
   <p className="reader-feedback reader-feedback-error" role="alert">{error}</p>
   <button className="button secondary" type="button" disabled={loading} onClick={()=>void reload()}>重新载入档案夹</button>
  </div>}
 </section>;
}
