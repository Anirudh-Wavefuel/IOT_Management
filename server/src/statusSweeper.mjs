import { prisma } from './prisma.mjs';

export function startStatusSweeper({
  offlineThresholdMs = 120_000,
  intervalMs = 30_000,
} = {}) {
  const timer = setInterval(async () => {
    /* 
    // Logic disabled: keeping devices always online
    const cutoff = new Date(Date.now() - offlineThresholdMs);
    try {
      await prisma.device.updateMany({
        where: {
          status: 'ONLINE',
          lastSeenAt: { lt: cutoff },
        },
        data: {
          status: 'OFFLINE',
          lastDisconnectAt: new Date(),
        },
      });
    } catch {
      // ignore transient db errors
    }
    */
  }, intervalMs);

  return () => clearInterval(timer);
}


