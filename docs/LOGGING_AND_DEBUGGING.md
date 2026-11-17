# Logging & Debugging Guide

## 1. Overview
The backend uses **Winston** with `winston-daily-rotate-file` and `nest-winston` to provide complete observability into all API operations, background tasks, and errors.

---

## 2. Where Are Logs Stored?

All file logs are saved inside the `logs/` directory at the project root:

```
logs/
├── app-2026-11-10.log       # Contains all info, HTTP requests, and successful operations
└── error-2026-11-10.log     # Contains only errors, failed requests, and stack traces
```

### Log File Rotation Rules:
* **`app-%DATE%.log`**: Rolls daily, maximum file size 20MB, kept for 14 days, auto-compressed (`.gz`).
* **`error-%DATE%.log`**: Rolls daily, maximum file size 20MB, kept for 30 days.

---

## 3. Real-Time Terminal Logs

When running `npm run start:dev` or `pm2 logs`, logs print directly in color:

```
[2026-11-10 10:15:30] [HTTP] GET /api/blogs?page=1&limit=10 200 - 18ms - IP: 127.0.0.1 - Agent: Chrome
[2026-11-10 10:15:45] [INFO] [AiService] Sliced 7,050-word document into 5 chunks across heading boundaries
[2026-11-10 10:15:52] [INFO] [AiService] Parallel translation completed in 6,840ms
[2026-11-10 10:16:02] [ERROR] [ExceptionFilter] [POST] /api/auth/login - Status: 401 - Invalid email or password
```

---

## 4. How to Inspect Logs Anytime

### View the latest live logs in terminal:
```bash
# Follow general application logs
tail -f logs/app-$(date +%Y-%m-%d).log

# Follow error logs only
tail -f logs/error-$(date +%Y-%m-%d).log
```

### Search logs for specific errors:
```bash
# Search for translation errors
grep -i "translate" logs/error-*.log

# Search for 500 status codes
grep "Status: 500" logs/error-*.log
```

---

## 5. Adding Logs to Your Own Code

Inject the standard NestJS `Logger` into any service or controller:

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  doSomething() {
    this.logger.log('Starting operation...');
    try {
      // success logic
      this.logger.debug('Operation succeeded with ID: 123');
    } catch (error) {
      this.logger.error('Failed to execute operation', error.stack);
      throw error;
    }
  }
}
```
