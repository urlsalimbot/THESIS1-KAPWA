import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { ContactMessagesService } from './contact-messages.service';
import { CreateContactMessageSchema, CreateContactMessageInput } from './dto/contact-message.zod';

// Public submission endpoint for the website contact form. Guards nothing —
// visitors must be able to reach the MSWDO without an account. Messages are
// stored in-app and surfaced to staff via the notifications system.
@ApiTags('Contact Messages (Public)')
@Controller('contact-messages')
export class ContactMessagesPublicController {
  constructor(private readonly svc: ContactMessagesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit a contact message (public)' })
  async submit(@Body(new ZodPipe(CreateContactMessageSchema)) dto: CreateContactMessageInput) {
    const saved = await this.svc.create(dto);
    return { id: saved.id, createdAt: saved.createdAt };
  }
}