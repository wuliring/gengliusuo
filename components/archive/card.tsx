import Link from "next/link";
import {cardTone,type StoredMeme} from "@/lib/records";

export function MemeCard({record:r,index=0}:{record:StoredMeme;index?:number}){
 return <Link href={`/meme/${r.id}`} className={`meme-card tone-${cardTone(r)}`} style={{"--delay":`${Math.min(index,8)*30}ms`} as React.CSSProperties}>
  <div className="card-cover">
   <span className="cover-class">{r.category}</span>
   <span className="cover-name" lang={/^[A-Za-z\s]+$/.test(r.name)?"en":undefined}>{r.name}</span>
   <span className="cover-period">{r.year??"流行年份待考"}<span>INTERNET MEMORY</span></span>
  </div>
  <div className="card-body">
   <div className="card-title"><h2>{r.name}</h2><span className="file-symbol" aria-hidden="true">＋</span></div>
   <p>{r.summary}</p>
   <div className="card-meta"><span>{r.period||"流行时期待考"}</span><span>{r.sources.length} 个来源</span></div>
  </div>
 </Link>;
}
