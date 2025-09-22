#!/bin/bash

# Frontend Azure Deployment Script
# This script deploys the Onetech frontend to Azure Container Instances

set -e

# Configuration
RESOURCE_GROUP="onetech-backend-rg"
CONTAINER_GROUP="onetech-frontend"
ACR_NAME="onetechregistry"
IMAGE_NAME="onetech-frontend"
LOCATION="East US"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Onetech Frontend deployment to Azure...${NC}"

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

# Get ACR login server
echo -e "${YELLOW}🔍 Getting ACR login server...${NC}"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "loginServer" --output tsv)

if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo -e "${RED}❌ Failed to get ACR login server. Please check your configuration.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ ACR Login Server: $ACR_LOGIN_SERVER${NC}"

# Get ACR credentials
echo -e "${YELLOW}🔑 Getting ACR credentials...${NC}"
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "username" --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "passwords[0].value" --output tsv)

# Build and push Docker image
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"

# Use environment variables from .env file
BACKEND_API_URL="http://onetech-backend-gdl7h722ruzvs.francecentral.azurecontainer.io:8000"
MONGODB_URI="mongodb+srv://habib79:wP04ICrcwg1XsNY7@personal.retbtbr.mongodb.net/onetech"
NEXTAUTH_SECRET="your-nextauth-secret-here"

echo -e "${GREEN}Using Backend API URL: $BACKEND_API_URL${NC}"
echo -e "${GREEN}Using MongoDB URI: ${MONGODB_URI:0:20}...${NC}"

# Build with build arguments for AMD64 platform (Azure compatibility)
docker build \
  --platform linux/amd64 \
  --build-arg MONGODB_URI="$MONGODB_URI" \
  --build-arg NEXT_PUBLIC_API_URL="$BACKEND_API_URL" \
  --build-arg NEXT_PUBLIC_EXTRACT_API="$BACKEND_API_URL/extract/" \
  --build-arg NEXT_PUBLIC_BACKEND_URL="$BACKEND_API_URL" \
  -t $ACR_LOGIN_SERVER/$IMAGE_NAME:latest .

echo -e "${YELLOW}📤 Pushing Docker image to ACR...${NC}"
az acr login --name $ACR_NAME
docker push $ACR_LOGIN_SERVER/$IMAGE_NAME:latest

# Deploy to Azure Container Instances
echo -e "${YELLOW}🚀 Deploying to Azure Container Instances...${NC}"

az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file azure-deployment/aci-template.json \
  --parameters \
    containerGroupName=$CONTAINER_GROUP \
    containerImageName=$ACR_LOGIN_SERVER/$IMAGE_NAME:latest \
    registryServer=$ACR_LOGIN_SERVER \
    registryUsername=$ACR_USERNAME \
    registryPassword=$ACR_PASSWORD \
    backendApiUrl="$BACKEND_API_URL" \
    mongodbUri="$MONGODB_URI" \
    nextAuthSecret="$NEXTAUTH_SECRET"

# Get deployment URL
echo -e "${YELLOW}🔍 Getting deployment URL...${NC}"
CONTAINER_FQDN=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name aci-template \
  --query "properties.outputs.containerFQDN.value" \
  --output tsv)

if [ -n "$CONTAINER_FQDN" ]; then
    echo -e "${GREEN}🌐 Frontend deployed successfully!${NC}"
    echo -e "${GREEN}🌐 Application URL: http://$CONTAINER_FQDN:3000${NC}"
else
    echo -e "${RED}❌ Failed to get deployment URL. Please check the Azure portal.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"