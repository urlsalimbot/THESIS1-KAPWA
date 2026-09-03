import { describe, it, expect } from 'vitest';
import { navTarget } from './NotificationsDropdown';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string;
}

function notif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    title: 'Test',
    message: 'test',
    category: 'sla_escalation',
    isRead: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('navTarget', () => {
  it('routes sla_escalation with a referenceId to the case', () => {
    expect(navTarget(notif({ referenceId: 'case-1' }))).toBe('/cases/case-1');
  });

  it('routes sla_escalation without a referenceId to /cases', () => {
    expect(navTarget(notif())).toBe('/cases');
  });

  it('leaves other categories unchanged', () => {
    expect(navTarget(notif({ category: 'sync_conflict' }))).toBe('/tracker');
    expect(navTarget(notif({ category: 'approval' }))).toBe('/approvals');
    expect(navTarget(notif({ category: 'unknown' }))).toBe('/notifications');
  });
});