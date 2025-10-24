# Cloudflare Infrastructure for kinetiCORE Cloud Assets

This directory contains the Cloudflare Workers, D1 database schema, and configuration for the kinetiCORE cloud asset storage system.

## Directory Structure

```
cloudflare/
├── workers/
│   ├── src/
│   │   └── index.ts          # Main Workers API
│   ├── wrangler.toml          # Workers configuration
│   └── package.json           # Dependencies
├── d1/
│   └── schema.sql             # D1 database schema
└── README.md                  # This file
```

## Setup

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Node.js 18+ and npm

### 1. Install Dependencies

```bash
cd cloudflare/workers
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create R2 Bucket

```bash
wrangler r2 bucket create kineticore-assets
```

### 4. Create D1 Database

```bash
wrangler d1 create kineticore-assets-db
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "ASSETS_DB"
database_name = "kineticore-assets-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Paste here
```

### 5. Initialize Database Schema

```bash
wrangler d1 execute kineticore-assets-db --file=../d1/schema.sql
```

### 6. Create KV Namespace

```bash
wrangler kv:namespace create "MANIFESTS_KV"
```

Copy the namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MANIFESTS_KV"
id = "YOUR_NAMESPACE_ID_HERE"  # <-- Paste here
```

### 7. Set API Key (Secret)

```bash
wrangler secret put API_KEY
# Enter your secret API key when prompted
```

### 8. Update Account ID

Get your account ID from [Cloudflare Dashboard](https://dash.cloudflare.com/) and update `wrangler.toml`:

```toml
account_id = "YOUR_ACCOUNT_ID_HERE"  # <-- Paste here
```

## Development

### Run Local Dev Server

```bash
cd cloudflare/workers
npm run dev
```

This starts a local Workers dev server at `http://localhost:8787`.

Test the API:

```bash
curl http://localhost:8787/v1/health
```

### Deploy to Cloudflare

#### Deploy to Staging

```bash
npm run deploy:staging
```

#### Deploy to Production

```bash
npm run deploy:production
```

## API Endpoints

### Public Endpoints (No Auth Required)

- `GET /v1/health` - Health check
- `GET /v1/version` - API version
- `GET /v1/manifests/global` - Global asset manifest
- `GET /v1/manifests/:domain` - Domain-specific manifest
- `GET /v1/assets` - Search assets
- `GET /v1/assets/:assetId` - Get asset details
- `GET /v1/assets/:assetId/download` - Get download URLs

### Authenticated Endpoints (Require API Key)

- `POST /v1/upload/initiate` - Initiate asset upload
- `POST /v1/upload/:uploadId/complete` - Complete upload
- `GET /v1/upload/:uploadId/status` - Check upload status
- `POST /v1/assets/:assetId/versions/:version/deprecate` - Deprecate version

### Authentication

Include API key in Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.kineticore.io/v1/upload/initiate
```

## Database Management

### Execute SQL Query

```bash
wrangler d1 execute kineticore-assets-db --command "SELECT * FROM assets LIMIT 10"
```

### Run SQL File

```bash
wrangler d1 execute kineticore-assets-db --file=query.sql
```

### Backup Database

```bash
wrangler d1 export kineticore-assets-db --output=backup.sql
```

### View Database Schema

```bash
wrangler d1 execute kineticore-assets-db --command ".schema"
```

## R2 Storage Management

### List Buckets

```bash
wrangler r2 bucket list
```

### Upload File to R2

```bash
wrangler r2 object put kineticore-assets/test.txt --file=test.txt
```

### List Objects in Bucket

```bash
wrangler r2 object list kineticore-assets --prefix=packages/
```

### Delete Object

```bash
wrangler r2 object delete kineticore-assets/test.txt
```

## KV Management

### Put Value

```bash
wrangler kv:key put --binding=MANIFESTS_KV "test-key" "test-value"
```

### Get Value

```bash
wrangler kv:key get --binding=MANIFESTS_KV "test-key"
```

### List Keys

```bash
wrangler kv:key list --binding=MANIFESTS_KV
```

## Monitoring

### View Logs (Tail)

```bash
npm run tail
```

For production:

```bash
npm run tail:production
```

### Analytics

View analytics in [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers → kineticore-assets-api → Analytics

## Custom Domain Setup

1. Add domain to Cloudflare
2. Go to Workers → Routes
3. Add route: `api.kineticore.io/v1/*` → `kineticore-assets-api`
4. Add DNS record: `api` → CNAME → `kineticore-assets-api.workers.dev`

For R2 custom domain:

1. Go to R2 → kineticore-assets → Settings → Custom Domains
2. Add: `assets.kineticore.io`
3. Add DNS record: `assets` → CNAME → R2 domain

## Cost Monitoring

Free tier limits:

- **R2:** 10 GB storage, 1M Class A ops/month
- **Workers:** 100K requests/day
- **D1:** 5 GB storage, 5M reads/day
- **KV:** 100K reads/day, 1K writes/day

View usage: [Cloudflare Dashboard](https://dash.cloudflare.com/) → Analytics & Logs

## Troubleshooting

### Issue: Workers deployment fails

```bash
# Check wrangler configuration
wrangler whoami

# Verify bindings
wrangler d1 list
wrangler r2 bucket list
wrangler kv:namespace list
```

### Issue: D1 schema not applied

```bash
# Re-run schema
wrangler d1 execute kineticore-assets-db --file=../d1/schema.sql

# Verify tables
wrangler d1 execute kineticore-assets-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### Issue: CORS errors

Ensure `corsHeaders` are included in all responses in `workers/src/index.ts`.

## Next Steps

1. ✅ Complete Workers API implementation
2. ⏳ Implement upload validation
3. ⏳ Add FTS search
4. ⏳ Set up analytics
5. ⏳ Configure monitoring/alerts

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [R2 Docs](https://developers.cloudflare.com/r2/)
- [D1 Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
