# 🔑 API KEYS SETUP GUIDE

## Required API Keys

Your Sales Intelligence Platform needs these API keys to function fully:

---

## 1️⃣ GEMINI_API_KEY (Required for AI Features)

### What It's Used For:

- ✅ Intelligent column mapping for Excel uploads
- ✅ Natural language query processing
- ✅ Web scraping strategy analysis
- ✅ Data validation and enrichment
- ✅ Conversational AI features

### How to Get It (FREE!):

1. **Go to Google AI Studio**:

   - Visit: https://aistudio.google.com/app/apikey

2. **Sign in with your Google account**

3. **Create API Key**:

   - Click "Get API key" or "Create API key"
   - Select "Create API key in new project" or use existing
   - Copy the API key

4. **Add to .env file**:

   ```bash
   # Edit backend/.env
   GEMINI_API_KEY=AIzaSy...your_actual_key_here
   ```

5. **Restart backend server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Current Status:

❌ **Your current key is a placeholder**: `your_gemini_api_key_here`  
✅ **Get a real key from**: https://aistudio.google.com/app/apikey

---

## 2️⃣ TAVILY_API_KEY (Optional - Web Search)

### What It's Used For:

- ✅ Online company information search
- ✅ LinkedIn profile discovery
- ✅ Data enrichment from web
- ✅ Finding missing contact information

### Current Status:

✅ **Already configured**: `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`

### How to Get Your Own (FREE tier available):

1. **Visit Tavily**:

   - Go to: https://tavily.com

2. **Sign up for account**

3. **Get API key from dashboard**

4. **Add to .env**:
   ```bash
   TAVILY_API_KEY=tvly-...your_key_here
   ```

---

## 3️⃣ SERPAPI_KEY (Optional - Alternative Web Search)

### What It's Used For:

- Alternative to Tavily for web search
- Google search results
- More comprehensive search capabilities

### How to Get It:

1. **Visit SerpAPI**:

   - Go to: https://serpapi.com

2. **Sign up (FREE tier: 100 searches/month)**

3. **Get API key from dashboard**

4. **Add to .env**:
   ```bash
   SERPAPI_KEY=your_serpapi_key_here
   ```

---

## 🔧 Update Your .env File

### Current .env Issues:

```bash
# ❌ This is a placeholder (won't work):
GEMINI_API_KEY=your_gemini_api_key_here

# ✅ Should be (real key):
GEMINI_API_KEY=AIzaSyD...your_actual_key
```

### Complete .env Template:

```bash
# Node Environment
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_intelligence
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sales_intelligence
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secrets (Generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your-access-secret-key-minimum-32-characters-long-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-characters-long-change-this

# AI APIs
GEMINI_API_KEY=AIzaSy...GET_FROM_https://aistudio.google.com/app/apikey

# Web Search
TAVILY_API_KEY=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

# Redis (optional but recommended)
REDIS_URL=redis://localhost:6379

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
```

---

## ✅ Verify API Keys Work

### After setting GEMINI_API_KEY:

```bash
# Restart backend
# Stop with Ctrl+C
npm run dev

# You should see:
✅ "Gemini AI client initialized successfully"

# NOT:
❌ "Gemini API key is not configured or invalid"
```

---

## 🎯 What Works WITHOUT Gemini API?

Even without a Gemini API key, most features work:

### ✅ Works:

- Authentication & login
- Company/people management (CRUD)
- File upload
- Basic Excel processing (with fallback column mapping)
- Database queries
- Most scraping features

### ⚠️ Limited:

- Excel column mapping (uses fallback logic instead of AI)
- Natural language queries (reduced capabilities)
- Smart data validation

### ❌ Won't Work:

- Advanced AI agent features
- Intelligent scraping strategy selection
- Conversational interface
- Smart data enrichment

---

## 🚀 Quick Fix Guide

### Get Gemini API Key (5 minutes):

1. **Open browser**: https://aistudio.google.com/app/apikey
2. **Sign in** with Google account
3. **Click** "Create API key"
4. **Copy** the key (starts with `AIzaSy...`)
5. **Edit** `backend/.env`:
   ```bash
   GEMINI_API_KEY=AIzaSy...your_actual_key_paste_here
   ```
6. **Restart** backend server
7. **Done!** ✅

---

## 💡 Pro Tips

### Generate Secure JWT Secrets:

```bash
# Generate random secrets for production
openssl rand -base64 32

# Update your .env with the generated values
```

### Test API Keys:

```bash
# Validate environment
node scripts/validate-env.js

# Should show all green checkmarks
```

### Monitor API Usage:

- **Gemini**: Check usage at https://aistudio.google.com
- **Tavily**: Check dashboard at https://tavily.com/dashboard
- Most have generous free tiers!

---

## 📊 Current Status

Based on your logs:

✅ **TAVILY_API_KEY**: Working  
❌ **GEMINI_API_KEY**: Placeholder (needs real key)  
✅ **Database**: Working  
✅ **File Upload**: Working  
✅ **Data Storage**: Working (6 companies stored!)

**Next Step**: Get a real Gemini API key (5 min) → https://aistudio.google.com/app/apikey

---

## 🎉 Good News!

Your platform is **working even without Gemini AI**!

The file upload succeeded with fallback logic:

- ✅ 6 companies added to database
- ✅ Basic column mapping worked
- ✅ Data is queryable

**Add the Gemini key to unlock full AI power!** 🚀
