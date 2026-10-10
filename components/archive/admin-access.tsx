import Link from "next/link";
import {chatGPTSignOutPath} from "@/app/chatgpt-auth";
import {PageShell} from "./chrome";
export function AdminAccessDenied({returnTo="/admin"}:{returnTo?:string}){return <PageShell><main id="main" className="error-panel"><h1>这里是管理员工作区</h1><p>当前登录账号没有编辑权限。发现档案错误，可以在 GitHub 提交更正线索；管理员可以切换到有权限的账号。</p><div className="error-actions"><Link className="button" href="/">返回档案馆</Link><a className="button secondary" href="https://github.com/wuliring/gengliusuo/issues/new" target="_blank" rel="noopener noreferrer">在 GitHub 提交更正</a><a className="button secondary" href={chatGPTSignOutPath(returnTo)} target="_top">退出登录，切换账号</a></div></main></PageShell>;}
