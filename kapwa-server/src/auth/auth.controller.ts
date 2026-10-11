import { Controller, Post, Body, HttpCode, HttpStatus, Get, Res, UseGuards, Request, UnauthorizedException, BadRequestException, UseInterceptors } from '@nestjs/common';
import { ClassSerializerInterceptor, SerializeOptions } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, REFRESH_COOKIE, REFRESH_COOKIE_MAX_AGE_MS } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { UserCreateSchema, LoginSchema, MfaEnableSchema, MfaDisableSchema, MfaVerifySchema, MfaResendSchema, OtpVerifySchema, UserCreateInput, ChangePasswordSchema, ChangeEmailSchema, ChangePasswordInput, ChangeEmailInput, VerifyEmailSchema, ResendVerificationSchema, ForgotPasswordSchema, ResetPasswordSchema, ConfirmEmailChangeSchema, UpdatePhoneSchema, UpdatePhoneInput, PersonLinkRequestSchema, PersonLinkVerifySchema } from './dto/auth.zod';
import { AuthenticatedRequest } from './types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * The refresh token never goes back in the body: it is set as an httpOnly,
   * SameSite=Strict cookie, so a script injected into the page cannot read it.
   * SameSite=Strict is also what protects this route from CSRF (no token
   * header needed, and the guard already exempts /auth/refresh).
   */
  private withRefreshCookie(res: Response, result: Record<string, unknown>): Record<string, unknown> {
    const { refreshToken, ...rest } = result as { refreshToken?: string };
    if (refreshToken) {
      res.cookie(REFRESH_COOKIE, refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });
    }
    return rest;
  }

  @Post('register')
  async register(@Body(new ZodPipe(UserCreateSchema)) body: UserCreateInput) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(LoginSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.withRefreshCookie(res, await this.authService.login(user) as Record<string, unknown>);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @SerializeOptions({ strategy: 'exposeAll' })
  async getMe(@Request() req: AuthenticatedRequest) {
    return { user: req.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Request() req: AuthenticatedRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    // The cookie is the only path: the browser app never sends a refresh token
    // in a body, and JS cannot read the cookie. Non-browser callers can POST the
    // token the way tests used to via the service directly.
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');
    return this.withRefreshCookie(res, await this.authService.refresh(token) as Record<string, unknown>);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return this.authService.logout(req.user.id);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Request() req: AuthenticatedRequest) {
    return this.authService.setupMfa(req.user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  async enableMfa(@Request() req: AuthenticatedRequest, @Body(new ZodPipe(MfaEnableSchema)) body: { code: string }) {
    return this.authService.enableMfa(req.user.id, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  async disableMfa(@Request() req: AuthenticatedRequest, @Body(new ZodPipe(MfaDisableSchema)) body: { password: string }) {
    return this.authService.disableMfa(req.user.id, body.password);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body(new ZodPipe(MfaVerifySchema)) body: { tempToken: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(res, await this.authService.verifyMfaChallenge(body.tempToken, body.code) as Record<string, unknown>);
  }

  @Post('mfa/email/setup')
  @UseGuards(JwtAuthGuard)
  async setupEmailMfa(@Request() req: AuthenticatedRequest) {
    return this.authService.setupEmailMfa(req.user.id);
  }

  @Post('mfa/email/enable')
  @UseGuards(JwtAuthGuard)
  async enableEmailMfa(@Request() req: AuthenticatedRequest, @Body(new ZodPipe(MfaEnableSchema)) body: { code: string }) {
    return this.authService.enableEmailMfa(req.user.id, body.code);
  }

  @Post('mfa/email/resend')
  @HttpCode(HttpStatus.OK)
  async resendEmailMfa(@Body(new ZodPipe(MfaResendSchema)) body: { tempToken: string }) {
    return this.authService.resendEmailMfa(body.tempToken);
  }

  @Post('mfa/email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailMfa(
    @Body(new ZodPipe(MfaVerifySchema)) body: { tempToken: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(res, await this.authService.verifyEmailMfa(body.tempToken, body.code) as Record<string, unknown>);
  }

  @Post('login/otp-verify')
  @HttpCode(HttpStatus.OK)
  async verifyLoginOtp(
    @Body(new ZodPipe(OtpVerifySchema)) body: { tempToken: string; otpCode: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(res, await this.authService.verifySmsOtp(body.tempToken, body.otpCode) as Record<string, unknown>);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(ChangePasswordSchema)) body: ChangePasswordInput
  ) {
    return this.authService.changePassword(req.user.id, body);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodPipe(VerifyEmailSchema)) body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body(new ZodPipe(ResendVerificationSchema)) body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodPipe(ForgotPasswordSchema)) body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodPipe(ResetPasswordSchema)) body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  async changeEmail(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(ChangeEmailSchema)) body: ChangeEmailInput
  ) {
    return this.authService.changeEmail(req.user.id, body);
  }

  @Post('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(@Body(new ZodPipe(ConfirmEmailChangeSchema)) body: { token: string }) {
    return this.authService.confirmEmailChange(body.token);
  }

  @Post('update-phone')
  @UseGuards(JwtAuthGuard)
  async updatePhone(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(UpdatePhoneSchema)) body: UpdatePhoneInput
  ) {
    if (!body.phone) throw new BadRequestException('Phone number is required');
    return this.authService.updatePhone(req.user.id, body.phone);
  }

  // Claimant self-service account linking. A person who already exists in the
  // beneficiary records but has never signed in claims an account by proving
  // ownership of a registered phone number and date of birth, then confirming a
  // one-time code. On success this sets user.personId and points the
  // beneficiaries row at the new user, which is what makes a claimant a
  // claimant — without it every beneficiary would need staff to create the
  // account for them.
  //
  // Deliberately kept despite having no client caller today: a static sweep
  // reports these as unreferenced, and they are load-bearing for account
  // creation, not vestigial. The client screen that calls them is still to be
  // built; retiring these would discard the whole flow.
  @Post('request-person-link')
  @HttpCode(HttpStatus.OK)
  async requestPersonLink(@Body(new ZodPipe(PersonLinkRequestSchema)) body: { phone: string; dob: string; email: string }) {
    return this.authService.requestPersonLink(body.phone, body.dob, body.email);
  }

  @Post('verify-person-link')
  @HttpCode(HttpStatus.OK)
  async verifyPersonLink(@Body(new ZodPipe(PersonLinkVerifySchema)) body: { email: string; code: string }) {
    return this.authService.verifyPersonLink(body.email, body.code);
  }
}
