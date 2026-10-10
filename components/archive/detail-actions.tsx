"use client";
import {useEffect,useRef,useState} from "react";
import {Copy,Share2} from "lucide-react";
import {requestJson} from "@/lib/client-request";

type PendingAction="copy"|"share"|null;

export function DetailActions({id,initialViews,name}:{id:string;initialViews:number;name:string}){
 const [views,setViews]=useState(initialViews);
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState<PendingAction>(null);
 const [fallbackUrl,setFallbackUrl]=useState("");
 const pendingRef=useRef(false);
 const linkInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const controller=new AbortController();
  requestJson<{views:number}>(`/api/meme/${encodeURIComponent(id)}/view`,{method:"POST",signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted&&Number.isFinite(data.views))setViews(data.views);})
   .catch(()=>{});
  return()=>controller.abort();
 },[id]);
 function begin(action:PendingAction){
  if(pendingRef.current)return false;
  pendingRef.current=true;
  setPending(action);
  setMessage("");
  return true;
 }
 function finish(){pendingRef.current=false;setPending(null);}
 function archiveUrl(){return new URL(`/meme/${encodeURIComponent(id)}`,window.location.origin).href;}
 function offerManualCopy(url:string,text:string){setFallbackUrl(url);setMessage(text);}
 async function copyUrl(url:string){
  if(!navigator.clipboard?.writeText){
   offerManualCopy(url,"当前浏览器未提供复制功能，请选中下面的链接复制。");
   return;
  }
  try{
   await navigator.clipboard.writeText(url);
   setMessage("链接已复制");
   setFallbackUrl("");
  }catch{
   offerManualCopy(url,"复制未完成，请选中下面的链接复制。");
  }
 }
 async function copy(){
  if(!begin("copy"))return;
  try{await copyUrl(archiveUrl());}finally{finish();}
 }
 async function share(){
  if(!begin("share"))return;
  const url=archiveUrl();
  try{
   if(!navigator.share){await copyUrl(url);return;}
   try{
    await navigator.share({title:`${name} · 梗留所`,url});
    setMessage("已交给系统分享");
    setFallbackUrl("");
   }catch(error){
    if(typeof error==="object"&&error!==null&&"name" in error&&error.name==="AbortError"){
     setMessage("已取消分享");
    }else{
     offerManualCopy(url,"分享未完成，可以复制下面的档案链接。");
    }
   }
  }finally{finish();}
 }
 function selectLink(){linkInput.current?.focus();linkInput.current?.select();}
 return <div>
  <div className="sharing" aria-busy={pending!==null}>
   <button type="button" onClick={copy} disabled={pending!==null}><Copy size={15}/>{pending==="copy"?"正在复制…":"复制链接"}</button>
   <button type="button" onClick={share} disabled={pending!==null}><Share2 size={15}/>{pending==="share"?"正在分享…":"分享档案"}</button>
   <span className="read-counter" title="同一浏览器当日重复阅读计 1 人次">本站阅读 {views.toLocaleString()} 人次</span>
  </div>
  <p className="action-feedback" role="status">{message}</p>
  {fallbackUrl&&<div className="link-fallback">
   <label>档案链接<input ref={linkInput} type="url" readOnly value={fallbackUrl} onFocus={event=>event.currentTarget.select()} aria-label="可选中复制的档案链接"/></label>
   <button type="button" onClick={selectLink}>选中链接</button>
   <p>选中后使用浏览器的复制操作，或按 Ctrl+C / Command+C。</p>
  </div>}
 </div>;
}
