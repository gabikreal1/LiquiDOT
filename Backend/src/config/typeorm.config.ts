import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'liquidot',
  password: process.env.DATABASE_PASSWORD || 'liquidot123',
  database: process.env.DATABASE_NAME || 'liquidot',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production', // Auto-create schema in dev
  logging: process.env.NODE_ENV !== 'production',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: process.env.NODE_ENV === 'production', // Auto-run migrations in production
};

/**
 * DataSource instance for TypeORM CLI (migration:generate, migration:run, etc.)
 */
export default new DataSource(typeOrmConfig as DataSourceOptions);
