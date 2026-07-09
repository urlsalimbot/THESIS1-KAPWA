import { createContext, useContext, type ReactNode } from 'react';

interface PageInfo {
  title: string;
  description?: string;
}

const PageInfoContext = createContext<PageInfo>({ title: '' });

export function PageInfoProvider({ value, children }: { value: PageInfo; children: ReactNode }) {
  return (
    <PageInfoContext.Provider value={value}>
      {children}
    </PageInfoContext.Provider>
  );
}

export function usePageInfo(): PageInfo {
  return useContext(PageInfoContext);
}
