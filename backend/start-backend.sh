#!/bin/bash
# Force backend to run on port 4000 connecting to Docker PostgreSQL

export PORT=4000
export NODE_ENV=development
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_intelligence
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=sales_intelligence
export DB_USER=postgres
export DB_PASSWORD=postgres

echo "🚀 Starting backend on PORT 4000 with Docker PostgreSQL..."
echo "📊 Database: Docker PostgreSQL (localhost:5432)"
echo "💾 Redis: Docker Redis (localhost:6379)"
echo ""

npm run dev

