## WaveFuel IoT Management (Postgres + Prisma + Simulator)

React dashboard + Node API that ingests simulated IoT telemetry over **HTTP** or **WebSocket**, stores it in **PostgreSQL** via **Prisma**, and shows live device status/telemetry + alert cards in the UI.

### Stack
- **Frontend**: Vite + React + TypeScript (port `8080`)
- **Backend**: Node + Express + WebSocket (`ws`) + Prisma (port `3001`)
- **DB**: Postgres (connect via `POSTGRES_DB_URI`)

### Setup
Create `wavefuel-monitor-main/.env` (template: `env.example`):
- `POSTGRES_DB_URI="postgresql://postgres:admin@localhost:5432/IOT"`
- `JWT_SECRET="..."` (required)
- `PORT=3001` (optional)
- `OFFLINE_THRESHOLD_MS=10000` (optional; device becomes OFFLINE after inactivity)
- `STATUS_SWEEP_MS=5000` (optional; how often offline detection runs)

Install and run:

```sh
cd wavefuel-monitor-main
npm i
npm run dev
```

Frontend: `http://localhost:8080`  
API: `http://localhost:3001`

### DB schema sync (only when schema changes)

```sh
npm run db:sync
```

### Start simulator (creates 10 devices + telemetry)
In a second terminal (after `npm run dev`):

```sh
# HTTP ingest (recommended)
npm run sim:http -- --intervalMs 2000

# or WebSocket ingest
npm run sim:ws -- --intervalMs 2000
```

Device types/fields are based on `devices.md`.

### Auth / roles
Roles stored in DB: `admin`, `operator`, `base`.  
Login is **role-locked** (you can only log in with the role stored on your account).

### Dashboard APIs (read from Postgres)
- `GET /api/devices`
- `GET /api/devices/:id`
- `GET /api/devices/:id/telemetry?since=&limit=`
- `GET /api/alerts`

### Alerts
Dashboard shows alert cards when latest telemetry per device exceeds:
- **Temperature** > **4°C**
- **Pressure** > **100 psi** (server converts stored `pressure` from bar→psi)

### Troubleshooting (Windows)
- If API fails with `EADDRINUSE` (port 3001 busy):

```sh
taskkill.exe //F //IM node.exe
```
