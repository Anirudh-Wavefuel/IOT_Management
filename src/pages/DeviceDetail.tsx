import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Radio, MapPin, Clock, Tag, Settings } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/devices/StatusBadge';
import { DeviceMetricCard } from '@/components/devices/DeviceMetricCard';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Device, DeviceMetric } from '@/types';
import { fetchDevice, fetchTelemetry, fetchAlerts, type TelemetryRow, type AlertRow } from '@/lib/iot';

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [device, setDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    const load = async () => {
      try {
        const d = await fetchDevice(id);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [t, a] = await Promise.all([
          fetchTelemetry(id, { since, limit: 500 }),
          fetchAlerts(id)
        ]);

        if (!alive) return;
        setDevice(d);
        setTelemetry(t);
        setAlerts(a);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [id]);

  // IMPORTANT: keep hooks above any early returns (prevents blank page due to hook order mismatch)
  const latest = useMemo(() => (telemetry.length ? telemetry[telemetry.length - 1] : null), [telemetry]);

  const metrics: DeviceMetric[] = useMemo(() => {
    if (!device || !latest) return [];
    const ts = new Date(latest.ts);
    const out: DeviceMetric[] = [];

    const addedKeys = new Set<string>();

    const add = (key: string, val: unknown, unit: string) => {
      if (typeof val === 'number') {
        out.push({
          id: `${device.id}-${key}`,
          deviceId: device.id,
          type: key,
          value: Math.round(val * 100) / 100,
          unit,
          timestamp: ts,
        });
        addedKeys.add(key);
      }
    };

    // Standard fields with known units
    if (latest.temperature !== null) add('temperature', latest.temperature, '°C');
    if (latest.humidity !== null) add('humidity', latest.humidity, '%');
    if (latest.pressure !== null) add('pressure', latest.pressure, 'bar');
    if (latest.battery !== null) add('battery', latest.battery, '%');

    // Dynamic fields from payload
    if (latest.payload) {
      Object.entries(latest.payload).forEach(([k, v]) => {
        // Skip keys that were already handled
        if (addedKeys.has(k)) return;

        // Simple unit inference
        let u = '';
        const lower = k.toLowerCase();
        if (lower.includes('temp')) u = '°C';
        else if (lower.includes('pressure')) u = 'bar';
        else if (lower.includes('rpm') || lower.includes('speed')) u = 'RPM';
        else if (lower.includes('flow')) u = 'L/min';
        else if (lower.includes('level') || lower.includes('pos') || lower.includes('valve')) u = '%';
        else if (lower.includes('current') || lower.includes('amp')) u = 'A';
        else if (lower.includes('vol')) u = 'L';
        else if (lower.includes('time')) u = 's';
        else if (lower.includes('kwh')) u = 'kWh';
        else if (lower.includes('conc')) u = '%';

        add(k, v, u);
      });
    }

    return out;
  }, [device, latest]);

  const timeSeriesData = useMemo(() => {
    return telemetry.map(t => {
      const point: any = {
        timestamp: new Date(t.ts),
        time: format(new Date(t.ts), 'HH:mm'),
        // Standard fields
        temperature: t.temperature,
        humidity: t.humidity,
        pressure: t.pressure,
        battery: t.battery,
      };

      // Merge payload fields
      if (t.payload) {
        Object.entries(t.payload).forEach(([k, v]) => {
          if (typeof v === 'number') point[k] = v;
        });
      }
      return point;
    });
  }, [telemetry]);

  const displayMetrics = useMemo(() => {
    return user?.role === 'base'
      ? metrics.filter(m => ['temperature', 'battery'].includes(m.type))
      : metrics;
  }, [metrics, user?.role]);

  if (!id) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-muted-foreground">Device not found</p>
          <Button variant="outline" onClick={() => navigate('/devices')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-2">
          <p className="text-muted-foreground">Loading device…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!device) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-muted-foreground">Device not found</p>
          <Button variant="outline" onClick={() => navigate('/devices')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/devices')}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{device.id}</h1>
              <StatusBadge status={device.status} />
              {device.status === 'ONLINE' && (
                <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-online))]">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'base' && (
              <Badge variant="outline" className="text-muted-foreground">
                Limited view
              </Badge>
            )}
            <RoleGuard allowed={['admin']}>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </RoleGuard>
          </div>
        </div>



        {/* Alerts Section */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium text-red-700 dark:text-red-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent alerts recorded.</p>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map(alert => (
                  <div key={alert.ts + alert.type} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded-md border border-red-100 dark:border-red-900/30">
                    <div className="flex gap-3 items-center">
                      <Badge variant="destructive" className="font-mono text-xs">{alert.type}</Badge>
                      <span className="text-foreground/90 font-medium">{alert.message || `Value ${alert.value} exceeded threshold ${alert.threshold}`}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(alert.ts), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RoleGuard allowed={['admin', 'operator']}>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Device ID</p>
                  <p className="font-mono text-sm font-medium">{device.id}</p>
                </div>
              </CardContent>
            </Card>
          </RoleGuard>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Kind</p>
                <p className="text-sm font-medium">{device.kind}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Last Seen</p>
                <p className="text-sm font-medium">
                  {device.lastSeenAt
                    ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <RoleGuard allowed={['admin', 'operator']}>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium">{device.status}</p>
                </div>
              </CardContent>
            </Card>
          </RoleGuard>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">
            {user?.role === 'base' ? 'Key Metrics' : 'Live Metrics'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {displayMetrics.map(metric => (
              <DeviceMetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {displayMetrics.map(metric => (
            <Card key={metric.id + '-history'}>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {metric.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Trend (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey={metric.type}
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout >
  );
}
