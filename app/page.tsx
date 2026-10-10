import Link from "next/link";
import {redirect} from "next/navigation";
import {PageShell} from "@/components/archive/chrome";
import {MemeCard} from "@/components/archive/card";
import {SearchTools} from "@/components/archive/search-tools";
import {DiscoveryStrip} from "@/components/archive/discovery-strip";
import {archiveStats,listRecords} from "@/lib/archive-db";
import {categories} from "@/lib/records";
export const dynamic="force-dynamic";
type Params=Record<string,string|string[]|undefined>;
export default async function Home({searchParams}:{searchParams:Promise<Params>}){
 const params=await searchParams;const value=(k:string)=>typeof params[k]==="string"?params[k] as string:"";
 const q=value("q"),category=value("category"),year=value("year"),requestedSort=value("sort");
 const sort=requestedSort==="oldest"?"oldest":"newest";
 if(requestedSort&&!['newest','oldest'].includes(requestedSort)){
  const chronological=new URLSearchParams();
  for(const [key,item]of Object.entries({q,category,year}))if(item)chronological.set(key,item);
  chronological.set("sort","newest");
  redirect(`/?${chronological}`);
 }
 const [result,stats]=await Promise.all([listRecords({q,category,year,sort,page:Number(value("page"))||1}),archiveStats()]);
 function href(change:Record<string,string>){const p=new URLSearchParams();for(const[k,v]of Object.entries({q,category,year,sort,...change}))if(v)p.set(k,v);return `/?${p}`;}
 return <PageShell><main id="main" className="home-main"><section className="archive-intro"><div><div className="eyebrow"><span className="index-label">THE INTERNET, ARCHIVED.</span><span>持续收录中</span></div><h1>热闹散场，<br/>梗有归处<span className="yellow-period">。</span></h1><p>它从哪里来，为什么刷屏，又留下了什么。</p></div><figure className="archive-art"><img src="/archive-art.png" alt="装着光盘、纸片和互联网记忆的透明档案盒" width="1122" height="1402"/><figcaption>把散落的互联网记忆装进档案。</figcaption></figure></section><DiscoveryStrip/><div className="archive-layout"><aside className="archive-sidebar"><div className="sidebar-heading">档案索引<span>INDEX</span></div><a className={!category?"category-link active":"category-link"} href={href({category:"",page:""})}>全部档案<span>{stats.total}</span></a>{categories.map(c=><a key={c} className={category===c?"category-link active":"category-link"} href={href({category:c,page:""})}>{c}<span>{stats.counts[c]??0}</span></a>)}<div className="sidebar-note"><span className="note-number">01 /</span><h2>热度不是唯一尺度</h2><p>留下有传播证据、能解释来历的梗。曾经流行，也值得记录。</p><Link href="/about">阅读收录准则</Link></div></aside><section className="archive-results" aria-label="热梗档案"><SearchTools q={q} category={category} year={year} sort={sort} years={stats.years}/><div className="result-heading"><h2>{q?`“${q}”的搜索结果`:category||"全部档案"}<span>{result.total} 份记录</span></h2><span className="result-hint">年份指流行记录，非首发时间</span></div>{result.records.length?<div className="card-grid">{result.records.map((r,i)=><MemeCard key={r.id} record={r} index={i}/>)}</div>:<div className="empty-state"><span>（暂时空白）</span><h3>这段记忆还没找到</h3><p>换一个别名，或清除分类与年份试试。</p><Link className="button" href="/">浏览全部档案</Link></div>}{result.pages>1&&<nav className="pagination" aria-label="档案分页">{result.page>1&&<a href={href({page:String(result.page-1)})}>上一页</a>}<span>第 {result.page} / {result.pages} 页</span>{result.page<result.pages&&<a href={href({page:String(result.page+1)})}>下一页</a>}</nav>}</section></div></main></PageShell>;
}

