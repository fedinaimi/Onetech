# Frontend Azure Deployment PowerShell Script
# This script deploys the Onetech frontend to Azure Container Instances

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "onetech-backend-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerGroup = "onetech-frontend",
    
    [Parameter(Mandatory=$false)]
    [string]$AcrName = "onetechregistry",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "onetech-frontend",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US"
)

Write-Host "🚀 Starting Onetech Frontend deployment to Azure..." -ForegroundColor Green

# Check if Azure CLI is installed
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if logged in to Azure
try {
    az account show | Out-Null
} catch {
    Write-Host "⚠️  Not logged in to Azure. Please login..." -ForegroundColor Yellow
    az login
}

# Get ACR login server
Write-Host "🔍 Getting ACR login server..." -ForegroundColor Yellow
$AcrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroup --query "loginServer" --output tsv

if (-not $AcrLoginServer) {
    Write-Host "❌ Failed to get ACR login server. Please check your configuration." -ForegroundColor Red
    exit 1
}

Write-Host "✅ ACR Login Server: $AcrLoginServer" -ForegroundColor Green

# Get ACR credentials
Write-Host "🔑 Getting ACR credentials..." -ForegroundColor Yellow
$AcrUsername = az acr credential show --name $AcrName --resource-group $ResourceGroup --query "username" --output tsv
$AcrPassword = az acr credential show --name $AcrName --resource-group $ResourceGroup --query "passwords[0].value" --output tsv

# Build and push Docker image
Write-Host "🏗️  Building Docker image..." -ForegroundColor Yellow
docker build -t "$AcrLoginServer/$ImageName`:latest" .

Write-Host "📤 Pushing Docker image to ACR..." -ForegroundColor Yellow
az acr login --name $AcrName
docker push "$AcrLoginServer/$ImageName`:latest"

# Deploy to Azure Container Instances
Write-Host "🚀 Deploying to Azure Container Instances..." -ForegroundColor Yellow

# Prompt for required secrets
$BackendApiUrl = Read-Host "Enter Backend API URL"
$MongodbUri = Read-Host "Enter MongoDB URI" -AsSecureString
$NextAuthSecret = Read-Host "Enter NextAuth Secret" -AsSecureString

# Convert secure strings to plain text for deployment
$MongodbUriPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($MongodbUri))
$NextAuthSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($NextAuthSecret))

az deployment group create `
  --resource-group $ResourceGroup `
  --template-file azure-deployment/aci-template.json `
  --parameters `
    containerGroupName=$ContainerGroup `
    containerImageName="$AcrLoginServer/$ImageName`:latest" `
    registryServer=$AcrLoginServer `
    registryUsername=$AcrUsername `
    registryPassword=$AcrPassword `
    backendApiUrl=$BackendApiUrl `
    mongodbUri=$MongodbUriPlain `
    nextAuthSecret=$NextAuthSecretPlain

# Get deployment URL
Write-Host "🔍 Getting deployment URL..." -ForegroundColor Yellow
$ContainerFqdn = az deployment group show `
  --resource-group $ResourceGroup `
  --name aci-template `
  --query "properties.outputs.containerFQDN.value" `
  --output tsv

if ($ContainerFqdn) {
    Write-Host "🌐 Frontend deployed successfully!" -ForegroundColor Green
    Write-Host "🌐 Application URL: http://$ContainerFqdn`:3000" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to get deployment URL. Please check the Azure portal." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green