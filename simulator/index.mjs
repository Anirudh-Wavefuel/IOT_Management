import 'dotenv/config';
import WebSocket from 'ws';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const mode = (arg('--mode', 'http') || 'http').toLowerCase(); // http | ws
const baseUrl = arg('--url', process.env.SIM_URL || 'http://localhost:3002');
const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';

const intervalMs = Number(arg('--intervalMs', process.env.SIM_INTERVAL_MS || 30000));

const MAX_HISTORY = 10;

function drift(current, min, max, safeDelta = 0.5) {
  if (current === undefined || current === null) return (min + max) / 2;
  const allowedDelta = Math.min(safeDelta, 2.0);
  const move = (Math.random() - 0.5) * allowedDelta;
  return clamp(current + move, min, max);
}

function toFixed(num, digits = 1) {
  return Number(num.toFixed(digits));
}

// 10 devices mapped from devices.md (IDs are examples; you can rename freely)
const devices = [
  { deviceId: 'BMC-01', kind: 'BMC' },
  { deviceId: 'PAST-01', kind: 'PAST' },
  { deviceId: 'HOMO-01', kind: 'HOMO' },
  { deviceId: 'CHILL-01', kind: 'CHILL' },
  { deviceId: 'CIP-01', kind: 'CIP' },
  { deviceId: 'FLOW-01', kind: 'FLOW' },
  { deviceId: 'TANK-01', kind: 'TANK' },
  { deviceId: 'VAC-01', kind: 'VAC' },
  { deviceId: 'VALVE-01', kind: 'VALVE' },
  { deviceId: 'CONV-01', kind: 'CONV' },
];

function generateTelemetry(kind, state) {
  // Initialize state keys if missing
  state.temp = drift(state.temp, 0, 4, 0.1);
  state.humidity = drift(state.humidity, 50, 90, 1.0);
  state.pressure = drift(state.pressure, 1, 3, 0.05);
  state.battery = drift(state.battery, 50, 100, 0.2);

  const common = {
    temp: toFixed(state.temp),
    humidity: toFixed(state.humidity),
    pressure: toFixed(state.pressure, 2),
    battery: toFixed(state.battery),
  };

  switch (kind) {
    case 'BMC': {
      state.milk_temp = drift(state.milk_temp, 0, 4, 0.1);
      state.tank_level = drift(state.tank_level, 10, 90, 0.5);
      const compressor_status = state.milk_temp > 3.5;

      return {
        ...common,
        milk_temp: toFixed(state.milk_temp),
        ambient_temp: toFixed(drift(state.ambient_temp ?? 25, 20, 30, 0.2)),
        evaporator_temp: toFixed(drift(state.evaporator_temp ?? -5, -10, 0, 0.3)),
        compressor_status,
        stirrer_rpm: compressor_status ? 40 : 0,
        tank_level: toFixed(state.tank_level),
        energy_kwh: toFixed((state.energy_kwh ?? 0) + 0.05, 2),
      };
    }
    case 'PAST': {
      // Pasteurizer needs high temps to work, but we'll respect "Normal Range" for inlet/milk
      state.inlet_temp = drift(state.inlet_temp, 0, 4, 0.1); // Cold milk entering
      state.heater_temp = drift(state.heater_temp, 72, 75, 0.2); // Pasteurization temp
      state.outlet_temp = drift(state.outlet_temp, 71, 74, 0.2);
      state.flow_rate = drift(state.flow_rate, 800, 1200, 2.0);

      return {
        ...common,
        inlet_temp: toFixed(state.inlet_temp),
        heater_temp: toFixed(state.heater_temp),
        outlet_temp: toFixed(state.outlet_temp),
        flow_rate: toFixed(state.flow_rate),
        holding_time_s: 16,
        valve_position: 100,
        pump_status: true,
        state: 'HOLDING',
      };
    }
    case 'HOMO': {
      state.rpm = drift(state.rpm, 1500, 1800, 2.0);
      state.pressure_in = drift(state.pressure_in, 4, 6, 0.1); // Feeding pump
      state.pressure_out = drift(state.pressure_out, 150, 200, 2); // Homogenization pressure (high)

      return {
        ...common,
        rpm: Math.round(state.rpm),
        pressure_in: toFixed(state.pressure_in),
        pressure_out: toFixed(state.pressure_out),
        valve_gap: 45,
        temperature: toFixed(drift(state.homo_temp ?? 45, 40, 60, 0.5)),
        oil_temp: toFixed(drift(state.oil_temp ?? 40, 35, 45, 0.2)),
      };
    }
    case 'CHILL': {
      // Stabilize status: only allow change every 10 mins
      const now = Date.now();
      if (!state.lastStatusChange) {
        state.lastStatusChange = now;
        state.compressor1_status = true; // start running
      }

      if (now - state.lastStatusChange > 600000) {
        // Chance to flip
        if (Math.random() < 0.3) {
          state.compressor1_status = !state.compressor1_status;
          state.lastStatusChange = now;
        }
      }

      const running = state.compressor1_status;
      return {
        ...common,
        compressor1_status: running,
        compressor1_amp: toFixed(drift(state.comp_amp ?? (running ? 25 : 0), running ? 18 : 0, running ? 55 : 0, 0.5)),
        suction_pressure: toFixed(drift(state.suc_p ?? 2, 1, 3, 0.1)),
        discharge_pressure: toFixed(drift(state.dis_p ?? 12, 10, 15, 0.2)),
        condenser_fan_rpm: running ? 1200 : 0,
        refrigerant_temp: toFixed(drift(state.ref_temp ?? 4, 0, 10, 0.2)),
        oil_pressure: toFixed(drift(state.oil_p ?? 3, 2, 4, 0.1)),
        state: running ? 'RUNNING' : 'STANDBY',
      };
    }
    case 'CIP': {
      // Loop phases slowly
      const phases = ['PRE-RINSE', 'CAUSTIC', 'RINSE', 'ACID', 'FINAL_RINSE'];
      if (!state.phaseTimestamp) state.phaseTimestamp = Date.now();
      if ((Date.now() - state.phaseTimestamp) > 30000) {
        state.phaseIdx = ((state.phaseIdx ?? 0) + 1) % phases.length;
        state.phaseTimestamp = Date.now();
      }

      return {
        ...common,
        cycle_phase: phases[state.phaseIdx ?? 0],
        chemical_conc: toFixed(drift(state.conc ?? 1.5, 1.0, 2.0, 0.05)),
        pump_flow: toFixed(drift(state.flow ?? 120, 110, 130, 1)),
        pump_status: true,
        tank_level_chem: toFixed(drift(state.chem_level ?? 80, 50, 100, 0.2)),
        temp: toFixed(drift(state.cip_temp ?? 65, 60, 70, 0.5)),
        cycle_time_elapsed: Math.round((Date.now() - state.phaseTimestamp) / 1000),
        state: 'RUNNING',
      };
    }
    case 'FLOW': {
      state.instant_flow = drift(state.instant_flow, 400, 600, 2.0);
      state.cum_volume = (state.cum_volume ?? 10000) + (state.instant_flow / 60) * (intervalMs / 1000 / 60); // approx integration

      return {
        ...common,
        instant_flow: toFixed(state.instant_flow),
        cum_volume: toFixed(state.cum_volume),
        velocity: toFixed(state.instant_flow / 200, 2), // dummy conversion
        signal_strength: 95,
        state: 'OK',
      };
    }
    case 'TANK': {
      state.level = drift(state.level, 20, 80, 0.5);
      state.milk_temp = drift(state.tank_milk_temp ?? 2, 0, 4, 0.1);

      const now = Date.now();
      if (!state.lastAgitatorChange) {
        state.lastAgitatorChange = now;
        state.agitator_status = true;
      }
      if (now - state.lastAgitatorChange > 600000) {
        if (Math.random() < 0.3) {
          state.agitator_status = !state.agitator_status;
          state.lastAgitatorChange = now;
        }
      }

      return {
        ...common,
        level: toFixed(state.level),
        milk_temp: toFixed(state.milk_temp),
        inlet_flow: 0,
        outlet_flow: 0,
        agitator_status: state.agitator_status,
        state: 'HOLDING',
      };
    }
    case 'VAC': {
      // Motor Current: 11-14 A
      state.motor_current = drift(state.motor_current, 11, 14, 0.1);

      return {
        ...common,
        vacuum_level: toFixed(drift(state.vac ?? -60, -70, -50, 0.5)),
        pump_rpm: 2800,
        motor_current: toFixed(state.motor_current),
        oil_temp: toFixed(drift(state.oil_temp ?? 45, 40, 50, 0.1)),
        state: 'PUMPING',
      };
    }
    case 'VALVE': {
      // Torque: 30-50 Nm
      state.position = drift(state.position, 0, 100, 2);
      state.torque = drift(state.torque, 30, 50, 0.5);

      return {
        ...common,
        position: Math.round(state.position),
        commanded_position: Math.round(state.position),
        torque: toFixed(state.torque),
        status: 'OK',
      };
    }
    case 'CONV': {
      // VFD Temp: 20-40, Cmd Speed: 600-1800, Speed RPM: 590-640, Motor Current: 11-14
      state.vfd_temp = drift(state.vfd_temp, 20, 40, 0.2);
      state.cmd_speed = drift(state.cmd_speed, 600, 1800, 2.0);

      // Speed RPM strictly 590-640 as requested, ignoring logical link to cmd_speed for now to obey metadata
      state.speed_rpm = drift(state.speed_rpm, 590, 640, 1);

      state.motor_current = drift(state.conv_current ?? 12, 11, 14, 0.1);
      state.torque = drift(state.conv_torque ?? 40, 30, 50, 0.5);

      return {
        ...common,
        speed_rpm: Math.round(state.speed_rpm),
        cmd_speed: Math.round(state.cmd_speed),
        motor_current: toFixed(state.motor_current),
        vfd_temp: toFixed(state.vfd_temp),
        torque: toFixed(state.torque),
        state: 'RUNNING',
      };
    }
    default:
      return common;
  }
}

async function sendHttpTelemetry(device, payload) {
  const url = `${baseUrl}/ingest/telemetry`;
  const body = { deviceId: device.deviceId, kind: device.kind, ts: nowIso(), ...payload };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

function startHttp() {
  const states = new Map();
  const tick = async () => {
    await Promise.allSettled(
      devices.map(async (d) => {
        const st = states.get(d.deviceId) ?? {};
        const payload = generateTelemetry(d.kind, st);
        states.set(d.deviceId, st);
        await sendHttpTelemetry(d, payload);
      })
    );
  };

  // Send immediately, then on interval
  tick();
  setInterval(tick, intervalMs);
  // eslint-disable-next-line no-console
  console.log(`[sim] HTTP mode -> ${baseUrl}/ingest/telemetry @ ${intervalMs}ms (${devices.length} devices)`);
}

function startWs() {
  const states = new Map();

  function connectDevice(d) {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', deviceId: d.deviceId, kind: d.kind }));
      // eslint-disable-next-line no-console
      console.log(`[sim] ws connected ${d.deviceId}`);

      // Send one telemetry frame right away (then continue on the interval)
      const st = states.get(d.deviceId) ?? {};
      const payload = generateTelemetry(d.kind, st);
      states.set(d.deviceId, st);
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'telemetry', ts: nowIso(), payload }));
        }
      }, 10);
    });

    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const st = states.get(d.deviceId) ?? {};
      const payload = generateTelemetry(d.kind, st);
      states.set(d.deviceId, st);
      ws.send(JSON.stringify({ type: 'telemetry', ts: nowIso(), payload }));
    }, intervalMs);

    ws.on('close', () => {
      clearInterval(timer);
      // Reconnect after a bit
      setTimeout(() => connectDevice(d), 1500 + Math.random() * 1500);
    });

    ws.on('error', () => {
      // handled by close/reconnect
    });
  }

  devices.forEach(connectDevice);
  // eslint-disable-next-line no-console
  console.log(`[sim] WS mode -> ${wsUrl} @ ${intervalMs}ms (${devices.length} devices)`);
}

if (mode === 'ws') startWs();
else startHttp();


