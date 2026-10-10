import {PageShell} from "@/components/archive/chrome";
import {Editor} from "@/components/archive/editor";
import {canEditPage} from "@/lib/admin-auth";
import {AdminAccessDenied} from "@/components/archive/admin-access";
export default async function NewRecord(){if(!await canEditPage("/admin/new"))return <AdminAccessDenied returnTo="/admin/new"/>;return <PageShell><main id="main" className="admin-main"><Editor key="new"/></main></PageShell>;}
