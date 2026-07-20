import { useState, useEffect, useCallback, ReactNode } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

export interface WidgetConfig {
  key: string;
  component: ReactNode;
  defaultW?: number;
  defaultH?: number;
  minW?: number;
  minH?: number;
}

interface DashboardEngineProps {
  widgets: WidgetConfig[];
  rowHeight?: number;
  cols?: number;
  storageKey?: string;
}

function getDefaultLayout(widgets: WidgetConfig[]): Layout {
  return widgets.map((w, i) => ({
    i: w.key,
    x: (i * 2) % 6,
    y: Math.floor(i / 3) * 2,
    w: w.defaultW ?? 2,
    h: w.defaultH ?? 5,
    minW: w.minW ?? 2,
    minH: w.minH ?? 3,
  }));
}

export function DashboardEngine({
  widgets,
  rowHeight = 60,
  cols = 3,
  storageKey = 'dashboard-layout',
}: DashboardEngineProps) {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lg) return parsed.lg;
      }
    } catch {}
    return getDefaultLayout(widgets);
  });

  const onLayoutChange = useCallback((newLayout: Layout) => {
    setLayout(newLayout);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ lg: newLayout }));
    } catch {}
  }, [storageKey]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <GridLayout
      layout={layout}
      gridConfig={{ cols, rowHeight }}
      dragConfig={{ enabled: !isMobile, handle: '.widget-drag-handle' }}
      resizeConfig={{ enabled: !isMobile }}
      width={1200}
      onLayoutChange={onLayoutChange}
      className="layout"
    >
      {widgets.map(w => (
        <div key={w.key} className="relative">
          {!isMobile && (
            <div className="widget-drag-handle absolute top-1 right-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="3" cy="3" r="1"/><circle cx="9" cy="3" r="1"/><circle cx="3" cy="9" r="1"/><circle cx="9" cy="9" r="1"/><circle cx="3" cy="6" r="1"/><circle cx="9" cy="6" r="1"/></svg>
            </div>
          )}
          {w.component}
        </div>
      ))}
    </GridLayout>
  );
}
