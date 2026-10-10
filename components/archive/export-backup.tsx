"use client";

import {useRef, useState} from "react";
import {requestJson} from "@/lib/client-request";
import {dateLabel} from "@/lib/records";

type ExportedBackup = {format: string; formatVersion: number; exportedAt?: string; records: unknown[]};

export function ExportBackup() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{error: boolean; text: string} | null>(null);

  async function download() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const data = await requestJson<ExportedBackup>("/api/admin/export");
      if (!data || data.format !== "gengliusuo-archive" || data.formatVersion !== 1 || !Array.isArray(data.records)) {
        throw new Error("服务器返回的备份格式有误，请稍后重试。");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `梗留所档案备份-${dateLabel(new Date().toISOString())}.json`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      setFeedback({error: false, text: `已开始下载 ${data.records.length} 份档案的 JSON 备份，请在浏览器下载记录中查看。`});
    } catch (error) {
      setFeedback({error: true, text: error instanceof Error ? error.message : "暂时无法导出，请稍后重试。"});
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <div style={{minWidth: 0}}>
    <button className="button secondary" type="button" onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? "正在准备备份…" : "导出全部档案"}
    </button>
    {feedback && <p className={`save-feedback${feedback.error ? " error" : ""}`} role={feedback.error ? "alert" : "status"} style={{marginTop: 12, marginBottom: 0}}>{feedback.text}</p>}
  </div>;
}