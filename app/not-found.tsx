import Link from "next/link";
import {PageShell} from "@/components/archive/chrome";
export default function NotFound(){return <PageShell><main id="main" className="error-panel"><div className="eyebrow">FILE NOT FOUND / 404</div><h1>这份档案没有找到</h1><p>它可能尚未发布、已经撤回，或地址发生了变化。</p><Link className="button" href="/">返回档案馆</Link></main></PageShell>;}
