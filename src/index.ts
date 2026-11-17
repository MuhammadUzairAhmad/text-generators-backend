import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { winstonConfig } from './common/logger/winston.config';
import { configureApp } from './main';
import { AuthService } from './modules/auth/auth.service';

let cachedServer: Express | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const loggerInstance = WinstonModule.createLogger(winstonConfig);

  const app = await NestFactory.create(AppModule, adapter, {
    logger: loggerInstance,
  });

  configureApp(app);

  try {
    const authService = app.get(AuthService);
    await authService.seedDefaultAdminIfEmpty();
  } catch {
    // Ignore seed errors on serverless cold starts
  }

  await app.init();
  cachedServer = expressApp;
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  return server(req, res);
}
