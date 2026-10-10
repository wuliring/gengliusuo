import Link from "next/link";
import {notFound} from "next/navigation";
import {env} from "cloudflare:workers";
import {PageShell} from "@/components/archive/chrome";
import {MemeCard} from "@/components/archive/card";
import {DetailActions} from "@/components/archive/detail-actions";
import {ReaderActions} from "@/components/archive/reader-actions";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import {collections} from "@/lib/collections";
import {getRecord} from "@/lib/archive-db";
import {cardTone,dateLabel,sourceHref} from "@/lib/records";

export const dynamic="force-dynamic";
const defaultSiteUrl="https://gengliusuo-archive.yebai.chatgpt.site";

function recordUrl(id:string){
 const site=typeof env.SITE_URL==="string"&&env.SITE_URL?env.SITE_URL:defaultSiteUrl;
 try{
  const url=new URL(`/meme/${encodeURIComponent(id)}`,site);
  if((url.protocol==="https:"||url.protocol==="http:")&&!url.username&&!url.password)return url.href;
 }catch{}
 return `${defaultSiteUrl}/meme/${encodeURIComponent(id)}`;
}
function correctionUrl(name:string,url:string){
 const issue=new URL("https://github.com/wuliring/gengliusuo/issues/new");
 issue.searchParams.set("title",`更正建议：${name}`);
 issue.searchParams.set("body",[`档案名称：${name}`,`档案链接：${url}`,"","需要更正的内容：","","可公开引用的出处或依据："].join("\n"));
 return issue.href;
}

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params,r=await getRecord(id);
 return {title:r?.name??"档案未找到",description:r?.summary,alternates:{canonical:recordUrl(id)}};
}
export default async function Detail({params}:{params:Promise<{id:string}>}){
 const {id}=await params,r=await getRecord(id);
 if(!r)notFound();
 const related=(await Promise.all(r.related.map(value=>getRecord(value)))).flatMap(value=>value&&value.id!==r.id?[value]:[]);
 const issueHref=correctionUrl(r.name,recordUrl(r.id));
 return <PageShell><main id="main" className="detail-main">
  <div className="breadcrumb"><Link href="/">档案馆</Link><span>/</span><Link href={`/?category=${encodeURIComponent(r.category)}`}>{r.category}</Link><span>/</span><span>{r.name}</span></div>
  <header className="detail-hero">
   <div>
    <div className="eyebrow"><span className="index-label">MEME / {r.id.toUpperCase()}</span></div>
    <h1>{r.name}</h1><p>{r.summary}</p>
    <div className="alias-list">{[...new Set(r.aliases)].filter(value=>value!==r.name).map(value=><span key={value}>{value}</span>)}</div>
    <div className="detail-meta"><span>{r.period||"流行时期待考"}</span><span>{r.sources.length} 个来源</span><span>修订 {dateLabel(r.updatedAt)} · v{r.revision}</span></div>
    <DetailActions key={r.id} id={r.id} name={r.name} initialViews={r.views}/>
    <ReaderActions key={`reader-${r.id}`} record={r} signInUrl={chatGPTSignInPath(`/meme/${encodeURIComponent(r.id)}`)}/>
   </div>
   <div className={`detail-cover tone-${cardTone(r)}`}><span>{r.category}</span><strong>{r.name}</strong><span>{r.year!==null?`${r.year} · 流行记录`:"流行年份待考"}</span></div>
  </header>
  <div className="detail-layout">
   <nav className="article-nav" aria-label="档案目录">
    <a href="#meaning">这个梗是什么意思</a><a href="#origin">从哪里来</a><a href="#spread">怎样流传</a>
    {r.usage.length>0&&<a href="#usage">怎样使用</a>}
    <a href="#evidence">传播与影响力</a><a href="#sources">原始素材与来源</a>
   </nav>
   <article>
    <section id="meaning" className="article-section"><h2><span className="section-number">01</span>这个梗是什么意思</h2><p>{r.definition}</p></section>
    <section id="origin" className="article-section"><h2><span className="section-number">02</span>从哪里来</h2><p>{r.origin}</p></section>
    <section id="spread" className="article-section"><h2><span className="section-number">03</span>怎样流传</h2><p>{r.spread}</p></section>
    {r.usage.length>0&&<section id="usage" className="article-section"><h2><span className="section-number">04</span>怎样使用</h2><ul className="usage-list">{r.usage.map((value,index)=><li key={index}>{value}</li>)}</ul></section>}
    <section id="evidence" className="article-section">
     <h2><span className="section-number">05</span>传播与影响力</h2>
     <div className="evidence-list">{r.evidence.map((value,index)=>{
      const href=sourceHref(value.sourceUrl);
      return <div key={index} className="evidence-item"><h3>{value.label}</h3>{value.value&&<strong>{value.value}</strong>}<p>{value.period}</p>{href?<a href={href} target="_blank" rel="noopener noreferrer">查看依据</a>:<span className="unavailable-link">依据链接待补</span>}</div>;
     })}</div>
     <p className="metric-note">各项指标保留原平台、统计时期与口径；不相加，也不换算成全网热度。</p>
    </section>
    {r.cautions&&<section className="article-section"><h2>读梗小注</h2><p className="info-note">{r.cautions}</p></section>}
    <section id="sources" className="article-section">
     <h2><span className="section-number">06</span>原始素材与来源</h2>
     <ol className="source-list">{r.sources.map((source,index)=>{
      const href=sourceHref(source.url);
      return <li key={`${source.url}-${index}`}><span className="source-index">{String(index+1).padStart(2,"0")}</span><div>{href?<a href={href} target="_blank" rel="noopener noreferrer">{source.title}</a>:<span>{source.title||"未命名来源"}<small className="unavailable-link"> · 来源链接待补</small></span>}<span className="source-type">{source.type}</span><p>{source.note}</p></div></li>;
     })}</ol>
     <p className="metric-note">来源在原平台打开，部分视频可能需要登录；链接失效时可按标题查找原作。</p>
    </section>
    {related.length>0&&<section className="article-section"><h2>记忆之间，也有连接</h2><div className="related-grid">{related.slice(0,4).map(value=><MemeCard key={value.id} record={value}/>)}</div></section>}
   </article>
   <aside className="detail-aside">
    {collections.some(collection=>collection.recordIds.includes(r.id))&&<div className="aside-card"><span className="note-number">CURATED TOGETHER</span><h2>也在这些专题里</h2><div className="collection-detail-links">{collections.filter(collection=>collection.recordIds.includes(r.id)).map(collection=><Link key={collection.slug} href={`/collections/${collection.slug}`}>{collection.title} ↗</Link>)}</div></div>}
    <div className="aside-card"><span className="note-number">ARCHIVE NOTE</span><h2>一份梗，多个版本</h2><p>原作、玩梗和二创各有语境。早期来源无法确认时，档案保留待考说明。</p><Link href="/about">了解收录准则</Link></div>
    <div className="aside-card">
     <h2>发现记录有误？</h2>
     <p>有更早的出处、统计口径或失效链接，可以在 GitHub 提交更正建议。需要 GitHub 账号，提交内容会公开展示。</p>
     <div className="correction-actions">
      <a href={issueHref} target="_blank" rel="noopener noreferrer">在 GitHub 提交更正</a>
      <Link href={`/admin/${r.id}`}>管理员：编辑这份档案</Link>
     </div>
    </div>
   </aside>
  </div>
 </main></PageShell>;
}
