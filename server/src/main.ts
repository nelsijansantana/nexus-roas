import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
// Run: npm install compression @types/compression
// module: nodenext requires CJS interop via import= for non-ESM packages
import compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // gzip compression — reduces outgoing bandwidth (JSON API responses, scripts)
  // and slightly reduces CPU spent serializing large payloads over the wire.
  app.use(compression());

  // Allow the pixel.js to be loaded from any domain and accept cookies/credentials
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validate incoming DTOs
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      skipMissingProperties: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Nexus ROAS backend running on http://localhost:${port}`);
  console.log(`📡 Pixel script: http://localhost:${port}/tracking/v1/pixel.js`);
}

bootstrap();
