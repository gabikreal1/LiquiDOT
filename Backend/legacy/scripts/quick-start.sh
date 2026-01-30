#!/bin/bash

# LiquiDOT Quick Start Script
# One-command deployment for local development

set -e

echo "🚀 LiquiDOT Quick Start"
echo "======================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}➜${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed!"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running!"
    echo "Please start Docker Desktop"
    exit 1
fi

print_step "Docker is running ✓"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    print_step "Creating from template..."
    cp .env.example .env
    
    echo ""
    print_warning "⚠️  IMPORTANT: You need to configure your .env file!"
    echo ""
    echo "Please add your contract addresses:"
    echo "  1. ASSET_HUB_VAULT_ADDRESS=0x..."
    echo "  2. XCM_PROXY_ADDRESS=0x..."
    echo "  3. OPERATOR_PRIVATE_KEY=0x..."
    echo ""
    
    read -p "Do you want to edit .env now? [Y/n]: " edit_env
    if [[ $edit_env != "n" && $edit_env != "N" ]]; then
        ${EDITOR:-nano} .env
    else
        print_warning "Remember to edit .env before the backend will work properly!"
    fi
fi

# Stop existing containers
print_step "Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Pull latest images
print_step "Pulling required images..."
docker-compose pull postgres

# Build backend
print_step "Building backend image..."
docker-compose build backend

# Start services
print_step "Starting services..."
docker-compose up -d

# Wait for services to be healthy
print_info "Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U liquidot > /dev/null 2>&1; then
        print_step "PostgreSQL is ready ✓"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start"
        docker-compose logs postgres
        exit 1
    fi
    sleep 1
done

# Check backend
for i in {1..30}; do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
        print_step "Backend is ready ✓"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend failed to start"
        echo ""
        echo "Checking logs:"
        docker-compose logs backend
        exit 1
    fi
    sleep 1
done

# Success!
echo ""
echo "✅ ${GREEN}LiquiDOT is running!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Services:"
echo "   Backend API:  http://localhost:3001"
echo "   PostgreSQL:   localhost:5432"
echo "   Health Check: http://localhost:3001/api/health"
echo ""
echo "📊 Useful commands:"
echo "   View logs:        docker-compose logs -f backend"
echo "   Stop services:    docker-compose down"
echo "   Restart:          docker-compose restart backend"
echo "   Check status:     docker-compose ps"
echo ""
echo "🧪 Test API:"
echo "   curl http://localhost:3001/api/health"
echo "   curl http://localhost:3001/api/pools"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show running services
print_info "Running services:"
docker-compose ps

echo ""
print_info "For more details, see: SIMPLE_DEPLOYMENT.md"
echo ""
