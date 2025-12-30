import { newsService } from "@/lib/newsService";

export async function GET() {
  const articles = await newsService.getLatest(100);
  const categories = newsService.getCategories();
  const baseUrl = 'http://localhost:3000';

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${baseUrl}</loc>
        <changefreq>always</changefreq>
        <priority>1.0</priority>
      </url>
      ${categories
        .map(
          (cat) => `
        <url>
          <loc>${baseUrl}/category/${cat.slug}</loc>
          <changefreq>hourly</changefreq>
          <priority>0.8</priority>
        </url>`
        )
        .join('')}
      ${articles
        .map(
          (article) => `
        <url>
          <loc>${baseUrl}/news/${article.slug}</loc>
          <lastmod>${article.updatedAt || article.publishedAt}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
        </url>`
        )
        .join('')}
    </urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
