# 🚀 **SALES INTELLIGENCE PLATFORM - SETUP GUIDE**

## 📋 **Prerequisites**

### **Required Software**

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **PostgreSQL 14+** - [Download here](https://www.postgresql.org/download/)
- **Redis** - [Download here](https://redis.io/download) or use Docker
- **Git** - [Download here](https://git-scm.com/)

### **Optional (Recommended)**

- **Docker** - For easy Redis setup
- **Postman** - For API testing
- **VS Code** - For development

---

## 🔧 **Step-by-Step Setup**

### **1. Clone and Navigate to Project**

```bash
cd /Users/siddhantpatil/Teamcast_UT/Scripting/Archive/hr-tech-investor-scrapping-actual/palAADIN
```

### **2. Backend Setup**

#### **Install Dependencies**

```bash
cd backend
npm install --legacy-peer-deps
```

#### **Environment Configuration**

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/sales_intelligence
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sales_intelligence
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Secrets
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Redis (for batch processing)
REDIS_URL=redis://localhost:6379
```

#### **Database Setup**

```bash
# Create PostgreSQL database
createdb sales_intelligence

# Run migrations (if available)
npm run migration:run

# Seed database (if available)
npm run seed
```

#### **Start Backend Server**

```bash
npm run dev
```

**Backend will run on:** http://localhost:5000

---

### **3. Frontend Setup**

#### **Install Dependencies**

```bash
cd ../frontend
npm install
```

#### **Environment Configuration**

Create `.env.local` file in `frontend/` directory:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=Sales Intelligence Platform
```

#### **Start Frontend Server**

```bash
npm run dev
```

**Frontend will run on:** http://localhost:3000

---

### **4. Redis Setup (for Batch Processing)**

#### **Option A: Using Docker**

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### **Option B: Local Installation**

```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://redis.io/download
```

---

## 🚀 **Running the Complete Platform**

### **Terminal 1: Backend Server**

```bash
cd backend
npm run dev
```

### **Terminal 2: Frontend Server**

```bash
cd frontend
npm run dev
```

### **Terminal 3: Redis (if not using Docker)**

```bash
redis-server
```

---

## 🌐 **Access the Platform**

### **Main Application**

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Documentation:** http://localhost:5000/api

### **Key Pages**

- **Dashboard:** http://localhost:3000/dashboard
- **Companies:** http://localhost:3000/companies
- **People:** http://localhost:3000/people
- **AI Search:** http://localhost:3000/search
- **Batch Processing:** http://localhost:3000/batch-processing
- **File Upload:** http://localhost:3000/files

---

## 🧪 **Testing the Platform**

### **1. Create User Account**

1. Go to http://localhost:3000
2. Click "Sign Up"
3. Create account with email/password
4. Login with credentials

### **2. Test Modern Data Table**

1. Navigate to Companies or People page
2. Try resizing columns (drag column borders)
3. Double-click cells to edit inline
4. Use global search to filter data
5. Select multiple rows for bulk operations
6. Test export functionality

### **3. Test Batch Processing**

1. Go to Batch Processing page
2. Click "Start New Job"
3. Enter a website URL (e.g., https://example.com)
4. Configure batch options
5. Start the job and watch real-time progress
6. Monitor statistics and progress updates

### **4. Test AI Search**

1. Go to AI Search page
2. Try natural language queries:
   - "Show me tech companies in San Francisco"
   - "Find people working at startups"
   - "Scrape companies from this website: [URL]"

### **5. Test File Upload**

1. Go to File Upload page
2. Upload an Excel file with company/people data
3. Watch the AI-powered column mapping
4. Review and confirm the mapping
5. Process the file and see results in Companies/People pages

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Backend Won't Start**

```bash
# Check if port 5000 is available
lsof -i :5000

# Kill process if needed
kill -9 [PID]

# Check environment variables
cat backend/.env
```

#### **Frontend Won't Start**

```bash
# Check if port 3000 is available
lsof -i :3000

# Clear Next.js cache
rm -rf frontend/.next
npm run dev
```

#### **Database Connection Issues**

```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql

# Test connection
psql -h localhost -U your_username -d sales_intelligence
```

#### **Redis Connection Issues**

```bash
# Check Redis status
redis-cli ping

# Should return "PONG"

# Start Redis if not running
redis-server
```

### **Logs and Debugging**

#### **Backend Logs**

```bash
cd backend
npm run dev
# Watch console for errors and logs
```

#### **Frontend Logs**

```bash
cd frontend
npm run dev
# Check browser console for errors
```

---

## 📊 **Performance Monitoring**

### **Backend Health Check**

```bash
curl http://localhost:5000/api/batch/stats
```

### **Database Performance**

```bash
# Connect to PostgreSQL
psql -h localhost -U your_username -d sales_intelligence

# Check table sizes
SELECT schemaname,tablename,attname,n_distinct,correlation FROM pg_stats;
```

### **Redis Performance**

```bash
# Connect to Redis
redis-cli

# Check memory usage
INFO memory

# Check connected clients
INFO clients
```

---

## 🚀 **Production Deployment**

### **Environment Variables for Production**

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-host:5432/sales_intelligence
REDIS_URL=redis://prod-redis:6379
JWT_ACCESS_SECRET=production_secret_key_32_chars_min
JWT_REFRESH_SECRET=production_refresh_secret_32_chars_min
GEMINI_API_KEY=your_production_gemini_key
FRONTEND_URL=https://your-domain.com
```

### **Build Commands**

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

---

## 🎯 **Quick Start Summary**

1. **Install Dependencies:** `npm install --legacy-peer-deps` (backend), `npm install` (frontend)
2. **Setup Database:** Create PostgreSQL database and run migrations
3. **Setup Redis:** Install and start Redis server
4. **Configure Environment:** Create `.env` files with your keys
5. **Start Servers:** Run `npm run dev` in both backend and frontend directories
6. **Access Platform:** Go to http://localhost:3000

**The Sales Intelligence Platform is now ready to use!** 🎉
