// jwt-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from '../user/user.service';
import { UserPayload } from 'src/types/user-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as unknown as UserPayload;
    const userData = await this.userService.findByUsername(user.username)
    if (userData.role !== 'admin') {
      throw new UnauthorizedException('User Role is not admin');
    }
    return true;
  }
}
