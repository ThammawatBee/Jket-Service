// user.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateUser,
  ListUsers,
  ResetInitialPassword,
  ResetPassword,
} from 'src/schema/zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPayload } from 'src/types/user-payload.interface';
import { User } from 'src/decorator/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() dto: any) {
    return this.userService.createUser(dto);
  }

  @Post()
  async createUser(@Body() payload: CreateUser) {
    return this.userService.createUser(payload);
  }

  @Get()
  async listUsers(@Query() query: ListUsers) {
    const result = await this.userService.listUsers(query);
    return { users: result.users, count: result.count };
  }

  @Patch('/reset-password')
  async resetPassword(
    @User() user: UserPayload,
    @Body() payload: ResetPassword,
  ) {
    const data = await this.userService.resetPassword(
      user.sub,
      payload.password,
    );
    return data;
  }

  @Patch('/reset-initial-password')
  async resetInitialPassword(@Body() payload: ResetInitialPassword) {
    const data = await this.userService.resetInitialPassword(payload.userId);
    return data;
  }
}
