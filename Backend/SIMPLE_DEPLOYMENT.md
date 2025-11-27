# 🚀 Simple Deployment Guide (Grant Submission)

Quick and easy deployment guide for LiquiDOT - optimized for grant demonstration.

---

## 📦 Quick Local Setup (5 minutes)

### Prerequisites
- Docker Desktop installed
- Node.js 20+ installed

### Steps

1. **Clone and Navigate**
   ```bash
   cd Backend
   ```

2. **Create Environment File**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with Your Contract Addresses**
   ```bash
   nano .env
   ```
   
   Update these required values:
   ```bash
   # Database (can leave as-is for local dev)
   DB_PASSWORD=liquidot123
   
   # Your deployed contracts
   ASSET_HUB_VAULT_ADDRESS=0xYourVaultAddress
   XCM_PROXY_ADDRESS=0xYourProxyAddress
   OPERATOR_PRIVATE_KEY=0xYourOperatorPrivateKey
   
   # RPCs (defaults are fine)
   ASSET_HUB_RPC_URL=wss://polkadot-asset-hub-rpc.polkadot.io
   MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
   ```

4. **Start Everything**
   ```bash
   docker-compose up -d
   ```

5. **Check Status**
   ```bash
   docker-compose ps
   ```

6. **Test API**
   ```bash
   curl http://localhost:3001/api/health
   ```

**Done! 🎉** Your backend is running at `http://localhost:3001`

---

## 🌐 Simple AWS Deployment (20 minutes)

### Prerequisites
- AWS Account
- AWS CLI installed and configured

### Option A: Single EC2 Instance (Simplest)

1. **Launch EC2 Instance**
   ```bash
   # Use AWS Console or CLI
   aws ec2 run-instances \
     --image-id ami-0c55b159cbfafe1f0 \
     --instance-type t3.medium \
     --key-name your-key-pair \
     --security-group-ids sg-xxxxxxxxx \
     --subnet-id subnet-xxxxxxxxx
   ```

2. **SSH into Instance**
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

3. **Install Docker**
   ```bash
   sudo yum update -y
   sudo yum install docker -y
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

4. **Deploy Application**
   ```bash
   # Clone your repo
   git clone https://github.com/yourusername/liquidot.git
   cd liquidot/Backend
   
   # Create .env
   nano .env
   # (paste your configuration)
   
   # Start services
   docker-compose up -d
   ```

5. **Configure Security Group**
   - Allow inbound on port 3001 (HTTP)
   - Allow inbound on port 22 (SSH)

**Access your API at**: `http://your-ec2-ip:3001`

---

### Option B: AWS ECS with RDS (Production-Ready)

1. **Create RDS Database**
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier liquidot-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username liquidot \
     --master-user-password YourSecurePassword123! \
     --allocated-storage 20 \
     --vpc-security-group-ids sg-xxxxxxxx \
     --db-subnet-group-name your-db-subnet \
     --publicly-accessible
   ```

2. **Build and Push Docker Image**
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   
   # Create repository
   aws ecr create-repository --repository-name liquidot-backend
   
   # Build and push
   docker build -t liquidot-backend .
   docker tag liquidot-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liquidot-backend:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liquidot-backend:latest
   ```

3. **Create ECS Cluster**
   ```bash
   aws ecs create-cluster --cluster-name liquidot-cluster
   ```

4. **Update `aws-ecs-task-definition.json`**
   - Replace `YOUR_ACCOUNT_ID` with your AWS account ID
   - Update database endpoint from RDS output

5. **Register Task Definition**
   ```bash
   aws ecs register-task-definition --cli-input-json file://aws-ecs-task-definition.json
   ```

6. **Create ECS Service**
   ```bash
   aws ecs create-service \
     --cluster liquidot-cluster \
     --service-name liquidot-backend \
     --task-definition liquidot-backend \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
   ```

---

## 🔍 Quick Verification

Test your deployment:

```bash
# Health check
curl http://your-server:3001/api/health

# Get pools
curl http://your-server:3001/api/pools

# Get user positions
curl http://your-server:3001/api/positions/0xYourUserAddress
```

---

## 📊 Monitoring

### View Logs (Local)
```bash
docker-compose logs -f backend
```

### View Logs (AWS ECS)
```bash
aws logs tail /ecs/liquidot-backend --follow
```

### Check Database
```bash
# Local
docker exec -it liquidot-postgres psql -U liquidot -d liquidot

# Check tables
\dt
```

---

## 🛑 Stopping Services

### Local
```bash
docker-compose down
```

### AWS EC2
```bash
ssh into instance
docker-compose down
```

### AWS ECS
```bash
aws ecs update-service --cluster liquidot-cluster --service liquidot-backend --desired-count 0
```

---

## 💰 Cost Estimate

**Local Development**: FREE

**AWS EC2 (t3.medium)**: ~$30/month
- EC2 instance: ~$30/month
- No additional services

**AWS ECS + RDS**: ~$50/month
- ECS Fargate (1 task): ~$25/month
- RDS db.t3.micro: ~$15/month
- Data transfer: ~$10/month

---

## 🐛 Common Issues

### "Connection refused" on port 3001
```bash
# Check if backend is running
docker-compose ps

# Check logs
docker-compose logs backend

# Restart
docker-compose restart backend
```

### "Database connection failed"
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
docker exec liquidot-backend nc -zv postgres 5432
```

### "Contract address not set"
```bash
# Verify .env file
cat .env | grep ADDRESS

# Restart with new config
docker-compose down
docker-compose up -d
```

---

## 📚 What You Get

With this deployment, you have:

✅ **Backend API** running on port 3001
✅ **PostgreSQL database** for storing user data, positions, pools
✅ **Investment Decision Worker** making automated LP decisions
✅ **Stop-Loss Worker** monitoring and liquidating positions
✅ **Pool Data Aggregator** fetching DEX analytics
✅ **Smart Contract Integration** with AssetHub and Moonbeam

---

## 🎯 For Grant Reviewers

To quickly test the system:

1. **Start local deployment** (5 minutes)
   ```bash
   docker-compose up -d
   ```

2. **Check API health**
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **View available pools**
   ```bash
   curl http://localhost:3001/api/pools
   ```

4. **Submit investment preferences** (see Frontend UI or API docs)

5. **Monitor workers**
   ```bash
   docker-compose logs -f backend | grep Worker
   ```

---

## 📞 Support

- Check logs first: `docker-compose logs backend`
- Review environment variables: `docker-compose config`
- Restart services: `docker-compose restart`

---

**That's it!** For the full production setup with auto-scaling and monitoring, see `DEPLOYMENT_GUIDE.md`.
