// auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { DateTime } from 'luxon';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) { }
  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username); // implement this
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, username: user.username };
    const expiresInSeconds = 2 * 60 * 60; // 2 hours
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });
    const expiresAt = DateTime.now().plus({ seconds: expiresInSeconds });
    return {
      access_token: token,
      expiresAt: Math.floor(expiresAt.toSeconds()),
    };
  }

  async extendToken(payload: { sub: string; username: string }) {
    const expiresInSeconds = 2 * 60 * 60; // 2 hours
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });
    const expiresAt = DateTime.now().plus({ seconds: expiresInSeconds });
    return {
      access_token: token,
      expiresAt: Math.floor(expiresAt.toSeconds()),
    };
  }

  async verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async getMyProfile(username: string) {
    const user = await this.userService.findByUsername(username); // implement this
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      requirePasswordReset: user.requirePasswordReset,
    };
  }
}
