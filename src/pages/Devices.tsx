import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DevicesTable } from '@/components/devices/DevicesTable';
import { Badge } from '@/components/ui/badge';

export default function Devices() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-muted-foreground">Monitor and manage all IoT devices</p>
          </div>
          {user?.role === 'base' && (
            <Badge variant="outline" className="text-muted-foreground">
              Read-only access
            </Badge>
          )}
        </div>

        <DevicesTable />
      </div>
    </DashboardLayout>
  );
}
