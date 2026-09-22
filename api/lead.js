const INGEST_URL = 'https://property-dashboard-three.vercel.app/api/leads/ingest'
const PROJECT_NAME = 'The Nine Mattamy'
const SOURCE_URL = 'https://theninemattamy.com'

function asString(value, max = 200) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, max)
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body)
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  const secret = (process.env.AGENCY_LEAD_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    res.status(503).json({ ok: false, error: 'Lead webhook is not configured.' })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    res.status(400).json({ ok: false, error: 'Request body must be JSON.' })
    return
  }

  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lead-Webhook-Secret': secret,
      },
      body: JSON.stringify({
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        phone: body.phone,
        is_broker: body.is_broker ?? body.broker,
        source: SOURCE_URL,
        project_name: PROJECT_NAME,
        page_path: body.page_path || '/',
        notes: body.notes || '',
        utm_source: body.utm_source || '',
        utm_campaign: body.utm_campaign || '',
        fax: body.fax || '',
      }),
    })

    const result = await response.json().catch(() => ({}))
    res.status(response.status).json(result)
  } catch {
    res.status(500).json({ ok: false, error: 'Could not save this lead. Please try again.' })
  }
}
