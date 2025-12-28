import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  subtitle?: string;
}

const variantStyles = {
  default: 'bg-card',
  success: 'bg-card border-l-4 border-l-[hsl(var(--status-online))]',
  danger: 'bg-card border-l-4 border-l-[hsl(var(--status-offline))]',
  warning: 'bg-card border-l-4 border-l-[hsl(var(--chart-3))]',
};

export function KPICard({ title, value, icon, variant = 'default', subtitle }: KPICardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
