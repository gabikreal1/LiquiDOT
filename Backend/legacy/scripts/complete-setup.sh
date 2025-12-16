#!/bin/bash

# 🚀 LiquiDOT Backend - Complete Setup Script
# Run this after extracting ABIs to get fully running system

set -e

echo "🔧 LiquiDOT Backend - Complete Setup"
echo "====================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the Backend directory"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1/6: Installing dependencies..."
npm install

# Step 2: Check for ABIs
echo ""
echo "📝 Step 2/6: Checking contract ABIs..."
if grep -q "Placeholder" src/modules/blockchain/abis/AssetHubVault.abi.ts; then
    echo "⚠️  Warning: ABIs are still placeholders!"
    echo "   Run: ./extract-abis.sh"
    echo "   Or manually copy ABIs from compiled contracts"
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ ABIs look good!"
fi

# Step 3: Check environment
echo ""
echo "🔐 Step 3/6: Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "❗ IMPORTANT: Edit .env with your contract addresses and keys!"
    read -p "   Press Enter after editing .env..." 
fi

# Step 4: Start PostgreSQL
echo ""
echo "🐘 Step 4/6: Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "   Waiting for database to be ready..."
sleep 5

# Step 5: Run migrations
echo ""
echo "🗄️  Step 5/6: Setting up database..."
echo "   Generating migration..."
npm run typeorm migration:generate -- src/migrations/InitialSchema || true

echo "   Running migrations..."
npm run typeorm migration:run || true

# Step 6: Start backend
echo ""
echo "🚀 Step 6/6: Starting backend..."
echo ""
echo "✅ Setup complete! Backend starting..."
echo ""
echo "📍 Endpoints:"
echo "   - Health: http://localhost:3001/api/health"
echo "   - API:    http://localhost:3001/api"
echo ""
echo "📊 Database:"
echo "   - Host: localhost:5432"
echo "   - DB:   liquidot_db"
echo ""
echo "🛠️  Development:"
echo "   - Logs: docker-compose logs -f backend"
echo "   - Stop: docker-compose down"
echo ""

npm run start:dev
