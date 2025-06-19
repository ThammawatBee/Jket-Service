import { join } from 'path';

import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
export const postgresDbConfig = (): PostgresConnectionOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA,
  logging: false,
  entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../migrations/postgres/*{.ts,.js}')],
  synchronize: true,
  namingStrategy: new SnakeNamingStrategy(),
  // extra: {
  //   options: '-c search_path=jtket',
  // },
});

if (
  process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'local'
) {
  Logger.debug(postgresDbConfig());
}

export default new DataSource(postgresDbConfig());
