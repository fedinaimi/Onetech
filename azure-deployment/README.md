# Onetech Frontend Azure Deployment

This directory contains the Azure deployment configuration for the Onetech Document Extractor frontend application.

## Prerequisites

- Azure CLI installed and configured
- Docker installed
- Access to the Azure Container Registry (`onetechregistry`)
- Proper Azure permissions for the resource group

## Files

- `aci-template.json` - Azure Resource Manager template for Container Instances
- `aci-parameters.json` - Template parameters (example values)
- `deploy.sh` - Linux/macOS deployment script
- `deploy.ps1` - Windows PowerShell deployment script

## GitHub Actions Secrets

The following secrets need to be configured in your GitHub repository:

### Azure Authentication
- `AZURE_CREDENTIALS` - Azure service principal credentials (JSON format)

### Application Configuration
- `NEXT_PUBLIC_API_URL` - Public URL of the backend API (for build time)
- `BACKEND_API_URL` - Backend API URL (for runtime)
- `MONGODB_URI` - MongoDB connection string
- `NEXTAUTH_SECRET` - NextAuth.js secret key

## Manual Deployment

### Using Shell Script (Linux/macOS)
```bash
cd azure-deployment
./deploy.sh
```

### Using PowerShell Script (Windows)
```powershell
cd azure-deployment
.\deploy.ps1
```

### Using Azure CLI Directly
```bash
# Login to Azure
az login

# Deploy using ARM template
az deployment group create \
  --resource-group onetech-backend-rg \
  --template-file aci-template.json \
  --parameters @aci-parameters.json
```

## Deployment Architecture

The frontend is deployed to the same resource group as the backend (`onetech-backend-rg`) but uses a separate container group (`onetech-frontend`). This allows:

- Shared resource management
- Cost optimization
- Simplified networking between frontend and backend

## Container Configuration

- **Port**: 3000 (Next.js default)
- **CPU**: 1.0 cores
- **Memory**: 2.0 GB
- **Restart Policy**: Always
- **OS Type**: Linux

## Environment Variables

The following environment variables are configured in the container:

- `NEXT_PUBLIC_API_URL` - Backend API URL for client-side requests
- `MONGODB_URI` - Database connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Application URL for NextAuth.js
- `NODE_ENV` - Set to "production"

## Networking

The container is deployed with a public IP address and a unique DNS name following the pattern:
`onetech-frontend-{uniqueString}.{region}.azurecontainer.io:3000`

## Monitoring

You can monitor the deployment status through:

1. Azure Portal - Container Instances
2. Azure CLI: `az container show --resource-group onetech-backend-rg --name onetech-frontend`
3. Container logs: `az container logs --resource-group onetech-backend-rg --name onetech-frontend`

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Node.js version compatibility and dependencies
2. **Container Start Issues**: Verify environment variables and secrets
3. **Networking Issues**: Ensure backend API URL is accessible
4. **Permission Issues**: Verify Azure credentials and resource group access

### Debugging Commands

```bash
# Check container status
az container show --resource-group onetech-backend-rg --name onetech-frontend

# View container logs
az container logs --resource-group onetech-backend-rg --name onetech-frontend

# Restart container
az container restart --resource-group onetech-backend-rg --name onetech-frontend
```

## Cost Optimization

- The container uses basic tier resources suitable for development/testing
- For production, consider upgrading to higher-tier resources or Azure App Service
- Monitor usage through Azure Cost Management

## Security

- Sensitive values are stored as secure parameters
- Container registry credentials are managed through Azure AD
- Environment variables containing secrets are marked as secure