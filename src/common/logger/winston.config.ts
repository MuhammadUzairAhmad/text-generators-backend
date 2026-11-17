import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch {
  // directory might exist or be read-only in sandbox
}

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

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
  ),
  transports: [
    // 1. Terminal Console with colors
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat,
      ),
    }),

    // 2. Rolling Daily File for All Info/HTTP/Success Logs
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: fileFormat,
    }),

    // 3. Dedicated Rolling File for Errors and Rejections
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: fileFormat,
    }),
  ],
};
