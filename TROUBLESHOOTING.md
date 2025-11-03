# 🔧 TROUBLESHOOTING GUIDE

## Common Issues & Solutions

---

## Issue: Database "sales_intelligence" does not exist

### Solution:
```bash
# Create the database
createdb sales_intelligence

# Or using psql
psql postgres -c "CREATE DATABASE sales_intelligence;"

# Then run migrations
npm run migration:run
```

---

## Issue: Port already in use (EADDRINUSE)

### Solution:
```bash
# Kill process on port 4000 (backend)
lsof -ti:4000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9

# Or use the helper script
chmod +x scripts/check-ports.sh
./scripts/check-ports.sh
```

---

## Issue: TAVILY_API_KEY warning even though it's in .env

### Solution:
1. **Check .env file exists**:
```bash
ls -la backend/.env
```

2. **Verify TAVILY_API_KEY is set**:
```bash
cat backend/.env | grep TAVILY
```

3. **Make sure .env is loaded**:
```bash
# The .env file should be in backend/ directory
# Not in the root directory
```

4. **Restart the server**:
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

---

## Issue: Redis connection errors

### Solution:
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it:
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

---

## Issue: PostgreSQL not running

### Solution:
```bash
# Check if PostgreSQL is running
pg_isready

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Or use Docker
docker-compose up -d postgres
```

---

## Issue: Migration errors

### Solution:
```bash
# Check migration status
npm run migration:show

# Revert last migration
npm run migration:revert

# Run migrations again
npm run migration:run

# If all else fails, drop and recreate database
dropdb sales_intelligence
createdb sales_intelligence
npm run migration:run
```

---

## Issue: TypeScript errors after updates

### Solution:
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run type check
npm run type-check
```

---

## Issue: Tests failing

### Solution:
```bash
# Create test database
createdb sales_intelligence_test

# Clear test cache
npm test -- --clearCache

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- path/to/test.ts
```

---

## Issue: Frontend build errors

### Solution:
```bash
cd frontend

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

---

## Issue: Docker container issues

### Solution:
```bash
# Stop all containers
docker-compose down

# Remove volumes (⚠️ destroys data)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

---

## Issue: "synchronize: true" still showing in logs

### Solution:
This is now fixed! But if you see it:

1. **Make sure you're using the correct data-source.ts**:
```bash
# Should be importing from @/data-source
# Not from @/config/database
```

2. **Clear build cache**:
```bash
rm -rf dist
npm run build
```

3. **Restart server**:
```bash
npm run dev
```

---

## Issue: Cannot find module errors

### Solution:
```bash
# Check tsconfig.json paths are correct
# Make sure all imports use @/ prefix

# Reinstall dependencies
npm install

# Clear module cache
rm -rf node_modules/.cache
```

---

## Issue: Swagger/API docs not showing

### Solution:
```bash
# Install Swagger packages
npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express

# Add to index.ts:
# import swaggerUi from 'swagger-ui-express';
# import { swaggerSpec } from '@/config/swagger';
# app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

# Access at: http://localhost:4000/api-docs
```

---

## Issue: Performance is slow

### Solution:
```bash
# Start Redis for caching
brew services start redis

# Check Redis is working
redis-cli ping
# Should return: PONG

# Verify caching is enabled in your services
# Check logs for "Cache hit/miss" messages
```

---

## Quick Fixes

### Kill all ports
```bash
# Kill common ports
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
lsof -ti:5000 | xargs kill -9
lsof -ti:5432 | xargs kill -9
```

### Reset everything
```bash
# Stop all services
killall node

# Clear all caches
rm -rf backend/node_modules backend/dist
rm -rf frontend/node_modules frontend/.next

# Reinstall
cd backend && npm install
cd ../frontend && npm install

# Start fresh
cd backend && npm run dev
```

### Check environment
```bash
# Verify all required environment variables
node -e "require('dotenv').config(); console.log(process.env)"
```

---

## Getting Help

If you're still stuck:

1. **Check the logs**: `backend/logs/combined.log`
2. **Check error logs**: `backend/logs/error.log`
3. **Check security logs**: `backend/logs/security.log`
4. **Run health check**: `curl http://localhost:4000/health`
5. **Review documentation**: See all .md files in root directory

---

## Environment Setup Checklist

- [ ] PostgreSQL installed and running
- [ ] Redis installed and running (optional but recommended)
- [ ] Node.js 20+ installed
- [ ] npm 10+ installed
- [ ] .env file created with all required variables
- [ ] Database created (`sales_intelligence`)
- [ ] Migrations run successfully
- [ ] Ports 3000, 4000 are available
- [ ] API keys configured (GEMINI_API_KEY, TAVILY_API_KEY)

---

**Most issues can be solved by: Kill ports → Clear caches → Reinstall → Try again**

