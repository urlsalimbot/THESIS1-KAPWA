import { Reflector } from '@nestjs/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DedupController } from './dedup.controller';
import { RemarksController } from './remarks.controller';

const dedup: any = {
  create: jest.fn(), upload: jest.fn(), list: jest.fn(), detail: jest.fn(),
  rows: jest.fn(), rowMatches: jest.fn(), decide: jest.fn(), revert: jest.fn(), finalize: jest.fn(),
};
const remarks: any = { list: jest.fn(), add: jest.fn() };

describe('DedupController', () => {
  const controller = new DedupController(dedup);
  const req = { user: { id: 'u1' } } as any;

  beforeEach(() => jest.clearAllMocks());

  it('carries the admin + social_worker role metadata', () => {
    const roles = new Reflector().get('roles', DedupController);
    expect(roles).toEqual(['admin', 'social_worker']);
  });

  it('creates an operation with the caller as author', async () => {
    dedup.create.mockResolvedValue({ id: 'op1' });
    await controller.create({ source: 'Batch 1.xlsx', columnMap: {} as any }, req);
    expect(dedup.create).toHaveBeenCalledWith({ source: 'Batch 1.xlsx', columnMap: {} }, 'u1');
  });

  it('requires a file for upload', async () => {
    await expect(controller.upload('op1', undefined, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(dedup.upload).not.toHaveBeenCalled();
  });

  it('passes the decision and actor through to the service', async () => {
    await controller.decide('op1', 'm1', { keep: 'existing_record', remark: 'duplicate' }, req);
    expect(dedup.decide).toHaveBeenCalledWith('op1', 'm1', { keep: 'existing_record', remark: 'duplicate' }, 'u1');
  });

  it('404s the output while the operation is not finalized', async () => {
    dedup.detail.mockResolvedValue({ id: 'op1', outputFile: null });
    await expect(controller.output('op1', { set: jest.fn() } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RemarksController', () => {
  const controller = new RemarksController(remarks);
  beforeEach(() => jest.clearAllMocks());

  it('carries the admin + social_worker role metadata', () => {
    const roles = new Reflector().get('roles', RemarksController);
    expect(roles).toEqual(['admin', 'social_worker']);
  });

  it('lists and adds through the remarks service', async () => {
    await controller.list('ben-1', 1, 20);
    expect(remarks.list).toHaveBeenCalledWith('ben-1', 1, 20);
    await controller.add('ben-1', { remark: 'Called to reschedule.' } as any, { user: { id: 'u1' } } as any);
    expect(remarks.add).toHaveBeenCalledWith('ben-1', { remark: 'Called to reschedule.' }, 'u1');
  });
});