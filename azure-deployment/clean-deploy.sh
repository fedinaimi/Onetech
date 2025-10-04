#!/bin/bash

# Clean deployment script - removes all caches and forces fresh build
# Use this when changes aren't appearing in production

set -e

# Configuration
RESOURCE_GROUP="onetech-backend-rg"
CONTAINER_GROUP="onetech-frontend"
ACR_NAME="onetechregistry"
IMAGE_NAME="onetech-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧹 Starting CLEAN deployment (removes all caches)...${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please login...${NC}"
    az login
fi

# Clean Docker cache
echo -e "${YELLOW}🧹 Cleaning Docker cache...${NC}"
docker system prune -f --volumes || true
docker builder prune -f || true

# Clean npm cache
echo -e "${YELLOW}🧹 Cleaning npm cache...${NC}"
npm cache clean --force || true

# Remove node_modules and rebuild
echo -e "${YELLOW}🧹 Rebuilding dependencies...${NC}"
rm -rf node_modules package-lock.json || true
npm install

# Get ACR login server
echo -e "${YELLOW}🔍 Getting ACR login server...${NC}"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "loginServer" --output tsv)

# Remove all images from ACR with this name
echo -e "${YELLOW}🗑️  Cleaning old images from ACR...${NC}"
az acr repository delete --name $ACR_NAME --repository $IMAGE_NAME --yes || echo -e "${YELLOW}⚠️  No existing images to delete${NC}"

# Now run the normal deployment
echo -e "${GREEN}🚀 Running fresh deployment...${NC}"
./azure-deployment/deploy.sh

echo -e "${GREEN}✅ Clean deployment completed!${NC}"
echo -e "${YELLOW}💡 If you still see old content, try hard refresh (Ctrl+F5) in your browser${NC}"