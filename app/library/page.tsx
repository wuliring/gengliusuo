import {PageShell} from "@/components/archive/chrome";
import {ReaderLibraryView} from "@/components/archive/reader-library";
import {chatGPTSignInPath, chatGPTSignOutPath} from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata = {title: "我的档案夹", robots: {index: false, follow: false}};

export default async function LibraryPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const value = typeof params.tab === "string" ? params.tab : "favorites";
  const tab = ["favorites", "unread", "read", "history"].includes(value) ? value : "favorites";
  const returnTo = `/library?tab=${tab}`;
  return <PageShell active="library"><ReaderLibraryView initialTab={tab} signInUrl={chatGPTSignInPath(returnTo)} signOutUrl={chatGPTSignOutPath(returnTo)} /></PageShell>;
}
