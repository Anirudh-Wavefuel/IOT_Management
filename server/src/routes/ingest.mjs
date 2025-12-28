import { Router } from 'express';
import { prisma } from '../prisma.mjs';

export const ingestRouter = Router();

const deviceKinds = new Set(['BMC', 'PAST', 'HOMO', 'CHILL', 'CIP', 'FLOW', 'TANK', 'VAC', 'VALVE', 'CONV']);

function parseTimestamp(ts) {
  if (!ts) return new Date();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function asNumber(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractStandard(payload) {
  // Standard fields are optional; simulator will send them as temp/humidity/pressure/battery.
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

ingestRouter.post('/telemetry', async (req, res) => {
  const body = req.body ?? {};
  const deviceId = body.deviceId;
  const kind = body.kind;

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  if (!kind || typeof kind !== 'string' || !deviceKinds.has(kind)) {
    return res.status(400).json({ error: 'kind is required (BMC|PAST|HOMO|CHILL|CIP|FLOW|TANK|VAC|VALVE|CONV)' });
  }

  const ts = parseTimestamp(body.ts);

  // Support both shapes:
  // 1) { deviceId, ts, kind, payload: {...} }
  // 2) { deviceId, ts, kind, ...flatPayload }
  const payload =
    body.payload && typeof body.payload === 'object'
      ? body.payload
      : Object.fromEntries(
        Object.entries(body).filter(([k]) => !['deviceId', 'ts', 'kind'].includes(k))
      );

  const now = new Date();
  await prisma.device.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      kind,
      status: 'ONLINE',
      lastSeenAt: now,
    },
    update: {
      kind,
      status: 'ONLINE',
      lastSeenAt: now,
    },
  });

  const { temperature, humidity, pressure, battery } = extractStandard(payload);

  // --- Alert Logic ---
  const alertsToCreate = [];

  // 1. Temperature > 4°C
  if (temperature !== null && temperature > 4.0) {
    alertsToCreate.push({
      deviceId,
      type: 'TEMPERATURE',
      message: `High Temperature detected: ${temperature}°C`,
      value: temperature,
      threshold: 4.0,
    });
  }

  // 2. Pressure > 3 bar (General check)
  if (pressure !== null && pressure > 3.0) {
    alertsToCreate.push({
      deviceId,
      type: 'PRESSURE',
      message: `High Pressure detected: ${pressure} bar`,
      value: pressure,
      threshold: 3.0,
    });
  }

  // 3. Battery < 20%
  if (battery !== null && battery < 20.0) {
    alertsToCreate.push({
      deviceId,
      type: 'BATTERY',
      message: `Low Battery detected: ${battery}%`,
      value: battery,
      threshold: 20.0,
    });
  }

  // 4. Device-specific thresholds (from payload)
  // VFD Temp > 50
  const vfdTemp = asNumber(payload.vfd_temp);
  if (vfdTemp !== null && vfdTemp > 50) {
    alertsToCreate.push({
      deviceId,
      type: 'VFD_TEMP',
      message: `VFD Overheating: ${vfdTemp}°C`,
      value: vfdTemp,
      threshold: 50.0,
    });
  }

  // Torque > 60 Nm (example safety limit)
  const torque = asNumber(payload.torque);
  if (torque !== null && torque > 60) {
    alertsToCreate.push({
      deviceId,
      type: 'TORQUE',
      message: `High Torque detected: ${torque} Nm`,
      value: torque,
      threshold: 60.0,
    });
  }

  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({
      data: alertsToCreate,
    });
  }
  // --- End Alert Logic ---

  await prisma.telemetry.create({
    data: {
      deviceId,
      ts,
      payload,
      temperature,
      humidity,
      pressure,
      battery,
    },
  });

  return res.json({ ok: true });
});


