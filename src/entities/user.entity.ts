import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RoleType {
  ADMIN = 'admin',
  OPERATOR = 'operator',
}

@Entity('users')
export class User {
  @Column({ type: 'uuid', primary: true, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  name: string;

  @Column()
  division: string;

  @Column({
    type: 'enum',
    enum: RoleType,
  })
  role!: RoleType;

  @Column()
  password: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  requirePasswordReset: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
