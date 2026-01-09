#!/bin/bash
set -e

echo "Setting up Document Management System..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed. Run: npm install -g pnpm" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "Node.js 22 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "Node.js version: $(node -v)"
echo "pnpm version: $(pnpm -v)"

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please update .env with your configuration"
fi

# Start Docker services
echo "Starting Docker services..."
docker compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U dms_user -d dms_dev; do
    sleep 2
done

# Generate Prisma client
echo "Generating Prisma client..."
pnpm db:generate

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Seed the database
echo "Seeding database..."
pnpm db:seed

echo ""
echo "Setup complete!"
echo ""
echo "To start development servers, run:"
echo "  pnpm dev"
echo ""
echo "Services:"
echo "  Web:     http://localhost:3000"
echo "  API:     http://localhost:4000"
echo "  Swagger: http://localhost:4000/api/docs"
echo "  MinIO:   http://localhost:9001 (minioadmin/minioadmin)"
echo "  MailHog: http://localhost:8025"
