#!/bin/bash

# LiquiDOT Quick Setup Script
# This script helps you set up the deployment environment

set -e

echo "🚀 LiquiDOT Deployment Setup"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}➜${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
print_step "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { print_error "Docker is required. Install from https://www.docker.com/"; exit 1; }
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required. Install with: brew install awscli"; exit 1; }
command -v terraform >/dev/null 2>&1 || { print_error "Terraform is required. Install with: brew install terraform"; exit 1; }
command -v node >/dev/null 2>&1 || { print_error "Node.js is required. Install from https://nodejs.org/"; exit 1; }

print_step "All prerequisites installed ✓"
echo ""

# Environment selection
echo "Select deployment environment:"
echo "1) Local Development (Docker Compose)"
echo "2) AWS Production"
read -p "Enter choice [1-2]: " env_choice

case $env_choice in
    1)
        print_step "Setting up local development environment..."
        
        # Check if .env exists
        if [ ! -f ".env" ]; then
            print_warning ".env file not found. Creating from template..."
            cp .env.example .env
            print_step "Created .env file. Please edit it with your values."
            
            read -p "Do you want to edit .env now? [y/N]: " edit_env
            if [[ $edit_env == "y" || $edit_env == "Y" ]]; then
                ${EDITOR:-nano} .env
            fi
        fi
        
        # Start services
        print_step "Starting Docker Compose services..."
        docker-compose up -d
        
        echo ""
        print_step "Waiting for services to be healthy..."
        sleep 10
        
        # Check health
        docker-compose ps
        
        echo ""
        echo "✅ Local development environment is ready!"
        echo ""
        echo "Services:"
        echo "  - Backend API: http://localhost:3001"
        echo "  - PostgreSQL: localhost:5432"
        echo "  - Redis: localhost:6379"
        echo ""
        echo "Useful commands:"
        echo "  - View logs: docker-compose logs -f backend"
        echo "  - Stop services: docker-compose down"
        echo "  - Restart: docker-compose restart backend"
        ;;
        
    2)
        print_step "Setting up AWS production deployment..."
        
        # Check AWS credentials
        if ! aws sts get-caller-identity >/dev/null 2>&1; then
            print_error "AWS credentials not configured. Run: aws configure"
            exit 1
        fi
        
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        print_step "AWS Account ID: $AWS_ACCOUNT_ID"
        
        # Get contract addresses
        echo ""
        print_warning "Please provide your deployed contract addresses:"
        read -p "Asset Hub Vault Address (0x...): " VAULT_ADDRESS
        read -p "XCM Proxy Address (0x...): " PROXY_ADDRESS
        read -sp "Operator Private Key (0x...): " OPERATOR_KEY
        echo ""
        
        # Validate addresses
        if [[ ! $VAULT_ADDRESS =~ ^0x[a-fA-F0-9]{40}$ ]]; then
            print_error "Invalid vault address format"
            exit 1
        fi
        
        if [[ ! $PROXY_ADDRESS =~ ^0x[a-fA-F0-9]{40}$ ]]; then
            print_error "Invalid proxy address format"
            exit 1
        fi
        
        # Store secrets
        print_step "Storing secrets in AWS Secrets Manager..."
        
        aws secretsmanager create-secret \
            --name liquidot/vault-address \
            --secret-string "$VAULT_ADDRESS" \
            --region us-east-1 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id liquidot/vault-address \
            --secret-string "$VAULT_ADDRESS" \
            --region us-east-1
        
        aws secretsmanager create-secret \
            --name liquidot/proxy-address \
            --secret-string "$PROXY_ADDRESS" \
            --region us-east-1 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id liquidot/proxy-address \
            --secret-string "$PROXY_ADDRESS" \
            --region us-east-1
        
        aws secretsmanager create-secret \
            --name liquidot/operator-key \
            --secret-string "$OPERATOR_KEY" \
            --region us-east-1 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id liquidot/operator-key \
            --secret-string "$OPERATOR_KEY" \
            --region us-east-1
        
        print_step "Secrets stored ✓"
        
        # Generate random DB password
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        
        aws secretsmanager create-secret \
            --name liquidot/db-password \
            --secret-string "$DB_PASSWORD" \
            --region us-east-1 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id liquidot/db-password \
            --secret-string "$DB_PASSWORD" \
            --region us-east-1
        
        # Request SSL certificate
        echo ""
        read -p "Enter your domain name (e.g., api.liquidot.io): " DOMAIN_NAME
        
        print_step "Requesting SSL certificate..."
        CERT_ARN=$(aws acm request-certificate \
            --domain-name "$DOMAIN_NAME" \
            --validation-method DNS \
            --region us-east-1 \
            --query CertificateArn --output text)
        
        print_warning "Please add the DNS validation records shown in AWS Certificate Manager console"
        print_warning "Certificate ARN: $CERT_ARN"
        
        read -p "Press Enter once DNS validation is complete..."
        
        # Create terraform.tfvars
        print_step "Creating Terraform configuration..."
        cd terraform
        
        cat > terraform.tfvars <<EOF
aws_region              = "us-east-1"
environment             = "production"
db_username             = "liquidot"
db_password             = "$DB_PASSWORD"
db_instance_class       = "db.t3.medium"
redis_node_type         = "cache.t3.micro"
acm_certificate_arn     = "$CERT_ARN"
operator_private_key    = "$OPERATOR_KEY"
asset_hub_vault_address = "$VAULT_ADDRESS"
xcm_proxy_address       = "$PROXY_ADDRESS"
EOF
        
        print_step "Terraform configuration created ✓"
        
        # Initialize Terraform
        print_step "Initializing Terraform..."
        terraform init
        
        # Plan
        print_step "Planning infrastructure..."
        terraform plan -out=tfplan
        
        echo ""
        print_warning "Review the Terraform plan above."
        read -p "Do you want to apply this plan? [y/N]: " apply_tf
        
        if [[ $apply_tf == "y" || $apply_tf == "Y" ]]; then
            print_step "Applying Terraform..."
            terraform apply tfplan
            
            # Save outputs
            terraform output > ../infrastructure-outputs.txt
            
            cd ..
            
            print_step "Infrastructure deployed ✓"
            
            # Deploy application
            echo ""
            read -p "Do you want to deploy the application now? [y/N]: " deploy_app
            
            if [[ $deploy_app == "y" || $deploy_app == "Y" ]]; then
                print_step "Deploying application to ECS..."
                chmod +x deploy.sh
                ./deploy.sh production
                
                print_step "Application deployed ✓"
            fi
            
            echo ""
            echo "✅ AWS Production deployment complete!"
            echo ""
            echo "Next steps:"
            echo "  1. Configure your domain DNS to point to the ALB"
            echo "  2. Check deployment: curl https://your-domain/api/health"
            echo "  3. Monitor logs: aws logs tail /ecs/liquidot-backend --follow"
            echo "  4. Deploy frontend to Vercel"
            echo ""
            echo "Infrastructure outputs saved to: infrastructure-outputs.txt"
        else
            print_warning "Terraform plan saved. Apply manually with: terraform apply tfplan"
        fi
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_step "Setup complete! 🎉"
echo ""
echo "📚 For detailed documentation, see: DEPLOYMENT_GUIDE.md"
