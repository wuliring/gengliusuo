"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useState, useTransition, type FormEvent} from "react";
import {Tabs, TabsList, TabsTrigger, TabsContent} from "@/components/ui/tabs";
import {ExportBackup} from "@/components/archive/export-backup";
import {statusLabels, dateLabel, type StoredMeme} from "@/lib/records";

type AdminListProps = {
  records: StoredMeme[];
  status: string;
  q: string;
  page: number;
  pages: number;
  total: number;
};

export function AdminList({records, status, q, page, pages, total}: AdminListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  const hasSearch = Boolean(q.trim());
  const filtered = hasSearch || status !== "all";

  function listUrl(nextStatus = status, nextQuery = q, nextPage?: number) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery);
    if (nextPage && nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? `/admin?${search}` : "/admin";
  }

  function navigate(url: string) {
    startTransition(() => router.push(url));
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const value = new FormData(event.currentTarget).get("q");
    navigate(listUrl(status, typeof value === "string" ? value : ""));
  }

  return <>
    <div className="admin-actions" style={{marginBottom: 22}}>
      <ExportBackup />
      <Link className="button secondary" href="/admin/backup">备份与补回档案</Link>
    </div>
    <form className="admin-search" action="/admin" onSubmit={search} style={{flexWrap: "wrap"}}>
      <input name="q" placeholder="搜索梗名、别名或内容" aria-label="搜索管理档案" value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={100} />
      {status !== "all" && <input name="status" value={status} type="hidden" />}
      <button className="button" type="submit" disabled={pending}>{pending ? "搜索中…" : "搜索"}</button>
      {hasSearch && <Link className="button secondary" href={listUrl(status, "")} onClick={() => setSearchInput("")}>清除搜索</Link>}
      {status !== "all" && <Link className="inline-link" href="/admin" onClick={() => setSearchInput("")}>重置筛选</Link>}
    </form>
    <p className="muted" role="status" aria-live="polite" style={{marginBottom: 18}}>
      {pending ? "正在更新档案列表…" : `${filtered ? "匹配" : "共"} ${total} 份档案，本页 ${records.length} 份。`}
    </p>
    <Tabs className="admin-tabs" value={status} onValueChange={value => navigate(listUrl(value, searchInput))} aria-busy={pending}>
      <TabsList>
        <TabsTrigger value="all" disabled={pending}>全部</TabsTrigger>
        <TabsTrigger value="published" disabled={pending}>已发布</TabsTrigger>
        <TabsTrigger value="draft" disabled={pending}>草稿</TabsTrigger>
        <TabsTrigger value="archived" disabled={pending}>已归档</TabsTrigger>
      </TabsList>
      <TabsContent value={status}>
        {records.length ? <ul className="admin-list">
          {records.map(record => <li key={record.id} className="admin-row">
            <div>
              <h2>{record.name} <span className={`status-badge status-${record.status}`}>{statusLabels[record.status]}</span></h2>
              <p><span>{record.category}</span><span>修订 {dateLabel(record.updatedAt)}</span><span>v{record.revision}</span><span>{record.sources.length} 个来源</span></p>
            </div>
            <Link className="button secondary" href={`/admin/${record.id}`}>编辑档案</Link>
          </li>)}
        </ul> : <div className="empty-state">
          <h3>{filtered ? "没有匹配的档案" : "这里还没有档案"}</h3>
          <p>{filtered ? "可以换个关键词，或清除筛选查看全部档案。" : "开始收录新的记忆，或从本站备份补入缺失档案。"}</p>
          <div className="admin-actions" style={{justifyContent: "center"}}>
            {filtered && <Link className="button secondary" href="/admin" onClick={() => setSearchInput("")}>清除全部筛选</Link>}
            <Link className="button" href="/admin/new">新增档案</Link>
            {!filtered && <Link className="button secondary" href="/admin/backup">导入缺失档案</Link>}
          </div>
        </div>}
      </TabsContent>
    </Tabs>
    {pages > 1 && <nav className="pagination" aria-label="管理分页">
      {page > 1 && <Link href={listUrl(status, q, page - 1)}>上一页</Link>}
      <span>第 {page} / {pages} 页</span>
      {page < pages && <Link href={listUrl(status, q, page + 1)}>下一页</Link>}
    </nav>}
  </>;
}
