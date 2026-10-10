import {env} from "cloudflare:workers";

const DEFAULT_PUBLIC_ORIGIN = "https://gengliusuo-archive.yebai.chatgpt.site";

export function publicSiteOrigin(): string {
  if (typeof env.SITE_URL === "string" && env.SITE_URL.trim()) {
    try {
      const url = new URL(env.SITE_URL.trim());
      if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return url.origin;
    } catch {
      // An invalid deployment setting must not become a public feed link.
    }
  }
  return DEFAULT_PUBLIC_ORIGIN;
}
