#!/bin/bash

################################################################################
# CrisisNet Cloud Run Deployment Script
#
# Automates deployment to Google Cloud Run with:
# - Docker image build
# - Container Registry push
# - Cloud Run service deployment
# - Smoke tests
#
# Usage:
#   ./deploy_cloud_run.sh --project YOUR_PROJECT_ID --region us-central1
#   ./deploy_cloud_run.sh --project YOUR_PROJECT_ID --dry-run
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="crisisnet-api"
IMAGE_NAME="gcr.io/\${PROJECT_ID}/crisisnet-api"
DRY_RUN=false
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project)
            PROJECT_ID="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: --project is required${NC}"
    echo "Usage: $0 --project YOUR_PROJECT_ID [--region REGION] [--dry-run]"
    exit 1
fi

# Update IMAGE_NAME with actual project ID
IMAGE_NAME="gcr.io/${PROJECT_ID}/crisisnet-api"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         CrisisNet Cloud Run Deployment                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Project ID:    $PROJECT_ID"
echo "  Region:        $REGION"
echo "  Service Name:  $SERVICE_NAME"
echo "  Image:         $IMAGE_NAME"
echo "  Dry Run:       $DRY_RUN"
echo ""

# Step 1: Pre-deployment validation
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Pre-deployment Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}Running demo dry-run...${NC}"
    if python3 scripts/demo_dry_run.py; then
        echo -e "${GREEN}✓ All pre-deployment checks passed${NC}"
    else
        echo -e "${RED}✗ Pre-deployment checks failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Skipping pre-deployment tests${NC}"
fi

# Step 2: Build Docker image
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Build Docker Image${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}Building Docker image: $IMAGE_NAME${NC}"
    if docker build -t "$IMAGE_NAME" .; then
        echo -e "${GREEN}✓ Docker image built successfully${NC}"
    else
        echo -e "${RED}✗ Docker build failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would build: docker build -t $IMAGE_NAME .${NC}"
fi

# Step 3: Push to Container Registry
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Push to Container Registry${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}Pushing image to GCR...${NC}"
    if docker push "$IMAGE_NAME"; then
        echo -e "${GREEN}✓ Image pushed successfully${NC}"
    else
        echo -e "${RED}✗ Image push failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would push: docker push $IMAGE_NAME${NC}"
fi

# Step 4: Deploy to Cloud Run
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Deploy to Cloud Run${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
    if gcloud run deploy "$SERVICE_NAME" \
        --image "$IMAGE_NAME" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --memory 2Gi \
        --cpu 2 \
        --timeout 300 \
        --max-instances 10 \
        --project "$PROJECT_ID"; then
        echo -e "${GREEN}✓ Deployment successful${NC}"
    else
        echo -e "${RED}✗ Deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would deploy with:${NC}"
    echo "  gcloud run deploy $SERVICE_NAME \\"
    echo "    --image $IMAGE_NAME \\"
    echo "    --platform managed \\"
    echo "    --region $REGION \\"
    echo "    --allow-unauthenticated \\"
    echo "    --memory 2Gi \\"
    echo "    --cpu 2 \\"
    echo "    --timeout 300 \\"
    echo "    --max-instances 10 \\"
    echo "    --project $PROJECT_ID"
fi

# Step 5: Get service URL
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Service Information${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = false ]; then
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --platform managed \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format 'value(status.url)')
    
    echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
    echo ""
    echo -e "${YELLOW}Running smoke tests...${NC}"
    
    # Run smoke tests
    if python3 scripts/smoke_tests.py --url "$SERVICE_URL"; then
        echo -e "${GREEN}✓ All smoke tests passed${NC}"
    else
        echo -e "${RED}✗ Smoke tests failed${NC}"
        echo -e "${YELLOW}⚠ Deployment completed but service may not be healthy${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would retrieve service URL and run smoke tests${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Deployment Successful! ✓                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}Service URL:${NC} $SERVICE_URL"
    echo ""
    echo -e "${YELLOW}Quick Test:${NC}"
    echo "  curl $SERVICE_URL/health"
    echo ""
    echo -e "${YELLOW}Allocation Test:${NC}"
    echo "  curl -X POST $SERVICE_URL/api/allocate \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d @demo_multi_crisis.json"
fi
echo ""
