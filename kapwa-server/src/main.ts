import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function runMigrations() {
  try {
    const { migrate } = await import('./database/migrate');
    await migrate();
  } catch (err) {
    console.error('Migration startup failed, continuing:', err.message);
  }
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.IRF_ENCRYPTION_KEY) {
      throw new Error(
        'IRF_ENCRYPTION_KEY is required in production — generate one with: openssl rand -hex 32'
      );
    }
    if (Buffer.from(process.env.IRF_ENCRYPTION_KEY, 'hex').length < 32) {
      throw new Error(
        'IRF_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
      );
    }
  }

  await runMigrations();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  const config = new DocumentBuilder()
    .setTitle('KAPWA API')
    .setDescription('MSWDO Norzagaray Social Welfare System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`KAPWA API running on port ${port}`);
}
bootstrap();
