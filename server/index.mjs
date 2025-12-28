import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { authRouter } from './src/routes/auth.mjs';
import { usersRouter } from './src/routes/users.mjs';
import { ingestRouter } from './src/routes/ingest.mjs';
import { devicesRouter } from './src/routes/devices.mjs';
import { alertsRouter } from './src/routes/alerts.mjs';
import { attachWs } from './src/ws.mjs';
import { startStatusSweeper } from './src/statusSweeper.mjs';
import { prisma } from './src/prisma.mjs';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    const result = await prisma.$queryRaw`select 1 as ok`;
    res.json({ ok: true, db: Array.isArray(result) && result?.[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/ingest', ingestRouter);

const port = Number(process.env.PORT ?? 3001);

// One-time normalization: ensure no legacy viewer roles remain
await prisma.user.updateMany({ where: { role: 'viewer' }, data: { role: 'base' } });
await prisma.device.updateMany({ data: { status: 'ONLINE' } });

const server = http.createServer(app);
attachWs(server);
startStatusSweeper({
  offlineThresholdMs: Number(process.env.OFFLINE_THRESHOLD_MS ?? 10_000),
  intervalMs: Number(process.env.STATUS_SWEEP_MS ?? 5_000),
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`[api] Port ${port} is already in use. Stop the other server or change PORT in .env`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error('[api] server error', err);
  process.exit(1);
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}`);
});



