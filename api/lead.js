const TABLE_NAME = 'agency_landing_leads'
const PROJECT_NAME = 'The Nine Mattamy'
const SOURCE_URL = 'https://theninemattamy.com'

function asString(value, max = 200) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, max)
}

function parseBroker(value) {
  if (value === true || value === 1) return true
  const raw = String(value ?? '').trim().toLowerCase()
  return ['yes', 'true', '1', 'y', 'realtor', 'broker'].includes(raw)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim()
  if (!supabaseUrl || !serviceKey) {
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

  if (asString(body.fax, 80) || asString(body.hp_website, 80)) {
    res.status(200).json({ ok: true })
    return
  }

  const first_name = asString(body.first_name ?? body.firstname, 80)
  const last_name = asString(body.last_name ?? body.lastname, 80)
  const email = asString(body.email, 200).toLowerCase()
  const phone = asString(body.phone, 40)
  const is_broker = parseBroker(body.is_broker ?? body.broker ?? body.is_realtor)
  const page_path = asString(body.page_path, 300) || '/'
  const notes = asString(body.notes ?? body.message, 2000)
  const utm_source = asString(body.utm_source, 120)
  const utm_campaign = asString(body.utm_campaign, 160)

  if (!first_name || !email || !phone) {
    res.status(400).json({
      ok: false,
      error: 'Missing required fields. Send first_name, last_name, email, phone, and is_broker.',
    })
    return
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
    return
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE_NAME}?select=id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        first_name,
        last_name,
        email,
        phone,
        is_broker,
        source: SOURCE_URL,
        project_name: PROJECT_NAME,
        page_path,
        notes: notes || null,
        utm_source: utm_source || null,
        utm_campaign: utm_campaign || null,
        status: 'new',
      }),
    })

    const raw = await response.text()
    let result = {}
    try {
      result = raw ? JSON.parse(raw) : {}
    } catch {
      result = { message: raw.slice(0, 200) }
    }

    if (!response.ok) {
      const detail = result.message || result.error || result.hint || `status ${response.status}`
      console.error('Agency lead insert failed:', response.status, detail)
      res.status(500).json({ ok: false, error: 'Could not save this lead. Please try again.', detail })
      return
    }

    const id = Array.isArray(result) ? result[0]?.id : result?.id
    res.status(200).json({ ok: true, id })
  } catch (error) {
    console.error('Agency lead insert error:', error)
    res.status(500).json({
      ok: false,
      error: 'Could not save this lead. Please try again.',
      detail: error instanceof Error ? error.message : 'network_error',
    })
  }
}
