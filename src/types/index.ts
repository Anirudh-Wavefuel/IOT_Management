export type UserRole = 'admin' | 'operator' | 'base';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export type DeviceKind =
  | 'BMC'
  | 'PAST'
  | 'HOMO'
  | 'CHILL'
  | 'CIP'
  | 'FLOW'
  | 'TANK'
  | 'VAC'
  | 'VALVE'
  | 'CONV';

export interface Device {
  id: string;
  kind: DeviceKind;
  status: DeviceStatus;
  lastSeenAt: string | null;
  lastDisconnectAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceMetric {
  id: string;
  deviceId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface DashboardSummary {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  activeAlerts: number;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
}

export interface ChartData {
  name: string;
  data: TimeSeriesDataPoint[];
}

export type TimeRange = '1h' | '24h' | '7d';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
