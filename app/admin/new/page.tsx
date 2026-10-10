import {PageShell} from "@/components/archive/chrome";
import {Editor} from "@/components/archive/editor";
import {requireEditor} from "@/lib/admin-auth";
export default async function NewRecord(){await requireEditor();return <PageShell><main id="main" className="admin-main"><Editor/></main></PageShell>;}
