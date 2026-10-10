"use client";
import {PageShell} from "@/components/archive/chrome";
import {useRouter} from "next/navigation";
import {useTransition} from "react";
export default function ErrorPage({reset}:{reset:()=>void}){const router=useRouter(),[pending,startTransition]=useTransition();return <PageShell><main id="main" className="error-panel"><div className="eyebrow">ARCHIVE TEMPORARILY UNAVAILABLE</div><h2>档案库暂时没有回应</h2><p>请稍后再试。已保存的档案会继续保留。</p><div className="error-actions"><button className="button" disabled={pending} onClick={()=>startTransition(()=>{router.refresh();reset();})}>{pending?"正在重新加载…":"重新加载"}</button><a className="button secondary" href="/">返回档案馆</a><a className="button secondary" href="/about">阅读收录准则</a></div></main></PageShell>;}
