const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://theninemattamy.com/</loc>
    <lastmod>2026-09-22</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'HEAD') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  res.status(200).send(SITEMAP)
}
