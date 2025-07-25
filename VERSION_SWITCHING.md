# Huly Version Switching Guide

This guide explains how to switch between different versions of Huly frontend and workspace services.

## Overview

The Huly deployment now supports version selection for the frontend and workspace services. This allows you to:

- Deploy specific versions for testing
- Roll back to previous versions if needed
- Try staging versions before production
- Use custom version tags

## Available Versions

### Standard Versions
- **latest** - Latest stable version (default)
- **staging** - Latest staging version with new features
- **v0.6.0** - Current stable version
- **v0.5.0** - Previous stable version
- **v0.4.0** - Older version

### Custom Versions
You can also specify any custom version tag that exists in the Docker registry.

## Usage Methods

### Method 1: Full Deployment with Version Selection

Use the enhanced `deploy.sh` script which now includes version selection:

```bash
# On Linux/Mac
./deploy.sh deploy

# On Windows
./deploy.sh deploy
```

The script will prompt you to select versions for both frontend and workspace services.

### Method 2: Quick Version Switching

Use the dedicated version switching scripts:

```bash
# On Linux/Mac
./switch-versions.sh

# On Windows
switch-versions.bat
```

This method is faster as it only switches the frontend and workspace services without redeploying the entire stack.

## Examples

### Deploy with Staging Versions
```bash
./deploy.sh deploy
# When prompted:
# Frontend version: staging
# Workspace version: staging
```

### Switch to Specific Versions
```bash
./switch-versions.sh
# When prompted:
# Frontend version: v0.5.0
# Workspace version: v0.6.0
```

### Use Custom Version Tags
```bash
./switch-versions.sh
# When prompted:
# Frontend version: custom
# Enter custom frontend version tag: v0.6.1-beta
# Workspace version: custom
# Enter custom workspace version tag: v0.6.1-rc1
```

## Version Compatibility

### Frontend Versions
- **v0.6.0** - Current stable version
- **v0.5.0** - Previous stable version
- **staging** - Latest development version

### Workspace Versions
- **v0.6.0** - Current stable version
- **v0.5.0** - Previous stable version
- **staging** - Latest development version

## Important Notes

### Version Compatibility
- Frontend and workspace versions should generally be compatible
- Using mismatched versions may cause functionality issues
- Staging versions may have breaking changes

### Data Persistence
- Switching versions does not affect your data
- Database, files, and configurations remain intact
- Only the application code changes

### Rollback
If you encounter issues with a new version:

1. Note the current version that's working
2. Switch back to a known good version
3. Check logs for any errors: `./deploy.sh logs`

### Testing Recommendations
1. Always test staging versions in a non-production environment first
2. Keep track of which versions work well for your use case
3. Consider using specific version tags for production deployments

## Troubleshooting

### Version Not Found
If you get an error about a version not being found:

```bash
# Check available tags
docker search hardcoreeng/front
docker search hardcoreeng/workspace

# Pull the latest version
docker pull hardcoreeng/front:latest
docker pull hardcoreeng/workspace:latest
```

### Service Won't Start
If services fail to start after version switch:

```bash
# Check logs
./deploy.sh logs

# Restart services
./deploy.sh restart

# If issues persist, rollback to a known good version
./switch-versions.sh
# Select a previous working version
```

### Database Compatibility
If you encounter database compatibility issues:

1. Check if the new version requires database migrations
2. Consider backing up your data before major version changes
3. Contact support if you need help with migrations

## Script Commands

### deploy.sh Commands
```bash
./deploy.sh deploy    # Full deployment with version selection
./deploy.sh start     # Start services
./deploy.sh stop      # Stop services
./deploy.sh restart   # Restart services
./deploy.sh logs      # View logs
./deploy.sh status    # Check service status
./deploy.sh update    # Update to latest images
./deploy.sh help      # Show help
```

### switch-versions.sh Commands
```bash
./switch-versions.sh switch  # Switch versions (default)
./switch-versions.sh status  # Show current status
./switch-versions.sh help    # Show help
```

## Environment Variables

The version switching respects your existing environment configuration in `.env`:

- `SERVER_SECRET` - Server security key
- `ADMIN_EMAILS` - Admin email addresses
- `FRONT_URL` - Frontend URL
- `MAIL_URL` - Email service configuration

## Support

If you encounter issues with version switching:

1. Check the logs: `./deploy.sh logs`
2. Verify Docker is running: `docker ps`
3. Ensure you have sufficient disk space
4. Check network connectivity for Docker image pulls

For additional support, refer to the main Huly documentation or contact the development team. 