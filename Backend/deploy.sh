#!/bin/bash

# LiquiDOT Backend Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

ENVIRONMENT=${1:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
ECR_REPOSITORY="liquidot-backend"
ECS_CLUSTER="liquidot-cluster"
ECS_SERVICE="liquidot-backend-service"
TASK_DEFINITION="liquidot-backend"

echo "🚀 Starting deployment to $ENVIRONMENT..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { print_error "Docker is required but not installed. Aborting."; exit 1; }
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required but not installed. Aborting."; exit 1; }

print_status "Prerequisites check passed"

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t $ECR_REPOSITORY:latest .
print_status "Docker image built successfully"

# Login to ECR
echo "🔐 Logging in to AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
print_status "Logged in to ECR"

# Create ECR repository if it doesn't exist
echo "📦 Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
print_status "ECR repository ready"

# Tag and push image
echo "📤 Pushing image to ECR..."
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
ECR_IMAGE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"

docker tag $ECR_REPOSITORY:latest $ECR_IMAGE:$IMAGE_TAG
docker tag $ECR_REPOSITORY:latest $ECR_IMAGE:latest

docker push $ECR_IMAGE:$IMAGE_TAG
docker push $ECR_IMAGE:latest
print_status "Image pushed to ECR"

# Update ECS task definition
echo "📝 Updating ECS task definition..."
TASK_DEF_ARN=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)

if [ -z "$TASK_DEF_ARN" ]; then
    print_warning "Task definition not found. Creating new one..."
    # Register task definition from JSON file
    aws ecs register-task-definition --cli-input-json file://aws-ecs-task-definition.json --region $AWS_REGION
else
    # Get current task definition
    TASK_DEF_JSON=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION --region $AWS_REGION --query 'taskDefinition' --output json)
    
    # Update image in task definition
    NEW_TASK_DEF=$(echo $TASK_DEF_JSON | jq --arg IMAGE "$ECR_IMAGE:$IMAGE_TAG" '.containerDefinitions[0].image = $IMAGE' | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')
    
    # Register new task definition revision
    aws ecs register-task-definition --cli-input-json "$NEW_TASK_DEF" --region $AWS_REGION
fi

print_status "Task definition updated"

# Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $TASK_DEFINITION \
    --force-new-deployment \
    --region $AWS_REGION

print_status "ECS service updated"

# Wait for deployment to complete
echo "⏳ Waiting for deployment to stabilize..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

print_status "Deployment completed successfully! 🎉"

# Get service information
echo ""
echo "📊 Service Information:"
SERVICE_INFO=$(aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION --query 'services[0]')
RUNNING_COUNT=$(echo $SERVICE_INFO | jq -r '.runningCount')
DESIRED_COUNT=$(echo $SERVICE_INFO | jq -r '.desiredCount')

echo "  Running tasks: $RUNNING_COUNT / $DESIRED_COUNT"
echo "  Image: $ECR_IMAGE:$IMAGE_TAG"
echo ""
echo "✅ Deployment to $ENVIRONMENT complete!"
