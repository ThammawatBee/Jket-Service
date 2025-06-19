import { join } from 'path';

import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
export const postgresDbConfig = (): PostgresConnectionOptions => ({
  type: 'postgres',
  host: 'dpg-cvr5rj6uk2gs73c9mk5g-a.singapore-postgres.render.com',
  port: 5432,
  username: 'jtket_user',
  password: '8RJAjGdU8nGZsxaBzry4clBrtDTWDW0O',
  database: 'jtket',
  schema: 'jtket',
  logging: false,
  entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../migrations/postgres/*{.ts,.js}')],
  synchronize: true,
  namingStrategy: new SnakeNamingStrategy(),
  extra: {
    options: '-c search_path=jtket',
  },
  ssl: true,
});

if (
  process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'local'
) {
  Logger.debug(postgresDbConfig());
}

export default new DataSource(postgresDbConfig());
