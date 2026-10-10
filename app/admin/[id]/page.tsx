import {notFound} from "next/navigation";
import {PageShell} from "@/components/archive/chrome";
import {Editor} from "@/components/archive/editor";
import {canEditPage} from "@/lib/admin-auth";
import {AdminAccessDenied} from "@/components/archive/admin-access";
import {getRecord,history} from "@/lib/archive-db";
export default async function EditRecord({params}:{params:Promise<{id:string}>}){const {id}=await params,returnTo=`/admin/${encodeURIComponent(id)}`;if(!await canEditPage(returnTo))return <AdminAccessDenied returnTo={returnTo}/>;const [record,versions]=await Promise.all([getRecord(id,true),history(id)]);if(!record)notFound();return <PageShell><main id="main" className="admin-main"><Editor key={record.id} initial={record} initialHistory={versions}/></main></PageShell>;}
