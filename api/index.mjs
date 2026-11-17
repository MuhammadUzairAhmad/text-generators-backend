import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from '../src/app.module.js';
import { winstonConfig } from '../src/common/logger/winston.config.js';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor.js';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

const server = express();
let cachedApp;

async function bootstrap() {
  if (cachedApp) return server;

  const loggerInstance = WinstonModule.createLogger(winstonConfig);

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: loggerInstance,
  });

  const logger = new Logger('Bootstrap');

  // Trust first proxy (Vercel Edge) for accurate client IP detection
  server.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Gzip compression
  app.use(compression());

  // Global API routing prefix
  app.setGlobalPrefix('api', {
    exclude: ['/', 'docs', 'docs/(.*)'],
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors and filters
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS
  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://textgenerators.net',
    'https://www.textgenerators.net',
  ];
  const rawOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  const envOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (origin && origin.endsWith('.vercel.app')) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TextGenerators API')
    .setDescription('Enterprise NestJS REST API for TextGenerators CMS')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization', description: 'Enter admin JWT token', in: 'header' }, 'bearer')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    customSiteTitle: 'TextGenerators API Documentation',
    customCssUrl: ['https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css'],
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js',
    ],
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list', filter: true },
  });

  // Seed admin
  try {
    const authService = app.get(AuthService);
    await authService.seedDefaultAdminIfEmpty();
  } catch (err) {
    logger.warn(`Admin seeding skipped: ${err.message}`);
  }

  await app.init();
  cachedApp = app;
  logger.log('NestJS app initialized for Vercel serverless');

  return server;
}

export default async function handler(req, res) {
  const app = await bootstrap();
  return app(req, res);
}
