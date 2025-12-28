import { Device, DeviceMetric, DashboardSummary, User, TimeSeriesDataPoint } from '@/types';

export const mockUsers: User[] = [
  { id: '1', email: 'admin@wavefuel.io', name: 'Sarah Chen', role: 'admin' },
  { id: '2', email: 'operator@wavefuel.io', name: 'James Wilson', role: 'operator' },
  { id: '3', email: 'base@wavefuel.io', name: 'Emily Parker', role: 'base' },
];

export const mockDevices: Device[] = [
  { id: 'DEV-001', name: 'Pump Station Alpha', status: 'online', location: 'Building A - Floor 1', lastSeen: new Date(), type: 'Pump' },
  { id: 'DEV-002', name: 'Temperature Sensor B2', status: 'online', location: 'Building A - Floor 2', lastSeen: new Date(), type: 'Sensor' },
  { id: 'DEV-003', name: 'Flow Meter C3', status: 'offline', location: 'Building B - Floor 1', lastSeen: new Date(Date.now() - 3600000), type: 'Meter' },
  { id: 'DEV-004', name: 'Pressure Gauge D4', status: 'online', location: 'Building B - Floor 2', lastSeen: new Date(), type: 'Gauge' },
  { id: 'DEV-005', name: 'Power Monitor E5', status: 'online', location: 'Building C - Floor 1', lastSeen: new Date(), type: 'Monitor' },
  { id: 'DEV-006', name: 'Humidity Sensor F6', status: 'unknown', location: 'Building C - Floor 2', lastSeen: new Date(Date.now() - 7200000), type: 'Sensor' },
  { id: 'DEV-007', name: 'Valve Controller G7', status: 'online', location: 'Building A - Basement', lastSeen: new Date(), type: 'Controller' },
  { id: 'DEV-008', name: 'Tank Level H8', status: 'online', location: 'Building B - Basement', lastSeen: new Date(), type: 'Sensor' },
  { id: 'DEV-009', name: 'Compressor I9', status: 'offline', location: 'Building C - Basement', lastSeen: new Date(Date.now() - 1800000), type: 'Pump' },
  { id: 'DEV-010', name: 'HVAC Unit J10', status: 'online', location: 'Building A - Roof', lastSeen: new Date(), type: 'HVAC' },
];

export const mockDashboardSummary: DashboardSummary = {
  totalDevices: mockDevices.length,
  onlineDevices: mockDevices.filter(d => d.status === 'online').length,
  offlineDevices: mockDevices.filter(d => d.status === 'offline').length,
  activeAlerts: 2,
};

export function generateTimeSeriesData(hours: number = 24): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = [];
  const now = new Date();
  const interval = (hours * 60) / 50; // ~50 data points

  for (let i = 50; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * interval * 60000);
    const baseValue = 50 + Math.sin(i / 5) * 20;
    const noise = (Math.random() - 0.5) * 10;
    data.push({
      timestamp,
      value: Math.round((baseValue + noise) * 10) / 10,
    });
  }

  return data;
}

export function generateDeviceMetrics(deviceId: string): DeviceMetric[] {
  const types: Array<DeviceMetric['type']> = ['temperature', 'humidity', 'pressure', 'power', 'flow'];
  const units: Record<DeviceMetric['type'], string> = {
    temperature: '°C',
    humidity: '%',
    pressure: 'bar',
    power: 'kW',
    flow: 'L/min',
  };

  return types.map((type, i) => ({
    id: `${deviceId}-metric-${i}`,
    deviceId,
    type,
    value: Math.round((30 + Math.random() * 40) * 10) / 10,
    unit: units[type],
    timestamp: new Date(),
  }));
}
