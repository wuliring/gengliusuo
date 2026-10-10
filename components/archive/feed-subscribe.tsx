"use client";

import {useRef, useState} from "react";

export function FeedSubscribe({feedUrl}: {feedUrl: string}) {
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function selectUrl() {
    input.current?.focus();
    input.current?.select();
    setMessage("订阅地址已选中，可用复制操作将它添加到 RSS 阅读器。");
  }

  async function copyUrl() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(feedUrl);
      setMessage("订阅地址已复制，可粘贴到 RSS 阅读器中。");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("暂时无法自动复制，地址已选中。请手动复制，再添加到 RSS 阅读器。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <div className="feed-subscribe">
    <p className="form-header-note">把下面的地址添加到 RSS 阅读器，可订阅最近修订的已发布档案。每份档案显示当前版本的摘要，正文与出处仍在档案页阅读。</p>
    <label className="field">RSS 订阅地址
      <input ref={input} type="url" value={feedUrl} readOnly spellCheck={false} onFocus={event => event.currentTarget.select()} />
      <small>没有安装阅读器时，也可以直接打开 RSS 文件查看内容。</small>
    </label>
    <div className="admin-actions feed-subscribe-actions">
      <button className="button" type="button" onClick={copyUrl} disabled={busy} aria-busy={busy}>{busy ? "正在复制…" : "复制订阅地址"}</button>
      <button className="button secondary" type="button" onClick={selectUrl}>选中地址</button>
      <a className="button secondary" href={feedUrl} target="_blank" rel="noopener noreferrer">打开 RSS 文件</a>
    </div>
    <p className="action-feedback feed-subscribe-feedback" role="status" aria-live="polite">{message}</p>
  </div>;
}
