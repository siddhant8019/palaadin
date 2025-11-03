# Environment Variables Template

Copy this content to `backend/.env`:

```bash
# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================

# Application
NODE_ENV=development
PORT=4000

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://username:password@localhost:5432/sales_intelligence
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sales_intelligence
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# ============================================
# AUTHENTICATION
# ============================================
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_characters_long_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters_long_here

# ============================================
# AI SERVICES
# ============================================

# Google Gemini API (Required)
# Get from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Tavily Web Search API (Required for online search)
# Get from: https://tavily.com
# Free tier: 1,000 searches/month
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Alternative: SerpAPI (optional, if not using Tavily)
# SERPAPI_KEY=your_serpapi_key_here

# ============================================
# CORS (Frontend URLs)
# ============================================
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ============================================
# FILE UPLOAD
# ============================================
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# LOGGING
# ============================================
# Options: error, warn, info, debug
LOG_LEVEL=info
```

## How to Generate Secure Secrets

### For JWT Secrets:

```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 32

# Method 3: Using bash
cat /dev/urandom | head -c 32 | base64
```

## Required Variables

These MUST be set for the app to work:

- ✅ `DATABASE_URL` and related DB\_ variables
- ✅ `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- ✅ `GEMINI_API_KEY`
- ✅ `TAVILY_API_KEY` (for online search feature)

## Optional Variables

These have defaults but can be customized:

- `PORT` (default: 4000)
- `ALLOWED_ORIGINS` (default: http://localhost:3000)
- `MAX_FILE_SIZE` (default: 10MB)
- `LOG_LEVEL` (default: info)

## Getting API Keys

### Gemini API Key

1. Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

### Tavily API Key

1. Go to [https://tavily.com](https://tavily.com)
2. Sign up for free account
3. Navigate to API Keys section
4. Copy your API key (starts with `tvly-`)

### Database Setup (PostgreSQL)

```bash
# Using Docker
docker run --name postgres \
  -e POSTGRES_USER=sales_user \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=sales_intelligence \
  -p 5432:5432 \
  -d postgres:15

# Then set in .env:
DATABASE_URL=postgresql://sales_user:secure_password@localhost:5432/sales_intelligence
```

## Verification

Check if your environment is set up correctly:

```bash
cd backend
npm run type-check
```

If you see no errors, you're good to go!

## Security Notes

⚠️ **NEVER commit `.env` file to git**
⚠️ **Use different secrets for production**
⚠️ **Rotate secrets regularly**
⚠️ **Keep API keys secure**

The `.env` file is already in `.gitignore` to prevent accidental commits.
