import {notFound} from "next/navigation";
import {PageShell} from "@/components/archive/chrome";
import {Editor} from "@/components/archive/editor";
import {requireEditor} from "@/lib/admin-auth";
import {getRecord,history} from "@/lib/archive-db";
export default async function EditRecord({params}:{params:Promise<{id:string}>}){await requireEditor();const {id}=await params;const [record,versions]=await Promise.all([getRecord(id,true),history(id)]);if(!record)notFound();return <PageShell><main id="main" className="admin-main"><Editor initial={record} initialHistory={versions}/></main></PageShell>;}
