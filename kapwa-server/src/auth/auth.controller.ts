import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { UserCreateSchema, LoginSchema, RefreshTokenSchema } from './dto/auth.zod';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body(new ZodPipe(UserCreateSchema)) body: any) {
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
  async getMe(@Request() req: any) {
    const { password, ...safeUser } = req.user; return { user: safeUser };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodPipe(RefreshTokenSchema)) body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }
}