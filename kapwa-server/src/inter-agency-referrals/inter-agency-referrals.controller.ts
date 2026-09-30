import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClassSerializerInterceptor, SerializeOptions } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import {
  IssueEndorsementLetterInput,
  IssueEndorsementLetterSchema,
} from './dto/inter-agency-referrals.zod';
import { AuthenticatedRequest } from '../auth/types';

/**
 * The endorsement letter is the whole public surface of this module.
 *
 * The letter is not a standalone artefact: `issueEndorsementLetter` writes the
 * referral and then renders the PDF from it, so the referral record is what the
 * letter is made of and the record has to outlive this change. `byCase` stays
 * because it is the only way a client learns the referral's id, which the
 * re-download of an already-issued letter needs — the issue response is a PDF,
 * so the id is never handed back in the body.
 *
 * The lifecycle around it (inbox, per-person views, get, create, receive,
 * action, close, decline, promote-to-case) is retired. A referral issued from a
 * case is now read by nothing but the letter.
 */
@ApiTags('Inter-Agency Referrals')
@Controller('inter-agency-referrals')
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InterAgencyReferralsController {
  constructor(private readonly svc: InterAgencyReferralsService) {}

  @Post('case/:caseId/endorsement-letter')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Issue an endorsement letter — records the referral and returns the PDF' })
  async issueEndorsementLetter(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body(new ZodPipe(IssueEndorsementLetterSchema)) body: IssueEndorsementLetterInput,
    @Request() req: AuthenticatedRequest,
    @Res() res: any,
  ) {
    const { referral, pdf } = await this.svc.issueEndorsementLetter(caseId, body, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ENDORSEMENT-${referral.id.slice(0, 8).toUpperCase()}.pdf"`,
    });
    res.send(pdf);
  }

  @Get(':id/endorsement-letter')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Download an already-issued endorsement letter' })
  async endorsementLetter(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: any,
  ) {
    const pdf = await this.svc.endorsementLetterPdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ENDORSEMENT-${id.slice(0, 8).toUpperCase()}.pdf"`,
    });
    res.send(pdf);
  }

  @Get('case/:caseId')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List referrals for a case — the source of the id used to re-download a letter' })
  async byCase(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.findForCase(caseId, req.user);
  }
}
