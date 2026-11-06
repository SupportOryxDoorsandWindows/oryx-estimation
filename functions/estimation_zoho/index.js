// Catalyst entry point. The logic is in handler.js.
// Authorized Domains supplies the CORS headers, so none are set here.
'use strict'

const catalyst = require('zcatalyst-sdk-node')
const { mcpTool, respond } = require('./handler')

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    if (typeof req.body === 'string') {
      try { return resolve(JSON.parse(req.body)) } catch { return resolve(null) }
    }
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : null) } catch { resolve(null) }
    })
    req.on('error', () => resolve(null))
  })
}

/** The signed-in Catalyst user. Anything that fails counts as not signed in. */
async function currentUser(req) {
  try {
    return (await catalyst.initialize(req).userManagement().getCurrentUser()) || null
  } catch {
    return null
  }
}

module.exports = async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  try {
    const [user, body] = await Promise.all([currentUser(req), readBody(req)])
    const tool = mcpTool(process.env.ZOHO_MCP_URL, fetch)
    const out = await respond({ method: req.method, user, body, tool })
    reply(out.status, out.body)
  } catch (e) {
    console.error('estimation_zoho', String(e?.message || e))
    reply(500, { error: 'server_error' })
  }
}
