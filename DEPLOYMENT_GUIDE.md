# 🚀 LiquiDOT Deployment Guide

Complete guide for deploying LiquiDOT to production on AWS.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Smart Contract Deployment](#smart-contract-deployment)
3. [AWS Infrastructure Setup](#aws-infrastructure-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Tools

```bash
# Install AWS CLI
brew install awscli  # macOS
# or
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Install Docker
brew install --cask docker  # macOS
# or download from https://www.docker.com/products/docker-desktop

# Install Node.js 20+
brew install node@20

# Install jq (JSON processor)
brew install jq
```

### AWS Account Setup

1. **Create AWS Account** (if you don't have one)
   - Go to https://aws.amazon.com/
   - Sign up for free tier

2. **Configure AWS CLI**
   ```bash
   aws configure
   # Enter:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1
   # - Default output format: json
   ```

3. **Create IAM User with Required Permissions**
   ```bash
   # Required IAM policies:
   # - AmazonECS_FullAccess
   # - AmazonRDSFullAccess
   # - ElastiCacheFullAccess
   # - AmazonEC2ContainerRegistryFullAccess
   # - CloudWatchLogsFullAccess
   # - SecretsManagerReadWrite
   ```

---

## 📝 Step 1: Smart Contract Deployment

### 1.1 Deploy AssetHub Vault Contract

```bash
cd SmartContracts

# Configure Hardhat for Asset Hub
export ASSET_HUB_RPC_URL="wss://polkadot-asset-hub-rpc.polkadot.io"
export DEPLOYER_PRIVATE_KEY="your_deployer_private_key"

# Deploy
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHub

# Save the contract address
export ASSET_HUB_VAULT_ADDRESS="0x..."
```

### 1.2 Deploy XCM Proxy Contract (Moonbeam)

```bash
# Configure Hardhat for Moonbeam
export MOONBEAM_RPC_URL="https://rpc.api.moonbeam.network"

# Deploy
npx hardhat run scripts/deploy-xcm-proxy.js --network moonbeam

# Save the contract address
export XCM_PROXY_ADDRESS="0x..."
```

### 1.3 Configure Contracts

```bash
# Configure AssetHub Vault
npx hardhat run scripts/configure-vault.js --network assetHub

# Configure XCM Proxy
npx hardhat run scripts/configure-proxy.js --network moonbeam

# Add Moonbeam chain to Vault
npx hardhat run scripts/add-chain.js --network assetHub
```

---

## 🏗️ Step 2: AWS Infrastructure Setup

### 2.1 Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://liquidot-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket liquidot-terraform-state \
  --versioning-configuration Status=Enabled
```

### 2.2 Store Secrets in AWS Secrets Manager

```bash
cd Backend

# Database password
aws secretsmanager create-secret \
  --name liquidot/db-password \
  --secret-string "your_secure_db_password" \
  --region us-east-1

# Operator private key
aws secretsmanager create-secret \
  --name liquidot/operator-key \
  --secret-string "$OPERATOR_PRIVATE_KEY" \
  --region us-east-1

# Contract addresses
aws secretsmanager create-secret \
  --name liquidot/vault-address \
  --secret-string "$ASSET_HUB_VAULT_ADDRESS" \
  --region us-east-1

aws secretsmanager create-secret \
  --name liquidot/proxy-address \
  --secret-string "$XCM_PROXY_ADDRESS" \
  --region us-east-1
```

### 2.3 Request SSL Certificate

```bash
# Request certificate in AWS Certificate Manager
aws acm request-certificate \
  --domain-name api.liquidot.io \
  --validation-method DNS \
  --region us-east-1

# Save the certificate ARN
export ACM_CERTIFICATE_ARN="arn:aws:acm:us-east-1:..."
```

### 2.4 Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars file
cat > terraform.tfvars <<EOF
aws_region              = "us-east-1"
environment             = "production"
db_username             = "liquidot"
db_password             = "your_secure_db_password"
db_instance_class       = "db.t3.medium"
redis_node_type         = "cache.t3.micro"
acm_certificate_arn     = "$ACM_CERTIFICATE_ARN"
operator_private_key    = "$OPERATOR_PRIVATE_KEY"
asset_hub_vault_address = "$ASSET_HUB_VAULT_ADDRESS"
xcm_proxy_address       = "$XCM_PROXY_ADDRESS"
EOF

# Review the plan
terraform plan

# Apply infrastructure
terraform apply

# Save outputs
terraform output > ../infrastructure-outputs.txt
```

---

## 🐳 Step 3: Backend Deployment

### 3.1 Configure Environment

```bash
cd Backend

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

Update `.env` with Terraform outputs:
```bash
DATABASE_HOST=<from terraform output: rds_endpoint>
REDIS_HOST=<from terraform output: redis_endpoint>
ASSET_HUB_VAULT_ADDRESS=<your vault address>
XCM_PROXY_ADDRESS=<your proxy address>
OPERATOR_PRIVATE_KEY=<your operator key>
```

### 3.2 Build and Push Docker Image

```bash
# Make deploy script executable
chmod +x deploy.sh

# Set AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1

# Run deployment
./deploy.sh production
```

### 3.3 Create ECS Service

```bash
# Create ECS service
aws ecs create-service \
  --cluster liquidot-cluster \
  --service-name liquidot-backend-service \
  --task-definition liquidot-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=liquidot-backend,containerPort=3001" \
  --region us-east-1
```

### 3.4 Run Database Migrations

```bash
# Connect to ECS task
ECS_TASK_ID=$(aws ecs list-tasks --cluster liquidot-cluster --service-name liquidot-backend-service --query 'taskArns[0]' --output text)

# Run migrations
aws ecs execute-command \
  --cluster liquidot-cluster \
  --task $ECS_TASK_ID \
  --container liquidot-backend \
  --command "npm run migration:run" \
  --interactive
```

---

## 🌐 Step 4: Frontend Deployment (Vercel)

### 4.1 Push Frontend to GitHub

```bash
cd ../Frontend

# Initialize git if not already
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/yourusername/liquidot-frontend.git
git push -u origin main
```

### 4.2 Deploy to Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://<alb-dns-name>
   NEXT_PUBLIC_ASSET_HUB_VAULT_ADDRESS=0x...
   NEXT_PUBLIC_XCM_PROXY_ADDRESS=0x...
   NEXT_PUBLIC_ASSET_HUB_RPC=wss://polkadot-asset-hub-rpc.polkadot.io
   NEXT_PUBLIC_MOONBEAM_RPC=https://rpc.api.moonbeam.network
   ```
5. Click "Deploy"

### 4.3 Configure Custom Domain

```bash
# In Vercel dashboard:
# Settings → Domains → Add Domain
# Add: app.liquidot.io
# Configure DNS records as instructed
```

---

## 📊 Step 5: Monitoring & Maintenance

### 5.1 Set Up CloudWatch Alarms

```bash
# CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name liquidot-backend-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Memory utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name liquidot-backend-high-memory \
  --alarm-description "Alert when memory exceeds 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### 5.2 View Logs

```bash
# Backend logs
aws logs tail /ecs/liquidot-backend --follow --region us-east-1

# Filter by error
aws logs filter-log-events \
  --log-group-name /ecs/liquidot-backend \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### 5.3 Scale Services

```bash
# Scale up
aws ecs update-service \
  --cluster liquidot-cluster \
  --service liquidot-backend-service \
  --desired-count 4

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/liquidot-cluster/liquidot-backend-service \
  --min-capacity 2 \
  --max-capacity 10
```

---

## 🔧 Step 6: Testing Deployment

### 6.1 Health Check

```bash
# Get ALB DNS
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl https://$ALB_DNS/api/health

# Expected output:
# {"status":"ok","timestamp":"2025-11-11T..."}
```

### 6.2 Test API Endpoints

```bash
# Get pools
curl https://$ALB_DNS/api/pools

# Get user positions
curl https://$ALB_DNS/api/positions/0x1234567890abcdef1234567890abcdef12345678
```

### 6.3 Monitor Workers

```bash
# Check worker logs
aws logs filter-log-events \
  --log-group-name /ecs/liquidot-backend \
  --filter-pattern "Investment Decision Worker" \
  --region us-east-1

aws logs filter-log-events \
  --log-group-name /ecs/liquidot-backend \
  --filter-pattern "Stop-Loss Worker" \
  --region us-east-1
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test RDS connectivity from ECS
aws ecs execute-command \
  --cluster liquidot-cluster \
  --task $ECS_TASK_ID \
  --container liquidot-backend \
  --command "nc -zv $DATABASE_HOST 5432" \
  --interactive
```

### Container Crashes

```bash
# Check task status
aws ecs describe-tasks \
  --cluster liquidot-cluster \
  --tasks $ECS_TASK_ID

# View stopped tasks
aws ecs list-tasks \
  --cluster liquidot-cluster \
  --desired-status STOPPED
```

### High Memory Usage

```bash
# Check memory metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=liquidot-backend-service \
  --start-time 2025-11-11T00:00:00Z \
  --end-time 2025-11-11T23:59:59Z \
  --period 3600 \
  --statistics Average
```

---

## 💰 Cost Estimation

**Monthly AWS Costs (Production):**

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate (2 tasks) | 1 vCPU, 2GB RAM | ~$60 |
| RDS PostgreSQL | db.t3.medium | ~$70 |
| ElastiCache Redis | cache.t3.micro | ~$15 |
| Application Load Balancer | - | ~$20 |
| NAT Gateway | - | ~$35 |
| Data Transfer | 100GB | ~$10 |
| CloudWatch Logs | 10GB | ~$5 |
| **Total** | | **~$215/month** |

**Cost Optimization Tips:**
- Use Reserved Instances for RDS (save 30-40%)
- Use Savings Plans for ECS (save 20-30%)
- Implement CloudWatch log retention policies
- Use S3 lifecycle policies for old logs

---

## 🔒 Security Checklist

- [ ] All secrets stored in AWS Secrets Manager
- [ ] SSL/TLS certificate configured
- [ ] Security groups properly configured
- [ ] RDS encryption enabled
- [ ] VPC properly configured with private subnets
- [ ] IAM roles follow least privilege principle
- [ ] CloudWatch alarms configured
- [ ] Regular backups enabled
- [ ] Multi-AZ deployment for RDS
- [ ] WAF configured on ALB (optional)

---

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Polkadot Documentation](https://wiki.polkadot.network/)

---

## 🆘 Support

If you encounter issues:

1. Check CloudWatch logs
2. Review ECS task status
3. Verify security group rules
4. Check Secrets Manager values
5. Open an issue on GitHub

---

**Deployment Complete! 🎉**

Your LiquiDOT backend is now running on AWS ECS with:
- High availability (multi-AZ)
- Auto-scaling capabilities
- Secure secret management
- Comprehensive monitoring
- Production-ready infrastructure
