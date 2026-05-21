#!/bin/bash

# CREA DDF IDX Integration Setup Script
# Automates testing and deployment

set -e  # Exit on error

echo "🏠 Realist.ca - CREA DDF IDX Integration Setup"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the idx-integration directory."
    exit 1
fi

# Step 1: Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js version: $(node -v)"
echo ""

# Step 2: Install dependencies
print_info "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi
echo ""

# Step 3: Check environment variables
print_info "Checking environment variables..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Copying from .env.example..."
    cp .env.example .env
    print_info "Please edit .env with your database URL and other settings"
    print_info "Then run this script again."
    exit 0
fi

# Check for required env vars
if ! grep -q "DATABASE_URL=" .env || grep -q "DATABASE_URL=postgresql://user:password" .env; then
    print_warning "DATABASE_URL not configured in .env"
    print_info "Please set your PostgreSQL connection string in .env"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    print_success "Environment variables configured"
fi
echo ""

# Step 4: Test DDF connection
print_info "Testing CREA DDF connection..."
echo "This will verify:"
echo "  - Authentication with CREA DDF"
echo "  - Ability to fetch listings"
echo "  - Photo retrieval"
echo ""

if npm run test:ddf; then
    print_success "DDF connection test passed!"
else
    print_error "DDF connection test failed"
    echo ""
    print_info "Troubleshooting:"
    echo "  1. Verify DDF_USERNAME and DDF_PASSWORD in .env"
    echo "  2. Check if your IP is whitelisted with CREA"
    echo "  3. Contact CREA support if issues persist"
    echo ""
    read -p "Do you want to continue with database setup anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Step 5: Database setup
print_info "Database setup..."
echo "Options:"
echo "  1) Run migrations now (requires DATABASE_URL)"
echo "  2) Skip database setup"
echo ""
read -p "Choose option (1-2): " -n 1 -r
echo

if [[ $REPLY =~ ^[1]$ ]]; then
    print_info "Running database migrations..."
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set in environment"
        exit 1
    fi
    
    # Run migrations
    if psql "$DATABASE_URL" -f schema.sql; then
        print_success "Database migrations completed"
    else
        print_error "Database migrations failed"
        print_info "You can run migrations manually with:"
        echo "  psql \$DATABASE_URL -f schema.sql"
        exit 1
    fi
else
    print_warning "Skipping database setup"
    print_info "Run migrations later with: npm run migrate"
fi
echo ""

# Step 6: Initial sync
print_info "Initial data sync..."
echo "Options:"
echo "  1) Test sync (10 listings)"
echo "  2) Small sync (100 listings, last 7 days)"
echo "  3) Full sync (all active listings)"
echo "  4) Skip sync"
echo ""
read -p "Choose option (1-4): " -n 1 -r
echo

case $REPLY in
    1)
        print_info "Running test sync with 10 listings..."
        DDF_LIMIT=10 npm run sync || print_warning "Sync failed - check logs above"
        ;;
    2)
        print_info "Running small sync (100 listings, last 7 days)..."
        npm run sync || print_warning "Sync failed - check logs above"
        ;;
    3)
        print_info "Running full sync (this may take a while)..."
        npm run sync:full || print_warning "Sync failed - check logs above"
        ;;
    4)
        print_warning "Skipping sync"
        ;;
esac
echo ""

# Step 7: Summary and next steps
echo "=============================================="
print_success "Setup complete!"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Development Server:"
echo "   npm run dev"
echo ""
echo "2. Schedule Daily Sync:"
echo "   Add to crontab: 0 2 * * * cd $(pwd) && npm run sync"
echo ""
echo "3. Integration with Realist.ca:"
echo "   See DEPLOYMENT.md for detailed integration guide"
echo ""
echo "4. Test API Endpoints:"
echo "   curl http://localhost:3000/api/listings?limit=10"
echo "   curl http://localhost:3000/api/listings/investment/top"
echo ""
echo "5. Frontend Setup:"
echo "   - Copy components to your React app"
echo "   - Add route: <Route path=\"/properties\" element={<ListingsPage />} />"
echo "   - Get Mapbox token: https://mapbox.com"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Project overview"
echo "   - DEPLOYMENT.md - Detailed deployment guide"
echo "   - INTEGRATION_SUMMARY.md - Complete feature list"
echo ""
echo "🐛 Troubleshooting:"
echo "   - Authentication issues: Check CREA credentials and IP whitelist"
echo "   - No listings: Verify search parameters and DMQL syntax"
echo "   - No photos: Photo parsing may need refinement"
echo "   - Missing cap rates: Check /api/rents endpoint is working"
echo ""
print_success "Happy investing! 🏠📈"
echo ""
