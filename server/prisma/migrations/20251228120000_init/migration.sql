-- Initial schema for WaveFuel (Prisma-managed)
-- This migration is written to be idempotent for local dev: it won't fail if tables already exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'base', 'viewer');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
    CREATE TYPE public.device_status AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_kind') THEN
    CREATE TYPE public.device_kind AS ENUM ('BMC','PAST','HOMO','CHILL','CIP','FLOW','TANK','VAC','VALVE','CONV');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'base',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id text PRIMARY KEY,
  kind public.device_kind NOT NULL,
  status public.device_status NOT NULL DEFAULT 'UNKNOWN',
  last_seen_at timestamptz NULL,
  last_disconnect_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  payload jsonb NOT NULL,
  temperature double precision NULL,
  humidity double precision NULL,
  pressure double precision NULL,
  battery double precision NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telemetry_device_ts_idx ON public.telemetry (device_id, ts DESC);
CREATE INDEX IF NOT EXISTS devices_status_idx ON public.devices (status);
CREATE INDEX IF NOT EXISTS devices_last_seen_idx ON public.devices (last_seen_at);


