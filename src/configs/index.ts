import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { postgresDbConfig } from './postgres.database.config';

interface IConfig {
  postgres: PostgresConnectionOptions;
}

export default (): Partial<IConfig> => ({
  postgres: postgresDbConfig(),
});
