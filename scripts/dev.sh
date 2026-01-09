#!/bin/bash
set -e

echo "Starting development environment..."

# Ensure Docker services are running
echo "Starting Docker services..."
docker compose up -d

# Wait for services
echo "Waiting for services to be ready..."
sleep 3

# Start development servers
echo "Starting development servers..."
pnpm dev
