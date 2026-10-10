"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
import {z} from "zod";
import {Tabs, TabsList, TabsTrigger, TabsContent} from "@/components/ui/tabs";
import {AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {useReader} from "@/components/archive/reader-provider";
import {readerEntrySchema, READER_ENTRY_LIMIT, type ReaderEntry} from "@/lib/reader-types";
import {categories, dateLabel, type StoredMeme} from "@/lib/records";

const libraryTabs = ["favorites", "unread", "read", "history"] as const;
type LibraryTab = typeof libraryTabs[number];
const tabLabels: Record<LibraryTab, string> = {favorites: "收藏", unread: "收藏未读", read: "已读", history: "最近足迹"};
const backupSchema = z.object({format: z.literal("gengliusuo-reader"), formatVersion: z.literal(1), entries: z.array(readerEntrySchema).max(READER_ENTRY_LIMIT)}).strict();
type Feedback = {area: "main" | "backup"; error: boolean; text: string};
type ImportPreview = {fileName: string; entries: ReaderEntry[]};

function normalizeTab(value: string): LibraryTab {
  return libraryTabs.includes(value as LibraryTab) ? value as LibraryTab : "favorites";
}

function inTab(entry: ReaderEntry, tab: LibraryTab) {
  return tab === "favorites" ? entry.favorite : tab === "unread" ? entry.favorite && !entry.read : tab === "read" ? entry.read : entry.lastVisitedAt !== null;
}

function entryTime(entry: ReaderEntry, tab: LibraryTab) {
  return tab === "history" ? entry.lastVisitedAt : tab === "read" ? entry.readAt : entry.favoritedAt;
}

function timeLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "时间未记录";
  return new Date(value).toLocaleString("zh-CN", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false});
}

function backupIssues(issues: z.ZodIssue[]) {
  const names: Record<string, string> = {format: "文件格式", formatVersion: "格式版本", entries: "个人记录", id: "档案地址", favorite: "收藏标记", favoritedAt: "收藏时间", read: "已读标记", readAt: "已读时间", lastVisitedAt: "最近到访时间"};
  const lines = issues.slice(0, 10).map(issue => {
    const label = issue.path.map(part => typeof part === "number" ? `第 ${part + 1} 条` : names[part] || part).join(" / ") || "备份文件";
    const message = issue.code === "invalid_literal" ? "格式或版本不受支持，请选择本站导出的个人档案夹备份。" :
      issue.code === "unrecognized_keys" ? "包含不支持的字段；个人备份只接受档案地址和阅读标记，不接受身份信息。" :
      issue.code === "too_big" ? `最多 ${issue.maximum} ${issue.type === "array" ? "条记录" : "个字符"}。` :
      issue.code === "too_small" ? `至少需要 ${issue.minimum} ${issue.type === "array" ? "条记录" : "个字符"}。` :
      issue.code === "invalid_type" ? "字段缺失或类型不正确，请使用本站导出的原始文件。" : issue.message;
    return `${label}：${message}`;
  });
  if (issues.length > lines.length) lines.push(`另有 ${issues.length - lines.length} 处字段问题，请修正后重新选择文件。`);
  return lines.join("\n");
}

export function ReaderLibraryView({initialTab, signInUrl, signOutUrl}: {initialTab: string; signInUrl: string; signOutUrl: string}) {
  const reader = useReader();
  const router = useRouter();
  const [tab, setTab] = useState<LibraryTab>(normalizeTab(initialTab));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [importError, setImportError] = useState("");
  const locked = useRef(false);
  const nextDownloadAt = useRef({current: 0, guest: 0});
  const selection = useRef(0);

  useEffect(() => {setTab(normalizeTab(initialTab)); setPage(1);}, [initialTab]);
  const recordMap = useMemo(() => new Map(reader.records.filter(record => record.status === "published").map(record => [record.id, record])), [reader.records]);
  const counts = useMemo(() => Object.fromEntries(libraryTabs.map(value => [value, reader.entries.filter(entry => inTab(entry, value)).length])) as Record<LibraryTab, number>, [reader.entries]);
  const filtered = useMemo(() => {
    const terms = query.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
    return reader.entries.filter(entry => {
      if (!inTab(entry, tab)) return false;
      const record = recordMap.get(entry.id);
      if (category && record?.category !== category) return false;
      const text = [entry.id, record?.name ?? "", ...(record?.aliases ?? []), record?.summary ?? ""].join(" ").normalize("NFKC").toLowerCase();
      return terms.every(term => text.includes(term));
    }).sort((a, b) => {
      const first = Date.parse(entryTime(a, tab) || "") || 0;
      const second = Date.parse(entryTime(b, tab) || "") || 0;
      return (sort === "oldest" ? first - second : second - first) || a.id.localeCompare(b.id);
    });
  }, [reader.entries, recordMap, query, category, tab, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 24, currentPage * 24);
  const disabled = !reader.ready || reader.busy || operation !== null;
  const hasFilters = Boolean(query.trim() || category);
  useEffect(() => setPage(current => Math.min(current, pages)), [pages]);

  async function perform<T>(name: string, action: () => T | Promise<T>, success: string | ((value: T) => string)) {
    const guestExport = name === "backup-export-guest";
    if (locked.current || (!guestExport && reader.busy) || (!guestExport && name !== "refresh" && !reader.ready)) return;
    locked.current = true;
    setOperation(name);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({area: name.startsWith("backup-") ? "backup" : "main", error: false, text: typeof success === "function" ? success(result) : success});
    } catch (error) {
      setFeedback({area: name.startsWith("backup-") ? "backup" : "main", error: true, text: error instanceof Error ? error.message : "暂时无法完成，请稍后重试。"});
    } finally {
      locked.current = false;
      setOperation(null);
    }
  }

  function resetFilters() {setQuery(""); setCategory(""); setSort("recent"); setPage(1);}
  function changeTab(value: string) {
    const next = normalizeTab(value);
    setTab(next);
    setPage(1);
    router.replace(`/library?tab=${next}`, {scroll: false});
  }

  async function selectFile(file: File | undefined) {
    if (locked.current || reader.busy) return;
    const currentSelection = ++selection.current;
    setPreview(null);
    setImportError("");
    setFileName(file?.name || "");
    setReadingFile(Boolean(file));
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("个人备份文件不能超过 1MB，请选择本站导出的档案夹 JSON 文件。");
      const text = await file.text();
      if (currentSelection !== selection.current) return;
      let value: unknown;
      try {value = JSON.parse(text);} catch {throw new Error("文件不是有效的 JSON，请重新选择本站导出的个人档案夹备份。");}
      const parsed = backupSchema.safeParse(value);
      if (!parsed.success) throw new Error(backupIssues(parsed.error.issues));
      const ids = new Map<string, number>();
      parsed.data.entries.forEach((entry, index) => {
        const previous = ids.get(entry.id);
        if (previous !== undefined) throw new Error(`第 ${index + 1} 条记录的档案地址「${entry.id}」与第 ${previous + 1} 条重复，请整理后重新选择文件。`);
        ids.set(entry.id, index);
      });
      if (currentSelection === selection.current) setPreview({fileName: file.name, entries: parsed.data.entries});
    } catch (error) {
      if (currentSelection === selection.current) setImportError(error instanceof Error ? error.message : "文件无法读取，请重新选择。");
    } finally {
      if (currentSelection === selection.current) setReadingFile(false);
    }
  }

  function clearFile() {selection.current++; setPreview(null); setFileName(""); setImportError(""); setReadingFile(false);}

  function exportEntries(guestOnly = false) {
    const source = guestOnly ? "guest" : "current";
    if (Date.now() < nextDownloadAt.current[source]) return;
    return perform(guestOnly ? "backup-export-guest" : "backup-export", () => {
      nextDownloadAt.current[source] = Date.now() + 600;
      const snapshot = guestOnly ? reader.getGuestEntries() : reader.entries;
      const entries = snapshot.map(({id, favorite, favoritedAt, read, readAt, lastVisitedAt}) => ({id, favorite, favoritedAt, read, readAt, lastVisitedAt}));
      const blob = new Blob([JSON.stringify({format: "gengliusuo-reader", formatVersion: 1, entries}, null, 2)], {type: "application/json;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `梗留所${guestOnly ? "本机游客记录" : "个人档案夹"}-${dateLabel(new Date().toISOString())}.json`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      try {anchor.click();} finally {anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);}
      return entries.length;
    }, count => `已开始下载 ${count} 条${guestOnly ? "本机游客" : "个人"}记录，请在浏览器下载记录中查看。`);
  }

  function importEntries() {
    if (!preview || !preview.entries.length) return;
    const current = preview;
    return perform("backup-import", async () => {
      await reader.importGuestEntries(current.entries);
      clearFile();
    }, `已处理 ${current.entries.length} 条备份记录，并入游客档案夹。${reader.authenticated ? "如需保存到账号，请再确认合并本机记录。" : "登录后可以再确认合并到账号。"}`);
  }

  function patch(record: StoredMeme, entry: ReaderEntry, field: "favorite" | "read") {
    const value = !entry[field];
    return perform(`${field}-${entry.id}`, () => reader.patchRecord(record, {[field]: value}), field === "favorite" ? (value ? "已收藏这份档案。" : "已取消收藏。") : (value ? "已标记为已读。" : "已取消已读标记。"));
  }

  function feedbackFor(area: Feedback["area"]) {
    return feedback?.area === area ? <p className={`save-feedback reader-feedback${feedback.error ? " error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p> : null;
  }

  return <main id="main" className="standard-main reader-library">
    <header className="standard-header">
      <div className="eyebrow"><span className="index-label">YOUR READING ARCHIVE</span></div>
      <h1>我的档案夹</h1>
      <p>{reader.authenticated ? "收藏、已读标记和足迹随当前账号保存，登录同一账号即可在其他设备查看。" : "游客记录保存在当前浏览器，登录后可以自行确认合并到账号。"}</p>
      <p className="muted">浏览器禁用本地存储时，游客记录仅暂存于本页；刷新前可先导出，或登录后确认合并。</p>
    </header>
    <div className="reader-toolbar">
      <div className="admin-actions">
        <button className="button secondary" type="button" disabled={reader.busy || operation !== null || reader.catalogLoading} onClick={() => void perform("refresh", () => reader.refresh(), "档案夹与公开档案信息已刷新。")}>{operation === "refresh" ? "正在刷新…" : reader.ready ? "刷新档案夹" : "重新加载档案夹"}</button>
        {reader.authenticated ? <a className="button secondary" href={signOutUrl} target="_top">退出当前账号</a> : <a className="button" href={signInUrl} target="_top">登录并跨设备保存</a>}
        <AlertDialog>
          <AlertDialogTrigger asChild><button className="button secondary" type="button" disabled={disabled || !counts.history}>清除足迹</button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>清除最近足迹？</AlertDialogTitle><AlertDialogDescription>将清除{reader.authenticated ? "当前账号" : "当前浏览器"}的到访时间。收藏与已读标记会保留。</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => void perform("clear-history", () => reader.clearHistory(), "最近足迹已清除，收藏与已读标记已保留。")}>确认清除足迹</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
    {!reader.ready && <p className="muted" role="status">正在读取个人档案夹…</p>}
    {reader.error && reader.error !== feedback?.text && <p className="save-feedback error" role="alert">{reader.error}</p>}
    {(operation || reader.busy) && <p className="muted" role="status">正在处理，请稍候…</p>}
    {feedbackFor("main")}
    {reader.ready && reader.guestCount > 0 && <section className="info-note reader-guest-panel">
      <h2>本机游客记录 · {reader.guestCount} 条</h2>
      <p>{reader.authenticated ? "这些记录仍在当前浏览器的游客档案夹。只有你确认合并后，才会写入当前账号。" : "这些记录属于当前浏览器。登录同一账号后，可以再确认合并，实现跨设备保存。"}</p>
      <div className="admin-actions" style={{marginTop: 14}}>
        {reader.authenticated && <AlertDialog>
          <AlertDialogTrigger asChild><button className="button" type="button" disabled={disabled}>合并本机记录到账号</button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>合并本机游客记录到当前账号？</AlertDialogTitle><AlertDialogDescription>将处理 {reader.guestCount} 条游客记录，并与当前账号的同地址记录合并。成功接收且期间未修改的记录会从游客档案夹移除；其余记录可稍后处理。</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => void perform("merge-guest", () => reader.mergeGuest(), value => `合并完成：合并 ${value.merged} 条记录，跳过 ${value.skipped} 条。仍留在本机的记录可以稍后处理。`)}>确认合并到账号</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
        <AlertDialog>
          <AlertDialogTrigger asChild><button className="button secondary" type="button" disabled={disabled}>清理本机游客记录</button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>清理本机游客记录？</AlertDialogTitle><AlertDialogDescription>将清除当前浏览器游客档案夹中的收藏、已读标记和足迹。{reader.authenticated ? "需要留存的可用记录可以先确认合并到账号，再导出账号记录。当前账号的记录会保留。" : "需要留存时，可先导出个人记录，或登录并确认合并。"}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => void perform("clear-guest", () => reader.clearGuestEntries(), "本页游客记录已清理。")}>确认清理游客记录</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>}
    <Tabs className="reader-tabs" value={tab} onValueChange={changeTab}>
      <TabsList aria-label="个人记录分类">{libraryTabs.map(value => <TabsTrigger key={value} value={value}>{tabLabels[value]} <span>{counts[value]}</span></TabsTrigger>)}</TabsList>
      <TabsContent value={tab}>
    <div className="reader-filters">
      <label className="field">搜索档案夹<input type="search" value={query} onChange={event => {setQuery(event.target.value); setPage(1);}} maxLength={100} placeholder="梗名、别名或档案地址" /></label>
      <label className="field">分类<select value={category} onChange={event => {setCategory(event.target.value); setPage(1);}}><option value="">全部分类</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <label className="field">时间排序<select value={sort} onChange={event => {setSort(event.target.value); setPage(1);}}><option value="recent">最近记录在前</option><option value="oldest">较早记录在前</option></select></label>
      <button className="button secondary" type="button" onClick={resetFilters} disabled={!query && !category && sort === "recent" && currentPage === 1}>重置筛选</button>
    </div>
    <p className="muted" style={{marginBottom: 18}} role="status">{tabLabels[tab]} · 匹配 {filtered.length} 条，本页 {visible.length} 条。不可用档案只保留个人引用。</p>
    {reader.catalogLoading ? <p className="muted" role="status">正在读取公开档案信息…</p> : reader.ready && (visible.length ? <ul className="reader-list">
      {visible.map(entry => {
        const record = recordMap.get(entry.id);
        const time = entryTime(entry, tab);
        return <li className={`reader-item${record ? "" : " reader-unavailable"}`} key={entry.id}>
          <div className="reader-item-content">
            <h2>{record ? <Link href={`/meme/${record.id}`}>{record.name}</Link> : "档案暂不可用"}</h2>
            <p>{record?.summary || "这份档案目前无法在公开目录中找到。可保留个人引用，或移除这条记录。"}</p>
            <div className="reader-meta"><span>{record?.category || entry.id}</span><span>{entry.favorite ? "已收藏" : "未收藏"}</span><span>{entry.read ? "已读" : "未读"}</span><span>{tab === "history" ? "到访" : tab === "read" ? "已读" : "收藏"} · {time ? <time dateTime={time}>{timeLabel(time)}</time> : "时间未记录"}</span></div>
          </div>
          <div className="reader-item-actions admin-actions">
            {record && <>
              <Link className="button" href={`/meme/${record.id}`}>阅读档案</Link>
              <button className="button secondary" type="button" aria-pressed={entry.favorite} disabled={disabled} onClick={() => void patch(record, entry, "favorite")}>{entry.favorite ? "取消收藏" : "收藏"}</button>
              <button className="button secondary" type="button" aria-pressed={entry.read} disabled={disabled} onClick={() => void patch(record, entry, "read")}>{entry.read ? "标为未读" : "标为已读"}</button>
            </>}
            <button className="button secondary" type="button" disabled={disabled} onClick={() => void perform(`remove-${entry.id}`, () => reader.remove(entry.id), "这份档案的个人引用与阅读标记已移除。")}>{record ? "移除此记录" : "移除此引用"}</button>
          </div>
        </li>;
      })}
    </ul> : <section className="empty-state">
      <h2>{hasFilters ? "没有匹配的个人记录" : tab === "favorites" ? "还没有收藏的档案" : tab === "unread" ? "没有收藏未读的档案" : tab === "read" ? "还没有已读标记" : "还没有最近足迹"}</h2>
      <p>{hasFilters ? "换个关键词，或清除分类筛选试试。" : tab === "history" ? "实际打开档案后，足迹会记录在这里。" : "阅读档案时，可以收藏或手动标记已读。"}</p>
      <div className="admin-actions" style={{justifyContent: "center"}}>{hasFilters && <button className="button secondary" type="button" onClick={resetFilters}>清除筛选</button>}<Link className="button" href="/">去档案馆逛逛</Link></div>
    </section>)}
    {pages > 1 && <nav className="pagination" aria-label="个人档案夹分页">
      <button className="button secondary" type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>上一页</button>
      <span>第 {currentPage} / {pages} 页</span>
      <button className="button secondary" type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>下一页</button>
    </nav>}
      </TabsContent>
    </Tabs>
    <section className="form-section reader-backup-panel" style={{marginTop: 36}}>
      <h2>个人档案夹备份</h2>
      <p className="form-header-note">备份只包含档案地址、收藏与已读标记、记录时间，不包含登录身份或档案正文。导出当前{reader.authenticated ? "账号" : "浏览器"}使用的个人记录；导入先合入本机游客档案夹，登录后需要另行确认合并。</p>
      <div className="admin-actions" style={{marginBottom: 20}}>
        <button className="button secondary" type="button" disabled={disabled} onClick={() => void exportEntries()}>{operation === "backup-export" ? "正在准备下载…" : "导出当前个人记录"}</button>
        {reader.guestCount > 0 && <button className="button secondary" type="button" disabled={operation !== null} onClick={() => void exportEntries(true)}>{operation === "backup-export-guest" ? "正在准备游客备份…" : "导出本机游客记录"}</button>}
      </div>
      {reader.guestCount > 0 && <p className="muted" style={{marginBottom: 18}}>本机游客备份只导出当前浏览器的游客记录快照。登录状态或网络尚未载入时，也可以先下载这份备份，留存当前页面的增量。</p>}
      <label className="field">选择个人档案夹 JSON 备份<input type="file" accept=".json,application/json" disabled={disabled} onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void selectFile(file);}} /><small>格式 gengliusuo-reader，版本 1。文件不超过 1MB，最多 {READER_ENTRY_LIMIT} 条记录。</small></label>
      {fileName && <p className="muted" style={{overflowWrap: "anywhere", marginBottom: 12}}>文件：{fileName}</p>}
      {readingFile && <p className="muted" role="status">正在读取并检查个人备份…</p>}
      {importError && <p className="save-feedback error" role="alert">{importError}</p>}
      {preview && <p className="info-note" style={{marginBottom: 18}}>{preview.entries.length ? `已检查 ${preview.entries.length} 条个人记录。相同地址将按标记和时间合并到游客档案夹。` : "这份备份没有个人记录，无需导入。"}</p>}
      <div className="admin-actions">
        <button className="button" type="button" disabled={disabled || readingFile || !preview?.entries.length} onClick={() => void importEntries()}>{operation === "backup-import" ? "正在合入…" : "合入本机游客记录"}</button>
        {(fileName || preview || readingFile) && <button className="button secondary" type="button" disabled={disabled} onClick={clearFile}>清除文件</button>}
      </div>
      <div style={{marginTop: 18}}>{feedbackFor("backup")}</div>
    </section>
  </main>;
}
