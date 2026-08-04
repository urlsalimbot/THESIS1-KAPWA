import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from './useConnectivity';

describe('useConnectivity', () => {
  it('starts with navigator.onLine and flips on offline/online events', () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current).toBe(navigator.onLine);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });
});
