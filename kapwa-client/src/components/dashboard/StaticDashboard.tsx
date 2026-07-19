import { ReactNode } from 'react';

export interface WidgetConfig {
  key: string;
  component: ReactNode;
  defaultW?: number;
  defaultH?: number;
  minW?: number;
  minH?: number;
}

interface StaticDashboardProps {
  widgets: WidgetConfig[];
}

export function StaticDashboard({ widgets }: StaticDashboardProps) {
  const large = widgets.filter(w => (w.defaultW ?? 1) >= 2);
  const small = widgets.filter(w => (w.defaultW ?? 1) < 2);

  const paired = [];
  let i = 0;
  while (i < large.length || i < small.length) {
    const pair: ReactNode[] = [];
    if (i < large.length) pair.push(large[i].component);
    if (i < small.length) pair.push(small[i].component);
    if (pair.length > 0) paired.push(pair);
    i++;
  }

  return (
    <div className="flex flex-col gap-4">
      {paired.map((pair, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {pair.length === 1 ? (
            <div className="lg:col-span-3">{pair[0]}</div>
          ) : (
            <>
              <div className="lg:col-span-2">{pair[0]}</div>
              <div className="lg:col-span-1">{pair[1]}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
