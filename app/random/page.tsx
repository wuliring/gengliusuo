import Link from "next/link";
import {redirect} from "next/navigation";
import {PageShell} from "@/components/archive/chrome";
import {getRandomPublishedRecord} from "@/lib/discovery-db";

export const dynamic = "force-dynamic";
export const metadata = {title: "随机逛梗", robots: {index: false, follow: true}};

export default async function RandomPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const excluded = typeof params.exclude === "string" ? params.exclude : undefined;
  const record = await getRandomPublishedRecord(excluded);
  if (record) redirect(`/meme/${encodeURIComponent(record.id)}`);
  return <PageShell>
    <main id="main" className="standard-main random-main">
      <header className="standard-header">
        <div className="eyebrow"><span className="index-label">A CHANCE ENCOUNTER</span></div>
        <h1>随机逛梗</h1>
        <p>从已发布的档案中，遇见一段互联网记忆。</p>
      </header>
      <section className="empty-state">
        <h2>暂时没有可随机打开的档案</h2>
        <p>档案发布后，就能从这里随机发现。你也可以先了解我们的收录方式。</p>
        <div className="admin-actions" style={{justifyContent: "center"}}>
          <Link className="button" href="/">返回档案馆</Link>
          <Link className="button secondary" href="/about">阅读收录准则</Link>
        </div>
      </section>
    </main>
  </PageShell>;
}
