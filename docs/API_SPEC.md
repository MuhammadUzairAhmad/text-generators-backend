# TextGenerators Backend API Specification

This document details all available REST API endpoints for the **TextGenerators Backend** built with NestJS.

Interactive Swagger documentation is available locally at:  
👉 **[http://localhost:4000/docs](http://localhost:4000/docs)**

---

## Table of Contents
1. [General Information & Headers](#general-information--headers)
2. [Authentication Endpoints (`/api/auth`)](#1-authentication-endpoints-apiauth)
3. [Blog Endpoints (`/api/blogs` & `/api/admin/blogs`)](#2-blog-endpoints-apiblogs--apiadminblogs)
4. [Niches Management (`/api/blogs/niches` & `/api/admin/niches`)](#3-niches-management)
5. [AI Translation Endpoints (`/api/admin/blogs/translate`)](#4-ai-translation-endpoints)
6. [Comments Endpoints (`/api/comments` & `/api/admin/comments`)](#5-comments-endpoints)
7. [Leads & Marketing Endpoints (`/api/leads` & `/api/admin/leads`)](#6-leads--marketing-endpoints)
8. [Uploads & Cloudinary (`/api/admin/uploads`)](#7-uploads--cloudinary)
9. [Analytics Endpoints (`/api/admin/analytics`)](#8-analytics-endpoints)
10. [Health & Monitoring (`/api/health`)](#9-health--monitoring)

---

## General Information & Headers

* **Base URL**: `http://localhost:4000/api`
* **Default Port**: `4000` (configurable via `PORT` in `.env`)
* **Standard Response Format**: `application/json; charset=utf-8`
* **Protected Routes Authentication**:
  * Either standard `Authorization: Bearer <jwt_token>` header
  * Or `admin_token` HTTP-only / same-site cookie

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/login`
Authenticates an administrator with email and password. Sets the `admin_token` cookie and returns user profile + JWT.
* **Public**: Yes
* **Request Body**:
  ```json
  {
    "email": "admin@textgenerators.net",
    "password": "yourPasswordHere"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "6ae09cf568cddf21d0d930b6",
      "name": "Super Admin",
      "email": "admin@textgenerators.net",
      "role": "super_admin",
      "avatar": { "url": "https://res.cloudinary.com/..." }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `GET /api/auth/me`
Retrieves the currently authenticated user's profile and permissions.
* **Public**: No (Requires Bearer token or `admin_token` cookie)
* **Success Response (200 OK)**:
  ```json
  {
    "id": "6ae09cf568cddf21d0d930b6",
    "name": "Super Admin",
    "email": "admin@textgenerators.net",
    "role": "super_admin",
    "lastLoginAt": "2026-11-10T05:45:52.372Z"
  }
  ```

### `PATCH /api/auth/me/change-password`
Changes current admin's password with validation against old password.
* **Public**: No
* **Request Body**:
  ```json
  {
    "currentPassword": "oldPassword",
    "newPassword": "newStrongPassword123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password updated successfully"
  }
  ```

### `POST /api/auth/logout`
Clears the `admin_token` cookie.
* **Public**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## 2. Blog Endpoints (`/api/blogs` & `/api/admin/blogs`)

### `GET /api/blogs`
Public query for published articles with pagination, full-text search, niche filter, and language filter.
* **Public**: Yes
* **Query Parameters**:
  * `page` (default: 1)
  * `limit` (default: 10)
  * `search` (optional keyword)
  * `nicheId` (optional ObjectId)
  * `tag` (optional tag string)
  * `lang` (optional: en, nl, es, fr, ru, zh, ar)
  * `sortBy` (default: `publishDate`)
  * `sortOrder` (asc | desc, default: `desc`)
* **Success Response (200 OK)**:
  ```json
  {
    "items": [ ... ],
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasMore": false
  }
  ```

### `GET /api/blogs/:slug`
Fetches a single published article by URL slug. If `?lang=<locale>` is provided and a translation exists, automatically overlays translated title, slug, excerpt, content, meta tags, and localized FAQs.
* **Public**: Yes
* **Query Parameters**: `lang` (optional locale code)
* **Success Response (200 OK)**: Returns full blog document.

### `POST /api/blogs/:slug/views`
Atomically records a page view and increments the daily analytics bucket.
* **Public**: Yes
* **Success Response (200 OK)**:
  ```json
  {
    "views": 1602
  }
  ```

### `GET /api/admin/blogs`
Admin listing across all statuses (`draft`, `published`, `unpublished`).
* **Public**: No (Admin only)
* **Query Parameters**: Same as `/api/blogs`, plus `status` filter (`draft`, `published`, `unpublished`).

### `POST /api/admin/blogs`
Creates a new blog post.
* **Public**: No (Admin only)
* **Request Body**: `CreateBlogDto`
* **Features**: Auto-generates unique transliterated slug, auto-fills `publishDate` when published without date.

### `GET /api/admin/blogs/:id`
Fetches blog post by MongoDB ID for the editor.
* **Public**: No (Admin only)

### `PUT /api/admin/blogs/:id`
Updates an existing blog post.
* **Public**: No (Admin only)
* **Request Body**: `UpdateBlogDto`

### `DELETE /api/admin/blogs/:id`
Deletes an article.
* **Public**: No (Admin only)

### `PATCH /api/admin/blogs/:id/status`
Fast status toggle endpoint.
* **Public**: No (Admin only)
* **Request Body**:
  ```json
  {
    "status": "published",
    "publishDate": "2026-11-10T12:00:00.000Z"
  }
  ```

### `POST /api/admin/blogs/:id/translations`
Saves or merges localized translations into the article's `translations` map.
* **Public**: No (Admin only)
* **Request Body**:
  ```json
  {
    "translations": {
      "nl": { "title": "...", "content": { ... } }
    }
  }
  ```

---

## 3. Niches Management

* `GET /api/blogs/niches` (Public) - Returns all active niches
* `GET /api/admin/niches` (Admin) - Lists niches for CMS
* `POST /api/admin/niches` (Admin) - Creates a new niche
* `PUT /api/admin/niches/:id` (Admin) - Updates a niche
* `DELETE /api/admin/niches/:id` (Admin) - Deletes a niche

---

## 4. AI Translation Endpoints

### `POST /api/admin/blogs/translate`
Uses Google Gemini Flash to translate article metadata, content, and FAQs into a target language with parallel block-chunking.
* **Public**: No (Admin only)
* **Request Body**:
  ```json
  {
    "title": "Sample Article",
    "slug": "sample-article",
    "excerpt": "Brief summary",
    "content": { "type": "doc", "content": [ ... ] },
    "faqs": [ { "question": "Q?", "answer": "A." } ],
    "toLang": "nl",
    "scopes": ["title", "content", "faqs", "seo"]
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "translation": {
      "title": "...",
      "slug": "...",
      "excerpt": "...",
      "content": { ... },
      "faqs": [ ... ]
    }
  }
  ```

### `POST /api/admin/blogs/translate/batch`
Batch translates to multiple target languages sequentially with rate-limit protection.
* **Public**: No (Admin only)
* **Request Body**: Same as single translate, but with `toLangs: ["nl", "es", "fr", "ru", "zh", "ar"]`.

---

## 5. Comments Endpoints

* `POST /api/comments` (Public) - Submits a comment (name, email, phone, comment, blogId, parentId). Marked `pending`.
* `GET /api/comments?blogId=<id>` (Public) - Returns approved threaded comments for the public article.
* `GET /api/admin/comments` (Admin) - Moderation list with status and search filters.
* `PATCH /api/admin/comments/:id/status` (Admin) - Changes status to `approved`, `rejected`, or `spam`.
* `POST /api/admin/comments/:id/reply` (Admin) - Official admin reply (auto-approved).
* `DELETE /api/admin/comments/:id` (Admin) - Deletes a comment and its thread.

---

## 6. Leads & Marketing Endpoints

* `POST /api/leads` (Public) - Captures a newsletter subscription or contact inquiry.
* `GET /api/admin/leads` (Admin) - Lists leads with source and search filters.
* `GET /api/admin/leads/export` (Admin) - Streams downloadable CSV file with headers.
* `DELETE /api/admin/leads/:id` (Admin) - Deletes a lead record.

---

## 7. Uploads & Cloudinary

* `GET /api/admin/uploads/signature` (Admin) - Generates secure client-side signed params for direct Cloudinary uploads.
* `POST /api/admin/uploads/signature` (Admin) - POST alias for signature generation.
* `DELETE /api/admin/uploads/:publicId` (Admin) - Deletes image asset from Cloudinary storage.

---

## 8. Analytics Endpoints

* `GET /api/admin/analytics` (Admin) - Aggregates total metrics (blogs, views, comments, leads), 30-day views by date, views by niche, and unified recent activity stream.

---

## 9. Health & Monitoring

* `GET /api/health` (Public) - Checks database connectivity, uptime, and memory usage. Returns `200 OK` or `503 Service Unavailable`.
