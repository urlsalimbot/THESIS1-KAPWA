import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DailyCounts {
  [day: string]: { interventions: number; cases: number };
}

interface ActivityCalendarProps {
  data: DailyCounts | null;
  year: number;
  month: number;
}

export function ActivityCalendar({ data, year, month }: ActivityCalendarProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">Loading...</p></CardContent>
      </Card>
    );
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const today = new Date();

  const weeks: { day: number; count: number }[][] = [];
  let week: { day: number; count: number }[] = [];
  for (let i = 0; i < firstDay; i++) week.push({ day: 0, count: -1 });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const counts = data[key];
    const total = counts ? counts.interventions + counts.cases : 0;
    week.push({ day: d, count: total });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push({ day: 0, count: -1 }); weeks.push(week); }

  const maxCount = Math.max(1, ...Object.values(data).flatMap(d => d.cases + d.interventions));
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const colors = ['bg-muted', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500'];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{monthName}</p>
        <div className="grid grid-cols-7 gap-0.5 text-[9px] leading-none">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[8px] text-muted-foreground py-0.5 font-medium">{d}</div>
          ))}
          {weeks.flat().map((cell, i) => {
            if (cell.day === 0) return <div key={i} />;
            const intensity = cell.count > 0 ? Math.min(Math.ceil((cell.count / maxCount) * 4), 4) : 0;
            const isToday = cell.day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
            return (
              <div
                key={i}
                title={`${monthName} ${cell.day}: ${cell.count} activities`}
                className={`rounded-sm h-5 flex items-center justify-center text-[8px] font-medium transition-colors ${colors[intensity]} ${isToday ? 'ring-1 ring-primary' : ''} ${cell.count > 0 ? 'text-white' : 'text-muted-foreground'}`}
              >
                {cell.day}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
