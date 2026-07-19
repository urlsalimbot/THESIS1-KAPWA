import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SlaWidgetProps {
  overdueCount: number;
}

export function SlaWidget({ overdueCount }: SlaWidgetProps) {
  const navigate = useNavigate();
  const compliant = overdueCount === 0;

  return (
    <Card className={compliant ? '' : 'ring-1 ring-destructive/30'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} />
          SLA Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          {compliant
            ? <CheckCircle size={20} className="text-green-600" />
            : <AlertTriangle size={20} className="text-destructive" />
          }
          <span className={`font-semibold ${compliant ? 'text-green-700' : 'text-destructive'}`}>
            {compliant ? 'Compliant' : `${overdueCount} Overdue`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Cases exceeding 72-hour SLA window
        </p>
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/cases')}>
          View Cases
        </Button>
      </CardContent>
    </Card>
  );
}
