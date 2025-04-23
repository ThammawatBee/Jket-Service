// auth.controller.ts
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from 'src/decorator/user.decorator';
import { UserPayload } from 'src/types/user-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const user = await this.authService.validateUser(
      body.username,
      body.password,
    );
    return this.authService.login(user); // returns JWT
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@User() user: UserPayload) {
    const data = await this.authService.getMyProfile(user.username);
    return { ...data };
  }
}
