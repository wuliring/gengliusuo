import {requireChatGPTUser} from "@/app/chatgpt-auth";
import {isEditor} from "@/lib/admin-auth";
import {PageShell} from "@/components/archive/chrome";
export const dynamic="force-dynamic";
export const metadata={title:"档案管理",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){await requireChatGPTUser("/admin");if(!await isEditor())return <PageShell><main id="main" className="error-panel"><h1>这里是管理员工作区</h1><p>你可以阅读公开档案；编辑权限仅属于网站管理员。</p><a className="button" href="/">返回档案馆</a></main></PageShell>;return children;}
