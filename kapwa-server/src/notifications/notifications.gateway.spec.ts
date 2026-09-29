import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';

interface FakeSocket {
  id: string;
  rooms: Set<string>;
  emit: jest.Mock;
  join: jest.Mock;
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

function makeFakeSocket(id: string): FakeSocket {
  const socket: FakeSocket = {
    id,
    rooms: new Set(),
    emit: jest.fn(),
    join: jest.fn((room: string) => {
      socket.rooms.add(room);
    }),
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
});