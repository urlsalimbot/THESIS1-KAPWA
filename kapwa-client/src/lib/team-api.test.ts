import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import {
  getSchedule,
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getMyStatus,
  putStatus,
  getStatuses,
  getAchievements,
  getIncomingInvites,
  getOutgoingInvites,
  sendInvite,
  acceptInvite,
  declineInvite,
} from './team-api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

const mocked = {
  get: vi.mocked(api.get),
  post: vi.mocked(api.post),
  patch: vi.mocked(api.patch),
  put: vi.mocked(api.put),
  del: vi.mocked(api.del),
};

describe('team-api', () => {
  beforeEach(() => {
    for (const fn of Object.values(mocked)) fn.mockReset();
    mocked.get.mockResolvedValue([]);
    mocked.post.mockResolvedValue(undefined);
    mocked.patch.mockResolvedValue(undefined);
    mocked.put.mockResolvedValue(undefined);
    mocked.del.mockResolvedValue(undefined);
  });

  it('getBlocks GETs /team/blocks with from/to params', () => {
    getBlocks('2026-09-28', '2026-10-04');
    expect(mocked.get).toHaveBeenCalledWith('/team/blocks?from=2026-09-28&to=2026-10-04');
  });

  it('getEvents GETs /team/events with from/to params', () => {
    getEvents('2026-09-28', '2026-10-04');
    expect(mocked.get).toHaveBeenCalledWith('/team/events?from=2026-09-28&to=2026-10-04');
  });

  it('getSchedule merges blocks + events client-side with the range echoed', async () => {
    mocked.get.mockResolvedValueOnce([{ id: 'b1' }]).mockResolvedValueOnce([{ id: 'e1' }]);
    const schedule = await getSchedule('2026-09-28', '2026-10-04');
    expect(mocked.get).toHaveBeenNthCalledWith(1, '/team/blocks?from=2026-09-28&to=2026-10-04');
    expect(mocked.get).toHaveBeenNthCalledWith(2, '/team/events?from=2026-09-28&to=2026-10-04');
    expect(schedule).toEqual({ from: '2026-09-28', to: '2026-10-04', blocks: [{ id: 'b1' }], events: [{ id: 'e1' }] });
  });

  it('createBlock POSTs the input to /team/blocks', () => {
    const input = { userId: 'u1', blockDate: '2026-10-01', blockType: 'in_office' };
    createBlock(input);
    expect(mocked.post).toHaveBeenCalledWith('/team/blocks', input);
  });

  it('updateBlock PATCHes /team/blocks/:id with the partial', () => {
    const patch = { blockType: 'remote' };
    updateBlock('b1', patch);
    expect(mocked.patch).toHaveBeenCalledWith('/team/blocks/b1', patch);
  });

  it('deleteBlock DELETEs /team/blocks/:id', () => {
    deleteBlock('b1');
    expect(mocked.del).toHaveBeenCalledWith('/team/blocks/b1');
  });

  it('createEvent POSTs the input to /team/events', () => {
    const input = { title: 'Meeting', startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T02:00:00Z', visibleTo: 'staff' };
    createEvent(input);
    expect(mocked.post).toHaveBeenCalledWith('/team/events', input);
  });

  it('updateEvent PATCHes /team/events/:id with the partial', () => {
    const patch = { location: 'Hall A' };
    updateEvent('e1', patch);
    expect(mocked.patch).toHaveBeenCalledWith('/team/events/e1', patch);
  });

  it('deleteEvent DELETEs /team/events/:id', () => {
    deleteEvent('e1');
    expect(mocked.del).toHaveBeenCalledWith('/team/events/e1');
  });

  it('getMyStatus GETs /team/status', () => {
    getMyStatus();
    expect(mocked.get).toHaveBeenCalledWith('/team/status');
  });

  it('putStatus PUTs the input to /team/status', () => {
    const input = { status: 'home_visit', note: 'Field visit' };
    putStatus(input);
    expect(mocked.put).toHaveBeenCalledWith('/team/status', input);
  });

  it('getStatuses GETs /team/statuses', () => {
    getStatuses();
    expect(mocked.get).toHaveBeenCalledWith('/team/statuses');
  });

  it('getAchievements GETs /team/achievements with from/to params', () => {
    getAchievements('2026-09-01', '2026-09-30');
    expect(mocked.get).toHaveBeenCalledWith('/team/achievements?from=2026-09-01&to=2026-09-30');
  });

  // Invite endpoints pinned against kapwa-server/src/team/team-invites.controller.ts:
  // POST /team/invites, GET /team/invites/incoming|outgoing, PATCH
  // /team/invites/:id/accept|decline (accept returns the created TeamBlock).
  it('getIncomingInvites GETs /team/invites/incoming', () => {
    getIncomingInvites();
    expect(mocked.get).toHaveBeenCalledWith('/team/invites/incoming');
  });

  it('getOutgoingInvites GETs /team/invites/outgoing', () => {
    getOutgoingInvites();
    expect(mocked.get).toHaveBeenCalledWith('/team/invites/outgoing');
  });

  it('sendInvite POSTs the suggestion body to /team/invites', () => {
    const input = { toUserId: 'u2', inviteDate: '2026-10-01', blockType: 'home_visit', note: 'FDS' };
    sendInvite(input);
    expect(mocked.post).toHaveBeenCalledWith('/team/invites', input);
  });

  it('sendInvite forwards a note-less suggestion (note optional)', () => {
    sendInvite({ toUserId: 'u2', inviteDate: '2026-10-01', blockType: 'in_office' });
    expect(mocked.post).toHaveBeenCalledWith('/team/invites', {
      toUserId: 'u2',
      inviteDate: '2026-10-01',
      blockType: 'in_office',
    });
  });

  it('acceptInvite PATCHes /team/invites/:id/accept (returns the created block)', () => {
    acceptInvite('inv1');
    expect(mocked.patch).toHaveBeenCalledWith('/team/invites/inv1/accept');
  });

  it('declineInvite PATCHes /team/invites/:id/decline', () => {
    declineInvite('inv1');
    expect(mocked.patch).toHaveBeenCalledWith('/team/invites/inv1/decline');
  });
});