import { newsService } from "@/lib/newsService";

export async function GET() {
  const articles = await newsService.getLatest(20);
  const baseUrl = 'http://localhost:3000';

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>Атмосфера2Н</title>
      <link>${baseUrl}</link>
      <description>Главные городские новости</description>
      <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
      ${articles
        .map(
          (article) => `
        <item>
          <title><![CDATA[${article.title}]]></title>
          <link>${baseUrl}/news/${article.slug}</link>
          <guid isPermaLink="true">${baseUrl}/news/${article.slug}</guid>
          <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
          <description><![CDATA[${article.excerpt}]]></description>
          <category>${article.category.title}</category>
        </item>`
        )
        .join('')}
    </channel>
    </rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}