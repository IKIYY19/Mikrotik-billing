#!/bin/bash

# MikroTik Config Builder - Quick Deploy Script
# Run this on your VPS: curl -sL <raw-url> | bash

set -e

echo "================================================"
echo "  MikroTik Config Builder - Quick Deploy"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed!"
    echo ""
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "⚠️  Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed!"
    echo ""
fi

# Detect docker compose command (V1 or V2)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "📁 Setting up MikroTik Config Builder..."
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔐 Creating environment file..."
    cp .env.example .env
    
    # Generate secure keys
    if command -v openssl &> /dev/null; then
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 32)/" .env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 64)/" .env
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env
        echo "✅ Secure keys generated!"
    else
        echo "⚠️  openssl not found. Please update .env with secure keys manually."
    fi
    echo ""
fi

echo "🚀 Building and starting services..."
$DOCKER_COMPOSE -f docker-compose-simple.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE -f docker-compose-simple.yml ps

echo ""
echo "================================================"
echo "  ✅ Deployment Complete!"
echo "================================================"
echo ""
echo "🌐 Access your app: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📝 Useful commands:"
echo "   View logs:          $DOCKER_COMPOSE -f docker-compose-simple.yml logs -f"
echo "   Restart:            $DOCKER_COMPOSE -f docker-compose-simple.yml restart"
echo "   Stop:               $DOCKER_COMPOSE -f docker-compose-simple.yml down"
echo "   Update:             git pull && $DOCKER_COMPOSE -f docker-compose-simple.yml up -d --build"
echo ""
echo "📖 Full documentation: DEPLOYMENT.md"
echo ""
