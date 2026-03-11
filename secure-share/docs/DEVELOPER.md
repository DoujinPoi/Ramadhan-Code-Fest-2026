# Developer Guide

## Table of Contents

1. [Development Setup](#development-setup)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Security Considerations](#security-considerations)
5. [Contributing Guidelines](#contributing-guidelines)
6. [Testing](#testing)
7. [Deployment](#deployment)

---

## Development Setup

### Prerequisites

- **Bun** (recommended) or Node.js 18+
- **Git**
- **SQLite** (included with Prisma)

### Installation Steps

```bash
# 1. Clone the repository
git clone 
cd secureshare

# 2. Install dependencies
bun install

# 3. Set up environment variables
cp .env.example .env

# 4. Initialize the database
bun run db:push

# 5. Generate Secure Scret for Cleanup Service
# Option 1: Using OpenSSL (Recommended)
openssl rand -base64 32
# Option 2: Using Node.js (if OpenSSL is not available)
bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Option 3: Using /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
# Option 4: Using a password generator
# Install if needed: bun add -g uuid
bun -e "console.log(crypto.randomUUID())"
# 6. Start the development server
bun run dev
```

### Development Commands

```bash
# Start development server (port 3000)
bun run dev

# Start cleanup service (port 3031)
cd mini-services/cleanup-service && bun run dev

# Run linter
bun run lint

# Build for production
bun run build

# Start production server
bun start

# Database commands
bun run db:push      # Push schema changes
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Create and run migrations
bun run db:reset     # Reset database (WARNING: deletes all data)
```

### Project Structure

```
secureshare/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home page (upload)
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── download/           # Download pages
│   │   │   └── [id]/page.tsx
│   │   └── api/                # API routes
│   │       ├── files/          # File operations
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── info/route.ts
│   │       └── cleanup/        # Cleanup operations
│   │           └── route.ts
│   ├── lib/                    # Utility libraries
│   │   ├── encryption.ts       # Encryption utilities
│   │   ├── db.ts               # Prisma client
│   │   └── utils.ts            # General utilities
│   ├── components/             # React components
│   │   └── ui/                 # shadcn/ui components
│   └── hooks/                  # Custom React hooks
├── prisma/
│   └── schema.prisma           # Database schema
├── mini-services/              # Background services
│   └── cleanup-service/
│       ├── index.ts
│       └── package.json
├── db/
│   └── custom.db               # SQLite database
├── docs/                       # Documentation
│   └── API.md
├── public/                     # Static files
├── .env.example                # Environment template
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    React Frontend                        ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ││
│  │  │ Upload Page │  │Download Page│  │Encryption Utils │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  ││
│  │                          │                               ││
│  │              ┌───────────┴───────────┐                  ││
│  │              │    Web Crypto API     │                  ││
│  │              │   (AES-256-GCM)       │                  ││
│  │              └───────────────────────┘                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    API Routes                            ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ││
│  │  │ POST /files │  │GET /files/id│  │POST /cleanup    │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────────┐│
│  │                   Prisma ORM                             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLite DATABASE                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 SecureFile Table                         ││
│  │  - id, fileName, fileType, fileSize                      ││
│  │  - encryptedData, iv, salt                               ││
│  │  - oneTimeDownload, downloadCount                        ││
│  │  - expiresAt, isDeleted, version                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Upload Flow
```
User selects file
       │
       ▼
Generate AES-256 key (client)
       │
       ▼
Generate random IV
       │
       ▼
Encrypt file (AES-GCM)
       │
       ▼
Export key to Base64
       │
       ▼
POST /api/files (encrypted data only)
       │
       ▼
Server stores encrypted data
       │
       ▼
Return fileId + expiry
       │
       ▼
Create share URL with key in fragment
```

#### Download Flow
```
User opens /download/:id#key
       │
       ▼
GET /api/files/:id/info (metadata only)
       │
       ▼
Show file info + countdown
       │
       ▼
User clicks Download
       │
       ▼
GET /api/files/:id (triggers counter)
       │
       ▼
Extract key from URL fragment
       │
       ▼
Decrypt file (client)
       │
       ▼
Download to device
```

---

## Database Schema

### SecureFile Model

```prisma
model SecureFile {
  id              String   @id @default(cuid())
  
  // File metadata
  fileName        String   // Original filename
  fileType        String   // MIME type
  fileSize        Int      // Size in bytes
  
  // Encrypted data
  encryptedData   String   // Base64 encoded
  iv              String   // Initialization vector
  salt            String   // Salt (optional)
  
  // Download settings
  oneTimeDownload Boolean  @default(true)
  downloadCount   Int      @default(0)
  
  // Expiry
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  
  // Deletion status
  isDeleted       Boolean  @default(false)
  deletedAt       DateTime?
  
  // Optimistic locking
  version         Int      @default(0)

  @@index([expiresAt])
  @@index([isDeleted])
}
```

### Indexes

- `expiresAt` - For quick lookup of expired files
- `isDeleted` - For filtering out deleted files

---

## Security Considerations

### Encryption

1. **Algorithm**: AES-256-GCM (Galois/Counter Mode)
   - Provides both encryption and authentication
   - Efficient and widely supported

2. **Key Generation**: 
   - Keys generated using Web Crypto API
   - Never transmitted to server
   - Stored only in URL fragment

3. **IV (Initialization Vector)**:
   - 12 bytes (recommended for GCM)
   - Randomly generated for each file
   - Stored on server (not secret)

### Zero-Knowledge Architecture

```
┌─────────────────────────────────────────────────────────┐
│ What the server KNOWS:                                  │
│ - File ID                                               │
│ - Encrypted data (ciphertext)                           │
│ - IV (initialization vector)                            │
│ - File metadata (name, type, size)                      │
│ - Expiry time                                           │
│                                                         │
│ What the server DOESN'T KNOW:                           │
│ - Encryption key                                        │
│ - File contents (plaintext)                             │
│ - Who downloads the file                                │
└─────────────────────────────────────────────────────────┘
```

### Race Condition Prevention

One-time downloads use optimistic locking:

```typescript
// 1. Read current version
const file = await tx.secureFile.findUnique({ where: { id } });

// 2. Update with version check
const result = await tx.secureFile.updateMany({
  where: { 
    id, 
    version: file.version  // Only update if version matches
  },
  data: { 
    downloadCount: { increment: 1 },
    version: { increment: 1 }  // Increment version
  }
});

// 3. Check if update succeeded
if (result.count === 0) {
  // Another request won the race
  throw new Error('RACE_CONDITION');
}
```

### Best Practices

1. **Never log encryption keys**
2. **Use HTTPS in production**
3. **Implement rate limiting**
4. **Set appropriate CORS headers**
5. **Validate all input on server side**
6. **Keep database backups encrypted**
7. **Prevent XSS attacks on file download**

### XSS (Stored XSS) Prevention

When downloading decrypted files, we prevent malicious files (like HTML with JavaScript) from being rendered by the browser:

```typescript
// Dangerous MIME types that could execute code
const dangerousTypes = [
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'image/svg+xml',
  'application/pdf',
];

// Use generic binary type for dangerous files
const safeFileType = dangerousTypes.some(type => 
  fileType.toLowerCase().includes(type.toLowerCase())
) 
  ? 'application/octet-stream'  // Forces download, prevents render
  : fileType;

// Create download link with security attributes
const a = document.createElement('a');
a.href = url;
a.download = fileName;           // Forces download instead of render
a.rel = 'noopener noreferrer';   // Prevents reverse tabnabbing
```

**Why this matters:**
- Without protection, a malicious HTML file could steal cookies
- SVG files can contain JavaScript that executes when rendered
- PDF files can contain embedded JavaScript
- Using `application/octet-stream` forces browser to download, not execute

---

## Contributing Guidelines

### Code Style

- Use TypeScript for all new code
- Follow ESLint rules
- Use meaningful variable names
- Add JSDoc comments for public functions

### Commit Messages

```
feat: add password protection feature
fix: resolve race condition in downloads
docs: update API documentation
style: improve button hover effects
refactor: simplify encryption utilities
test: add unit tests for crypto functions
chore: update dependencies
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Review Checklist

- [ ] Code compiles without errors
- [ ] ESLint passes
- [ ] No security vulnerabilities
- [ ] Responsive design tested
- [ ] Error handling implemented
- [ ] Documentation updated

---

## Testing

### Manual Testing

```bash
# 1. Upload a file using the UI

# 2. Test API directly
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.txt",
    "fileType": "text/plain",
    "fileSize": 100,
    "encryptedData": "dGVzdA==",
    "iv": "dGVzdGl2",
    "salt": ""
  }'

# 3. Check file info
curl http://localhost:3000/api/files/<file_id>/info

# 4. Test cleanup
curl -X POST http://localhost:3000/api/cleanup \
  -H "Authorization: Bearer secure-share-cleanup-secret"
```

### Test Cases

| Test | Description |
|------|-------------|
| Upload valid file | Should return file ID |
| Upload oversized file | Should return 400 error |
| Download once | Should return encrypted data |
| Download twice (one-time) | Should return 410 error |
| Download expired | Should return 410 error |
| Missing encryption key | Should show error message |
| Countdown timer | Should count down correctly |

---

## Deployment

### Environment Setup

```bash
# Production environment variables
DATABASE_URL="file:/path/to/production.db"
CLEANUP_SECRET="your-secure-secret-here"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"
NODE_ENV="production"
```

### Build & Deploy

```bash
# Build the application
bun run build

# Start production server
bun start

# Start cleanup service
cd mini-services/cleanup-service && bun run dev
```

### Deployment Checklist

- [ ] Set secure CLEANUP_SECRET
- [ ] Configure HTTPS
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring
- [ ] Configure CDN for static assets
- [ ] Set up error tracking (e.g., Sentry)

### Recommended Infrastructure

- **Hosting**: Vercel, Railway, or self-hosted VPS
- **Database**: SQLite for small scale, PostgreSQL for production
- **CDN**: Cloudflare or Vercel Edge Network
- **Monitoring**: Sentry, LogRocket, or Datadog

---

## Troubleshooting

### Common Issues

**Window is not defined**
- Cause: Using `window` during SSR
- Fix: Check `typeof window !== 'undefined'`

**Prisma client not initialized**
- Fix: Run `bun run db:generate`

**File upload fails with "Invalid input"**
- Cause: Zod validation failure
- Fix: Check all required fields are present

**Download shows "Missing Encryption Key"**
- Cause: URL fragment missing
- Fix: Ensure URL contains `#key` fragment

---
