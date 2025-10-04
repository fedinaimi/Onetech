#!/bin/bash

# Quick restart script for Azure Container Instances
# Use this when you want to force restart without rebuilding

set -e

# Configuration
RESOURCE_GROUP="onetech-backend-rg"
CONTAINER_GROUP="onetech-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Restarting Onetech Frontend container...${NC}"

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

# Restart the container group
echo -e "${YELLOW}🔄 Restarting container group...${NC}"
az container restart \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_GROUP

# Get deployment URL
echo -e "${YELLOW}🔍 Getting deployment URL...${NC}"
CONTAINER_FQDN=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name aci-template \
  --query "properties.outputs.containerFQDN.value" \
  --output tsv 2>/dev/null || echo "")

if [ -n "$CONTAINER_FQDN" ]; then
    echo -e "${GREEN}🌐 Container restarted successfully!${NC}"
    echo -e "${GREEN}🌐 Application URL: http://$CONTAINER_FQDN:3000${NC}"
    echo -e "${YELLOW}💡 Please wait 2-3 minutes for the container to fully start${NC}"
else
    echo -e "${YELLOW}⚠️  Container restarted but couldn't get URL. Check Azure portal.${NC}"
fi

echo -e "${GREEN}✅ Restart completed!${NC}"