# SecureShare API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Error Handling](#error-handling)
5. [Encryption Guide](#encryption-guide)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Overview

SecureShare provides a RESTful API for secure file sharing with zero-knowledge encryption. All file encryption happens client-side, ensuring the server never has access to plaintext data.

### Base URL
```
http://localhost:3000/api
```

### Content Types
- Request: `application/json`
- Response: `application/json`

---

## Authentication

Most endpoints are public. The cleanup endpoint requires a secret token:

```http
Authorization: Bearer <CLEANUP_SECRET>
```

---

## Endpoints

### 1. Upload File

Creates a new encrypted file record.

**Endpoint:** `POST /api/files`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileName` | string | Yes | Original filename (max 255 chars) |
| `fileType` | string | Yes | MIME type (max 100 chars) |
| `fileSize` | number | Yes | File size in bytes (max 50MB) |
| `encryptedData` | string | Yes | Base64-encoded encrypted data |
| `iv` | string | Yes | Base64-encoded initialization vector |
| `salt` | string | No | Base64-encoded salt (optional) |
| `oneTimeDownload` | boolean | No | Enable one-time download (default: true) |
| `expiryHours` | number | No | Hours until expiry (default: 24, max: 168) |

**Request Example:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024000,
  "encryptedData": "U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y=",
  "iv": "dGVzdGl2MTIzNDU2Nzg5MA==",
  "salt": "",
  "oneTimeDownload": true,
  "expiryHours": 24
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "fileId": "clx123abc456def",
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid input",
  "details": [
    {
      "code": "too_big",
      "maximum": 52428800,
      "type": "number",
      "inclusive": true,
      "path": ["fileSize"],
      "message": "fileSize must be less than or equal to 52428800"
    }
  ]
}
```

---

### 2. Get File Info

Retrieves file metadata without triggering download counter.

**Endpoint:** `GET /api/files/:id/info`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | File ID (cuid format) |

**Response (200 OK):**
```json
{
  "success": true,
  "file": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "oneTimeDownload": true,
    "expiresAt": "2024-01-02T12:00:00.000Z"
  }
}
```

**Error Response (410 Gone):**
```json
{
  "success": false,
  "error": "Sorry, This File Has Been Downloaded"
}
```

---

### 3. Download File

Retrieves encrypted file data. This endpoint triggers the one-time download counter.

**Endpoint:** `GET /api/files/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | File ID (cuid format) |

**Response (200 OK):**
```json
{
  "success": true,
  "file": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "encryptedData": "U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y=",
    "iv": "dGVzdGl2MTIzNDU2Nzg5MA==",
    "downloadCount": 1,
    "oneTimeDownload": true,
    "expiresAt": "2024-01-02T12:00:00.000Z"
  }
}
```

---

## Rate Limiting

All API endpoints have rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/files (Upload) | 5 requests | 1 hour |
| GET /api/files/:id (Download) | 10 requests | 1 hour |
| GET /api/files/:id/info | 30 requests | 1 minute |
| General API | 100 requests | 1 minute |

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2024-01-01T12:00:00.000Z
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Too many uploads. Please try again later.",
  "retryAfter": 3600
}
```

HTTP Status: `429 Too Many Requests`

---

### 4. Cleanup Expired Files

Removes expired and deleted files from the database.

**Endpoint:** `POST /api/cleanup`

**Headers:**
```http
Authorization: Bearer secure-share-cleanup-secret
```

**Response (200 OK):**
```json
{
  "success": true,
  "deletedCount": 5,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 5. Get Cleanup Status

Returns statistics about files pending cleanup.

**Endpoint:** `GET /api/cleanup`

**Response (200 OK):**
```json
{
  "expiredFiles": 3,
  "deletedFiles": 5,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 6. Server Status

Returns server configuration and limits.

**Endpoint:** `GET /api/files`

**Response (200 OK):**
```json
{
  "status": "ok",
  "maxFileSize": 52428800,
  "maxFileSizeFormatted": "50 MB"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 404 | Not Found - File doesn't exist |
| 409 | Conflict - Race condition |
| 410 | Gone - File expired or downloaded |
| 500 | Internal Server Error |

### Error Messages

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `File not found` | 404 | File ID doesn't exist |
| `Sorry, This File Has Been Downloaded` | 410 | One-time download already used |
| `Sorry, The Time For Downloading The File Has Expired` | 410 | File has expired |
| `Missing Encryption Key` | N/A (client) | URL fragment missing |
| `Invalid input` | 400 | Validation failed |

---

## Encryption Guide

### Algorithm Details

- **Algorithm:** AES-256-GCM
- **Key Length:** 256 bits
- **IV Length:** 12 bytes (96 bits)
- **Key Generation:** Web Crypto API `crypto.subtle.generateKey()`

### JavaScript Example

```javascript
// Generate encryption key
async function generateKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt file
async function encryptFile(file, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );
  
  return {
    encryptedData: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv)
  };
}

// Decrypt file
async function decryptFile(encryptedData, iv, key) {
  const encryptedBuffer = base64ToBuffer(encryptedData);
  const ivBuffer = base64ToBuffer(iv);
  
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );
}

// Helper functions
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider adding:

- Request rate limiting per IP
- Upload size limits (implemented)
- Concurrent upload limits

---

## Examples

### Complete Upload Flow

```javascript
// 1. Generate key
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);

// 2. Encrypt file
const iv = crypto.getRandomValues(new Uint8Array(12));
const fileBuffer = await file.arrayBuffer();
const encryptedBuffer = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  fileBuffer
);

// 3. Export key for URL
const exportedKey = await crypto.subtle.exportKey('raw', key);
const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

// 4. Upload to server
const response = await fetch('/api/files', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    encryptedData: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: '',
    oneTimeDownload: true,
    expiryHours: 24
  })
});

const result = await response.json();

// 5. Create share URL
const shareUrl = `${window.location.origin}/download/${result.fileId}#${keyBase64}`;
```

### Complete Download Flow

```javascript
// 1. Extract key from URL
const keyBase64 = window.location.hash.slice(1);

// 2. Import key
const keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
const key = await crypto.subtle.importKey(
  'raw',
  keyBuffer,
  { name: 'AES-GCM', length: 256 },
  true,
  ['decrypt']
);

// 3. Fetch encrypted data
const response = await fetch(`/api/files/${fileId}`);
const result = await response.json();

// 4. Decrypt
const decryptedBuffer = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: base64ToBuffer(result.file.iv) },
  key,
  base64ToBuffer(result.file.encryptedData)
);

// 5. Download
const blob = new Blob([decryptedBuffer], { type: result.file.fileType });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = result.file.fileName;
a.click();
```

---

## WebSocket Support

Not currently implemented. For real-time features, consider adding Socket.IO.

---

## Versioning

API version: `v1` (implicit)

Breaking changes will be documented in the changelog.

---
