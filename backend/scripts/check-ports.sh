#!/bin/bash

# Script to check and fix port conflicts

echo "🔍 Checking for port conflicts..."

# Check port 4000 (backend)
PORT_4000=$(lsof -ti:4000)
if [ ! -z "$PORT_4000" ]; then
    echo "⚠️  Port 4000 is in use by process $PORT_4000"
    read -p "Kill process on port 4000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PORT_4000
        echo "✅ Process killed"
    fi
else
    echo "✅ Port 4000 is available"
fi

# Check port 5000
PORT_5000=$(lsof -ti:5000)
if [ ! -z "$PORT_5000" ]; then
    echo "⚠️  Port 5000 is in use by process $PORT_5000"
    read -p "Kill process on port 5000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PORT_5000
        echo "✅ Process killed"
    fi
else
    echo "✅ Port 5000 is available"
fi

# Check port 3000 (frontend)
PORT_3000=$(lsof -ti:3000)
if [ ! -z "$PORT_3000" ]; then
    echo "⚠️  Port 3000 is in use by process $PORT_3000"
    read -p "Kill process on port 3000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PORT_3000
        echo "✅ Process killed"
    fi
else
    echo "✅ Port 3000 is available"
fi

# Check PostgreSQL
PG_STATUS=$(pg_isready 2>/dev/null || echo "not running")
if [[ $PG_STATUS == *"accepting connections"* ]]; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL is not running"
    echo "   Start it with: brew services start postgresql"
fi

# Check Redis
REDIS_STATUS=$(redis-cli ping 2>/dev/null || echo "not running")
if [[ $REDIS_STATUS == "PONG" ]]; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is not running (optional for caching)"
    echo "   Start it with: brew services start redis"
fi

echo ""
echo "✅ Port check complete!"

