// user.controller.ts
import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUser, ListUsers } from 'src/schema/zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

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
}
