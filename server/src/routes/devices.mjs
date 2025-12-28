import { Router } from 'express';
import { prisma } from '../prisma.mjs';
import { requireAuth } from '../auth.mjs';

export const devicesRouter = Router();

devicesRouter.get('/', requireAuth, async (req, res) => {
  const status = req.query.status;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const where = {};
  if (status && ['ONLINE', 'OFFLINE', 'UNKNOWN'].includes(String(status))) {
    where.status = String(status);
  }

  const devices = await prisma.device.findMany({
    where,
    orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
    take: limit,
    skip: offset,
  });

  return res.json({ devices });
});

devicesRouter.get('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  return res.json({ device });
});

devicesRouter.get('/:id/telemetry', requireAuth, async (req, res) => {
  const id = req.params.id;
  const limit = Math.min(Number(req.query.limit ?? 200), 2000);
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  if (since && Number.isNaN(since.getTime())) {
    return res.status(400).json({ error: 'Invalid since' });
  }

  const rows = await prisma.telemetry.findMany({
    where: {
      deviceId: id,
      ...(since ? { ts: { gte: since } } : {}),
    },
    orderBy: { ts: 'desc' },
    take: limit,
    select: {
      id: true,
      ts: true,
      payload: true,
      temperature: true,
      humidity: true,
      pressure: true,
      battery: true,
    },
  });

  return res.json({ telemetry: rows.reverse() });
});


