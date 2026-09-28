// hermes-ui: sirve la app oficial de Hermes Desktop compilada como web, con el
// shim de window.hermesDesktop, y hace de proxy /hermes-api -> dashboard de
// Hermes (HTTP y WebSocket). La sesion del dashboard vive solo aqui: el
// navegador nunca ve la clave. En el VPS escucha solo en Tailscale (decision A).
// Variables: HOST, PORT, HERMES_BACKEND, HERMES_UI_DIST, HERMES_UI_USER,
// HERMES_UI_PASS (o HERMES_VAULT con lineas "Usuario:" y "Clave:"), HERMES_UI_FRAME_ANCESTORS.
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 4390)
const BACKEND = new URL(process.env.HERMES_BACKEND || 'http://100.127.42.51:9119')
const DIST = path.resolve(process.env.HERMES_UI_DIST || path.join(here, '.work', 'dist'))
const DEV_SHIM = path.join(here, 'shim', 'hermes-desktop-shim.js')
const VAULT = process.env.HERMES_VAULT || 'C:\\Users\\Francisco\\OneDrive\\Vault\\hermes dashboard vps.txt'
const FRAME_ANCESTORS = process.env.HERMES_UI_FRAME_ANCESTORS || "'self' https://os.franciscoabad.com"
const PREFIX = '/hermes-api'
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8'
}
// Actualizar o reiniciar el VPS desde la web queda prohibido: se hace por SSH.
const BLOCKED = [/^\/api\/hermes\/update(?!\/check)/, /^\/api\/gateway\/restart/]

const jar = new Map()
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
const absorb = setCookies => {
  for (const raw of setCookies || []) {
    const [pair] = raw.split(';')
    const i = pair.indexOf('=')
    const name = pair.slice(0, i).trim()
    const value = pair.slice(i + 1).trim()
    if (!value || /max-age=0/i.test(raw)) jar.delete(name)
    else jar.set(name, value)
  }
}

function credentials() {
  if (process.env.HERMES_UI_USER && process.env.HERMES_UI_PASS) {
    return { username: process.env.HERMES_UI_USER, password: process.env.HERMES_UI_PASS }
  }
  const lines = fs.readFileSync(VAULT, 'utf8').split(/\r?\n/)
  const pick = key => lines.find(l => l.toLowerCase().startsWith(key))?.split(':').slice(1).join(':').trim()
  return { username: pick('usuario'), password: pick('clave') }
}

// Sin keep-alive: el backend cierra conexiones ociosas y Node las reusaba ("socket hang up").
const agent = new http.Agent({ keepAlive: false })

async function send(method, pathname, headers, body) {
  try {
    return await sendOnce(method, pathname, headers, body)
  } catch (err) {
    // Solo se reintentan lecturas: un POST repetido podria duplicar una accion.
    if (method !== 'GET' || !/hang up|ECONNRESET/.test(err.message)) throw err
    return sendOnce(method, pathname, headers, body)
  }
}

function sendOnce(method, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: BACKEND.hostname, port: BACKEND.port, method, path: pathname, headers, agent },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve({ res, body: Buffer.concat(chunks) }))
      }
    )
    req.on('error', reject)
    req.setTimeout(120_000, () => req.destroy(new Error('timeout')))
    if (body?.length) req.write(body)
    req.end()
  })
}

let loginPromise = null
function login() {
  loginPromise ??= (async () => {
    const payload = Buffer.from(JSON.stringify({ provider: 'basic', ...credentials(), next: '/' }))
    const { res } = await send('POST', '/auth/password-login', {
      'content-type': 'application/json', 'content-length': payload.length, origin: BACKEND.origin
    }, payload)
    if (res.statusCode !== 200) throw new Error(`login ${res.statusCode}`)
    absorb(res.headers['set-cookie'])
    console.log(`[hermes-ui] sesion iniciada (${jar.size} cookies)`)
  })().finally(() => (loginPromise = null))
  return loginPromise
}

const HOP = new Set(['host', 'cookie', 'origin', 'referer', 'connection', 'accept-encoding', 'content-length'])
function upstreamHeaders(incoming, bodyLength) {
  const h = {}
  for (const [k, v] of Object.entries(incoming)) if (!HOP.has(k)) h[k] = v
  h.host = BACKEND.host
  h.origin = BACKEND.origin
  h.cookie = cookieHeader()
  if (bodyLength) h['content-length'] = bodyLength
  return h
}

async function proxyHttp(req, res) {
  const target = req.url.slice(PREFIX.length) || '/'
  if (req.method !== 'GET' && BLOCKED.some(re => re.test(target))) {
    console.warn('[hermes-ui] bloqueado', req.method, target.split('?')[0])
    res.writeHead(403, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ detail: 'Bloqueado en Pancho OS: actualiza o reinicia el VPS por SSH' }))
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks)
  if (!jar.size) await login()
  let out = await send(req.method, target, upstreamHeaders(req.headers, body.length), body)
  if (out.res.statusCode === 401) {
    await login()
    out = await send(req.method, target, upstreamHeaders(req.headers, body.length), body)
  }
  absorb(out.res.headers['set-cookie'])
  const headers = { ...out.res.headers }
  delete headers['set-cookie']
  delete headers['content-length']
  delete headers['transfer-encoding']
  res.writeHead(out.res.statusCode, headers)
  res.end(out.body)
}

function proxyUpgrade(req, socket, head) {
  const target = req.url.slice(PREFIX.length)
  const upstream = net.connect(Number(BACKEND.port), BACKEND.hostname, () => {
    const h = upstreamHeaders(req.headers, 0)
    h.connection = 'Upgrade'
    const lines = [`GET ${target} HTTP/1.1`, ...Object.entries(h).map(([k, v]) => `${k}: ${v}`), '', '']
    upstream.write(lines.join('\r\n'))
    if (head?.length) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  const close = () => { upstream.destroy(); socket.destroy() }
  upstream.on('error', close)
  socket.on('error', close)
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x')
  const frame = { 'content-security-policy': `frame-ancestors ${FRAME_ANCESTORS}` }
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(fs.readFileSync(path.join(DIST, 'build-info.json')))
  }
  if (url.pathname === '/hermes-desktop-shim.js') {
    const shim = fs.existsSync(DEV_SHIM) ? DEV_SHIM : path.join(DIST, 'hermes-desktop-shim.js')
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    return res.end(fs.readFileSync(shim))
  }
  let file = path.join(DIST, decodeURIComponent(url.pathname))
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  if (file.endsWith('index.html')) {
    const html = fs.readFileSync(file, 'utf8').replace('<head>', '<head>\n    <script src="/hermes-desktop-shim.js"></script>')
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store', ...frame })
    return res.end(html)
  }
  const immutable = url.pathname.startsWith('/assets/') ? { 'cache-control': 'public, max-age=31536000, immutable' } : {}
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', ...immutable })
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer((req, res) => {
  const handler = req.url.startsWith(`${PREFIX}/`) ? proxyHttp : serveStatic
  Promise.resolve(handler(req, res)).catch(err => {
    console.error('[hermes-ui]', req.method, req.url.split('?')[0], err.message)
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ detail: `proxy: ${err.message}` }))
  })
})
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith(`${PREFIX}/`)) proxyUpgrade(req, socket, head)
  else socket.destroy()
})
server.listen(PORT, HOST, () => console.log(`[hermes-ui] http://${HOST}:${PORT} -> ${BACKEND.origin} (dist ${DIST})`))
