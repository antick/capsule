import type { APIContext } from "astro";

export function GET({ site }: APIContext) {
  const sitemap = site ? `Sitemap: ${new URL("/sitemap.xml", site).href}\n` : "";
  return new Response(`User-agent: *\nAllow: /\n${sitemap}`);
}
