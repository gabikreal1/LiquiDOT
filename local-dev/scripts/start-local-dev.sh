#!/bin/bash

echo "🌐 Starting LiquiDOT local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start the local nodes and services
echo "📦 Starting local nodes and services..."
docker-compose up -d

# Wait for nodes to be ready
echo "⏳ Waiting for nodes to be ready..."
sleep 30

# Check if nodes are responding
echo "🔍 Checking node connectivity..."

# Check Asset Hub
if curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
    http://localhost:9944 > /dev/null 2>&1; then
    echo "✅ Asset Hub local node is running"
else
    echo "❌ Asset Hub local node is not responding"
fi

# Check Moonbeam
if curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
    http://localhost:9945 > /dev/null 2>&1; then
    echo "✅ Moonbeam local node is running"
else
    echo "❌ Moonbeam local node is not responding"
fi

# Check PostgreSQL
if docker exec liquidot-postgres pg_isready -U liquidot_user > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not responding"
fi

# Check Redis
if docker exec liquidot-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not responding"
fi

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📊 Service URLs:"
echo "   Asset Hub RPC: ws://localhost:9944"
echo "   Moonbeam RPC:  ws://localhost:9945"
echo "   PostgreSQL:     localhost:5432"
echo "   Redis:         localhost:6379"
echo "   XCM Relayer:   http://localhost:8000"
echo ""
echo "🔧 Next steps:"
echo "   1. Deploy contracts to local nodes"
echo "   2. Run backend services"
echo "   3. Start frontend development server"
echo ""
echo "📝 To stop the environment: docker-compose down" 