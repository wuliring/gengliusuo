import Link from "next/link";
import {PageShell} from "@/components/archive/chrome";
import {Backup} from "@/components/archive/backup";
import {requireEditor} from "@/lib/admin-auth";
export default async function BackupPage(){await requireEditor();return <PageShell><main id="main" className="standard-main"><header className="admin-heading"><div><div className="eyebrow"><span className="index-label">ARCHIVE BACKUP</span></div><h1>备份与恢复</h1><p>把档案带走，也能把缺失的记忆补回来。</p></div><Link className="button secondary" href="/admin">返回档案管理</Link></header><Backup/></main></PageShell>;}
