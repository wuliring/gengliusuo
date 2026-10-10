import Link from "next/link";
import {PageShell} from "@/components/archive/chrome";
import {FeedSubscribe} from "@/components/archive/feed-subscribe";
import {listRecords} from "@/lib/archive-db";
import {dateLabel} from "@/lib/records";
import {publicSiteOrigin} from "@/lib/public-url";

export const dynamic = "force-dynamic";
export const metadata = {title: "最近修订", description: "查看梗留所最近补全、修订和首次收录的公开档案，也可以通过 RSS 订阅更新。"};

export default async function UpdatesPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await listRecords({sort: "updated", page});
  const feedUrl = new URL("/feed.xml", publicSiteOrigin()).href;
  return <PageShell active="updates">
    <main id="main" className="standard-main updates-main">
      <header className="standard-header">
        <div className="eyebrow"><span className="index-label">THE ARCHIVE, UPDATED</span></div>
        <h1>最近修订</h1>
        <p>按本站最后修订时间排列，初次收录也会出现。这里展示每份档案当前已公开的版本；修订日期指本站编辑日期，流行记录年份保留在档案中。</p>
      </header>
      <div className="updates-toolbar">
        <p className="muted">共 {result.total} 份公开档案，本页 {result.records.length} 份。</p>
        <div className="admin-actions">
          <a className="button secondary" href="/random">随机逛一份</a>
          <a className="button secondary" href="#subscribe">RSS 订阅</a>
        </div>
      </div>
      {result.records.length ? <ol className="updates-list">
        {result.records.map(record => <li className="updates-item" key={record.id}>
          <time className="updates-date" dateTime={record.updatedAt} title={new Date(record.updatedAt).toLocaleString("zh-CN", {timeZone: "Asia/Shanghai"})}>{dateLabel(record.updatedAt)}</time>
          <div className="updates-item-content">
            <h2><Link href={`/meme/${record.id}`}>{record.name}</Link></h2>
            <p>{record.summary}</p>
            <div className="updates-meta">
              <span>{record.category}</span>
              <span>修订 v{record.revision}</span>
              <span>{record.sources.length} 个来源</span>
              <span>{record.year === null ? "流行年份待考" : `${record.year} · 流行记录`}</span>
            </div>
          </div>
          <Link className="button secondary" href={`/meme/${record.id}`}>阅读档案</Link>
        </li>)}
      </ol> : <section className="empty-state">
        <h2>等待下一份公开档案</h2>
        <p>档案发布后，会按最近修订时间出现在这里。RSS 订阅地址已经可以添加到阅读器。</p>
        <Link className="button" href="/">返回档案馆</Link>
      </section>}
      {result.pages > 1 && <nav className="pagination" aria-label="最近修订分页">
        {result.page > 1 && <Link href={result.page === 2 ? "/updates" : `/updates?page=${result.page - 1}`}>上一页</Link>}
        <span>第 {result.page} / {result.pages} 页</span>
        {result.page < result.pages && <Link href={`/updates?page=${result.page + 1}`}>下一页</Link>}
      </nav>}
      <section id="subscribe" className="form-section feed-section" style={{marginTop: 42, scrollMarginTop: 28}}>
        <h2>订阅档案更新</h2>
        <FeedSubscribe feedUrl={feedUrl} />
      </section>
    </main>
  </PageShell>;
}
