"use client";
import {PageShell} from "@/components/archive/chrome";
export default function ErrorPage({reset}:{reset:()=>void}){return <PageShell><main id="main" className="error-panel"><div className="eyebrow">ARCHIVE TEMPORARILY UNAVAILABLE</div><h2>档案库暂时没有回应</h2><p>请稍后再试。已保存的档案会继续保留。</p><div className="error-actions"><button className="button" onClick={reset}>重新加载</button><a className="button secondary" href="/about">阅读收录准则</a></div></main></PageShell>;}
