import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Custom console format
const consoleFormat = printf(({ level, message, context, timestamp: time, stack }) => {
  const contextStr = context ? ` \x1b[33m[${context}]\x1b[0m` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `\x1b[90m[${time}]\x1b[0m ${level}${contextStr} ${message}${stackStr}`;
});

// JSON / Flat format for persistent rolling log files
const fileFormat = printf(({ level, message, context, timestamp: time, stack }) => {
  const contextStr = context ? ` [${context}]` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `[${time}] [${level.toUpperCase()}]${contextStr} ${message}${stackStr}`;
});

const transports: winston.transport[] = [
  // 1. Terminal / Vercel Console with colors
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      consoleFormat,
    ),
  }),
];

// Rolling file transports only when running on a persistent host (VPS / local dev)
if (!isServerless) {
  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Dynamic import/require to prevent bundling issues on serverless
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('winston-daily-rotate-file');

    transports.push(
      new (winston.transports as any).DailyRotateFile({
        dirname: logDir,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
        format: fileFormat,
      }),
      new (winston.transports as any).DailyRotateFile({
        dirname: logDir,
        filename: 'error-%DATE%.log',
        level: 'error',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
        format: fileFormat,
      }),
    );
  } catch {
    // Read-only filesystem fallback - ignore file transport
  }
}

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
  ),
  transports,
};
