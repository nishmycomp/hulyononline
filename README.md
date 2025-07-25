# Huly Server Deployment

This repository contains production-ready deployment files for the Huly project management platform.

## 🚀 Quick Deploy

```bash
git clone https://github.com/yourusername/huly-server.git
cd huly-server
cp environment.production .env
# Edit .env with your settings
./deploy.sh deploy
```

## 📁 Files

- `docker-compose.production.yml` - Production Docker Compose configuration
- `environment.production` - Environment template
- `deploy.sh` - Deployment and management script
- `DEPLOYMENT.md` - Comprehensive deployment guide

## 🔧 Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 50GB+ storage

## 📖 Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete setup instructions.

## 🌐 Access Points

After deployment:
- **Frontend**: http://your-server:15087
- **Database Admin**: http://your-server:15433
- **File Storage**: http://your-server:15101

## 🆘 Support

For issues with:
- **Deployment**: Check this repository's issues
- **Huly Platform**: Visit [Huly GitHub](https://github.com/hcengineering/platform)

## 📄 License

Deployment configuration is MIT licensed. Huly platform uses EPL-2.0 license.
