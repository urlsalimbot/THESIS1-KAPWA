import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { UserCreateSchema, LoginSchema, RefreshTokenSchema, MfaSetupSchema, MfaEnableSchema, MfaDisableSchema, MfaVerifySchema, OtpVerifySchema, UserCreateInput } from './dto/auth.zod';
import { AuthenticatedRequest } from './types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body(new ZodPipe(UserCreateSchema)) body: UserCreateInput) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodPipe(LoginSchema)) body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: AuthenticatedRequest) {
    const { password, mfaSecret, ...safeUser } = req.user; return { user: safeUser };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodPipe(RefreshTokenSchema)) body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
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
  async verifyMfa(@Body(new ZodPipe(MfaVerifySchema)) body: { tempToken: string; code: string }) {
    return this.authService.verifyMfaChallenge(body.tempToken, body.code);
  }

  @Post('login/otp-verify')
  @HttpCode(HttpStatus.OK)
  async verifyLoginOtp(@Body(new ZodPipe(OtpVerifySchema)) body: { tempToken: string; otpCode: string }) {
    return this.authService.verifySmsOtp(body.tempToken, body.otpCode);
  }
}
