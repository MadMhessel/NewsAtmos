export function GET() {
  const baseUrl = 'http://localhost:3000';
  const txt = `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`;

  return new Response(txt, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
