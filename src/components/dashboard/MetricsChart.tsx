import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimeRange, type Device } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Radio } from 'lucide-react';
import { fetchDevices, fetchTelemetry } from '@/lib/iot';

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: '1H', value: '1h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
];

const rangeToHours: Record<TimeRange, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
};

export function MetricsChart() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');
  const [isLive, setIsLive] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [series, setSeries] = useState<Array<{ time: string; value: number }>>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const since = useMemo(() => {
    const hours = rangeToHours[selectedRange];
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }, [selectedRange]);

  const formatXAxis = (timestamp: Date) => {
    if (selectedRange === '1h') {
      return format(new Date(timestamp), 'HH:mm');
    } else if (selectedRange === '24h') {
      return format(new Date(timestamp), 'HH:mm');
    }
    return format(new Date(timestamp), 'MMM dd');
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await fetchDevices();
        if (!alive) return;
        setDevices(d);
        setDeviceId(prev => prev ?? d[0]?.id ?? null);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    let alive = true;
    const load = async () => {
      try {
        const t = await fetchTelemetry(deviceId, { since, limit: 500 });
        if (!alive) return;
        const points = t
          .filter(row => row.temperature !== null)
          .map(row => ({
            time: formatXAxis(new Date(row.ts)),
            value: row.temperature as number,
          }));
        setSeries(points);
      } catch {
        // ignore
      }
    };
    load();
    const interval = isLive ? setInterval(load, 2000) : null;
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [deviceId, since, isLive]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base font-medium">
            Temperature (device: {deviceId ?? '—'})
          </CardTitle>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-online))]">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 border border-border p-0.5">
          {timeRanges.map(range => (
            <Button
              key={range.value}
              variant={selectedRange === range.value ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setSelectedRange(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
