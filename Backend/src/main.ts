import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('LiquiDOT API')
    .setDescription('API documentation for LiquiDOT Backend')
    .setVersion('1.0')
    .addTag('investment-decision')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 LiquiDOT Backend running on: http://localhost:${port}/api`);
  logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);
  logger.log(`📊 Health check: http://localhost:${port}/api/health`);
  logger.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
