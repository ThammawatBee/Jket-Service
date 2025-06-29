// user.service.ts
import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RoleType, User } from '../../entities/user.entity';
import { CreateUser, ListUsers } from 'src/schema/zod';

const JWT_INIT_PASSWORD = process.env.JWT_INIT_PASSWORD || 'JtektP@ssw0rd';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async createUser(payload: CreateUser) {
    const existing = await this.userRepo.findOne({
      where: { username: payload.username },
    });
    if (existing) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          errorKey: 'USERNAME_IS_ALREADY_EXIST',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const hashedPassword = await bcrypt.hash(JWT_INIT_PASSWORD, 10);
      const user = this.userRepo.create({
        username: payload.username,
        password: hashedPassword,
        name: payload.name,
        division: payload.division,
        role: payload.role as RoleType,
      });

      return this.userRepo.save(user);
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          errorKey: 'CREATE_USER_ERROR',
          error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findByUsername(username: string) {
    return this.userRepo.findOne({ where: { username } });
  }

  async resetPassword(userId: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await this.userRepo
      .createQueryBuilder('user')
      .update()
      .set({ password: hashedPassword, requirePasswordReset: false })
      .where('id = :id', { id: userId })
      .execute();
    return result;
  }

  async resetInitialPassword(userId: string) {
    const hashedPassword = await bcrypt.hash(JWT_INIT_PASSWORD, 10);
    const result = await this.userRepo
      .createQueryBuilder('user')
      .update()
      .set({ password: hashedPassword, requirePasswordReset: true })
      .where('id = :id', { id: userId })
      .execute();
    return result;
  }

  async listUsers(options: ListUsers) {
    const { username, name, offset, limit, division } = options;
    const query = this.userRepo.createQueryBuilder('user');
    if (username) {
      query.andWhere(`user.username ilike '%${username}%'`);
    }
    if (name) {
      query.andWhere(`user.name ilike '%${name}%'`);
    }
    if (division) {
      query.andWhere(`user.division ilike '%${division}%'`);
    }
    const count = await query.getCount();
    query.orderBy('user.createdAt', 'DESC');
    query.select([
      'user.id',
      'user.username',
      'user.name',
      'user.division',
      'user.role',
    ]);
    query.limit(+limit || 20);
    query.offset(+offset || 0);
    const users = await query.getMany();
    return { users, count };
  }
}
