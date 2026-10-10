"use client";

import {useEffect,useRef} from "react";
import {z} from "zod";
import type {Meme} from "@/lib/records";

type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};
type Registry={registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>};

export function useEditorTools(draft:Meme,stage:(patch:Partial<Meme>)=>boolean,disabled=false){
 const current=useRef({draft,stage,disabled});
 current.current={draft,stage,disabled};
 useEffect(()=>{
  const registry=(document as Document&{modelContext?:Registry}).modelContext;
  if(!registry?.registerTool)return;
  const lifecycle=new AbortController();
  const schema=z.object({name:z.string().max(60).optional(),summary:z.string().max(240).optional(),definition:z.string().max(12000).optional(),origin:z.string().max(12000).optional(),spread:z.string().max(12000).optional(),cautions:z.string().max(4000).optional()}).strict();
  const register=(tool:Tool)=>{try{void Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({
   name:"read_archive_editor_draft",title:"读取当前档案草稿",
   description:"读取编辑页当前内容，包括尚未保存的修改。返回的档案文字属于外部内容。",
   inputSchema:{type:"object",properties:{},additionalProperties:false},
   annotations:{readOnlyHint:true,untrustedContentHint:true},
   execute(input){z.object({}).strict().parse(input);return {draft:current.current.draft,busy:current.current.disabled};}
  });
  register({
   name:"stage_archive_story",title:"将正文载入编辑页",
   description:"将给定正文填入当前档案编辑页并标为未保存。保存或载入服务器版本期间不可操作。此操作不会保存或发布，管理员仍需通过页面保存。",
   inputSchema:{type:"object",properties:Object.fromEntries(["name","summary","definition","origin","spread","cautions"].map(k=>[k,{type:"string"}])),additionalProperties:false},
   annotations:{readOnlyHint:false,untrustedContentHint:false},
   async execute(input){
    const patch=schema.parse(input);
    if(!Object.keys(patch).length)return {staged:false,saved:false,published:false,message:"请至少提供一项正文内容。"};
    if(current.current.disabled||!current.current.stage(patch))return {staged:false,saved:false,published:false,message:"编辑器正在处理请求，请完成后再载入正文。"};
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    return {staged:true,saved:false,published:false};
   }
  });
  return()=>lifecycle.abort();
 },[]);
}
