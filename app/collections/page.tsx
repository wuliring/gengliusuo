import Link from "next/link";
import type { Metadata } from "next";
import { PageShell } from "@/components/archive/chrome";
import { CollectionCard } from "@/components/archive/collection-card";
import { getCollectionSummaries } from "@/lib/collection-db";
import { collectionPolicy } from "@/lib/collections";
import { publicSiteOrigin } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const url = new URL("/collections", publicSiteOrigin()).href;
  return {
    title: "策展专题",
    description: "按声音、游戏语境、生活情绪与二创场景，重新组织梗留所的文化档案。",
    alternates: { canonical: url },
    openGraph: { title: "策展专题 · 梗留所", url, type: "website" },
  };
}

export default async function CollectionsPage() {
  const summaries = await getCollectionSummaries();
  return <PageShell active="collections"><main id="main" className="standard-main collections-main">
    <div className="breadcrumb"><Link href="/">档案馆</Link><span>/</span><span>策展专题</span></div>
    <header className="standard-header collection-index-header">
      <div className="eyebrow"><span className="index-label">CURATED CONNECTIONS</span><span>{summaries.length} 个专题</span></div>
      <h1>换一条线索，<br/>重新翻开记忆。</h1>
      <p>从一段循环的声音，到一句照顾自己的话，把散落的档案放在一起读。</p>
    </header>
    <p className="info-note collection-policy">{collectionPolicy} 条目数与年份跨度按当前可阅读的档案计算。</p>
    <section className="collection-grid" aria-label="策展专题">
      {summaries.map((summary, index) => <CollectionCard key={summary.collection.slug} summary={summary} index={index}/>)}
    </section>
    <div className="collection-index-return"><Link className="button secondary" href="/">浏览全部档案</Link></div>
  </main></PageShell>;
}
