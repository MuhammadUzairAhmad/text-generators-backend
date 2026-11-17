# TextGenerators Backend Architecture & Design Guide

## 1. Architectural Overview
This backend is built on **NestJS** (Node.js framework) using **TypeScript**, **Express**, **Mongoose** (MongoDB), and **Winston**.

### Key Architectural Tenets:
1. **Modular Architecture:** Each domain (Auth, Blogs, Comments, Leads, Analytics) is an encapsulated NestJS Module containing its own Controller, Service, DTOs, and Mongoose Schema.
2. **Dependency Injection (DI):** Services and repositories are injected via constructor injection. Zero global state.
3. **Strict Data Transfer Objects (DTOs):** Incoming requests are validated automatically against DTO classes decorated with `class-validator` and `class-transformer`.
4. **Living OpenAPI / Swagger Documentation:** Interactive API explorer generated automatically from TypeScript code at `/docs`.
5. **Persistent Rotating Logging:** Built-in Winston logger with console coloring and daily rotating file logs in `logs/`.

---

## 2. Request Lifecycle

```
Client HTTP Request
   │
   ▼
[ Helmet & CORS Middleware ]
   │
   ▼
[ LoggingInterceptor ] ──▶ Records Start Time, Method, Path, IP
   │
   ▼
[ JwtAuthGuard / RolesGuard ] ──▶ Validates Bearer Token & Role
   │
   ▼
[ ValidationPipe ] ──▶ Validates DTO using class-validator
   │
   ▼
[ Controller ] ──▶ Routes to proper Service method
   │
   ▼
[ Service ] ──▶ Executes Business Logic / Database Queries
   │
   ▼
[ Mongoose Model ] ──▶ MongoDB Atlas
   │
   ▼
[ AllExceptionsFilter ] ──▶ If error, logs stack trace to logs/error.log
   │
   ▼
Response sent to Client (LoggingInterceptor records execution duration in ms)
```

---

## 3. Directory Layout

```
src/
├── common/                # Shared reusable cross-cutting concerns
│   ├── decorators/        # @Public(), @Roles(), @CurrentUser()
│   ├── filters/           # AllExceptionsFilter
│   ├── interceptors/      # LoggingInterceptor
│   └── logger/            # Winston configuration & logger setup
├── config/                # Environment variables & runtime settings
├── modules/               # Domain-specific modules
│   ├── auth/              # JWT auth, user login, password update
│   ├── blogs/             # Multilingual articles, CRUD, revisions
│   │   ├── ai/            # Gemini parallel block-chunking translation engine
│   │   ├── dto/           # CreateBlogDto, UpdateBlogDto, etc.
│   │   └── schemas/       # Blog Mongoose schema
│   ├── comments/          # Public comment submission & moderation
│   ├── leads/             # Lead capture & CSV streaming export
│   ├── uploads/           # Cloudinary secure signatures
│   ├── analytics/         # View tracking & aggregated dashboard stats
│   └── health/            # /api/health check
├── app.module.ts          # Master root module
└── main.ts                # Application bootstrap & Swagger setup
```

---

## 4. Database & Models
This backend directly connects to the **same MongoDB Atlas database** as the Next.js frontend:
* **Zero data migration needed.**
* All existing collections (`blogs`, `users`, `comments`, `leads`, `niches`) remain intact.
* Compound indexes are defined via Mongoose schema decorators for ultra-fast indexed querying (`< 2ms`).
