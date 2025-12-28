import { Router } from 'express';
import { prisma } from '../prisma.mjs';
import { requireAuth } from '../auth.mjs';

export const alertsRouter = Router();

const TEMP_THRESHOLD_C = 4;
const PRESSURE_THRESHOLD_PSI = 100;
const BAR_TO_PSI = 14.5037738;

function toPsiFromBar(bar) {
  if (bar === null || bar === undefined) return null;
  const n = typeof bar === 'number' ? bar : Number(bar);
  if (!Number.isFinite(n)) return null;
  return n * BAR_TO_PSI;
}

alertsRouter.get('/', requireAuth, async (req, res) => {
  const { deviceId } = req.query;

  const where = {};
  if (deviceId && typeof deviceId === 'string') {
    where.deviceId = deviceId;
  }

  const dbAlerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      device: {
        select: { id: true, kind: true, status: true }
      }
    }
  });

  const alerts = dbAlerts.map(a => ({
    id: a.id,
    type: a.type,
    deviceId: a.deviceId,
    kind: a.device.kind,
    status: a.device.status,
    ts: a.createdAt,
    value: a.value,
    message: a.message,
    threshold: a.threshold,
    acknowledged: a.acknowledged
  }));

  return res.json({ alerts });
});


