# Realist.ca - Real Estate Deal Analyzer

## Overview

Realist.ca is a production-grade real estate deal analyzer web application designed to help investors underwrite deals, compare investment strategies, and export investor-ready analysis sheets. The platform targets Canadian and US real estate investors with institutional-grade financial calculations including cap rates, IRR, cash-on-cash returns, and multi-year projections.

The application features a high-converting landing page with lead capture, a sophisticated deal analyzer tool supporting multiple investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and an admin dashboard for lead management. It integrates with GoHighLevel CRM for automated lead delivery.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack Query (React Query) for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system following modern fintech aesthetics (Inter font, JetBrains Mono for financial figures)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for financial visualizations
- **Theme**: Dark/light mode support with CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON APIs under `/api` prefix
- **Build**: esbuild for server bundling, Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: leads, properties, analyses, webhookLogs, dataCache, buyBoxAgreements, buyBoxMandates, buyBoxResponses, buyBoxNotifications, coInvestUserProfiles, coInvestGroups, coInvestMemberships, coInvestChecklistResults, coInvestMessages
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are shared between client and server
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code

### Navigation Structure (Reorganized February 2026)
The navigation uses a category-based dropdown structure:
- **Tools**: Deal Analyzer, BuyBox, Co-Invest, Calculators hub
- **Community**: Events, Network, Online Community (Skool)
- **Insights**: Podcast, Blog, Guides
- **About**: About Realist, Team, Programs, Shop, Contact

### Page Structure
#### Tools (/tools/*)
- `/` and `/tools/analyzer` - Deal Analyzer (main product page with hero section and calculator)
- `/tools` - Tools hub page listing all calculators and tools
- `/tools/buybox` - BuyBox mandate builder with Google Maps polygon drawing
- `/tools/buybox/agreement` - E-signature agreement page for buyer representation
- `/tools/buybox/confirmation/:id` - Confirmation page after mandate submission
- `/tools/coinvest` - Co-Investing landing page with feature overview
- `/tools/coinvest/opportunities` - Browse and filter co-investing groups
- `/tools/coinvest/checklist` - Interactive complexity assessment tool
- `/tools/coinvest/groups/new` - Multi-step group creation wizard (requires auth)
- `/tools/coinvest/groups/:id` - Group detail page with chat for approved members

#### Community (/community/*)
- `/community` - Community hub page
- `/community/events` - Events and workshops
- `/community/network` - Grow your network / find partners

#### Insights (/insights/*)
- `/insights` - Insights hub page
- `/insights/podcast` - Podcast episodes
- `/insights/blog` - Blog articles
- `/insights/guides` - Educational guides and resources

#### About (/about/*)
- `/about` - Team bios and company information
- `/about/shop` - Realist merchandise
- `/about/contact` - Contact page

#### Other Pages
- `/admin` - Protected dashboard for lead and webhook management
- `/privacy` and `/terms` - Legal pages
- `/login` - User login page
- `/create-account` - New user registration
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset with token
- `/set-password` - Account setup for auto-enrolled leads
- `/realtor/buyboxes` - Realtor dashboard to view and respond to mandates

#### Redirects (Old Routes → New Routes)
- `/buybox` → `/tools/buybox`
- `/coinvesting` → `/tools/coinvest`
- `/events` → `/community/events`
- `/podcast` → `/insights/podcast`
- `/blog` → `/insights/blog`
- `/shop` → `/about/shop`

### Authentication System
- **Type**: Custom email/password authentication (not Replit OAuth)
- **Session Store**: PostgreSQL-backed sessions via connect-pg-simple
- **Password Hashing**: bcrypt with 12 rounds
- **Security Features**:
  - SHA-256 hashed tokens for password reset and account setup
  - Single-use tokens with expiration (1 hour for reset, 24 hours for setup)
  - Token invalidation on new request
  - SESSION_SECRET validation at startup
  - Development-only token logging (disabled in production)
- **Lead Auto-Enrollment**: When leads submit the deal analyzer form, accounts are created without passwords; setup tokens are sent via email (logged in dev mode)

## External Dependencies

### CRM Integration
- **GoHighLevel (GHL)**: Webhook integration for lead delivery
- **Configuration**: `GHL_WEBHOOK_URL` environment variable
- **Features**: Retry logic with exponential backoff, delivery logging in database

### Database
- **PostgreSQL**: Required, configured via `DATABASE_URL` environment variable
- **Session Store**: connect-pg-simple for Express sessions

### Third-Party Services (Planned/Configurable)
- **Google Maps Places API**: For address autocomplete and geocoding (referenced in requirements)
- **PDF Export**: html-to-image and jsPDF for analysis exports

## Recent Changes

### True Cost of Homeownership Calculator (February 2026)
- New tool at `/tools/true-cost` for Ontario homebuyers
- Calculates all hidden costs: development charges, land transfer taxes, HST with rebates
- Supports 6 Ontario cities (Toronto, Mississauga, Brampton, Ottawa, Hamilton, London)
- Handles new construction vs resale, first-time vs repeat buyers, different home types
- Pie chart visualization of cost breakdown
- Data sources: BILD/Altus 2023, CRA, Ontario Government

### Lead Capture Improvements (February 2026)
- Google Sheets webhook backup for all lead creation endpoints (Deal Analyzer, MLI Select, engagement forms)
- HMAC SHA-256 signature authentication for webhook security (WEBHOOK_SECRET)
- Auto-creation of user accounts when leads submit forms (passwordless, users can set password later)
- Pre-fill Deal Analyzer form for logged-in users from their profile
- Auto-submit lead data for authenticated users (skip modal display)

### BRA Gating for Co-Investing (February 2026)
- Buyer Representation Agreement (BRA) gating for Ontario users in Co-Investing
- Ontario users must complete BRA signing flow before creating groups, joining groups, or messaging
- Server-side authorization guards on protected routes with compliance logging
- Frontend RepresentationGate component wraps group creation page
- RepresentationStatusBanner shows compliance status on all Co-Invest pages
- Proper error handling redirects users to representation flow when blocked
- Other provinces have direct access without representation requirements
- Database tables: coInvestUserProfiles (BRA fields), coInvestComplianceLogs
- PROVINCES constant in client/src/lib/provinces.ts for jurisdiction dropdown

### Co-Investing Platform (February 2026)
- Co-Investing feature for finding partners and pooling capital for real estate deals
- Multi-step group creation wizard with complexity scoring system (0-100 score, 3-tier classification)
- Educational disclaimer system throughout emphasizing this is not legal/securities/tax advice
- Complexity checklist evaluates 10+ factors (passive investors, profit promises, centralized management, etc.)
- Tier classification: simple_coownership (<30), borderline (30-60), likely_complex (>60)
- Public/private group visibility with member approval workflow
- Basic chat functionality for approved group members
- Database tables: coInvestUserProfiles, coInvestGroups, coInvestMemberships, coInvestChecklistResults, coInvestMessages
- Navigation updated with "Co-Invest" link
- Frontend library: `client/src/lib/coinvesting.ts` for shared labels and complexity calculation

### BuyBox Mandate System (January 2026)
- Multi-step BuyBox builder for buyers to define target investment areas
- Google Maps polygon drawing to define search geography
- Optional mandate details: price range, lot dimensions, building type, occupancy, closing conditions
- E-signature agreement page with buyer representation terms
- Session-based data transport (sessionStorage) to handle large polygons
- Automatic cleanup of session data on flow abandonment or completion
- Database tables: buyBoxAgreements, buyBoxMandates, buyBoxResponses, buyBoxNotifications
- Realtor dashboard at `/realtor/buyboxes` with status and building type filters
- Email notifications to danielfoch@gmail.com on new mandate submissions
- API routes with Zod validation and authentication/authorization checks

### Stress Test Analysis (January 2026)
- Added stress test feature to Deal Analyzer showing Base/Bear/Bull scenarios
- Compact table format in ResultsSummary displaying NOI, DSCR, Cash Flow, and Equity across scenarios
- Proforma table now has scenario selection buttons (Base/Bear/Bull) with full 10-year projections for each
- Assumptions displayed when Bear or Bull scenario is selected
- Bear case: -5% rent, +3% vacancy, +5% expenses, +1% interest rate
- Bull case: +3% rent, -1% vacancy, -2% expenses, -0.5% interest rate

### MLI Select Calculator
- Standalone CMHC MLI Select points calculator as top-level calculator
- Full underwriting with NOI, DSCR, and debt service calculations
- Insurance premiums properly financed into loan balance
- LTV slider with "Find Max LTC for DSCR >= 1.10" optimization
- Stress testing table with configurable scenarios
- Lead capture integration with MLISelect webhook type

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation
- `@tanstack/react-query` - Data fetching and caching
- `recharts` - Financial charts and visualizations
- `@hookform/resolvers` / `zod` - Form validation
- `date-fns` - Date formatting
- Full Radix UI component suite via shadcn/ui