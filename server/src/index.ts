import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { networkInterfaces } from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { DungeonRoom } from './rooms/DungeonRoom.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 2567

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()

// Allow requests from the Vite dev server (any localhost origin) and from the
// same-host production case. Colyseus WebSocket handshake also uses HTTP.
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. same-origin prod, curl), or any
    // localhost / 127.0.0.1 origin (Vite dev server on any port).
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cb(null, true)
    } else {
      cb(null, true) // allow all LAN origins — users run on a local network
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))

// Serve the built frontend from ../dist (relative to this file at build time,
// or ../../dist relative to src/ at dev time)
const distPath = path.resolve(__dirname, '..', '..', 'dist')
app.use(express.static(distPath))

// Fallback: serve index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// ── HTTP + Colyseus server ────────────────────────────────────────────────────
const httpServer = createServer(app)

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    maxPayload: 50 * 1024 * 1024, // 50 MB — map JSON can be large
  }),
})

gameServer.define('dungeon', DungeonRoom)

// ── Start ─────────────────────────────────────────────────────────────────────
gameServer.listen(PORT).then(() => {
  const lanIp = getLanIp()

  console.log('')
  console.log('  ╔══════════════════════════════════════╗')
  console.log('  ║      DungeonPlanner — Server         ║')
  console.log('  ╠══════════════════════════════════════╣')
  console.log(`  ║  DM (you):  http://localhost:${PORT}   ║`)
  console.log(`  ║  Players:   http://${lanIp}:${PORT}  ║`)
  console.log('  ╚══════════════════════════════════════╝')
  console.log('')
  console.log('  Share the Players URL with your group.')
  console.log('  Press Ctrl+C to stop the server.')
  console.log('')
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLanIp(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost      '
}
