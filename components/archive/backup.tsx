"use client";

import {useRef, useState} from "react";
import Link from "next/link";
import {AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogHeader, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {requestJson, RequestError} from "@/lib/client-request";
import {recordSchema, formatRecordIssues, type Meme} from "@/lib/records";

const MAX_BATCH_RECORDS = 100;
const MAX_BATCH_BYTES = 4_500_000;
const EMPTY_ENVELOPE = '{"format":"gengliusuo-archive","formatVersion":1,"records":[]}';
type FieldIssue = {path: (string | number)[]; message: string};
type ImportBatch = {body: string; count: number; firstRecord: number};
type ImportPlan = {fileName: string; records: Meme[]; batches: ImportBatch[]};
type ImportProgress = {completed: number; imported: number; skipped: number};
const initialProgress: ImportProgress = {completed: 0, imported: 0, skipped: 0};

const fieldNames: Record<string, string> = {
  id: "档案地址", name: "梗名", aliases: "别名", category: "分类", period: "流行时期", year: "记录年份",
  summary: "摘要", definition: "含义", origin: "来历", spread: "传播记录", usage: "使用示例", cautions: "使用提醒",
  related: "关联档案", sources: "来源", evidence: "传播证据", title: "标题", url: "链接", type: "类型", note: "说明",
  label: "证据名称", value: "证据内容", sourceUrl: "来源链接", status: "状态",
};

function describeIssues(issues: FieldIssue[], records: unknown[], firstRecord = 0) {
  const lines = issues.slice(0, 12).map(issue => {
    const recordIndex = issue.path[0] === "records" && typeof issue.path[1] === "number" ? issue.path[1] : null;
    const record = recordIndex === null ? null : records[recordIndex];
    const name = record && typeof record === "object" && "name" in record && typeof record.name === "string" ? record.name : "";
    const label = recordIndex === null ? "备份文件" : `第 ${firstRecord + recordIndex + 1} 份档案${name ? `「${name}」` : ""}`;
    const path = (recordIndex === null ? issue.path : issue.path.slice(2)).map(part => typeof part === "number" ? `第 ${part + 1} 项` : (fieldNames[part] || part)).join(" / ");
    const separator = issue.message.indexOf("：");
    const detail = separator >= 0 ? issue.message.slice(separator + 1) : issue.message;
    return `${label}${path ? ` · ${path}` : ""}：${detail}`;
  });
  if (issues.length > lines.length) lines.push(`另有 ${issues.length - lines.length} 处问题，请修改后重新选择文件。`);
  return lines.join("\n");
}

function prepareBackup(value: unknown, fileName: string): ImportPlan {
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== "gengliusuo-archive" ||
      !("formatVersion" in value) || value.formatVersion !== 1 || !("records" in value) || !Array.isArray(value.records)) {
    throw new Error("备份文件格式不正确。请选择本站导出的 gengliusuo-archive 格式 1 JSON 文件。");
  }
  if (!value.records.length) throw new Error("这份备份没有档案，无需导入。");

  const records: Meme[] = [];
  const issues: FieldIssue[] = [];
  const ids = new Map<string, number>();
  value.records.forEach((record: unknown, index: number) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      issues.push({path: ["records", index], message: "档案必须是包含各个字段的对象。"});
      return;
    }
    const parsed = recordSchema.safeParse({...record, status: "draft"});
    if (!parsed.success) {
      issues.push(...formatRecordIssues(parsed.error.issues).map(issue => ({...issue, path: ["records", index, ...issue.path]})));
      return;
    }
    const previous = ids.get(parsed.data.id);
    if (previous !== undefined) {
      issues.push({path: ["records", index, "id"], message: `与第 ${previous + 1} 份档案的地址重复，请保留一份后重新选择文件。`});
    } else {
      ids.set(parsed.data.id, index);
    }
    records.push(parsed.data);
  });
  if (issues.length) throw new Error(`备份尚未导入，请先修正以下字段：\n${describeIssues(issues, value.records)}`);

  const encoder = new TextEncoder();
  const envelopeBytes = encoder.encode(EMPTY_ENVELOPE).byteLength;
  const batches: ImportBatch[] = [];
  let parts: string[] = [];
  let bytes = envelopeBytes;
  let firstRecord = 0;
  function finishBatch() {
    if (!parts.length) return;
    batches.push({body: `{"format":"gengliusuo-archive","formatVersion":1,"records":[${parts.join(",")}]}`, count: parts.length, firstRecord});
    firstRecord += parts.length;
    parts = [];
    bytes = envelopeBytes;
  }
  records.forEach((record, index) => {
    const serialized = JSON.stringify(record);
    const size = encoder.encode(serialized).byteLength;
    if (envelopeBytes + size >= MAX_BATCH_BYTES) {
      throw new Error(`第 ${index + 1} 份档案「${record.name}」的单条内容过大，无法安全导入。请缩短该档案的内容后重新选择文件。`);
    }
    if (parts.length >= MAX_BATCH_RECORDS || bytes + size + (parts.length ? 1 : 0) >= MAX_BATCH_BYTES) finishBatch();
    bytes += size + (parts.length ? 1 : 0);
    parts.push(serialized);
  });
  finishBatch();
  return {fileName, records, batches};
}

export function Backup() {
  const selection = useRef(0);
  const requestLocked = useRef(false);
  const planRef = useRef<ImportPlan | null>(null);
  const progressRef = useRef<ImportProgress>({...initialProgress});
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({...initialProgress});
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = Boolean(plan && progress.completed === plan.batches.length);

  async function select(file: File | undefined) {
    if (requestLocked.current) return;
    const currentSelection = ++selection.current;
    planRef.current = null;
    progressRef.current = {...initialProgress};
    setPlan(null);
    setProgress({...initialProgress});
    setError("");
    setReading(Boolean(file));
    if (!file) return;
    try {
      const text = await file.text();
      if (currentSelection !== selection.current) return;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error("文件不是有效的 JSON。请使用本站导出的原始备份文件，或检查 JSON 语法后重新选择。");
      }
      const prepared = prepareBackup(value, file.name);
      if (currentSelection !== selection.current) return;
      planRef.current = prepared;
      setPlan(prepared);
    } catch (cause) {
      if (currentSelection === selection.current) setError(cause instanceof Error ? cause.message : "文件无法读取，请重新选择。");
    } finally {
      if (currentSelection === selection.current) setReading(false);
    }
  }

  function clearSelection() {
    if (requestLocked.current) return;
    selection.current++;
    planRef.current = null;
    progressRef.current = {...initialProgress};
    setPlan(null);
    setProgress({...initialProgress});
    setReading(false);
    setError("");
  }

  async function importBackup() {
    const currentPlan = planRef.current;
    if (requestLocked.current || !currentPlan || progressRef.current.completed >= currentPlan.batches.length) return;
    requestLocked.current = true;
    setBusy(true);
    setError("");
    try {
      while (progressRef.current.completed < currentPlan.batches.length) {
        const batch = currentPlan.batches[progressRef.current.completed];
        let data: {imported: number; skipped: number};
        try {
          data = await requestJson<{imported: number; skipped: number}>("/api/admin/import", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: batch.body,
          });
        } catch (cause) {
          if (cause instanceof RequestError && cause.issues?.length) {
            throw new Error(describeIssues(cause.issues, currentPlan.records.slice(batch.firstRecord, batch.firstRecord + batch.count), batch.firstRecord));
          }
          if (cause instanceof RequestError && (cause.status === 401 || cause.status === 403)) {
            throw new Error(`${cause.message}\n请确认登录状态和管理权限，再点击重试。`);
          }
          throw cause;
        }
        if (!data || !Number.isInteger(data.imported) || !Number.isInteger(data.skipped) || data.imported < 0 || data.skipped < 0 || data.imported + data.skipped !== batch.count) {
          throw new Error("服务器没有返回完整的导入结果，请重试当前批次；已存在的档案会自动跳过。");
        }
        progressRef.current = {
          completed: progressRef.current.completed + 1,
          imported: progressRef.current.imported + data.imported,
          skipped: progressRef.current.skipped + data.skipped,
        };
        setProgress({...progressRef.current});
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "暂时无法导入，请稍后重试。";
      setError(`第 ${progressRef.current.completed + 1} / ${currentPlan.batches.length} 批尚未完成。\n${detail}\n已完成的批次已保存，点击重试将从这一批继续；若请求中断前已写入部分档案，重试时会跳过已有记录。`);
    } finally {
      requestLocked.current = false;
      setBusy(false);
    }
  }

  return <section className="form-section" aria-busy={busy || reading}>
    <h2>从备份中补回缺失档案</h2>
    <p className="form-header-note">只补入当前站点尚不存在的档案，相同地址的已有内容会跳过。新增记录统一保存为草稿，审阅后再发布。此操作不覆盖已有档案，也不恢复原站点的阅读次数、发布状态或修订历史。</p>
    <label className="field">选择 JSON 备份文件
      <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        void select(file);
      }} />
      <small>可直接选择本站完整导出的备份。网站先检查全部档案，再按每批最多 100 份、低于 4.5MB 自动拆分，无需手工修改文件。</small>
    </label>
    {reading && <p className="muted" role="status">正在读取并检查整份备份…</p>}
    {plan && <div className="info-note" style={{marginBottom: 20, overflowWrap: "anywhere"}}>
      <p>文件：{plan.fileName}</p>
      <p>已检查 {plan.records.length} 份档案，将分成 {plan.batches.length} 批补入。每一批会单独保存。</p>
    </div>}
    {plan && <div role="status" aria-live="polite" style={{marginBottom: 20}}>
      <p className="muted" style={{marginBottom: 8}}>
        {busy ? `正在导入第 ${Math.min(progress.completed + 1, plan.batches.length)} / ${plan.batches.length} 批…` : `已完成 ${progress.completed} / ${plan.batches.length} 批。`}
        {` 累计确认新增 ${progress.imported} 份草稿，跳过 ${progress.skipped} 份已有档案。`}
      </p>
      <progress max={plan.batches.length} value={progress.completed} aria-label="备份导入批次进度" style={{width: "100%"}} />
    </div>}
    {error && <p className="save-feedback error" role="alert">{error}</p>}
    {done && <p className="save-feedback" role="status">
      {`导入完成：已确认新增 ${progress.imported} 份草稿，跳过 ${progress.skipped} 份已有档案。已有内容未被覆盖。`}
    </p>}
    <div className="admin-actions">
      {error && plan ? <button className="button yellow" type="button" disabled={busy} onClick={importBackup}>{busy ? "正在重试…" : "重试未完成的批次"}</button> : <AlertDialog>
        <AlertDialogTrigger asChild><button className="button yellow" type="button" disabled={!plan || reading || busy || done}>{busy ? "正在导入…" : done ? "已完成导入" : "导入缺失档案为草稿"}</button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>补入这份备份中的缺失档案？</AlertDialogTitle>
            <AlertDialogDescription>将检查 {plan?.records.length ?? 0} 份档案，并分 {plan?.batches.length ?? 0} 批保存。相同地址会跳过；新增记录为草稿，需要在编辑页发布。不会恢复阅读次数和修订历史。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !plan} onClick={() => void importBackup()}>补入草稿</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      {(plan || reading || error) && <button className="button secondary" type="button" disabled={busy} onClick={clearSelection}>清除文件</button>}
    </div>
    {done && <p style={{marginTop: 20}}><Link className="inline-link" href={progress.imported ? "/admin?status=draft" : "/admin"}>{progress.imported ? "查看草稿列表" : "返回档案管理"}</Link></p>}
  </section>;
}
