# 🐳 DOCKER-FIRST SETUP GUIDE

## One Database, Clean Setup - Docker PostgreSQL + Redis

**Recommended Setup**: Use Docker for PostgreSQL and Redis, run backend/frontend locally.

---

## ✅ WHY DOCKER?

- ✅ **Consistent Environment**: Same database for everyone
- ✅ **No Local Installation**: No need to install PostgreSQL
- ✅ **Easy Reset**: `docker-compose down -v` to start fresh
- ✅ **Data Persistence**: Docker volumes keep your data safe
- ✅ **Production-Like**: Same setup as production
- ✅ **Isolated**: Doesn't interfere with other projects

---

## 🚀 ONE-COMMAND STARTUP

```bash
# From project root
./start.sh

# This will:
# ✅ Start PostgreSQL container
# ✅ Start Redis container
# ✅ Run database migrations
# ✅ Create admin user
# ✅ Show you next steps
```

---

## 📋 DETAILED SETUP (First Time)

### Step 1: Make Sure Docker is Running
```bash
# Check Docker
docker --version

# Start Docker Desktop (if not running)
# You should see Docker icon in menu bar
```

### Step 2: Start Database Containers
```bash
# Start PostgreSQL + Redis
docker-compose up -d postgres redis

# Verify they're running
docker ps

# Should see:
# sales-intelligence-postgres
# sales-intelligence-redis
```

### Step 3: Setup Database
```bash
cd backend

# Run migrations (creates tables)
npm run migration:run

# Create admin user
npm run seed:admin

# Verify
docker exec -it sales-intelligence-postgres psql -U postgres -d sales_intelligence -c "\dt"
```

### Step 4: Start Backend (Local)
```bash
# Terminal 1
cd backend
npm install  # First time only
npm run dev

# Should see:
# ✅ Database connection established
# ✅ Server running on port 4000
```

### Step 5: Start Frontend (Local)
```bash
# Terminal 2
cd frontend
npm install  # First time only
npm run dev

# Should see:
# ✅ Ready on http://localhost:3000
```

### Step 6: Login
```
URL:      http://localhost:3000/login
Email:    admin@example.com
Password: password123
```

---

## 🔧 DOCKER COMMANDS

### Start Services:
```bash
# Start PostgreSQL only
docker-compose up -d postgres

# Start PostgreSQL + Redis
docker-compose up -d postgres redis

# Check status
docker-compose ps
```

### Stop Services:
```bash
# Stop all containers
docker-compose down

# Stop and remove data (⚠️ DELETES EVERYTHING!)
docker-compose down -v
```

### View Logs:
```bash
# PostgreSQL logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# All logs
docker-compose logs -f
```

### Access Database:
```bash
# PostgreSQL CLI
docker exec -it sales-intelligence-postgres psql -U postgres -d sales_intelligence

# Run SQL commands
# sales_intelligence=> SELECT * FROM companies;
# sales_intelligence=> \dt  (list tables)
# sales_intelligence=> \q   (quit)
```

### Access Redis:
```bash
# Redis CLI
docker exec -it sales-intelligence-redis redis-cli

# Check cache
# 127.0.0.1:6379> KEYS *
# 127.0.0.1:6379> GET some-key
# 127.0.0.1:6379> quit
```

---

## 🗂️ CLEAN ARCHITECTURE

### What Runs Where:

**Docker Containers** (Infrastructure):
```
├── PostgreSQL (port 5432)
│   └── Persistent data in volume
└── Redis (port 6379)
    └── Persistent cache in volume
```

**Local Development** (Code):
```
├── Backend (port 4000)
│   ├── Hot reload with tsx watch
│   └── Connects to Docker PostgreSQL
└── Frontend (port 3000)
    ├── Hot reload with Next.js
    └── Connects to Backend API
```

**Benefits**:
- ✅ Code changes reload instantly
- ✅ Database persists between restarts
- ✅ Easy to debug and develop
- ✅ Production-like setup

---

## 📝 UPDATED .ENV CONFIGURATION

Your `backend/.env` should have:

```bash
# Database - Points to Docker PostgreSQL
DB_HOST=localhost  # Docker exposes on localhost
DB_PORT=5432
DB_NAME=sales_intelligence
DB_USER=postgres
DB_PASSWORD=postgres

# Redis - Points to Docker Redis
REDIS_URL=redis://localhost:6379

# Other settings (same as before)
PORT=4000
NODE_ENV=development
GEMINI_API_KEY=your_actual_key_from_google
TAVILY_API_KEY=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
```

---

## ✅ DATA PERSISTENCE EXPLAINED

### How Data is Saved:

**Docker Volumes** (Persistent):
```
postgres_data    → Stores all database tables
redis_data       → Stores all cache data
```

**What Happens on Restart**:
```bash
# Stop containers
docker-compose down
# ✅ Data is SAFE in volumes

# Start again
docker-compose up -d
# ✅ Data is RESTORED automatically
```

**What DELETES Data**:
```bash
# This removes volumes (data)
docker-compose down -v  # ⚠️ DANGER!

# This is safe (keeps data)
docker-compose down     # ✅ SAFE
```

---

## 🎯 RECOMMENDED WORKFLOW

### Daily Development:

**First time** (Setup):
```bash
./start.sh  # One command!
```

**Every day** (Quick start):
```bash
# Check if Docker containers running
docker ps | grep sales-intelligence

# If not running:
docker-compose up -d postgres redis

# Start backend
cd backend && npm run dev

# Start frontend (new terminal)
cd frontend && npm run dev
```

### When Done:
```bash
# Stop backend/frontend (Ctrl+C in terminals)

# Optional: Stop Docker containers (saves resources)
docker-compose down

# Data is preserved in volumes ✅
```

---

## 🔍 TROUBLESHOOTING

### Issue: "Database already exists"
```bash
# This is GOOD! It means data persisted
# Just run migrations to update schema
npm run migration:run
```

### Issue: "Port 5432 already in use"
```bash
# Stop local PostgreSQL
brew services stop postgresql

# Or kill the process
lsof -ti:5432 | xargs kill -9

# Use Docker PostgreSQL instead
docker-compose up -d postgres
```

### Issue: Data is gone after restart
```bash
# Check if volumes exist
docker volume ls | grep postgres

# Should see: sales-intelligence_postgres_data

# If missing, you ran: docker-compose down -v
# That deletes volumes! Don't use -v flag
```

### Issue: Can't connect to database
```bash
# Check container is running
docker ps | grep postgres

# Check container logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres
```

---

## 📊 VERIFY SETUP

### Check Everything:

```bash
# 1. Check Docker containers
docker ps

# Should show:
# sales-intelligence-postgres  (Up)
# sales-intelligence-redis     (Up)

# 2. Check database has tables
docker exec -it sales-intelligence-postgres psql -U postgres -d sales_intelligence -c "\dt"

# Should show 9 tables:
# audit_logs, companies, file_uploads, migrations,
# people, refresh_tokens, scraping_jobs, user_sessions, users

# 3. Check users exist
docker exec -it sales-intelligence-postgres psql -U postgres -d sales_intelligence -c "SELECT email, role FROM users;"

# Should show:
# admin@example.com | admin
# user@example.com  | user

# 4. Check Redis
docker exec -it sales-intelligence-redis redis-cli ping

# Should return: PONG
```

---

## 🎯 PRODUCTION DEPLOYMENT

When deploying to production, use the same Docker approach:

```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# With proper:
# - Environment variables
# - Secrets management
# - SSL certificates
# - Backup strategy
```

---

## 📦 PACKAGE.JSON SCRIPTS

New simplified scripts:

```bash
# Docker management
npm run docker:db     # Start database only
npm run docker:up     # Start all services
npm run docker:down   # Stop all services
npm run docker:logs   # View logs

# Database
npm run migration:run    # Run migrations
npm run migration:show   # Show migration status
npm run seed:admin       # Create admin user

# Development
npm run dev              # Start backend (connects to Docker DB)
npm test                 # Run tests
```

---

## ✅ BENEFITS OF THIS SETUP

### Development:
- ✅ Fast hot reload (code runs locally)
- ✅ Easy debugging
- ✅ Consistent database
- ✅ No local PostgreSQL installation needed

### Data:
- ✅ Persists between restarts
- ✅ Easy to backup (`docker volume`)
- ✅ Easy to reset (`docker-compose down -v`)
- ✅ Version controlled (migrations)

### Team:
- ✅ Same environment for everyone
- ✅ Easy onboarding (one script)
- ✅ No "works on my machine" issues

---

## 🎉 SUMMARY

**Old Way** (Complicated):
- Multiple index files
- Multiple database configs
- Local PostgreSQL required
- Inconsistent setups

**New Way** (Simple):
- ✅ ONE index.ts
- ✅ ONE database config
- ✅ Docker PostgreSQL (consistent)
- ✅ ONE startup command: `./start.sh`

---

## 🚀 GET STARTED NOW

```bash
# One command to rule them all:
./start.sh

# Then:
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2

# Login at: http://localhost:3000
```

**Your data will persist between restarts!** ✅

---

*This is the professional, industry-standard way to run development environments.*

