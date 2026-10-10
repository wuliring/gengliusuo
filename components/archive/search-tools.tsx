"use client";
import {useEffect,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Search,X} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
export function SearchTools({q,category,year,sort,years}:{q:string;category:string;year:string;sort:string;years:number[]}){
 const router=useRouter();
 const [query,setQuery]=useState(q);
 const [pending,startTransition]=useTransition();
 useEffect(()=>{setQuery(q);},[q]);
 function change(key:string,value:string){
  if(pending)return;
  const params=new URLSearchParams(window.location.search);
  const currentQuery=query.trim();
  if(currentQuery)params.set("q",currentQuery);else params.delete("q");
  if(value==="all"||!value)params.delete(key);else params.set(key,value);
  params.delete("page");
  const search=params.toString();
  startTransition(()=>router.push(search?`/?${search}`:"/"));
 }
 return <div className="search-tools" aria-busy={pending}>
  <form className="search-form" action="/" method="get">
   <Search size={20} aria-hidden="true"/>
   <input name="q" aria-label="搜索梗名、别名或内容" placeholder="搜索一个梗，找回一段记忆" value={query} onChange={event=>setQuery(event.target.value)} maxLength={100} disabled={pending}/>
   {category&&<input type="hidden" name="category" value={category}/>}
   <input type="hidden" name="sort" value={sort}/>
   {year&&<input type="hidden" name="year" value={year}/>}
   <button type="submit" disabled={pending}>搜索</button>
  </form>
  <div className="filter-tools">
   <Select value={year||"all"} onValueChange={value=>change("year",value)} disabled={pending}>
    <SelectTrigger aria-label="按流行记录年份筛选"><SelectValue/></SelectTrigger>
    <SelectContent><SelectItem value="all">所有年份</SelectItem>{years.map(value=><SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
   </Select>
   <Select value={sort} onValueChange={value=>change("sort",value)} disabled={pending}>
    <SelectTrigger aria-label="档案排序"><SelectValue/></SelectTrigger>
    <SelectContent><SelectItem value="newest">年份：由新到旧</SelectItem><SelectItem value="oldest">年份：由旧到新</SelectItem></SelectContent>
   </Select>
  </div>
  {(query||year||category)&&<a className="clear-filter" href="/"><X size={14}/>清除筛选</a>}
  {pending&&<span className="search-feedback" role="status">正在更新档案…</span>}
 </div>;
}
