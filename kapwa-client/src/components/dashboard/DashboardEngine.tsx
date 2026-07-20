import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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

function getDefaultLayout(widgets: WidgetConfig[], cols: number): Layout[] {
  return widgets.map((w, i) => ({
    i: w.key,
    x: i % cols,
    y: Math.floor(i / cols) * 2,
    w: w.defaultW ?? Math.max(1, Math.floor(cols / 2)),
    h: w.defaultH ?? 5,
    minW: w.minW ?? 1,
    minH: w.minH ?? 3,
  }));
}

export function DashboardEngine({
  widgets,
  rowHeight = 60,
  cols = 3,
  storageKey = 'dashboard-layout',
}: DashboardEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [layout, setLayout] = useState<Layout[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lg) return parsed.lg;
      }
    } catch {}
    return getDefaultLayout(widgets, cols);
  });

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
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
    <div ref={containerRef}>
      <GridLayout
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={width}
        onLayoutChange={onLayoutChange}
        isDraggable={!isMobile}
        isResizable={!isMobile}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
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
    </div>
  );
}
