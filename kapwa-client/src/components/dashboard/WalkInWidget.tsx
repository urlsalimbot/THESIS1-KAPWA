import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface WalkInDashboard {
  visits: number; waiting: number; inService: number; completed: number; referred: number;
  avgWaitingMinutes: number; conversionRate: number;
}

/** Today's front-door activity — the logbook side of the dashboard. */
export function WalkInWidget() {
  const navigate = useNavigate();
  const { data } = useSWR<WalkInDashboard>(['walkInDashboard'], () => api.get<WalkInDashboard>('/walk-in-logs/dashboard'));
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Walk-in log · today</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/walk-in-logs')}>Open log</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Visits</div><div className="text-xl font-semibold">{data?.visits ?? 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Waiting</div><div className="text-xl font-semibold text-warning-foreground">{data?.waiting ?? 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Completed</div><div className="text-xl font-semibold text-success">{data?.completed ?? 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Avg wait</div><div className="text-xl font-semibold">{data?.avgWaitingMinutes ?? 0}m</div></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Referrals {data?.referred ?? 0} · visit → case {data?.conversionRate ?? 0}%</p>
      </CardContent>
    </Card>
  );
}
