import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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