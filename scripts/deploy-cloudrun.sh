#!/bin/bash
# ============================================
# VegaLens - Cloud Run Deployment Script
# ============================================
# This script helps you deploy VegaLens to Google Cloud Run.
#
# Prerequisites:
#   - Google Cloud SDK (gcloud) installed and authenticated
#   - Docker installed (for local builds)
#   - A Google Cloud project with billing enabled
#
# Usage:
#   ./scripts/deploy-cloudrun.sh [OPTIONS]
#
# Options:
#   --project     GCP project ID (required)
#   --region      Cloud Run region (default: us-central1)
#   --service     Service name (default: vegalens)
#   --setup       Run initial setup (create Artifact Registry, enable APIs)
#   --build-only  Only build and push the image, don't deploy
#   --help        Show this help message

set -euo pipefail

# Default values
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="vegalens"
SETUP=false
BUILD_ONLY=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Parse command line arguments
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
    --setup)
      SETUP=true
      shift
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --help)
      head -30 "$0" | tail -n +2 | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      error "Unknown option: $1. Use --help for usage."
      ;;
  esac
done

# Validate required arguments
if [[ -z "$PROJECT_ID" ]]; then
  # Try to get from gcloud config
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
  if [[ -z "$PROJECT_ID" ]]; then
    error "Project ID is required. Use --project or set with: gcloud config set project YOUR_PROJECT"
  fi
  warn "Using project from gcloud config: $PROJECT_ID"
fi

# Derived values
ARTIFACT_REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/vegalens"
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
FULL_IMAGE="${ARTIFACT_REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"

echo ""
echo "============================================"
echo "  VegaLens Cloud Run Deployment"
echo "============================================"
echo ""
info "Project:  $PROJECT_ID"
info "Region:   $REGION"
info "Service:  $SERVICE_NAME"
info "Image:    $FULL_IMAGE"
echo ""

# Initial setup
if [[ "$SETUP" == "true" ]]; then
  echo "----------------------------------------"
  info "Running initial setup..."
  echo "----------------------------------------"
  
  # Enable required APIs
  info "Enabling required Google Cloud APIs..."
  gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    --project="$PROJECT_ID"
  success "APIs enabled"
  
  # Create Artifact Registry repository
  info "Creating Artifact Registry repository..."
  gcloud artifacts repositories create vegalens \
    --repository-format=docker \
    --location="$REGION" \
    --description="VegaLens Docker images" \
    --project="$PROJECT_ID" 2>/dev/null || warn "Repository already exists"
  success "Artifact Registry ready"
  
  # Create service account
  info "Creating service account..."
  gcloud iam service-accounts create vegalens-sa \
    --display-name="VegaLens Service Account" \
    --project="$PROJECT_ID" 2>/dev/null || warn "Service account already exists"
  
  # Grant necessary permissions
  info "Granting permissions..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:vegalens-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
  success "Setup complete"
  echo ""
fi

# Configure Docker for Artifact Registry
info "Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
success "Docker configured"

# Build the Docker image
echo ""
echo "----------------------------------------"
info "Building Docker image..."
echo "----------------------------------------"
docker build \
  -t "${FULL_IMAGE}" \
  -t "${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest" \
  -f Dockerfile \
  .
success "Image built: ${FULL_IMAGE}"

# Push to Artifact Registry
echo ""
echo "----------------------------------------"
info "Pushing image to Artifact Registry..."
echo "----------------------------------------"
docker push "${FULL_IMAGE}"
docker push "${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest"
success "Image pushed"

if [[ "$BUILD_ONLY" == "true" ]]; then
  echo ""
  success "Build complete! Image: ${FULL_IMAGE}"
  exit 0
fi

# Deploy to Cloud Run
echo ""
echo "----------------------------------------"
info "Deploying to Cloud Run..."
echo "----------------------------------------"
gcloud run deploy "$SERVICE_NAME" \
  --image="${FULL_IMAGE}" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=production" \
  --project="$PROJECT_ID"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')

echo ""
echo "============================================"
success "Deployment complete!"
echo "============================================"
echo ""
info "Service URL: ${SERVICE_URL}"
echo ""
info "Next steps:"
echo "  1. Configure Elasticsearch connection via environment variables:"
echo "     gcloud run services update $SERVICE_NAME --region=$REGION \\"
echo "       --set-env-vars=ELASTIC_SERVERLESS_ENDPOINT=your-endpoint,ELASTIC_API_KEY=your-key"
echo ""
echo "  2. Or use Secret Manager for sensitive values:"
echo "     gcloud secrets create elastic-api-key --data-file=-"
echo "     gcloud run services update $SERVICE_NAME --region=$REGION \\"
echo "       --set-secrets=ELASTIC_API_KEY=elastic-api-key:latest"
echo ""
echo "  3. Update CORS_ORIGIN if needed:"
echo "     gcloud run services update $SERVICE_NAME --region=$REGION \\"
echo "       --set-env-vars=CORS_ORIGIN=${SERVICE_URL}"
echo ""


