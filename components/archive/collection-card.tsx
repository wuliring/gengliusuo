import Link from "next/link";
import type { CollectionSummary } from "@/lib/collection-db";

export function CollectionCard({ summary, index = 0 }: { summary: CollectionSummary; index?: number }) {
  const { collection, count, yearSpan, unknownYearCount, categories, representatives } = summary;
  const href = "/collections/" + collection.slug;
  return <article className={"collection-card tone-" + collection.tone}>
    <div className="collection-card-top">
      <span className="collection-index">{String(index + 1).padStart(2, "0")} / 专题</span>
      <span className="collection-count">{count} 份可读档案</span>
    </div>
    <h2><Link href={href}>{collection.title}</Link></h2>
    <p className="collection-description">{collection.description}</p>
    <div className="collection-meta">
      <span>{count ? "流行记录 " + yearSpan : "暂无已发布档案"}</span>
      {unknownYearCount > 0 && summary.years.length > 0 && <span>另有 {unknownYearCount} 份年份待考</span>}
      {categories.length > 0 && <span>{categories.join(" / ")}</span>}
    </div>
    {representatives.length > 0 && <div className="collection-representatives">
      <p>从这几份读起</p>
      <ul>{representatives.map((record) => <li key={record.id}>
        <Link href={"/meme/" + record.id}>{record.name}<span>{record.year ?? "待考"}</span></Link>
      </li>)}</ul>
    </div>}
    <Link className="collection-open" href={href}>打开专题 <span aria-hidden="true">↗</span></Link>
  </article>;
}
