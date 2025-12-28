import { useEffect, useMemo, useState } from 'react';
import { Cpu, CpuIcon, AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { MetricsChart } from '@/components/dashboard/MetricsChart';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { Badge } from '@/components/ui/badge';
import { fetchAlerts, fetchDevices, type AlertRow } from '@/lib/iot';
import type { Device } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Dashboard() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchDevices();
        if (alive) setDevices(data);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await fetchAlerts();
        if (alive) setAlerts(a);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const summary = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(d => d.status === 'ONLINE').length;
    const offline = devices.filter(d => d.status === 'OFFLINE').length;
    const activeAlerts = alerts.length;
    return {
      totalDevices: total,
      onlineDevices: online,
      offlineDevices: offline,
      activeAlerts,
    };
  }, [devices, alerts.length]);
  const uptimePct = summary.totalDevices ? Math.round((summary.onlineDevices / summary.totalDevices) * 100) : 0;

  const tempAlerts = useMemo(() => alerts.filter(a => a.type === 'TEMPERATURE'), [alerts]);
  const pressureAlerts = useMemo(() => alerts.filter(a => a.type === 'PRESSURE'), [alerts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">System overview at a glance</p>
          </div>
          {user?.role === 'base' && (
            <Badge variant="outline" className="text-muted-foreground">
              Read-only access
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Devices"
            value={summary.totalDevices}
            icon={<Cpu className="h-5 w-5" />}
            subtitle="Across all locations"
          />
          <KPICard
            title="Online"
            value={summary.onlineDevices}
            icon={<Activity className="h-5 w-5" />}
            variant="success"
            subtitle={`${uptimePct}% uptime`}
          />
          <KPICard
            title="Offline"
            value={summary.offlineDevices}
            icon={<CpuIcon className="h-5 w-5" />}
            variant="danger"
            subtitle="Requires attention"
          />
          <RoleGuard allowed={['admin', 'operator']}>
            <KPICard
              title="Active Alerts"
              value={summary.activeAlerts}
              icon={<AlertTriangle className="h-5 w-5" />}
              variant="warning"
              subtitle="Last 24 hours"
            />
          </RoleGuard>
          {user?.role === 'base' && (
            <KPICard
              title="System Status"
              value="Normal"
              icon={<Activity className="h-5 w-5" />}
              subtitle="All systems operational"
            />
          )}
        </div>

        <MetricsChart />

        {(tempAlerts.length > 0 || pressureAlerts.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Alert variant="destructive" className="bg-card">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Temperature Alerts ({tempAlerts.length})
              </AlertTitle>
              <AlertDescription>
                {tempAlerts.length === 0 ? (
                  <p>No temperature alerts.</p>
                ) : (
                  <div className="space-y-2">
                    {tempAlerts.slice(0, 6).map(a => (
                      <div key={`${a.type}-${a.deviceId}-${a.ts}`} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm">{a.deviceId}</span>
                        <span className="text-sm">
                          {a.value}{a.unit} &gt; {a.threshold}{a.thresholdUnit}
                        </span>
                      </div>
                    ))}
                    {tempAlerts.length > 6 && (
                      <p className="text-xs text-muted-foreground">+{tempAlerts.length - 6} more</p>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            <Alert variant="destructive" className="bg-card">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Pressure Alerts ({pressureAlerts.length})
              </AlertTitle>
              <AlertDescription>
                {pressureAlerts.length === 0 ? (
                  <p>No pressure alerts.</p>
                ) : (
                  <div className="space-y-2">
                    {pressureAlerts.slice(0, 6).map(a => (
                      <div key={`${a.type}-${a.deviceId}-${a.ts}`} className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm">{a.deviceId}</span>
                        <span className="text-sm">
                          {a.value}{a.unit} &gt; {a.threshold}{a.thresholdUnit}
                        </span>
                      </div>
                    ))}
                    {pressureAlerts.length > 6 && (
                      <p className="text-xs text-muted-foreground">+{pressureAlerts.length - 6} more</p>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
