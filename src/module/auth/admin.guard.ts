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
    console.log('xxxuserxxx', user);
    const userData = await this.userService.findByUsername(user.username)
    console.log(' userData', userData);
    // const authHeader = request.headers['authorization'];

    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //   throw new UnauthorizedException('Missing token');
    // }

    // const token = authHeader.split(' ')[1];
    // const decoded = await this.authService.verifyToken(token);
    // request['user'] = decoded;
    return true;
  }
}
