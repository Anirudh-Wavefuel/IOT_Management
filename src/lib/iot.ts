import { apiFetch } from '@/lib/api';
import type { Device } from '@/types';

export interface TelemetryRow {
  id: string;
  ts: string;
  payload: Record<string, unknown>;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  battery: number | null;
}

export interface AlertRow {
  type: 'TEMPERATURE' | 'PRESSURE';
  deviceId: string;
  kind: string;
  status: string;
  ts: string;
  value: number;
  unit: string;
  threshold: number;
  thresholdUnit: string;
  message: string;
}

export async function fetchAlerts(deviceId?: string): Promise<AlertRow[]> {
  const url = deviceId
    ? `/api/alerts?deviceId=${encodeURIComponent(deviceId)}`
    : '/api/alerts';
  const { alerts } = await apiFetch<{ alerts: AlertRow[] }>(url);
  return alerts ?? [];
}

export async function fetchDevices(): Promise<Device[]> {
  const { devices } = await apiFetch<{ devices: Device[] }>('/api/devices');
  return devices ?? [];
}

export async function fetchDevice(id: string): Promise<Device> {
  const { device } = await apiFetch<{ device: Device }>(`/api/devices/${encodeURIComponent(id)}`);
  return device;
}

export async function fetchTelemetry(deviceId: string, opts?: { since?: Date; limit?: number }): Promise<TelemetryRow[]> {
  const params = new URLSearchParams();
  if (opts?.since) params.set('since', opts.since.toISOString());
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();

  const { telemetry } = await apiFetch<{ telemetry: TelemetryRow[] }>(
    `/api/devices/${encodeURIComponent(deviceId)}/telemetry${qs ? `?${qs}` : ''}`
  );
  return telemetry ?? [];
}


