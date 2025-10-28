#!/bin/bash

# =============================================
# Deployment Script for Attendance System
# Usage: ./deploy.sh
# =============================================

set -e  # Exit on any error

echo "=========================================="
echo "🚀 Starting Deployment Process"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="/www/wwwroot/attendance-system"
BACKEND_DIR="$PROJECT_DIR/BackEnd"
FRONTEND_DIR="$PROJECT_DIR/FrontEnd"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Navigate to project directory
cd $PROJECT_DIR || { print_error "Failed to navigate to project directory"; exit 1; }

# Pull latest changes
print_info "Pulling latest changes from main branch..."
git fetch origin
git reset --hard origin/main
print_success "Code updated successfully"

# Backend deployment
print_info "Deploying backend..."
cd $BACKEND_DIR

# Backup .env file
if [ -f .env ]; then
    cp .env .env.backup
    print_success "Backend .env backed up"
fi

# Install dependencies
print_info "Installing backend dependencies..."
npm install --legacy-peer-deps
print_success "Backend dependencies installed"

# Restore .env if needed
if [ -f .env.backup ]; then
    mv .env.backup .env
fi

# Frontend deployment
print_info "Deploying frontend..."
cd $FRONTEND_DIR

# Backup .env file
if [ -f .env ]; then
    cp .env .env.backup
    print_success "Frontend .env backed up"
fi

# Install dependencies
print_info "Installing frontend dependencies..."
npm install --legacy-peer-deps
print_success "Frontend dependencies installed"

# Build frontend
print_info "Building frontend for production..."
npm run build
print_success "Frontend built successfully"

# Restore .env if needed
if [ -f .env.backup ]; then
    mv .env.backup .env
fi

# Restart services with PM2
print_info "Restarting services..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Restart backend
pm2 restart backend 2>/dev/null || pm2 start $BACKEND_DIR/server.js --name backend
print_success "Backend restarted"

# Optional: Restart frontend if running as dev server
# pm2 restart frontend 2>/dev/null || pm2 start npm --name frontend -- run dev -- --port 5001 --host 0.0.0.0

# Reload nginx
print_info "Reloading nginx..."
if command -v nginx &> /dev/null; then
    nginx -t && nginx -s reload
    print_success "Nginx reloaded"
else
    print_info "Nginx not found, skipping reload"
fi

# Save PM2 configuration
pm2 save

echo ""
echo "=========================================="
print_success "🎉 Deployment Completed Successfully!"
echo "=========================================="
echo ""
print_info "Backend: http://localhost:5000"
print_info "Frontend: https://attendance.itsignaturepvtltd.com"
echo ""

# Show PM2 status
print_info "Current PM2 processes:"
pm2 list
