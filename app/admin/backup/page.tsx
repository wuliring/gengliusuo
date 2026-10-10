import Link from "next/link";
import {PageShell} from "@/components/archive/chrome";
import {Backup} from "@/components/archive/backup";
import {ExportBackup} from "@/components/archive/export-backup";
import {AdminAccessDenied} from "@/components/archive/admin-access";
import {canEditPage} from "@/lib/admin-auth";

export default async function BackupPage() {
  if (!await canEditPage("/admin/backup")) return <AdminAccessDenied returnTo="/admin/backup" />;
  return <PageShell>
    <main id="main" className="standard-main">
      <header className="admin-heading">
        <div>
          <div className="eyebrow"><span className="index-label">ARCHIVE BACKUP</span></div>
          <h1>备份与补回档案</h1>
          <p>导出当前内容，也能把备份中缺失的档案补为草稿。</p>
        </div>
        <Link className="button secondary" href="/admin">返回档案管理</Link>
      </header>
      <section className="form-section" style={{marginBottom: 24}}>
        <h2>带走一份内容备份</h2>
        <p className="form-header-note">导出全部已发布、草稿和已归档档案的当前内容。文件包含当前修订编号、阅读次数与更新时间，供查阅留存；补回功能只使用内容字段，不恢复完整数据库或历史版本。</p>
        <ExportBackup />
      </section>
      <Backup />
    </main>
  </PageShell>;
}
