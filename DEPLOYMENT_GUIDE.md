# 🚀 Deployment Guide - Attendance System

This guide explains how to automatically deploy your application when you push to the `main` branch.

---

## Method 1: GitHub Actions (Recommended) ⭐

### Step 1: Set up SSH access to your server

On your **local machine**, generate an SSH key (if you don't have one):

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions"
```

Copy the **public key** to your server:

```bash
ssh-copy-id root@173.212.242.227
```

### Step 2: Add secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these:

| Secret Name | Value | Example |
|------------|-------|---------|
| `SERVER_HOST` | Your server IP or domain | `173.212.242.227` |
| `SERVER_USER` | SSH username | `root` |
| `SERVER_PASSWORD` | SSH password | `your_password` |
| `SERVER_PORT` | SSH port (usually 22) | `22` |

**OR use SSH key instead of password:**
- `SERVER_SSH_KEY`: Paste your **private key** content (from `~/.ssh/id_rsa`)

### Step 3: Enable GitHub Actions

The workflow file `.github/workflows/deploy.yml` is already created.

**Now, when you push to main branch:**
```bash
git add .
git commit -m "Update feature"
git push origin main
```

GitHub Actions will automatically:
- SSH into your server
- Pull latest code
- Install dependencies
- Build frontend
- Restart services
- Reload nginx

### Step 4: View deployment logs

Go to **GitHub** → **Actions** tab to see deployment progress and logs.

---

## Method 2: Manual Script (Simple & Quick)

### Step 1: Set up Git on server

SSH into your server:

```bash
ssh root@173.212.242.227
```

Navigate to project directory and initialize Git:

```bash
cd /www/wwwroot/attendance-system

# If not already a git repo
git init
git remote add origin YOUR_GITHUB_REPO_URL
git pull origin main
```

### Step 2: Make deploy script executable

```bash
chmod +x /www/wwwroot/attendance-system/deploy.sh
```

### Step 3: Deploy manually

Whenever you push changes to GitHub, SSH into server and run:

```bash
ssh root@173.212.242.227
cd /www/wwwroot/attendance-system
./deploy.sh
```

Or create an alias for quick deployment:

```bash
echo 'alias deploy-attendance="cd /www/wwwroot/attendance-system && ./deploy.sh"' >> ~/.bashrc
source ~/.bashrc

# Now just run:
deploy-attendance
```

---

## Method 3: Git Webhook (Automatic from GitHub)

### Step 1: Create webhook endpoint on your server

Create a webhook receiver script:

```bash
nano /www/wwwroot/attendance-system/webhook-server.js
```

Paste this content:

```javascript
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SECRET = 'YOUR_WEBHOOK_SECRET_HERE'; // Match GitHub webhook secret
const PORT = 9000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // Verify signature
      const signature = req.headers['x-hub-signature-256'];
      const hmac = crypto.createHmac('sha256', SECRET);
      const digest = 'sha256=' + hmac.update(body).digest('hex');

      if (signature === digest) {
        console.log('✅ Webhook verified, starting deployment...');

        try {
          execSync('bash /www/wwwroot/attendance-system/deploy.sh', {
            stdio: 'inherit'
          });
          res.writeHead(200);
          res.end('Deployment started');
        } catch (error) {
          console.error('Deployment failed:', error);
          res.writeHead(500);
          res.end('Deployment failed');
        }
      } else {
        console.error('❌ Invalid signature');
        res.writeHead(401);
        res.end('Invalid signature');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🎣 Webhook server listening on port ${PORT}`);
});
```

### Step 2: Start webhook server with PM2

```bash
pm2 start /www/wwwroot/attendance-system/webhook-server.js --name webhook
pm2 save
```

### Step 3: Configure GitHub webhook

1. Go to GitHub repository → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `http://173.212.242.227:9000/webhook`
3. **Content type**: `application/json`
4. **Secret**: `YOUR_WEBHOOK_SECRET_HERE` (same as in script)
5. **Events**: Select "Just the push event"
6. Click **Add webhook**

### Step 4: Open firewall port

```bash
ufw allow 9000/tcp
```

Now every push to `main` branch will automatically trigger deployment!

---

## Method 4: GitLab CI/CD (If using GitLab)

Create `.gitlab-ci.yml` in your project root:

```yaml
stages:
  - deploy

deploy_production:
  stage: deploy
  only:
    - main
  before_script:
    - 'which ssh-agent || ( apt-get update -y && apt-get install openssh-client -y )'
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan 173.212.242.227 >> ~/.ssh/known_hosts
  script:
    - ssh root@173.212.242.227 "cd /www/wwwroot/attendance-system && ./deploy.sh"
```

Add `SSH_PRIVATE_KEY` variable in GitLab CI/CD settings.

---

## Recommended Setup for Your Case

Based on your setup, I recommend **Method 1 (GitHub Actions)** because:

✅ No additional server configuration needed
✅ Easy to set up and monitor
✅ Secure (secrets managed by GitHub)
✅ Deployment logs visible in GitHub
✅ Can add tests before deployment

### Quick Start (GitHub Actions):

1. Add secrets to GitHub repository (SERVER_HOST, SERVER_USER, SERVER_PASSWORD)
2. Push the `.github/workflows/deploy.yml` file to your repo
3. Push to main branch - deployment happens automatically!

---

## Rollback Strategy

If deployment fails, quickly rollback:

```bash
ssh root@173.212.242.227
cd /www/wwwroot/attendance-system

# Check recent commits
git log --oneline -5

# Rollback to previous commit
git reset --hard HEAD~1

# Run deployment
./deploy.sh
```

---

## Monitoring

Check deployment status:

```bash
ssh root@173.212.242.227

# Check PM2 processes
pm2 list
pm2 logs backend --lines 50
pm2 logs frontend --lines 50

# Check nginx logs
tail -f /www/wwwlogs/attendance.error.log

# Check if services are running
netstat -tulpn | grep 5000  # Backend
netstat -tulpn | grep 5001  # Frontend (if applicable)
```

---

## Troubleshooting

### Issue: Permission denied during git pull
```bash
ssh root@173.212.242.227
cd /www/wwwroot/attendance-system
chown -R root:root .
chmod -R 755 .
```

### Issue: PM2 not found
```bash
npm install -g pm2
```

### Issue: Build fails due to memory
```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"
cd /www/wwwroot/attendance-system/FrontEnd
npm run build
```

### Issue: Port already in use
```bash
# Kill process on port
lsof -ti:5000 | xargs kill -9
lsof -ti:5001 | xargs kill -9

# Restart services
pm2 restart all
```

---

## Need Help?

- Check GitHub Actions logs: Repository → Actions tab
- Check server logs: `pm2 logs`
- Check deployment script: `cat deploy.sh`
