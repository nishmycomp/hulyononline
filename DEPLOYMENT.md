# Huly Production Deployment Guide

This guide will help you deploy Huly on your AlmaLinux cPanel server using Docker containers.

## 📋 Prerequisites

Before deploying Huly, ensure your server meets these requirements:

### System Requirements
- **OS**: AlmaLinux (or RHEL-based distro)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 50GB+ free space
- **Ports**: Ensure these ports are available (all moved to 15000+ range to avoid conflicts):
  - 15087 (Frontend)
  - 15000 (Account Service)
  - 15333 (Workspace Service)
  - 15900 (Stats Service)
  - 15432, 15433 (CockroachDB)
  - 15100, 15101 (MinIO)
  - 15200 (Elasticsearch)
  - 15081, 15082, 15092, 15044 (Redpanda)

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git

## 🚀 Quick Start

### 1. Install Docker (if not already installed)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Clone Your Repository

```bash
# Clone your repository containing the deployment files
git clone https://github.com/yourusername/your-huly-deployment.git
cd your-huly-deployment

# OR if you're setting up manually, create these files:
# - docker-compose.production.yml
# - environment.production
# - deploy.sh
```

### 3. Configure Environment

```bash
# Copy the environment template
cp environment.production .env

# Edit the configuration file
nano .env
```

**Important**: Update these values in `.env`:
- `SERVER_SECRET`: Use a strong, unique secret
- `DOMAIN`: Your server's domain or IP address
- `FRONT_URL`: Full URL where users will access Huly
- `ADMIN_EMAILS`: Your admin email address
- `MINIO_ROOT_USER` & `MINIO_ROOT_PASSWORD`: Change from defaults

### 4. Deploy Huly

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh deploy
```

### 5. Access Your Huly Instance

Once deployed, access Huly at:
- **Main Application**: `http://your-domain.com:15087`
- **Database Admin**: `http://your-domain.com:15433`
- **File Storage Admin**: `http://your-domain.com:15101`

## 🛠 Management Commands

The deployment script provides several management commands:

```bash
# Start services
./deploy.sh start

# Stop services
./deploy.sh stop

# Restart services
./deploy.sh restart

# View logs
./deploy.sh logs

# Check service status
./deploy.sh status

# Update to latest versions
./deploy.sh update
```

## 🔒 Security Configuration

### 1. Firewall Setup

Configure your firewall to allow necessary ports:

```bash
# For AlmaLinux/RHEL with firewalld
sudo firewall-cmd --permanent --add-port=15087/tcp  # Frontend
sudo firewall-cmd --permanent --add-port=15000/tcp  # Account API
sudo firewall-cmd --permanent --add-port=15101/tcp  # MinIO Console
sudo firewall-cmd --permanent --add-port=15433/tcp  # DB Admin
sudo firewall-cmd --reload

# For systems with iptables
sudo iptables -A INPUT -p tcp --dport 15087 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 15000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 15101 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 15433 -j ACCEPT
```

### 2. SSL/TLS Setup (Recommended)

For production, set up SSL certificates:

1. **Using Let's Encrypt with Nginx**:

```bash
# Install Nginx
sudo dnf install nginx

# Install Certbot
sudo dnf install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Create Nginx config for Huly
sudo nano /etc/nginx/conf.d/huly.conf
```

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8087;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Change Default Passwords

After deployment, immediately change:
- MinIO admin credentials (via MinIO console at port 9001)
- Server secret in `.env` file
- Any default database passwords

## 📧 Email Configuration

To enable email notifications (password reset, etc.), configure the `MAIL_URL` in your `.env` file:

```bash
# SMTP configuration examples:
MAIL_URL=smtp://username:password@smtp.gmail.com:587
MAIL_URL=smtp://username:password@smtp.office365.com:587
MAIL_URL=smtp://username:password@your-smtp-server.com:587
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**:
   ```bash
   # Check if ports are in use
   sudo netstat -tlnp | grep :8087
   
   # Modify ports in docker-compose.production.yml if needed
   ```

2. **Docker Permission Issues**:
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Services Not Starting**:
   ```bash
   # Check logs
   ./deploy.sh logs
   
   # Check individual service status
   docker-compose -f docker-compose.production.yml ps
   ```

4. **Database Connection Issues**:
   ```bash
   # Check CockroachDB status
   docker exec -it huly-cockroach-1 ./cockroach sql --insecure
   ```

### Log Locations

- **Application logs**: `./deploy.sh logs`
- **Docker logs**: `/var/lib/docker/containers/`
- **System logs**: `/var/log/messages`

## 🔄 Backup and Updates

### Backup

Regular backups are crucial. The deployment creates persistent volumes for:
- Database: `cockroach_data`
- Files: `minio_data`
- Search index: `elastic_data`
- Message queue: `redpanda_data`

```bash
# Backup script example
docker run --rm -v $(pwd):/backup -v huly_cockroach_data:/data alpine tar czf /backup/cockroach-backup-$(date +%Y%m%d).tar.gz /data
docker run --rm -v $(pwd):/backup -v huly_minio_data:/data alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data
```

### Updates

```bash
# Update to latest versions
./deploy.sh update
```

## 📊 Monitoring

Monitor your Huly instance:

1. **CockroachDB Admin**: `http://your-domain.com:15433`
2. **MinIO Console**: `http://your-domain.com:15101`
3. **Application logs**: `./deploy.sh logs`

## 🆘 Support

If you encounter issues:

1. Check the [Huly GitHub Issues](https://github.com/hcengineering/platform/issues)
2. Review the logs: `./deploy.sh logs`
3. Check the [official documentation](https://github.com/hcengineering/platform)

## 📝 License

This deployment configuration is provided as-is. Huly platform follows the [EPL-2.0 license](https://github.com/hcengineering/platform/blob/main/LICENSE).

---

**Note**: This deployment is suitable for production use but requires proper security hardening for internet-facing deployments. 