import type { APIContext } from "astro";

export function GET({ site }: APIContext) {
  const homepage = site ? `<url><loc>${new URL("/", site).href}</loc></url>` : "";
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${homepage}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
