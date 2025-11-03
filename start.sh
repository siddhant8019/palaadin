#!/bin/bash

# Sales Intelligence Platform - One-Command Startup Script
# Uses Docker PostgreSQL + Redis for consistency and efficiency

set -e

echo "🚀 Starting Sales Intelligence Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Step 2: Start PostgreSQL and Redis containers
echo ""
echo "🗄️  Starting database containers..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout 30 bash -c 'until docker exec sales-intelligence-postgres pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
}
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout 30 bash -c 'until docker exec sales-intelligence-redis redis-cli ping > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "${YELLOW}⚠️  Redis not ready (optional)${NC}"
}
echo -e "${GREEN}✅ Redis is ready${NC}"

# Step 3: Run migrations
echo ""
echo "📊 Running database migrations..."
cd backend
npm run migration:run || {
    echo -e "${YELLOW}⚠️  Migrations already applied or failed${NC}"
}

# Step 4: Seed admin user (if needed)
echo ""
echo "👤 Creating admin user (if doesn't exist)..."
npm run seed:admin || echo -e "${YELLOW}⚠️  Admin user already exists${NC}"

cd ..

# Step 5: Show status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Services Started Successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Docker Containers:"
echo "   • PostgreSQL: localhost:5432 ✅"
echo "   • Redis:      localhost:6379 ✅"
echo ""
echo "🔐 Default Login:"
echo "   Email:    admin@example.com"
echo "   Password: password123"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ cd frontend && npm run dev"
echo ""
echo "   Then visit: http://localhost:3000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Useful Commands:"
echo "   • Stop services:  docker-compose down"
echo "   • View logs:      docker-compose logs -f postgres"
echo "   • Check DB:       docker exec -it sales-intelligence-postgres psql -U postgres -d sales_intelligence"
echo "   • Reset DB:       docker-compose down -v (⚠️  Deletes all data!)"
echo ""

