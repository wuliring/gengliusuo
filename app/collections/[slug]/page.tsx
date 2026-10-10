import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/archive/chrome";
import { MemeCard } from "@/components/archive/card";
import { getCollectionSummary } from "@/lib/collection-db";
import { collectionPolicy, getCollection } from "@/lib/collections";
import { categories } from "@/lib/records";
import { publicSiteOrigin } from "@/lib/public-url";

export const dynamic = "force-dynamic";
type QueryParams = Record<string, string | string[] | undefined>;
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<QueryParams> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();
  const url = new URL("/collections/" + collection.slug, publicSiteOrigin()).href;
  return {
    title: collection.title + " · 策展专题",
    description: collection.description,
    alternates: { canonical: url },
    openGraph: { title: collection.title + " · 梗留所", description: collection.description, url, type: "website" },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const summary = await getCollectionSummary(slug);
  if (!summary) notFound();
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const requestedCategory = value("category");
  const category = categories.includes(requestedCategory as (typeof categories)[number]) ? requestedCategory : "";
  const requestedYear = value("year");
  const year = requestedYear === "unknown" || (/^\d{4}$/.test(requestedYear) && Number(requestedYear) >= 1990 && Number(requestedYear) <= 2100)
    ? requestedYear : "";
  const records = summary.records.filter((record) =>
    (!category || record.category === category)
    && (!year || (year === "unknown" ? record.year === null : record.year === Number(year))),
  );
  const filtered = Boolean(category || year);
  const { collection } = summary;
  const href = "/collections/" + collection.slug;
  const selectedCategoryMissing = Boolean(category) && !summary.categories.some((item) => item === category);
  const selectedYearMissing = Boolean(year) && year !== "unknown" && !summary.years.includes(Number(year));

  return <PageShell active="collections"><main id="main" className="standard-main collection-detail-main">
    <div className="breadcrumb"><Link href="/">档案馆</Link><span>/</span><Link href="/collections">策展专题</Link><span>/</span><span>{collection.title}</span></div>
    <header className={"standard-header collection-detail-header tone-" + collection.tone}>
      <div className="eyebrow"><span className="index-label">CURATED / {collection.slug.toUpperCase()}</span></div>
      <h1>{collection.title}</h1>
      <p>{collection.description}</p>
      <div className="collection-detail-meta">
        <span>{summary.count} 份可读档案</span>
        <span>{summary.count ? "流行记录 " + summary.yearSpan : "等待档案发布"}</span>
        {summary.unknownYearCount > 0 && <span>{summary.unknownYearCount} 份年份待考</span>}
        {summary.categories.length > 0 && <span>{summary.categories.join(" / ")}</span>}
      </div>
    </header>
    <section className="collection-curator-note" aria-label="策展说明">
      <h2>这组档案怎样读</h2>
      <p>{collection.readingNote}</p>
      <p className="muted">{collectionPolicy}</p>
    </section>
    <form className="collection-filter-form" action={href} method="get" key={category + ":" + year}>
      <label>分类<select name="category" defaultValue={category}>
        <option value="">全部分类</option>
        {summary.categories.map((item) => <option key={item} value={item}>{item}</option>)}
        {selectedCategoryMissing && <option value={category}>{category}（暂无匹配）</option>}
      </select></label>
      <label>流行记录年份<select name="year" defaultValue={year}>
        <option value="">所有年份</option>
        {summary.years.map((item) => <option key={item} value={String(item)}>{item} 年</option>)}
        {(summary.unknownYearCount > 0 || year === "unknown") && <option value="unknown">年份待考</option>}
        {selectedYearMissing && <option value={year}>{year} 年（暂无匹配）</option>}
      </select></label>
      <button className="button" type="submit">筛选档案</button>
      {filtered && <Link className="button secondary" href={href}>重置筛选</Link>}
    </form>
    <div className="result-heading">
      <h2>{filtered ? "筛选后的专题档案" : "专题档案"}<span>{records.length} 份记录</span></h2>
      <span className="result-hint">按流行记录年份由新到旧；年份未知的档案置后</span>
    </div>
    {records.length > 0 ? <div className="collection-reading-layout">
      <nav className="collection-reading-directory" aria-label="专题阅读目录">
        <h2>阅读目录</h2>
        <ol>{records.map((record, index) => <li key={record.id}>
          <a href={"#record-" + record.id}><span className="collection-directory-number">{String(index + 1).padStart(2, "0")}</span><span>{record.name}</span><small>{record.year ?? "待考"}</small></a>
        </li>)}</ol>
      </nav>
      <section className="collection-records" aria-label="专题档案卡片">
        <div className="card-grid collection-record-grid">{records.map((record, index) =>
          <div className="collection-record" id={"record-" + record.id} key={record.id}><MemeCard record={record} index={index}/></div>,
        )}</div>
      </section>
    </div> : <div className="empty-state">
      <h2>{summary.count ? "当前筛选没有匹配档案" : "这一专题暂时没有可阅读档案"}</h2>
      <p>{summary.count ? "可以重置分类或年份，再从专题目录读起。" : "该专题收录的档案发布后，会出现在这里。"}</p>
      <div className="collection-empty-actions">
        {filtered && <Link className="button" href={href}>重置筛选</Link>}
        <Link className="button secondary" href="/collections">查看其他专题</Link>
      </div>
    </div>}
    <div className="collection-detail-return"><Link className="button secondary" href="/collections">返回全部专题</Link><Link className="inline-link" href="/">浏览全部档案</Link></div>
  </main></PageShell>;
}
