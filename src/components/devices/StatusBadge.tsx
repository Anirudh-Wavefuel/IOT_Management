import { DeviceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: DeviceStatus;
  size?: 'sm' | 'default';
}

const statusConfig: Record<DeviceStatus, { label: string; className: string }> = {
  ONLINE: {
    label: 'Online',
    className: 'bg-[hsl(var(--status-online))] text-primary-foreground hover:bg-[hsl(var(--status-online))]',
  },
  OFFLINE: {
    label: 'Offline',
    className: 'bg-[hsl(var(--status-offline))] text-primary-foreground hover:bg-[hsl(var(--status-offline))]',
  },
  UNKNOWN: {
    label: 'Unknown',
    className: 'bg-[hsl(var(--status-unknown))] text-primary-foreground hover:bg-[hsl(var(--status-unknown))]',
  },
};

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge 
      className={cn(
        config.className,
        size === 'sm' && 'text-xs px-2 py-0.5'
      )}
    >
      {config.label}
    </Badge>
  );
}
