import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  namingStrategy: new SnakeNamingStrategy(),
  logging: ['error', 'warn'],
  extra: {
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});
