import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReminderSetting } from './reminder-setting.entity';
import { ReminderSettingDraft, ReminderSettingsBulkSchema } from './dto/reminder-settings.zod';

/**
 * Lead-time configuration. System rows (admin) are the defaults every worker
 * starts from; worker rows override only their own reminders. An empty
 * offsets array is an explicit "no reminders" (worker) or a system default of
 * none — never a crash.
 */
@Injectable()
export class ReminderSettingsService {
  constructor(
    @InjectRepository(ReminderSetting) private readonly repo: Repository<ReminderSetting>,
  ) {}

  validateOffsets(offsets: number[]): void {
    for (let i = 0; i < offsets.length; i++) {
      if (!Number.isInteger(offsets[i]) || offsets[i] <= 0) {
        throw new BadRequestException('Reminder offsets must be positive whole minutes.');
      }
      if (i > 0 && offsets[i - 1] <= offsets[i]) {
        throw new BadRequestException('Reminder offsets must be strictly descending (largest first).');
      }
    }
  }

  private validateAll(input: ReminderSettingDraft[]): ReminderSettingDraft[] {
    const parsed = ReminderSettingsBulkSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid reminder settings payload.');
    }
    for (const draft of parsed.data) this.validateOffsets(draft.offsets);
    return parsed.data;
  }

  /**
   * Find-then-save rather than `upsert`: the uniqueness lives in *partial*
   * unique indexes (`WHERE scope='system'` / `WHERE scope='worker'`), which
   * TypeORM's `conflictPaths` cannot target. Both scopes are keyed by
   * (scope, user_id, event_type) in practice.
   */
  private async put(
    scope: 'system' | 'worker',
    userId: string | null,
    draft: ReminderSettingDraft,
    actorId: string,
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { scope, userId: userId as any, eventType: draft.eventType } });
    if (existing) {
      existing.offsets = draft.offsets;
      existing.updatedBy = actorId;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(this.repo.create({
      scope,
      userId,
      eventType: draft.eventType,
      offsets: draft.offsets,
      updatedBy: actorId,
    }));
  }

  async systemDefaults(): Promise<ReminderSetting[]> {
    return this.repo.find({ where: { scope: 'system' }, order: { eventType: 'ASC' } });
  }

  async saveSystemDefaults(input: ReminderSettingDraft[], actorId: string): Promise<ReminderSetting[]> {
    const drafts = this.validateAll(input);
    for (const draft of drafts) await this.put('system', null, draft, actorId);
    return this.systemDefaults();
  }

  async workerSettings(userId: string): Promise<ReminderSetting[]> {
    return this.repo.find({ where: { scope: 'worker', userId }, order: { eventType: 'ASC' } });
  }

  async saveWorkerSettings(userId: string, input: ReminderSettingDraft[], actorId: string): Promise<ReminderSetting[]> {
    const drafts = this.validateAll(input);
    for (const draft of drafts) await this.put('worker', userId, draft, actorId);
    return this.workerSettings(userId);
  }

  /**
   * The offsets in force for one worker + event type: their own override when
   * present (including an explicit empty list), else the system default, else
   * none. The dispatcher and the settings API share this one rule.
   */
  async resolveOffsets(eventType: string, workerId: string): Promise<number[]> {
    const worker = await this.repo.findOne({ where: { scope: 'worker', userId: workerId, eventType } });
    if (worker) return Array.isArray(worker.offsets) ? worker.offsets : [];
    const system = await this.repo.findOne({ where: { scope: 'system', eventType } });
    return system && Array.isArray(system.offsets) ? system.offsets : [];
  }
}