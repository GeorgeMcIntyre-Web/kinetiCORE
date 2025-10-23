#!/bin/bash

# Cloudflare R2 Setup Script
# Date: 2025-10-23
# Description: Automated setup for R2 asset storage

set -e  # Exit on error

echo "🚀 kinetiCORE - Cloudflare R2 Setup"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found${NC}"
    echo "Installing wrangler..."
    npm install -g wrangler
fi

echo -e "${GREEN}✅ Wrangler CLI found${NC}"
echo ""

# Step 1: Login to Cloudflare
echo "Step 1: Login to Cloudflare"
echo "----------------------------"
wrangler login
echo ""

# Step 2: Create R2 Buckets
echo "Step 2: Create R2 Buckets"
echo "-------------------------"

# Check if production bucket exists
if wrangler r2 bucket list | grep -q "kineticore-assets"; then
    echo -e "${YELLOW}⚠️  Production bucket 'kineticore-assets' already exists${NC}"
else
    echo "Creating production bucket..."
    wrangler r2 bucket create kineticore-assets
    echo -e "${GREEN}✅ Created production bucket${NC}"
fi

# Check if preview bucket exists
if wrangler r2 bucket list | grep -q "kineticore-assets-preview"; then
    echo -e "${YELLOW}⚠️  Preview bucket 'kineticore-assets-preview' already exists${NC}"
else
    echo "Creating preview bucket..."
    wrangler r2 bucket create kineticore-assets-preview
    echo -e "${GREEN}✅ Created preview bucket${NC}"
fi

echo ""

# Step 3: Deploy Worker
echo "Step 3: Deploy Cloudflare Worker"
echo "---------------------------------"
cd cloudflare/kineticore-supabase-proxy

echo "Deploying worker..."
wrangler deploy

echo -e "${GREEN}✅ Worker deployed${NC}"
echo ""

# Step 4: Get Worker URL
echo "Step 4: Worker URL"
echo "------------------"
WORKER_URL=$(wrangler deployments list --name kineticore-supabase-proxy 2>/dev/null | grep -oP 'https://[^\s]+' | head -1)

if [ -z "$WORKER_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not auto-detect worker URL${NC}"
    echo "Please check Cloudflare dashboard for your worker URL"
    WORKER_URL="https://kineticore-supabase-proxy.YOUR-SUBDOMAIN.workers.dev"
else
    echo -e "${GREEN}✅ Worker URL: $WORKER_URL${NC}"
fi

echo ""

# Step 5: Update Environment Variables
echo "Step 5: Update Environment Variables"
echo "-------------------------------------"

cd ../..

if [ -f ".env" ]; then
    # Check if VITE_WORKER_URL already exists
    if grep -q "VITE_WORKER_URL" .env; then
        echo -e "${YELLOW}⚠️  VITE_WORKER_URL already exists in .env${NC}"
        echo "Current value:"
        grep "VITE_WORKER_URL" .env
        echo ""
        read -p "Update to $WORKER_URL? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sed -i.bak "s|VITE_WORKER_URL=.*|VITE_WORKER_URL=$WORKER_URL|" .env
            echo -e "${GREEN}✅ Updated .env${NC}"
        fi
    else
        echo "VITE_WORKER_URL=$WORKER_URL" >> .env
        echo -e "${GREEN}✅ Added VITE_WORKER_URL to .env${NC}"
    fi
else
    echo "VITE_WORKER_URL=$WORKER_URL" > .env
    echo -e "${GREEN}✅ Created .env with VITE_WORKER_URL${NC}"
fi

echo ""

# Step 6: Test Connection
echo "Step 6: Test Connection"
echo "-----------------------"

echo "Testing worker endpoint..."
TEST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $WORKER_URL)

if [ "$TEST_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✅ Worker is responding (HTTP 200)${NC}"
else
    echo -e "${YELLOW}⚠️  Worker returned HTTP $TEST_RESPONSE${NC}"
fi

echo ""

# Summary
echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Run database migration:"
echo "   ${GREEN}supabase db push${NC}"
echo ""
echo "2. Test file upload:"
echo "   ${GREEN}npm run test:upload${NC}"
echo ""
echo "3. Start development server:"
echo "   ${GREEN}npm run dev${NC}"
echo ""
echo "Worker URL: ${GREEN}$WORKER_URL${NC}"
echo "R2 Buckets:"
echo "  - Production: ${GREEN}kineticore-assets${NC}"
echo "  - Preview: ${GREEN}kineticore-assets-preview${NC}"
echo ""
echo "Documentation: ${GREEN}/workspace/docs/R2_SETUP_GUIDE.md${NC}"
echo ""
