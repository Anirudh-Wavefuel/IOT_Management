import { DeviceMetric } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Thermometer, Droplets, Gauge, Battery, Activity } from 'lucide-react';

interface DeviceMetricCardProps {
  metric: DeviceMetric;
}

const iconMap: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  battery: Battery,
};

const labelMap: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  battery: 'Battery',
};

export function DeviceMetricCard({ metric }: DeviceMetricCardProps) {
  const Icon = iconMap[metric.type] || Activity;
  const label = labelMap[metric.type] || metric.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-secondary">
              <Icon className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tracking-tight">
                {metric.value}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {metric.unit}
                </span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
