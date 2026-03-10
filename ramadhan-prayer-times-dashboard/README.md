# Ramadhan Prayer Times Dashboard

Simple Express API proxy + frontend dashboard for Indonesia prayer times using `api.co.id`, with anti-spam rate limit.

## Features

- Frontend dashboard at `GET /`
- API endpoint `GET /prayer-times`
- API endpoint `GET /cities`
- API endpoint `GET /api-info` for debug and upstream config
- Rate limit: **20 requests per 5 minutes per IP**
- Upstream response cache: **5 minutes** (`/prayer-times` and `/cities`)
- Healthcheck: `GET /health`

## Requirements

- Node.js 18+
- API key from `api.co.id`

## Setup

From this folder (`ramadhan-prayer-times-dashboard`):

PowerShell:
```powershell
Copy-Item .env.example .env
```

Bash:
```bash
cp .env.example .env
```

Fill `.env`:

```env
PORT=3000
API_CO_ID_KEY=your_api_key_here
```

Optional override (usually no need):

```env
API_CO_ID_BASE_URL=https://use.api.co.id/regional/indonesia/prayer-times
API_CO_ID_REGENCIES_URL=https://use.api.co.id/regional/indonesia/prayer-times/regencies
```

Install dependencies:

```bash
npm install
```

Run server:

```bash
npm run dev
```

Or production mode:

```bash
npm start
```

## API Usage

### Frontend

```http
GET /
```

### Health

```http
GET /health
```

### API Info

```http
GET /api-info
```

### Prayer Times

```http
GET /prayer-times?regency_code=3171&date=2026-03-10
GET /prayer-times?city=jakarta selatan&date=2026-03-10
```

Query params:

- `regency_code` (recommended): 4 digit code, e.g. `3171`
- `city` (optional): city/regency name, server resolves to `regency_code`
- `date` (optional): one-day shortcut (`start_date` = `end_date`)
- `start_date` (optional): format `YYYY-MM-DD`
- `end_date` (optional): format `YYYY-MM-DD`
- `page` (optional): default `1`

### Cities

```http
GET /cities?page=1
GET /cities?search=jakarta
```

## Quick Test Without Frontend

```bash
curl http://localhost:3000/health
curl "http://localhost:3000/cities?search=jakarta"
curl "http://localhost:3000/prayer-times?regency_code=3171&date=2026-03-10"
```

Check cache behavior:
- First request: `"cached": false`
- Repeated same request within 5 minutes: `"cached": true`

## Notes

- This project forwards requests to `api.co.id` and returns upstream payload.
- Upstream limits still apply based on your `api.co.id` plan.
- Keep `.env` private and do not commit it.
