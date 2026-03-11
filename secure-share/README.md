# SecureShare - Zero-Knowledge File Sharing

A secure, self-destructing file sharing application with end-to-end encryption. Files are encrypted in the browser using AES-256-GCM, and the encryption key never leaves the client device.

## Features

### Security Features
- **Zero-Knowledge Encryption** - Files are encrypted client-side using AES-256-GCM
- **Encryption Key in URL Fragment** - The key is stored in the URL after `#` which is never sent to the server
- **One-Time Download** - Links automatically expire after first download
- **Auto-Delete** - Files self-destruct after the specified expiry time
- **Atomic Download Protection** - Race condition prevention for one-time downloads
- **Max File Size Limit** - 50MB STRICT maximum file size
- **Rate Limiting** - 5 uploads per hour per IP, prevents abuse
- **Cloudflare Turnstile** - Invisible/smooth CAPTCHA protection (optional)
- **XSS Prevention** - Dangerous file types forced to download, not render
- **Aggressive Cleanup** - Files deleted every 5 minutes after expiry

### UI/UX Features
- **Glassmorphism Design** - Beautiful glass-effect cards with backdrop blur
- **Dark Theme** - Deep Purple to Midnight Blue gradient background
- **Neon Gold Accents** - Eye-catching gold (#FCD34D) for primary actions
- **Lock Animations** - Visual feedback when file is secured/unlocked
- **Countdown Timer** - Real-time expiry countdown on download page
- **Separate Progress Bars** - Encryption progress and upload progress shown separately
- **Responsive Design** - Works perfectly on mobile and desktop
- **Bootstrap Icons** - Consistent iconography throughout

### Technical Features
- **Monospace Typography** - JetBrains Mono for URLs, IDs, and keys
- **Merriweather Font** - Elegant serif typography
- **SSR-Safe** - Works with Next.js server-side rendering
- **Cleanup Service** - Automatic deletion of expired files

## Quick Start

### Prerequisites
- Node.js 18+ or Bun
- SQLite (included)

### Installation

```bash
# Clone the repository
git clone
cd secureshare

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Initialize database
bun run db:push

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Upload page (main)
│   ├── download/[id]/page.tsx      # Download page
│   ├── layout.tsx                  # Root layout with fonts
│   ├── globals.css                 # Global styles
│   └── api/
│       ├── files/
│       │   ├── route.ts            # Upload API
│       │   └── [id]/
│       │       ├── route.ts        # Download API (atomic)
│       │       └── info/
│       │           └── route.ts    # File info API
│       └── cleanup/
│           └── route.ts            # Cleanup API
├── lib/
│   ├── encryption.ts               # Encryption utilities
│   ├── db.ts                       # Prisma client
│   └── utils.ts                    # Utility functions
├── components/ui/                  # shadcn/ui components
└── hooks/                          # Custom React hooks

prisma/
└── schema.prisma                   # Database schema

mini-services/
└── cleanup-service/
    └── index.ts                    # Background cleanup service

db/
└── custom.db                       # SQLite database
```

## API Documentation

### Upload File
```
POST /api/files
```

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024000,
  "encryptedData": "base64-encoded-encrypted-data",
  "iv": "base64-encoded-iv",
  "salt": "",
  "oneTimeDownload": true,
  "expiryHours": 24,
  "turnstileToken": "cloudflare-turnstile-token"
}
```

**Note:** `turnstileToken` is required only when Turnstile is configured.

**Response:**
```json
{
  "success": true,
  "fileId": "clx123abc",
  "expiresAt": "2024-01-02T00:00:00.000Z"
}
```

### Get File Info
```
GET /api/files/:id/info
```

**Response:**
```json
{
  "success": true,
  "file": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "oneTimeDownload": true,
    "expiresAt": "2024-01-02T00:00:00.000Z"
  }
}
```

### Download File
```
GET /api/files/:id
```

**Response:**
```json
{
  "success": true,
  "file": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "encryptedData": "base64-encoded-encrypted-data",
    "iv": "base64-encoded-iv",
    "downloadCount": 1,
    "oneTimeDownload": true,
    "expiresAt": "2024-01-02T00:00:00.000Z"
  }
}
```

### Cleanup Expired Files
```
POST /api/cleanup
Authorization: Bearer <CLEANUP_SECRET>
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 5,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Security Architecture

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User selects file                                       │
│  2. Generate AES-256-GCM key (Web Crypto API)               │
│  3. Generate random IV (12 bytes)                           │
│  4. Encrypt file: AES-GCM(key, IV, plaintext)               │
│  5. Export key to base64                                    │
│  6. Upload encrypted data + IV to server                    │
│  7. Create share URL: /download/:id#<encryption_key>        │
│                                                             │
│  Note: The #fragment is NEVER sent to the server!           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  - Stores: encrypted_data, iv, metadata                     │
│  - Never sees: encryption key, plaintext                    │
│  - Enforces: expiry, one-time download, size limits         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### One-Time Download Protection

```typescript
// Atomic operation using optimistic locking
await db.$transaction(async (tx) => {
  // 1. Read file with current version
  const file = await tx.secureFile.findUnique({ where: { id } });
  
  // 2. Check if already downloaded
  if (file.downloadCount >= 1) throw new Error('ALREADY_DOWNLOADED');
  
  // 3. Atomic increment with version check
  const updated = await tx.secureFile.updateMany({
    where: { id, version: file.version },
    data: { downloadCount: { increment: 1 }, version: { increment: 1 } }
  });
  
  // 4. If count=0, race condition occurred
  if (updated.count === 0) throw new Error('RACE_CONDITION');
  
  // 5. Mark for deletion
  await tx.secureFile.update({ where: { id }, data: { isDeleted: true } });
});
```

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database file path | `file:./db/custom.db` |
| `CLEANUP_SECRET` | Secret for cleanup API | `secure-share-cleanup-secret` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | - |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (private) | - |
| `NODE_ENV` | Environment mode | `development` |

### Cloudflare Turnstile Setup

1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site
3. Copy the **Site Key** and **Secret Key**
4. Add to your `.env` file:
```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"
```

**Benefits:**
- No annoying image selection (unlike reCAPTCHA)
- Invisible or one-click verification
- Better privacy for your users
- Fast and modern

## Customization

### Change Max File Size
Edit `src/lib/encryption.ts`:
```typescript
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

### Change Expiry Options
Edit `src/app/page.tsx`:
```typescript
{[1, 6, 12, 24, 48, 72].map((hours) => ( // hours
```

### Change Theme Colors
Edit `src/app/globals.css`:
```css
:root {
  --primary: #FCD34D; /* Neon Gold */
}
```

## Scripts

```bash
# Development
bun run dev          # Start dev server on port 3000

# Database
bun run db:push      # Push schema to database
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Run migrations
bun run db:reset     # Reset database

# Code Quality
bun run lint         # Run ESLint
bun run build        # Build for production
```

## Mini Services

### Cleanup Service (Port 3031)

Automatically deletes expired files every hour.

```bash
# Start cleanup service
cd mini-services/cleanup-service && bun run dev
```

**Endpoints:**
- `GET /health` - Health check
- `GET /status` - File statistics
- `POST /cleanup` - Trigger manual cleanup



## Docker Deployment

### Quick Deploy

```bash
# Clone repository
git clone https://github.com/yourusername/secure-share.git
cd secureshare

# Configure environment
cp .env.production .env
nano .env  # Add your configuration

# Update domain in Caddyfile
sed -i 's/share.yourdomain.com/your-actual-domain.com/g' Caddyfile

# Deploy
docker compose up -d --build
```

### Production Requirements
- Docker & Docker Compose
- Domain name with DNS pointing to your server
- Open ports: 80, 443

### Files for Deployment
| File | Purpose |
|------|---------|
| `Dockerfile` | Main application container |
| `Dockerfile.cleanup` | Cleanup service container |
| `docker-compose.yml` | Orchestration config |
| `Caddyfile` | Reverse proxy + SSL |
| `.env.production` | Environment template |

**Full deployment guide**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)



## Error Messages

| Error | Message |
|-------|---------|
| File Not Found | `File not found` |
| Already Downloaded | `Sorry, This File Has Been Downloaded` |
| Expired | `Sorry, The Time For Downloading The File Has Expired` |
| Missing Key | `Missing Encryption Key` |
| Race Condition | `Sorry, This File Has Been Downloaded` |

## Testing

```bash
# Upload a file
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.txt","fileType":"text/plain","fileSize":100,"encryptedData":"test","iv":"test","salt":""}'

# Check cleanup status
curl http://localhost:3000/api/cleanup
```

## License

MIT License - feel free to use for personal or commercial projects.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with using Next.js, Prisma, and Web Crypto API.

