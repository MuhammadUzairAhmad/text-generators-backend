import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { winstonConfig } from './common/logger/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AuthService } from './modules/auth/auth.service';

async function bootstrap() {
  const loggerInstance = WinstonModule.createLogger(winstonConfig);

  const app = await NestFactory.create(AppModule, {
    logger: loggerInstance,
  });

  const logger = new Logger('Bootstrap');

  // Trust first proxy (Nginx / Vercel Edge) for accurate client IP detection
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // Security headers (disable strict CSP so Swagger UI loads cleanly)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Gzip compression for high-performance payload delivery
  app.use(compression());

  // Global API routing prefix with exclusion for root and Swagger docs
  app.setGlobalPrefix('api', {
    exclude: ['/', 'docs', 'docs/(.*)'],
  });

  // Request validation pipe with automatic transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global HTTP request/response latency logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global Exception filter with structured JSON and rolling error logs
  app.useGlobalFilters(new AllExceptionsFilter());

  // Dynamic CORS configuration for local dev, production domain, and Vercel QA previews
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

  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, mobile apps, or same-origin requests with no origin header
      if (!origin) return callback(null, true);

      // Check allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Automatically allow Vercel QA preview deployments (*.vercel.app)
      if (origin && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'Accept',
    ],
  });

  // Interactive Swagger / OpenAPI Specification
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TextGenerators API')
    .setDescription(
      'Enterprise NestJS REST API for TextGenerators CMS, Multilingual Gemini Translation Engine & Marketing Services',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter admin JWT token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Root', 'API root status and health checks')
    .addTag('Authentication', 'Admin login, session check, and credentials')
    .addTag('Blogs', 'Public article delivery and CMS administration')
    .addTag('Comments', 'Public commenting and moderation')
    .addTag('Leads', 'Lead capture and export')
    .addTag('Uploads', 'Cloudinary asset signatures and deletion')
    .addTag('Analytics', 'Admin dashboard statistics and metrics')
    .addTag('Health', 'Server and database readiness probes')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // Serve Swagger UI using CDN assets to avoid missing static files in Vercel serverless
  SwaggerModule.setup('docs', app, swaggerDocument, {
    customSiteTitle: 'TextGenerators API Documentation',
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css',
    ],
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js',
    ],
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });

  // Seed default super-admin if database has no users
  try {
    const authService = app.get(AuthService);
    await authService.seedDefaultAdminIfEmpty();
  } catch (err: unknown) {
    logger.warn(`Admin seeding skipped: ${(err as Error).message}`);
  }

  // Vercel injects process.env.PORT automatically; defaults to 4000 locally
  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 TextGenerators API running on: http://localhost:${port}/api`);
  logger.log(`📚 Interactive Swagger Docs on: http://localhost:${port}/docs`);
  logger.log(`❤️  Health Probe available at:   http://localhost:${port}/api/health`);
  logger.log(`📂 Persistent logs rotating to:  logs/app-%DATE%.log`);
  logger.log(`=======================================================`);
}

void bootstrap();
