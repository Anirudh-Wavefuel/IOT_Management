import { WebSocketServer } from 'ws';
import { prisma } from './prisma.mjs';

const deviceKinds = new Set(['BMC', 'PAST', 'HOMO', 'CHILL', 'CIP', 'FLOW', 'TANK', 'VAC', 'VALVE', 'CONV']);

function asNumber(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractStandard(payload) {
  const temperature =
    asNumber(payload.temperature) ??
    asNumber(payload.temp) ??
    asNumber(payload.milk_temp) ??
    asNumber(payload.outlet_temp) ??
    asNumber(payload.inlet_temp) ??
    asNumber(payload.heater_temp) ??
    asNumber(payload.ambient_temp) ??
    asNumber(payload.evaporator_temp) ??
    asNumber(payload.oil_temp);

  const humidity = asNumber(payload.humidity);

  const pressure =
    asNumber(payload.pressure) ??
    asNumber(payload.pressure_in) ??
    asNumber(payload.pressure_out) ??
    asNumber(payload.suction_pressure) ??
    asNumber(payload.discharge_pressure) ??
    asNumber(payload.oil_pressure);

  const battery = asNumber(payload.battery);

  return { temperature, humidity, pressure, battery };
}

function parseTimestamp(ts) {
  if (!ts) return new Date();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.deviceId = null;
    ws.kind = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (buf) => {
      let msg;
      try {
        msg = JSON.parse(buf.toString('utf8'));
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }

      if (msg?.type === 'hello') {
        const deviceId = msg.deviceId;
        const kind = msg.kind;
        if (!deviceId || typeof deviceId !== 'string') {
          ws.send(JSON.stringify({ type: 'error', error: 'deviceId required' }));
          return;
        }
        if (!kind || typeof kind !== 'string' || !deviceKinds.has(kind)) {
          ws.send(JSON.stringify({ type: 'error', error: 'kind required' }));
          return;
        }
        ws.deviceId = deviceId;
        ws.kind = kind;

        const now = new Date();
        await prisma.device.upsert({
          where: { id: deviceId },
          create: { id: deviceId, kind, status: 'ONLINE', lastSeenAt: now },
          update: { kind, status: 'ONLINE', lastSeenAt: now },
        });

        ws.send(JSON.stringify({ type: 'hello_ack', ok: true }));
        return;
      }

      if (msg?.type === 'telemetry') {
        if (!ws.deviceId || !ws.kind) {
          ws.send(JSON.stringify({ type: 'error', error: 'Send hello first' }));
          return;
        }
        const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
        const ts = parseTimestamp(msg.ts);
        const now = new Date();

        await prisma.device.update({
          where: { id: ws.deviceId },
          data: { status: 'ONLINE', lastSeenAt: now },
        });

        const { temperature, humidity, pressure, battery } = extractStandard(payload);
        await prisma.telemetry.create({
          data: {
            deviceId: ws.deviceId,
            ts,
            payload,
            temperature,
            humidity,
            pressure,
            battery,
          },
        });

        return;
      }

      ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
    });

    ws.on('close', async () => {
      /*
      if (!ws.deviceId) return;
      try {
        await prisma.device.update({
          where: { id: ws.deviceId },
          data: { status: 'OFFLINE', lastDisconnectAt: new Date() },
        });
      } catch {
        // ignore
      }
      */
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 5000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}


