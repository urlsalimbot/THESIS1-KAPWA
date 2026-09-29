import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';

interface FakeSocket {
  id: string;
  rooms: Set<string>;
  emit: jest.Mock;
  join: jest.Mock;
  handshake: { auth: Record<string, unknown>; query: Record<string, unknown> };
  data: Record<string, unknown>;
  disconnect: jest.Mock;
}

/**
 * Minimal socket.io Server stand-in: `to(room).emit(event, data)` reaches every
 * attached socket that joined the room — the same routing semantics the real
 * server applies for the notifications namespace.
 */
function makeFakeServer(sockets: FakeSocket[]) {
  return {
    to: jest.fn((room: string) => ({
      emit: jest.fn((event: string, data: unknown) => {
        for (const socket of sockets) {
          if (socket.rooms.has(room)) socket.emit(event, data);
        }
      }),
    })),
  };
}

function makeFakeSocket(id: string, token?: string): FakeSocket {
  const socket: FakeSocket = {
    id,
    rooms: new Set(),
    emit: jest.fn(),
    join: jest.fn((room: string) => {
      socket.rooms.add(room);
    }),
    handshake: { auth: token ? { token } : {}, query: {} },
    data: {},
    disconnect: jest.fn(),
  };
  return socket;
}

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtMock: any;

  beforeEach(async () => {
    jwtMock = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway, { provide: JwtService, useValue: jwtMock }],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('broadcasts team status to sockets attached to the team room', () => {
    const teamMember = makeFakeSocket('team-socket-1');
    const outsider = makeFakeSocket('other-socket-1');
    teamMember.join('team');
    outsider.join('user:u9');
    gateway.server = makeFakeServer([teamMember, outsider]) as any;

    const payload = {
      userId: 'u1',
      status: 'in_office',
      note: 'At the front desk',
      updatedAt: '2026-09-29T08:30:00.000Z',
    };

    gateway.broadcastTeamStatus(payload);

    expect(teamMember.emit).toHaveBeenCalledWith('team.status.updated', payload);
    expect(outsider.emit).not.toHaveBeenCalled();
  });

  it('emits to the team room via the server room helper', () => {
    const server = makeFakeServer([]);
    gateway.server = server as any;

    const payload = {
      userId: 'u2',
      status: 'field_visit',
      note: null,
      updatedAt: '2026-09-29T09:00:00.000Z',
    };

    gateway.broadcastTeamStatus(payload);

    expect(server.to).toHaveBeenCalledWith('team');
    const roomTarget = server.to.mock.results[0].value;
    expect(roomTarget.emit).toHaveBeenCalledWith('team.status.updated', payload);
  });

  it('supports optional note omitted', () => {
    const teamMember = makeFakeSocket('team-socket-2');
    teamMember.join('team');
    gateway.server = makeFakeServer([teamMember]) as any;

    gateway.broadcastTeamStatus({ userId: 'u3', status: 'out_of_office', updatedAt: '2026-09-29T10:00:00.000Z' });

    expect(teamMember.emit).toHaveBeenCalledWith(
      'team.status.updated',
      expect.objectContaining({ userId: 'u3', status: 'out_of_office' }),
    );
  });

  describe('handleConnection team-room join', () => {
    it.each(['admin', 'social_worker', 'coordinator'])(
      '%s socket joins the team room on connection',
      async (role) => {
        jwtMock.verify.mockReturnValue({ sub: 'u-staff', role });
        const socket = makeFakeSocket('staff-socket', 'token');
        await gateway.handleConnection(socket as any);
        expect(socket.join).toHaveBeenCalledWith('team');
        expect(socket.rooms.has('team')).toBe(true);
      },
    );

    it.each(['claimant', 'mayor', 'auditor', 'agency_staff'])(
      '%s socket does NOT join the team room on connection',
      async (role) => {
        jwtMock.verify.mockReturnValue({ sub: 'u-other', role });
        const socket = makeFakeSocket('other-socket', 'token');
        await gateway.handleConnection(socket as any);
        expect(socket.join).not.toHaveBeenCalledWith('team');
        expect(socket.rooms.has('team')).toBe(false);
        expect(socket.join).toHaveBeenCalledWith('user:u-other');
      },
    );

    it('broadcast reaches only staff sockets that joined team on connection', async () => {
      jwtMock.verify.mockReturnValue({ sub: 'u-sw', role: 'social_worker' });
      const staff = makeFakeSocket('staff-socket-1', 'token');
      await gateway.handleConnection(staff as any);

      jwtMock.verify.mockReturnValue({ sub: 'u-c', role: 'claimant' });
      const claimant = makeFakeSocket('claimant-socket-1', 'token');
      await gateway.handleConnection(claimant as any);

      gateway.server = makeFakeServer([staff, claimant]) as any;
      gateway.broadcastTeamStatus({
        userId: 'u-sw',
        status: 'in_office',
        updatedAt: '2026-09-29T11:00:00.000Z',
      });

      expect(staff.emit).toHaveBeenCalledWith(
        'team.status.updated',
        expect.objectContaining({ userId: 'u-sw', status: 'in_office' }),
      );
      expect(claimant.emit).not.toHaveBeenCalledWith('team.status.updated', expect.anything());
    });
  });
});