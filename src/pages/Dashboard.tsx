import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard, PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EQUIPMENT_STATUS_LABELS, WORK_ORDER_STATUS_LABELS, ROLE_LABELS, formatDate } from '@/lib/constants';
import { Truck, Wrench, ClipboardCheck, Route, Package, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { equipment, workOrders, inspections, travelLogs, requisitions } = useData();
  const { profile } = useAuth();

  const operationalCount = equipment.filter((e) => e.status === 'operational').length;
  const maintenanceCount = equipment.filter((e) => e.status === 'maintenance').length;
  const brokenCount = equipment.filter((e) => e.status === 'broken').length;
  const openWOCount = workOrders.filter((w) => w.status === 'open' || w.status === 'in_progress').length;
  const pendingInsp = inspections.filter((i) => i.status === 'pending').length;
  const pendingReq = requisitions.filter((r) => r.status === 'pending').length;
  const activeTrips = travelLogs.filter((t) => t.status === 'in_transit' || t.status === 'planned').length;

  const recentWorkOrders = [...workOrders].slice(0, 5);
  const criticalItems = equipment.filter((e) => e.status === 'broken' || e.status === 'maintenance').slice(0, 4);

  const statusData = [
    { label: 'Operational', value: operationalCount, color: 'bg-emerald-500', key: 'operational' },
    { label: 'Maintenance', value: maintenanceCount, color: 'bg-amber-500', key: 'maintenance' },
    { label: 'Standby', value: equipment.filter((e) => e.status === 'standby').length, color: 'bg-blue-500', key: 'standby' },
    { label: 'Broken', value: brokenCount, color: 'bg-red-500', key: 'broken' },
  ];
  const maxStatus = Math.max(...statusData.map((s) => s.value), 1);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}`}
        description={`You're signed in as ${ROLE_LABELS[profile?.role || 'user']}. Here's your overview.`}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Equipment" value={equipment.length} icon={<Truck className="w-5 h-5" />} color="blue" trend={`${operationalCount} operational`} />
        <StatCard label="Active Work Orders" value={openWOCount} icon={<Wrench className="w-5 h-5" />} color="amber" trend={`${workOrders.filter(w => w.status === 'waiting_parts').length} awaiting parts`} />
        <StatCard label="Pending Inspections" value={pendingInsp} icon={<ClipboardCheck className="w-5 h-5" />} color="teal" trend={`${inspections.length} total inspections`} />
        <StatCard label="Pending Requisitions" value={pendingReq} icon={<Package className="w-5 h-5" />} color="red" trend={`${requisitions.length} total requisitions`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Equipment status chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Equipment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusData.map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(s.value / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent work orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              Recent Work Orders
            </CardTitle>
            <button onClick={() => onNavigate('work-orders')} className="text-xs text-primary hover:underline">
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentWorkOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No work orders yet</p>
              ) : (
                recentWorkOrders.map((wo) => {
                  const eq = equipment.find((e) => e.id === wo.equipment_id);
                  return (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onNavigate('work-orders')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{wo.number} — {eq?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{wo.description}</p>
                      </div>
                      <StatusBadge status={wo.status} label={WORK_ORDER_STATUS_LABELS[wo.status]} />
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalItems.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  All equipment is operational
                </div>
              ) : (
                criticalItems.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{eq.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{eq.location} · {eq.serial_number}</p>
                    </div>
                    <StatusBadge status={eq.status} label={EQUIPMENT_STATUS_LABELS[eq.status]} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active trips & quick stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              Travel & Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Route className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Active Trips</span>
                </div>
                <p className="text-xl font-bold">{activeTrips}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Waiting Parts</span>
                </div>
                <p className="text-xl font-bold">{workOrders.filter(w => w.status === 'waiting_parts').length}</p>
              </div>
            </div>
            <div className="space-y-2">
              {travelLogs.filter((t) => t.status === 'in_transit' || t.status === 'planned').slice(0, 3).map((tl) => (
                <div key={tl.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tl.number}</p>
                    <p className="text-xs text-muted-foreground truncate">{tl.destination}</p>
                  </div>
                  <StatusBadge status={tl.status} label={tl.status === 'in_transit' ? 'In Transit' : 'Planned'} />
                </div>
              ))}
              {travelLogs.filter((t) => t.status === 'in_transit' || t.status === 'planned').length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">No active trips</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
