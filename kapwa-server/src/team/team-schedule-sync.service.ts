import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { Case } from '../cases/case.entity';
import { CaseEvent } from '../case-events/case-event.entity';
import { shouldSyncCaseEvent } from '../case-events/case-events.constants';

// System-managed mirror of case_events into team_schedule_blocks. This is the
// ONLY writer of `source='case_event'` blocks: the public team-schedule API
// rejects synced blocks (see TeamScheduleService), so the owner-only rule
// holds for every human caller while this internal path stays the exempt one.
@Injectable()
export class TeamScheduleSyncService {
  constructor(
    @InjectRepository(TeamScheduleBlock) private blocks: Repository<TeamScheduleBlock>,
    @InjectRepository(Case) private cases: Repository<Case>,
    @InjectRepository(CaseEvent) private events: Repository<CaseEvent>,
  ) {}

  private async blockForEvent(eventId: string): Promise<TeamScheduleBlock | null> {
    return this.blocks.findOne({ where: { source: 'case_event', sourceRef: eventId } });
  }

  /**
   * The calendar note's middle term. UI-created events carry no title (the
   * forms collect date/time/venue/notes), so the raw `event_type` must never
   * reach the calendar — a human label stands in.
   */
  private static eventLabel(eventType: string): string {
    return eventType === 'court_hearing' ? 'Court hearing' : 'Home visit';
  }

  async upsertForEvent(
    event: { id: string; eventType: string; eventDate: string; startTime?: string | null; endTime?: string | null; title?: string | null; venue?: string | null; status: string },
    workerId: string | null | undefined,
    controlNo: string,
  ): Promise<void> {
    if (!workerId) return;
    const existing = await this.blockForEvent(event.id);
    const note = `Case ${controlNo} — ${event.title ?? TeamScheduleSyncService.eventLabel(event.eventType)}${event.venue ? ` (${event.venue})` : ''}`;
    const patch = {
      userId: workerId,
      blockDate: event.eventDate,
      blockType: event.eventType,
      startTime: event.startTime ?? null,
      endTime: event.endTime ?? null,
      note,
      source: 'case_event' as const,
      sourceRef: event.id,
    };
    if (existing) {
      await this.blocks.save(this.blocks.merge(existing, patch as Partial<TeamScheduleBlock>));
    } else {
      await this.blocks.save(this.blocks.create(patch as Partial<TeamScheduleBlock>));
    }
  }

  async removeForEvent(eventId: string): Promise<void> {
    await this.blocks.delete({ source: 'case_event', sourceRef: eventId });
  }

  async moveForCase(caseId: string, newWorkerId: string | null | undefined): Promise<void> {
    const events = await this.events.find({ where: { caseId } });
    if (!newWorkerId) {
      for (const e of events) await this.removeForEvent(e.id);
      return;
    }
    const c = await this.cases.findOne({ where: { id: caseId } });
    const controlNo = c?.controlNo ?? '';
    for (const e of events) {
      await this.removeForEvent(e.id);
      // Only events that belong on a calendar come back — a reassignment must
      // not resurrect a block for a done/cancelled/not-attended event.
      if (shouldSyncCaseEvent(e)) {
        await this.upsertForEvent(e, newWorkerId, controlNo);
      }
    }
  }
}