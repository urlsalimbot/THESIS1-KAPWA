import React from 'react';

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useConfig() {
  return { apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' };
}