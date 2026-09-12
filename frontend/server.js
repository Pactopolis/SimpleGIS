// Static file server for the production build. Zero dependencies.
//
//   npm run build && npm start
//   npm start -- --port 8080 --host 0.0.0.0
//
// Serves ./dist, falls back to index.html for client-side routes, and treats
// Vite's hashed /assets/* output as immutable.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'

/** Read `--name value` or `--name=value` from argv. */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1]
  }
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

const root = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const port = Number(arg('port') ?? process.env.PORT) || 4173

// Default to all interfaces: inside a container 127.0.0.1 is unreachable
// from the host. Override with --host 127.0.0.1 when running natively.
const host = arg('host') ?? process.env.HOST ?? '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
}

const COMPRESSIBLE = new Set([
  'text/html',
  'text/javascript',
  'text/css',
  'text/plain',
  'application/json',
  'image/svg+xml',
  'application/wasm'
])

const indexHtml = join(root, 'index.html')

if (!existsSync(indexHtml)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

/** Map a request path to a file inside dist, or null if it escapes or is missing. */
function resolveFile(pathname) {
  const target = join(root, normalize(pathname))

  if (target !== root && !target.startsWith(root + sep)) return null

  if (existsSync(target)) {
    const stats = statSync(target)
    if (stats.isFile()) return target
    if (stats.isDirectory()) {
      const nested = join(target, 'index.html')
      if (existsSync(nested)) return nested
    }
  }

  // Extensionless paths are client-side routes; anything else is a real miss.
  return extname(pathname) === '' ? indexHtml : null
}

function send(req, res, filePath, status) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const immutable = req.url.startsWith('/assets/') && filePath !== indexHtml

  const headers = {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  }

  const compressible = COMPRESSIBLE.has(type.split(';')[0])
  const gzip = compressible && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')

  if (compressible) headers['Vary'] = 'Accept-Encoding'
  if (gzip) headers['Content-Encoding'] = 'gzip'
  else headers['Content-Length'] = statSync(filePath).size

  res.writeHead(status, headers)

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => res.destroy())

  if (gzip) stream.pipe(createGzip()).pipe(res)
  else stream.pipe(res)
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host ?? host}`).pathname)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad Request')
    return
  }

  const file = resolveFile(pathname)

  if (file === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }

  send(req, res, file, 200)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use.`)
  else if (err.code === 'EACCES') console.error(`Not allowed to bind ${host}:${port}.`)
  else console.error(err.message)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`ridgeline-web serving ${root} at http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
