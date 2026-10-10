"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogHeader,AlertDialogFooter,AlertDialogAction,AlertDialogCancel,AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {categories,sourceTypes,recordSchema,statusLabels,dateLabel,formatRecordIssues,sourceHref,type Meme,type StoredMeme} from "@/lib/records";
import {requestJson,RequestError} from "@/lib/client-request";
import {useEditorTools} from "./editor-tools";

type History={version:number;updatedAt:string;record:Meme};
type Issue={path:(string|number)[];message:string};
type TextKey="name"|"id"|"period"|"summary"|"definition"|"origin"|"spread"|"cautions";
const blank:Meme={id:"",name:"",aliases:[],category:"生活情绪",period:"",year:null,summary:"",definition:"",origin:"",spread:"",usage:[],cautions:"",related:[],sources:[],evidence:[],status:"draft"};
const textLimits:Record<TextKey,number>={name:60,id:80,period:120,summary:240,definition:12000,origin:12000,spread:12000,cautions:4000};
const fieldId=(path:(string|number)[])=>`archive-field-${path.join("-")}`;
const splitList=(value:string)=>[...new Set(value.split(/[,，、\n]/).map(v=>v.trim()).filter(Boolean))];

export function Editor({initial,initialHistory=[]}:{initial?:StoredMeme;initialHistory?:History[]}){
 const router=useRouter();
 const [record,setRecord]=useState<Meme>(initial??blank);
 const [revision,setRevision]=useState<number|null>(initial?.revision??null);
 const [savedId,setSavedId]=useState<string|null>(initial?.id??null);
 const [savedStatus,setSavedStatus]=useState<Meme["status"]>(initial?.status??"draft");
 const [tab,setTab]=useState("story");
 const [busy,setBusy]=useState<string|null>(null);
 const pending=useRef(false);
 const [dirty,setDirty]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [failed,setFailed]=useState(false);
 const [issues,setIssues]=useState<Issue[]>([]);
 const [conflict,setConflict]=useState(false);
 const [versions,setVersions]=useState(initialHistory);
 const [aliases,setAliases]=useState(initial?.aliases.join("、")??"");
 const [usage,setUsage]=useState(initial?.usage.join("\n")??"");
 const [related,setRelated]=useState(initial?.related.join(", ")??"");
 const [focusTarget,setFocusTarget]=useState<{id:string;tab:string}|null>(null);

 useEffect(()=>{
  if(!dirty)return;
  let confirmedNavigation=false;
  let confirmationReset:number|undefined;
  function warn(e:BeforeUnloadEvent){if(confirmedNavigation)return;e.preventDefault();e.returnValue="";}
  function confirmNavigation(event:MouseEvent){
   if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const element=event.target instanceof Element?event.target:event.target instanceof Node?event.target.parentElement:null;
   const link=element?.closest("a[href]");
   if(!(link instanceof HTMLAnchorElement)||link.hasAttribute("download"))return;
   const target=link.getAttribute("target")?.trim().toLowerCase();
   if(target&&target!=="_self"&&target!=="_top"&&target!=="_parent")return;
   let destination:URL;
   try{destination=new URL(link.href,window.location.href);}catch{return;}
   if(destination.protocol!=="https:"&&destination.protocol!=="http:")return;
   const current=new URL(window.location.href);
   const samePage=destination.origin===current.origin&&destination.pathname===current.pathname&&destination.search===current.search;
   if(samePage&&(destination.hash||link.getAttribute("href")?.trim().startsWith("#")))return;
   if(pending.current){event.preventDefault();event.stopPropagation();return;}
   if(!window.confirm("当前修改尚未保存，仍要离开编辑页吗？")){event.preventDefault();event.stopPropagation();return;}
   confirmedNavigation=true;
   if(confirmationReset!==undefined)window.clearTimeout(confirmationReset);
   confirmationReset=window.setTimeout(()=>{confirmedNavigation=false;},0);
  }
  window.addEventListener("beforeunload",warn);
  document.addEventListener("click",confirmNavigation,true);
  return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",confirmNavigation,true);if(confirmationReset!==undefined)window.clearTimeout(confirmationReset);};
 },[dirty]);
 useEffect(()=>{
  if(!focusTarget||busy||tab!==focusTarget.tab)return;
  const frame=requestAnimationFrame(()=>{
   const field=document.getElementById(focusTarget.id);
   field?.focus();
   field?.scrollIntoView({block:"center",behavior:"auto"});
  });
  return()=>cancelAnimationFrame(frame);
 },[focusTarget,tab,busy]);

 function edited(key?:keyof Meme){
  setDirty(true);setFailed(false);setFeedback("");
  setIssues(current=>key?current.filter(issue=>issue.path[0]!==key):[]);
 }
 function update<K extends keyof Meme>(key:K,value:Meme[K]){
  if(pending.current)return;
  setRecord(current=>({...current,[key]:value}));edited(key);
 }
 function buffer(key:"aliases"|"usage"|"related",value:string){
  if(pending.current)return;
  if(key==="aliases")setAliases(value);else if(key==="usage")setUsage(value);else setRelated(value);
  edited(key);
 }
 function materialize(status:Meme["status"]=savedStatus):Meme{
  return {...record,status,aliases:splitList(aliases),usage:usage.split("\n").map(v=>v.trim()).filter(Boolean),related:splitList(related)};
 }
 const draft=materialize();
 useEditorTools(draft,patch=>{
  if(pending.current)return false;
  setRecord(current=>({...current,...patch,status:savedStatus}));edited();
  setFeedback("正文已载入，尚未保存。");return true;
 },!!busy);

 function messagesFor(path:(string|number)[],exact=false){
  return [...new Set(issues.filter(issue=>(!exact||issue.path.length===path.length)&&path.every((part,index)=>issue.path[index]===part)).map(issue=>issue.message))];
 }
 function attrs(path:(string|number)[]){
  const invalid=messagesFor(path).length>0;
  return {id:fieldId(path),"aria-invalid":invalid,"aria-describedby":invalid?`${fieldId(path)}-error`:undefined};
 }
 function fieldError(path:(string|number)[],exact=false){
  const messages=messagesFor(path,exact);
  return messages.length?<small id={`${fieldId(path)}-error`} style={{color:"#971f1f"}}>{messages.join("；")}</small>:null;
 }
 function focusIssue(issue:Issue){
  const [key,index,part]=issue.path;
  let target=fieldId([String(key??"name")]);
  const targetTab=key==="sources"||key==="evidence"?"sources":"story";
  if(key==="sources"){
   if(typeof index!=="number"||!record.sources[index])target="archive-add-source";
   else target=fieldId(["sources",index,part??(!record.sources[index].title?"title":!sourceHref(record.sources[index].url)?"url":"title")]);
  }else if(key==="evidence"){
   if(typeof index!=="number"||!record.evidence[index])target="archive-add-evidence";
   else target=fieldId(["evidence",index,part??(!record.evidence[index].label?"label":!sourceHref(record.evidence[index].sourceUrl)?"sourceUrl":"label")]);
  }else if(key==="aliases"||key==="usage"||key==="related")target=fieldId([key]);
  setTab(targetTab);setFocusTarget({id:target,tab:targetTab});
 }
 function showIssues(next:Issue[],message="请修改以下字段后再保存。"){
  const normalized=next.map(issue=>({...issue,path:issue.path[0]==="record"?issue.path.slice(1):issue.path}));
  setIssues(normalized);setFailed(true);setFeedback(message);
  if(normalized[0])focusIssue(normalized[0]);
 }
 function applySaved(saved:StoredMeme){
  setRecord(saved);setRevision(saved.revision);setSavedId(saved.id);setSavedStatus(saved.status);
  setAliases(saved.aliases.join("、"));setUsage(saved.usage.join("\n"));setRelated(saved.related.join(", "));
  setDirty(false);setIssues([]);setConflict(false);setFailed(false);setFocusTarget(null);
 }
 function requestFailure(error:unknown,fallback:string){
  setFailed(true);
  if(error instanceof RequestError){
   if(error.issues?.length){showIssues(error.issues);return;}
   if(error.status===409&&revision!==null){setConflict(true);setFeedback("服务器已有其他修订，当前输入仍保留。请先下载当前编辑，再查看最新版本并合并。");return;}
   if(error.status===409&&revision===null){showIssues([{path:["id"],message:error.message||"这个档案地址已存在，请换一个地址。"}]);return;}
   if(error.status===401||error.status===403){setFeedback("请求未获授权。当前编辑仍保留，请先下载留底，再确认登录和编辑权限后重试。");return;}
   setFeedback(error.message||fallback);return;
  }
  setFeedback(fallback);
 }
 async function save(status:Meme["status"]){
  if(pending.current)return;
  const parsed=recordSchema.safeParse(materialize(status));
  if(!parsed.success){showIssues(formatRecordIssues(parsed.error.issues));return;}
  const firstSave=revision===null;
  const beforeStatus=savedStatus;
  pending.current=true;setBusy(status==="archived"?"正在保存并归档…":"正在保存…");setFeedback("");setFailed(false);setIssues([]);
  try{
   const data=await requestJson<{record:StoredMeme}>(firstSave?"/api/admin/records":`/api/admin/records/${encodeURIComponent(savedId??record.id)}`,{
    method:firstSave?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({record:parsed.data,expectedRevision:revision})
   });
   if(!data.record||!Number.isInteger(data.record.revision))throw new Error("invalid_record_response");
   const saved=data.record;applySaved(saved);
   setVersions(current=>[{version:saved.revision,updatedAt:saved.updatedAt,record:saved},...current.filter(v=>v.version!==saved.revision)].slice(0,50));
   setFeedback(status==="published"?(beforeStatus==="published"?"修订已保存，阅读前台已更新。":beforeStatus==="archived"?"档案已重新发布，阅读前台已更新。":"档案已发布，阅读前台已更新。"):
    status==="archived"?(beforeStatus==="archived"?"归档内容已保存，仍保持归档。":"当前内容已保存并归档，阅读前台不再展示。"):
    beforeStatus==="archived"?"已恢复为草稿，当前内容已保存；尚未发布。":"草稿已保存。");
   if(firstSave)router.replace(`/admin/${encodeURIComponent(saved.id)}`);
   router.refresh();
  }catch(error){requestFailure(error,"暂时无法保存。当前输入仍保留，请检查网络后重试。");}
  finally{pending.current=false;setBusy(null);}
 }
 async function loadLatest(){
  if(pending.current||!savedId)return;
  if(!window.confirm("将用服务器最新版本替换当前编辑内容，尚未保存的修改会被丢弃。建议先下载当前编辑留底。继续吗？"))return;
  pending.current=true;setBusy("正在载入最新版本…");setFeedback("");setFailed(false);
  try{
   const data=await requestJson<{record:StoredMeme;history:History[]}>(`/api/admin/records/${encodeURIComponent(savedId)}`,{cache:"no-store"});
   if(!data.record||!Number.isInteger(data.record.revision)||!Array.isArray(data.history))throw new Error("invalid_record_response");
   applySaved(data.record);setVersions(data.history);setTab("story");setFeedback(`已载入服务器最新版本 v${data.record.revision}。`);
  }catch(error){requestFailure(error,"暂时无法载入最新版本。当前编辑没有改变，请稍后重试。");}
  finally{pending.current=false;setBusy(null);}
 }
 function downloadDraft(){
  if(pending.current)return;
  try{
   const payload={format:"gengliusuo-archive",formatVersion:1,exportedAt:new Date().toISOString(),records:[materialize()],editorDraft:{expectedRevision:revision,aliasesText:aliases,usageText:usage,relatedText:related}};
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}));
   const link=document.createElement("a");
   link.href=url;link.download=`${record.id.replace(/[^a-z0-9-]/g,"")||"new-memory"}-editing-${new Date().toISOString().slice(0,10)}.json`;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setFailed(false);setFeedback("已下载当前编辑内容。请保留文件，载入最新版本后可对照合并修改；导入备份不会覆盖同地址档案。");
  }catch{setFailed(true);setFeedback("暂时无法下载，请重试。当前输入仍然保留。");}
 }
 function restore(version:History){
  if(pending.current)return;
  if(dirty&&!window.confirm("载入历史内容会替换当前未保存的修改。继续吗？"))return;
  setRecord({...version.record,id:savedId??record.id,status:savedStatus});
  setAliases(version.record.aliases.join("、"));setUsage(version.record.usage.join("\n"));setRelated(version.record.related.join(", "));
  setDirty(true);setTab("story");setIssues([]);setFocusTarget(null);setFailed(false);
  setFeedback(`已载入 v${version.version} 的内容，尚未保存。当前已保存状态仍为“${statusLabels[savedStatus]}”；保存后形成新修订。`);
 }
 function source(index:number,key:keyof Meme["sources"][number],value:string){update("sources",record.sources.map((item,i)=>i===index?{...item,[key]:value}:item));}
 function evidence(index:number,key:keyof Meme["evidence"][number],value:string){update("evidence",record.evidence.map((item,i)=>i===index?{...item,[key]:key==="value"?value||null:value}:item));}
 function addSource(){
  if(pending.current||record.sources.length>=30)return;
  const index=record.sources.length;update("sources",[...record.sources,{title:"",url:"",type:"媒体报道",note:""}]);
  setFocusTarget({id:fieldId(["sources",index,"title"]),tab:"sources"});
 }
 function addEvidence(){
  if(pending.current||record.evidence.length>=20)return;
  const index=record.evidence.length;update("evidence",[...record.evidence,{label:"",value:null,period:"",sourceUrl:""}]);
  setFocusTarget({id:fieldId(["evidence",index,"label"]),tab:"sources"});
 }
 function text(key:TextKey,label:string,help?:string,large=false){
  return <label className="field" htmlFor={fieldId([key])}>{label}
   {large?<textarea {...attrs([key])} value={record[key]} onChange={e=>update(key,e.target.value)} maxLength={textLimits[key]}/>:
    <input {...attrs([key])} value={record[key]} disabled={!!busy||(key==="id"&&revision!==null)} onChange={e=>update(key,e.target.value)} maxLength={textLimits[key]}/>}
   {help&&<small>{help}</small>}{fieldError([key])}
  </label>;
 }
 function previewLink(url:string,label:string){
  const href=sourceHref(url);
  return href?<a href={href} target="_blank" rel="noopener noreferrer">{label}</a>:<span>{label} <small>（{url?"链接格式需要修改":"链接尚未填写"}）</small></span>;
 }

 return <>
  <header className="admin-heading"><div>
   <div className="eyebrow"><span className="index-label">EDIT / {revision?record.id.toUpperCase():"NEW MEMORY"}</span></div>
   <h1>{revision?record.name||"编辑档案":"新增档案"}</h1>
   <p>{dirty?"有尚未保存的修改":revision?`已保存 · v${revision}`:"从梗名和第一条来源开始。"}</p>
  </div><Link className="button secondary" href="/admin" aria-disabled={!!busy} onClick={e=>{
   if(pending.current){e.preventDefault();return;}
  }}>返回档案列表</Link></header>
  <div className="editor-layout"><div className="editor-form">
   <fieldset disabled={!!busy} aria-busy={!!busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <Tabs className="editor-tabs" value={tab} onValueChange={value=>{if(!pending.current)setTab(value);}}>
     <TabsList><TabsTrigger value="story" disabled={!!busy}>档案正文</TabsTrigger><TabsTrigger value="sources" disabled={!!busy}>来源与影响力</TabsTrigger><TabsTrigger value="preview" disabled={!!busy}>阅读预览</TabsTrigger></TabsList>
     <TabsContent value="story">
      <section className="form-section"><h2>基本信息</h2>
       {text("name","梗名","最多 60 字。")}
       {text("id","档案地址","2—80 个小写字母、数字和连字符，例如 go-xuezhang；首次保存后地址固定。")}
       {text("summary","一句话摘要","用一句话说明它是什么，最多 240 字。",true)}
       <label className="field" htmlFor={fieldId(["aliases"])}>别名<input {...attrs(["aliases"])} value={aliases} onChange={e=>buffer("aliases",e.target.value)} placeholder="IKUN、爱坤"/>
        <small>{draft.aliases.length}/20 个；每个最多 60 字，用顿号、逗号或换行分隔。搜索会包含这些别名。</small>{fieldError(["aliases"])}</label>
       <div className="field-grid">
        <label className="field" htmlFor={fieldId(["category"])}>分类<Select value={record.category} disabled={!!busy} onValueChange={value=>update("category",value as Meme["category"])}><SelectTrigger {...attrs(["category"])}><SelectValue/></SelectTrigger><SelectContent>{categories.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>{fieldError(["category"])}</label>
        <label className="field" htmlFor={fieldId(["year"])}>流行记录年份<input {...attrs(["year"])} type="number" min={1990} max={2100} step={1} value={record.year??""} onChange={e=>update("year",e.target.value?Number(e.target.value):null)}/><small>1990—2100 的整数；采用有出处的活跃或入榜年份，未知可留空。</small>{fieldError(["year"])}</label>
       </div>
       <div style={{marginTop:20}}>{text("period","流行时期说明","最多 120 字，例如 2021 年 B 站年度弹幕。")}</div>
      </section>
      <section className="form-section" style={{marginTop:24}}><h2>故事与语境</h2>
       {text("definition","这个梗是什么意思","最多 12000 字。",true)}
       {text("origin","从哪里来","区分已确认来源与尚未确认的首发，最多 12000 字。",true)}
       {text("spread","怎样流传","说明传播场景、二创形式和变化，最多 12000 字。",true)}
       <label className="field" htmlFor={fieldId(["usage"])}>用法示例<textarea {...attrs(["usage"])} value={usage} onChange={e=>buffer("usage",e.target.value)}/><small>{draft.usage.length}/20 条；每行一条，每条最多 1000 字。用自然句子保留使用语境。</small>{fieldError(["usage"])}</label>
       {text("cautions","读梗小注","记录歧义、数据缺口和原作与二创的区别，最多 4000 字。",true)}
       <label className="field" htmlFor={fieldId(["related"])}>关联档案地址<input {...attrs(["related"])} value={related} onChange={e=>buffer("related",e.target.value)} placeholder="go-xuezhang, wa-xuedi"/><small>{draft.related.length}/20 个；每个最多 80 字，用逗号分隔。阅读页仅显示已发布且存在的档案。</small>{fieldError(["related"])}</label>
      </section>
     </TabsContent>
     <TabsContent value="sources">
      <section className="form-section"><h2>来源与代表作品</h2><p className="form-header-note">原始素材、代表二创和起源证明分开说明。已添加 {record.sources.length}/30 条来源。</p>
       {record.sources.map((item,index)=><div key={index} className="nested-field">
        <header><strong>来源 {index+1}</strong><button type="button" className="text-button" disabled={!!busy} onClick={()=>update("sources",record.sources.filter((_,i)=>i!==index))}>移除此来源</button></header>
        {fieldError(["sources",index],true)}
        <label className="field" htmlFor={fieldId(["sources",index,"title"])}>标题<input {...attrs(["sources",index,"title"])} value={item.title} onChange={e=>source(index,"title",e.target.value)} maxLength={200}/><small>最多 200 字。</small>{fieldError(["sources",index,"title"])}</label>
        <label className="field" htmlFor={fieldId(["sources",index,"url"])}>原始链接<input {...attrs(["sources",index,"url"])} type="url" value={item.url} onChange={e=>source(index,"url",e.target.value)} placeholder="https://" maxLength={2000}/><small>最多 2000 字；发布时需要有效 HTTPS 链接，不能含登录信息。</small>{fieldError(["sources",index,"url"])}</label>
        <label className="field" htmlFor={fieldId(["sources",index,"type"])}>来源类型<Select value={item.type} disabled={!!busy} onValueChange={value=>source(index,"type",value)}><SelectTrigger {...attrs(["sources",index,"type"])}><SelectValue/></SelectTrigger><SelectContent>{sourceTypes.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>{fieldError(["sources",index,"type"])}</label>
        <label className="field" htmlFor={fieldId(["sources",index,"note"])}>这条来源支持什么<textarea {...attrs(["sources",index,"note"])} value={item.note} onChange={e=>source(index,"note",e.target.value)} maxLength={1500}/><small>最多 1500 字。</small>{fieldError(["sources",index,"note"])}</label>
       </div>)}
       {fieldError(["sources"],true)}<button id="archive-add-source" type="button" className="button secondary" disabled={!!busy||record.sources.length>=30} onClick={addSource}>＋ 添加来源</button>
       {record.sources.length>=30&&<p className="muted">已达到 30 条来源上限，可编辑或移除现有来源。</p>}
      </section>
      <section className="form-section" style={{marginTop:24}}><h2>传播与影响力证据</h2><p className="form-header-note">保留平台、时期与统计口径。已添加 {record.evidence.length}/20 条证据。</p>
       {record.evidence.map((item,index)=><div key={index} className="nested-field">
        <header><strong>证据 {index+1}</strong><button type="button" className="text-button" disabled={!!busy} onClick={()=>update("evidence",record.evidence.filter((_,i)=>i!==index))}>移除此证据</button></header>
        {fieldError(["evidence",index],true)}
        <label className="field" htmlFor={fieldId(["evidence",index,"label"])}>指标或证据名称<input {...attrs(["evidence",index,"label"])} value={item.label} onChange={e=>evidence(index,"label",e.target.value)} maxLength={240} placeholder="例如 2021 年 B 站年度弹幕"/><small>最多 240 字。</small>{fieldError(["evidence",index,"label"])}</label>
        <label className="field" htmlFor={fieldId(["evidence",index,"value"])}>数值或结果<input {...attrs(["evidence",index,"value"])} value={item.value??""} onChange={e=>evidence(index,"value",e.target.value)} maxLength={240}/><small>最多 240 字；未知可留空，不要估计全网累计播放。</small>{fieldError(["evidence",index,"value"])}</label>
        <label className="field" htmlFor={fieldId(["evidence",index,"period"])}>平台、时期与统计口径<input {...attrs(["evidence",index,"period"])} value={item.period} onChange={e=>evidence(index,"period",e.target.value)} maxLength={120}/><small>最多 120 字。</small>{fieldError(["evidence",index,"period"])}</label>
        <label className="field" htmlFor={fieldId(["evidence",index,"sourceUrl"])}>证据来源链接<input {...attrs(["evidence",index,"sourceUrl"])} type="url" value={item.sourceUrl} onChange={e=>evidence(index,"sourceUrl",e.target.value)} placeholder="https://" maxLength={2000}/><small>最多 2000 字；发布时需要有效 HTTPS 链接，不能含登录信息。</small>{fieldError(["evidence",index,"sourceUrl"])}</label>
       </div>)}
       {fieldError(["evidence"],true)}<button id="archive-add-evidence" type="button" className="button secondary" disabled={!!busy||record.evidence.length>=20} onClick={addEvidence}>＋ 添加传播证据</button>
       {record.evidence.length>=20&&<p className="muted">已达到 20 条证据上限，可编辑或移除现有证据。</p>}
      </section>
     </TabsContent>
     <TabsContent value="preview"><article className="edit-preview">
      <div className="eyebrow">当前编辑内容的阅读预览 · 尚未保存的修改不会自动发布</div><h2>{draft.name||"梗名"}</h2><p>{draft.summary||"摘要尚未填写。"}</p>
      <div className="alias-list">{draft.aliases.filter(value=>value!==draft.name).map(value=><span key={value}>{value}</span>)}</div>
      <div className="detail-meta"><span>{draft.category}</span><span>{draft.year===null?"流行年份待考":`${draft.year} · 流行记录`}</span><span>{draft.period||"流行时期说明尚未填写"}</span><span>{draft.sources.length} 个来源</span><span>已保存状态：{statusLabels[savedStatus]}</span></div>
      {([['definition','这个梗是什么意思'],['origin','从哪里来'],['spread','怎样流传']] as const).map(([key,label])=><section key={key}><h3>{label}</h3><p>{draft[key]||"这部分尚未填写。"}</p></section>)}
      <section><h3>用法示例</h3>{draft.usage.length?<ul className="usage-list">{draft.usage.map((value,index)=><li key={index}>{value}</li>)}</ul>:<p>尚未添加用法示例。</p>}</section>
      <section><h3>传播与影响力</h3>{draft.evidence.length?<div className="evidence-list">{draft.evidence.map((item,index)=><div className="evidence-item" key={index}><h4>{item.label||"未命名证据"}</h4>{item.value&&<strong>{item.value}</strong>}<p>{item.period||"平台、时期与统计口径尚未填写。"}</p>{previewLink(item.sourceUrl,"查看依据")}</div>)}</div>:<p>尚未添加传播证据。</p>}<p className="metric-note">各项指标保留原平台、统计时期与口径；不相加，也不换算成全网热度。</p></section>
      <section><h3>读梗小注</h3><p className="info-note">{draft.cautions||"尚未填写读梗小注。"}</p></section>
      <section><h3>原始素材与来源</h3>{draft.sources.length?<ol className="source-list">{draft.sources.map((item,index)=><li key={index}><span className="source-index">{String(index+1).padStart(2,"0")}</span><div>{previewLink(item.url,item.title||"未命名来源")}<span className="source-type">{item.type}</span><p>{item.note||"来源支持的事实尚未说明。"}</p></div></li>)}</ol>:<p>尚未添加来源。</p>}</section>
      <section><h3>关联档案</h3>{draft.related.length?<ul>{draft.related.map(value=><li key={value}>{value}</li>)}</ul>:<p>尚未添加关联档案。</p>}<p className="metric-note">此处展示已填地址；阅读前台只展示已发布且存在的关联档案。</p></section>
     </article></TabsContent>
    </Tabs>
   </fieldset>
  </div><aside className="editor-sidebar">
   {feedback&&<div className={`save-feedback ${failed?"error":""}`} role={failed?"alert":"status"}><p>{feedback}</p>{issues.length>0&&<ul>{issues.map((issue,index)=><li key={`${issue.path.join(".")}-${index}`}><button type="button" className="text-button" disabled={!!busy} onClick={()=>focusIssue(issue)} style={{textAlign:"left",color:"inherit"}}>{issue.message} · 前往修改</button></li>)}</ul>}</div>}
   {conflict&&savedId&&<div className="aside-card"><h2>合并其他修订</h2><p>查看最新版本不会更改当前输入。载入最新会替换当前内容，请先下载留底。</p><Link className="button secondary" href={`/admin/${encodeURIComponent(savedId)}`} target="_blank" rel="noopener noreferrer" aria-disabled={!!busy} onClick={e=>{if(pending.current)e.preventDefault();}}>查看最新版本</Link><button type="button" className="button secondary" disabled={!!busy} onClick={()=>void loadLatest()}>载入最新版本</button><button type="button" className="button secondary" disabled={!!busy} onClick={downloadDraft}>下载当前编辑</button></div>}
   <div className="aside-card"><h2>发布与保存</h2><p>已保存状态：{statusLabels[savedStatus]}。状态操作也会保存当前修改；发布前补全正文、来源和传播证据。</p>
    {busy&&<p role="status">{busy}编辑内容暂时锁定。</p>}
    {savedStatus==="draft"&&<><button type="button" className="button yellow" disabled={!!busy} onClick={()=>void save("published")}>发布档案</button><button type="button" className="button secondary" disabled={!!busy||(revision!==null&&!dirty)} onClick={()=>void save("draft")}>保存草稿</button></>}
    {savedStatus==="published"&&<button type="button" className="button yellow" disabled={!!busy||!dirty} onClick={()=>void save("published")}>保存并更新前台</button>}
    {savedStatus==="archived"&&<><button type="button" className="button yellow" disabled={!!busy} onClick={()=>void save("published")}>重新发布</button><button type="button" className="button secondary" disabled={!!busy||!dirty} onClick={()=>void save("archived")}>保存归档内容</button><button type="button" className="button secondary" disabled={!!busy} onClick={()=>void save("draft")}>恢复为草稿</button></>}
    {revision!==null&&savedStatus!=="archived"&&<AlertDialog><AlertDialogTrigger asChild><button type="button" className="button danger" disabled={!!busy}>保存并归档</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>保存当前内容并归档？</AlertDialogTitle><AlertDialogDescription>将保存编辑页中的全部修改，并把档案转为归档状态。阅读前台会隐藏这份档案，内容和修订历史保留，之后可以恢复为草稿或重新发布。若字段格式有误，需要先修改才能完成。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>继续编辑</AlertDialogCancel><AlertDialogAction disabled={!!busy} onClick={()=>void save("archived")}>保存并归档</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    {!conflict&&<button type="button" className="button secondary" disabled={!!busy} onClick={downloadDraft}>下载当前编辑</button>}
    {revision!==null&&savedStatus==="published"&&<Link href={`/meme/${encodeURIComponent(savedId??record.id)}`} target="_blank" rel="noopener noreferrer">打开已保存的阅读页</Link>}
   </div>
   <div className="aside-card"><h2>修订历史</h2><p>载入历史只替换编辑内容，保持当前已保存状态。保存后才成为新修订。</p>{versions.map(version=><div key={version.version} className="history-item"><span>v{version.version}{version.version===revision?" · 当前":""}<small>{dateLabel(version.updatedAt)}</small></span><button type="button" className="text-button" disabled={!!busy} onClick={()=>restore(version)}>载入此版</button></div>)}{!versions.length&&<p>首次保存后开始记录版本。</p>}</div>
  </aside></div>
 </>;
}
