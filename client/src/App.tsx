import { Switch, Route } from "wouter";
import { Suspense, useEffect } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Loader2 } from "lucide-react";
import { GetAppBanner } from "@/components/GetAppBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { initNativePush } from "@/lib/capacitorPush";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Redirect } from "@/components/Redirect";
import { TrafficAnalyticsTracker } from "@/components/TrafficAnalyticsTracker";

// Eager pages — highest-traffic entry points stay in the main chunk so the
// most common landings render with zero extra network round-trips:
// - InvestorStart: "/" homepage
// - Events / EventDetail / EventSuccess: event marketing + ticket purchase
//   funnel (incl. the post-Stripe success redirect, which must never flash a
//   loader after payment)
// - Login / Signup: primary auth entries
// - NotFound: tiny, avoids a spinner flash on bad URLs
import InvestorStart from "@/pages/InvestorStart";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import EventSuccess from "@/pages/EventSuccess";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
/* resolved: the following pages are lazy-loaded below
import CreateAccount from "@/pages/CreateAccount";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SetPassword from "@/pages/SetPassword";
import VerifyPhone from "@/pages/VerifyPhone";
import BuyBox from "@/pages/BuyBox";
import BuyBoxAgreement from "@/pages/BuyBoxAgreement";
import BuyBoxCheckout from "@/pages/BuyBoxCheckout";
import BuyBoxConfirmation from "@/pages/BuyBoxConfirmation";
import RealtorBuyBoxes from "@/pages/RealtorBuyBoxes";
import CoInvesting from "@/pages/CoInvesting";
import CoInvestingOpportunities from "@/pages/CoInvestingOpportunities";
import CoInvestingChecklist from "@/pages/CoInvestingChecklist";
import CoInvestingGroupNew from "@/pages/CoInvestingGroupNew";
import CoInvestingGroupDetail from "@/pages/CoInvestingGroupDetail";
import DealDesk from "@/pages/DealDesk";
import Offer from "@/pages/Offer";
import CrmHome from "@/pages/CrmHome";
import MeetupNew from "@/pages/MeetupNew";
import SponsorPackagePage from "@/pages/SponsorPackagePage";
import AdminSponsors from "@/pages/AdminSponsors";
import CrmContact from "@/pages/CrmContact";
import TrueCost from "@/pages/TrueCost";
import RentVsBuy from "@/pages/RentVsBuy";
import RentToOwn from "@/pages/RentToOwn";
import WillItPlex from "@/pages/WillItPlex";
import Leaderboard from "@/pages/Leaderboard";
import FullLeaderboard from "@/pages/FullLeaderboard";
import Premium from "@/pages/Premium";
import PremiumBranding from "@/pages/PremiumBranding";
import CapRates from "@/pages/CapRates";
import ListingIntelligence from "@/pages/ListingIntelligence";
import ListingDetailPage from "@/pages/ListingDetailPage";
import Experts from "@/pages/Experts";
import ExpertProfile from "@/pages/ExpertProfile";
import JoinExperts from "@/pages/JoinExperts";
import RealtorNetwork from "@/pages/RealtorNetwork";
import MarketReport from "@/pages/MarketReport";
import MortgageRates from "@/pages/MortgageRates";
import FixedVsVariable from "@/pages/FixedVsVariable";
import LandClaimScreener from "@/pages/LandClaimScreener";
import DistressReport from "@/pages/DistressReport";
import MultiplexFit from "@/pages/MultiplexFit";
import MultiplexMasterclass from "@/pages/MultiplexMasterclass";
import MultiplexFeasibilityPage from "@/pages/MultiplexFeasibilityPage";
import MultiplexUnderwriterPage from "@/pages/MultiplexUnderwriterPage";
import PowerTeam from "@/pages/PowerTeam";
import PowerTeamProfile from "@/pages/PowerTeamProfile";
import AdminPowerTeam from "@/pages/AdminPowerTeam";
import OntarioHstRebateCalculator from "@/pages/OntarioHstRebateCalculator";
import Course from "@/pages/Course";
import MarketReportBuilder from "@/pages/MarketReportBuilder";
import BuildingPermitsReport from "@/pages/BuildingPermitsReport";
import ProductivityGapReport from "@/pages/ProductivityGapReport";
import NewConstructionCanadaReport from "@/pages/NewConstructionCanadaReport";
import GtaPreconPricingReport from "@/pages/GtaPreconPricingReport";
import CpiInflationReport from "@/pages/CpiInflationReport";
import CreditSpreadEconomyReport from "@/pages/CreditSpreadEconomyReport";
import SpringEconomicUpdate2026Report from "@/pages/SpringEconomicUpdate2026Report";
import PreconResale1990sReport from "@/pages/PreconResale1990sReport";
import BankOfCanadaApril2026Report, { BankOfCanadaApril2026ReportEmbed } from "@/pages/BankOfCanadaApril2026Report";
import LabourForceSurveyApril2026Report from "@/pages/LabourForceSurveyApril2026Report";
import LabourForceSurveyMay2026Report from "@/pages/LabourForceSurveyMay2026Report";
import StatCanGdpQ12026Report from "@/pages/StatCanGdpQ12026Report";
import HousingCorrectionLockedOut2026Report from "@/pages/HousingCorrectionLockedOut2026Report";
import LabourMortgageStressApril2026Report from "@/pages/LabourMortgageStressApril2026Report";
import MonthlyMarketReportMay2026 from "@/pages/MonthlyMarketReportMay2026";
import InterprovincialMigrationCanada2026Report from "@/pages/InterprovincialMigrationCanada2026Report";
import SeoProjectDetail from "@/pages/SeoProjectDetail";
import {
  TorontoHousingMarketPage,
  TorontoCondoPricesDroppingPage,
  BiggestPriceDropsGtaPage,
  CanadaHousingMarketPage,
} from "@/pages/seo/MarketPages";
import JoinRealtors from "@/pages/JoinRealtors";
import JoinMortgageBrokers from "@/pages/JoinMortgageBrokers";
import PartnerOnboarding from "@/pages/PartnerOnboarding";
import JoinLenders from "@/pages/JoinLenders";
import MyPerformance from "@/pages/MyPerformance";
import DailyGlance from "@/pages/DailyGlance";
import Stats from "@/pages/Stats";
import UsListings from "@/pages/UsListings";
import PublicProfile from "@/pages/PublicProfile";
import WorkWithRealist from "@/pages/WorkWithRealist";
import PitchDeck from "@/pages/PitchDeck";
import UnderwritingShare from "@/pages/UnderwritingShare";
import AccountApiKeys from "@/pages/AccountApiKeys";
import NotificationPreferences from "@/pages/NotificationPreferences";
import ThankYouVancouver from "@/pages/ThankYouVancouver";
import EdmontonEvent from "@/pages/EdmontonEvent";
resolved end */
import NotFound from "@/pages/not-found";

// Lazy pages — code-split into per-route chunks, fetched on first navigation.
const MapHomepage = lazy(() => import("@/pages/MapHomepage"));
const Home = lazy(() => import("@/pages/Home"));
const About = lazy(() => import("@/pages/About"));
const Notebook = lazy(() => import("@/pages/Notebook"));
const NotebookPrint = lazy(() => import("@/pages/NotebookPrint"));
const DanielFoch = lazy(() => import("@/pages/DanielFoch"));
const NickHill = lazy(() => import("@/pages/NickHill"));
const LocalExperts = lazy(() => import("@/pages/LocalExperts"));
const UnpackingMultiplexesToronto = lazy(() => import("@/pages/UnpackingMultiplexesToronto"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const Shop = lazy(() => import("@/pages/Shop"));
const Compare = lazy(() => import("@/pages/Compare"));
const Podcast = lazy(() => import("@/pages/Podcast"));
const PodcastEpisodeDetail = lazy(() => import("@/pages/PodcastEpisodeDetail"));
const Videos = lazy(() => import("@/pages/Videos"));
const VideoDetail = lazy(() => import("@/pages/VideoDetail"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminDealDesk = lazy(() => import("@/pages/AdminDealDesk"));
const AdminEvents = lazy(() => import("@/pages/AdminEvents"));
const AdminEventRoster = lazy(() => import("@/pages/AdminEventRoster"));
const AdminEventNew = lazy(() => import("@/pages/AdminEventNew"));
const AdminEventEdit = lazy(() => import("@/pages/AdminEventEdit"));
const Meetups = lazy(() => import("@/pages/Meetups"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const InvestorPortal = lazy(() => import("@/pages/InvestorPortal"));
const PartnerPortal = lazy(() => import("@/pages/PartnerPortal"));
const ProfessionalDashboard = lazy(() => import("@/pages/ProfessionalDashboard"));
const CreateAccount = lazy(() => import("@/pages/CreateAccount"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SetPassword = lazy(() => import("@/pages/SetPassword"));
const VerifyPhone = lazy(() => import("@/pages/VerifyPhone"));
const BuyBox = lazy(() => import("@/pages/BuyBox"));
const BuyBoxAgreement = lazy(() => import("@/pages/BuyBoxAgreement"));
const BuyBoxCheckout = lazy(() => import("@/pages/BuyBoxCheckout"));
const BuyBoxConfirmation = lazy(() => import("@/pages/BuyBoxConfirmation"));
const RealtorBuyBoxes = lazy(() => import("@/pages/RealtorBuyBoxes"));
const CoInvesting = lazy(() => import("@/pages/CoInvesting"));
const CoInvestingOpportunities = lazy(() => import("@/pages/CoInvestingOpportunities"));
const CoInvestingChecklist = lazy(() => import("@/pages/CoInvestingChecklist"));
const CoInvestingGroupNew = lazy(() => import("@/pages/CoInvestingGroupNew"));
const CoInvestingGroupDetail = lazy(() => import("@/pages/CoInvestingGroupDetail"));
const DealDesk = lazy(() => import("@/pages/DealDesk"));
const Offer = lazy(() => import("@/pages/Offer"));
const CrmHome = lazy(() => import("@/pages/CrmHome"));
const MeetupNew = lazy(() => import("@/pages/MeetupNew"));
const SponsorPackagePage = lazy(() => import("@/pages/SponsorPackagePage"));
const AdminSponsors = lazy(() => import("@/pages/AdminSponsors"));
const CrmContact = lazy(() => import("@/pages/CrmContact"));
const TrueCost = lazy(() => import("@/pages/TrueCost"));
const RentVsBuy = lazy(() => import("@/pages/RentVsBuy"));
const RentToOwn = lazy(() => import("@/pages/RentToOwn"));
const WillItPlex = lazy(() => import("@/pages/WillItPlex"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const FullLeaderboard = lazy(() => import("@/pages/FullLeaderboard"));
const Premium = lazy(() => import("@/pages/Premium"));
const PremiumBranding = lazy(() => import("@/pages/PremiumBranding"));
const CapRates = lazy(() => import("@/pages/CapRates"));
const ListingIntelligence = lazy(() => import("@/pages/ListingIntelligence"));
const ListingDetailPage = lazy(() => import("@/pages/ListingDetailPage"));
const Experts = lazy(() => import("@/pages/Experts"));
const ExpertProfile = lazy(() => import("@/pages/ExpertProfile"));
const JoinExperts = lazy(() => import("@/pages/JoinExperts"));
const RealtorNetwork = lazy(() => import("@/pages/RealtorNetwork"));
const MarketReport = lazy(() => import("@/pages/MarketReport"));
const MortgageRates = lazy(() => import("@/pages/MortgageRates"));
const FixedVsVariable = lazy(() => import("@/pages/FixedVsVariable"));
const LandClaimScreener = lazy(() => import("@/pages/LandClaimScreener"));
const DistressReport = lazy(() => import("@/pages/DistressReport"));
const MultiplexFit = lazy(() => import("@/pages/MultiplexFit"));
const MultiplexMasterclass = lazy(() => import("@/pages/MultiplexMasterclass"));
const MultiplexFeasibilityPage = lazy(() => import("@/pages/MultiplexFeasibilityPage"));
const MultiplexUnderwriterPage = lazy(() => import("@/pages/MultiplexUnderwriterPage"));
const PowerTeam = lazy(() => import("@/pages/PowerTeam"));
const OntarioHstRebateCalculator = lazy(() => import("@/pages/OntarioHstRebateCalculator"));
const Course = lazy(() => import("@/pages/Course"));
const MarketReportBuilder = lazy(() => import("@/pages/MarketReportBuilder"));
const BuildingPermitsReport = lazy(() => import("@/pages/BuildingPermitsReport"));
const ProductivityGapReport = lazy(() => import("@/pages/ProductivityGapReport"));
const NewConstructionCanadaReport = lazy(() => import("@/pages/NewConstructionCanadaReport"));
const GtaPreconPricingReport = lazy(() => import("@/pages/GtaPreconPricingReport"));
const CpiInflationReport = lazy(() => import("@/pages/CpiInflationReport"));
const CreditSpreadEconomyReport = lazy(() => import("@/pages/CreditSpreadEconomyReport"));
const SpringEconomicUpdate2026Report = lazy(() => import("@/pages/SpringEconomicUpdate2026Report"));
const PreconResale1990sReport = lazy(() => import("@/pages/PreconResale1990sReport"));
const BankOfCanadaApril2026Report = lazy(() => import("@/pages/BankOfCanadaApril2026Report"));
const BankOfCanadaApril2026ReportEmbed = lazy(() =>
  import("@/pages/BankOfCanadaApril2026Report").then((m) => ({
    default: m.BankOfCanadaApril2026ReportEmbed,
  })),
);
const LabourForceSurveyApril2026Report = lazy(() => import("@/pages/LabourForceSurveyApril2026Report"));
const LabourForceSurveyMay2026Report = lazy(() => import("@/pages/LabourForceSurveyMay2026Report"));
const StatCanGdpQ12026Report = lazy(() => import("@/pages/StatCanGdpQ12026Report"));
const HousingCorrectionLockedOut2026Report = lazy(() => import("@/pages/HousingCorrectionLockedOut2026Report"));
const LabourMortgageStressApril2026Report = lazy(() => import("@/pages/LabourMortgageStressApril2026Report"));
const MonthlyMarketReportMay2026 = lazy(() => import("@/pages/MonthlyMarketReportMay2026"));
const InterprovincialMigrationCanada2026Report = lazy(() => import("@/pages/InterprovincialMigrationCanada2026Report"));
const SeoProjectDetail = lazy(() => import("@/pages/SeoProjectDetail"));
const TorontoHousingMarketPage = lazy(() =>
  import("@/pages/seo/MarketPages").then((m) => ({ default: m.TorontoHousingMarketPage })),
);
const TorontoCondoPricesDroppingPage = lazy(() =>
  import("@/pages/seo/MarketPages").then((m) => ({ default: m.TorontoCondoPricesDroppingPage })),
);
const BiggestPriceDropsGtaPage = lazy(() =>
  import("@/pages/seo/MarketPages").then((m) => ({ default: m.BiggestPriceDropsGtaPage })),
);
const CanadaHousingMarketPage = lazy(() =>
  import("@/pages/seo/MarketPages").then((m) => ({ default: m.CanadaHousingMarketPage })),
);
const JoinRealtors = lazy(() => import("@/pages/JoinRealtors"));
const JoinMortgageBrokers = lazy(() => import("@/pages/JoinMortgageBrokers"));
const PartnerOnboarding = lazy(() => import("@/pages/PartnerOnboarding"));
const JoinLenders = lazy(() => import("@/pages/JoinLenders"));
const MyPerformance = lazy(() => import("@/pages/MyPerformance"));
const Stats = lazy(() => import("@/pages/Stats"));
const UsListings = lazy(() => import("@/pages/UsListings"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const WorkWithRealist = lazy(() => import("@/pages/WorkWithRealist"));
const PitchDeck = lazy(() => import("@/pages/PitchDeck"));
const UnderwritingShare = lazy(() => import("@/pages/UnderwritingShare"));
const AccountApiKeys = lazy(() => import("@/pages/AccountApiKeys"));
const ThankYouVancouver = lazy(() => import("@/pages/ThankYouVancouver"));
const EdmontonEvent = lazy(() => import("@/pages/EdmontonEvent"));

// Hub Pages
const ToolsHub = lazy(() => import("@/pages/ToolsHub"));
const CommunityHub = lazy(() => import("@/pages/CommunityHub"));
const PropertyQuestions = lazy(() => import("@/pages/PropertyQuestions"));
const InsightsHub = lazy(() => import("@/pages/InsightsHub"));
const GuidesHub = lazy(() => import("@/pages/GuidesHub"));
const EncyclopediaIndex = lazy(() => import("@/pages/EncyclopediaIndex"));
const GuidePage = lazy(() => import("@/pages/GuidePage"));
const EncyclopediaDetail = lazy(() => import("@/pages/EncyclopediaDetail"));
const CapitalStackCanadaGuide = lazy(() => import("@/pages/CapitalStackCanadaGuide"));
const ABCLendersCanadaGuide = lazy(() => import("@/pages/ABCLendersCanadaGuide"));
const ReportsHub = lazy(() => import("@/pages/ReportsHub"));
const ReportPage = lazy(() => import("@/pages/ReportPage"));
const ConfigReportPage = lazy(() => import("@/pages/ConfigReportPage"));
const IrccImmigrationDashboardReport = lazy(() => import("@/pages/IrccImmigrationDashboardReport"));
const RealBenchReport = lazy(() => import("@/pages/RealBenchReport"));
const MarketsHub = lazy(() => import("@/pages/MarketsHub"));
const ProgrammaticMarketPage = lazy(() => import("@/pages/ProgrammaticMarketPage"));
const StrategiesHub = lazy(() => import("@/pages/StrategiesHub"));
const ProgrammaticStrategyPage = lazy(() => import("@/pages/ProgrammaticStrategyPage"));
const NetworkHub = lazy(() => import("@/pages/NetworkHub"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const InvestorOperatingSystem = lazy(() => import("@/pages/InvestorOperatingSystem"));
const Watchlist = lazy(() => import("@/pages/Watchlist"));
const BookACall = lazy(() => import("@/pages/BookACall"));
const DealRoom = lazy(() => import("@/pages/DealRoom"));
const FinancingReadiness = lazy(() => import("@/pages/FinancingReadiness"));
const DailyGlance = lazy(() => import("@/pages/DailyGlance"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const PowerTeamProfile = lazy(() => import("@/pages/PowerTeamProfile"));
const AdminPowerTeam = lazy(() => import("@/pages/AdminPowerTeam"));

// Matches the full-page loading state used across pages
// (e.g. CoInvestingGroupDetail, TrueCost).
function PageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <>
    <GetAppBanner />
    <Suspense fallback={<PageFallback />}>
    <Switch>
      {/* Main entry - simplified investor homepage */}
      <Route path="/" component={InvestorStart} />
      <Route path="/discover" component={MapHomepage} />
      <Route path="/deal-analyzer">{() => <Redirect to="/tools/analyzer" />}</Route>

      {/* New Tools routes */}
      <Route path="/tools" component={ToolsHub} />
      <Route path="/tools/analyzer">{() => <Home />}</Route>
      <Route path="/tools/buybox" component={BuyBox} />
      <Route path="/tools/buybox/agreement" component={BuyBoxAgreement} />
      <Route path="/tools/buybox/checkout" component={BuyBoxCheckout} />
      <Route path="/tools/buybox/confirmation/:id" component={BuyBoxConfirmation} />
      <Route path="/tools/coinvest" component={CoInvesting} />
      <Route path="/tools/coinvest/opportunities" component={CoInvestingOpportunities} />
      <Route path="/tools/coinvest/checklist" component={CoInvestingChecklist} />
      <Route path="/tools/coinvest/groups/new" component={CoInvestingGroupNew} />
      <Route path="/tools/coinvest/groups/:id" component={CoInvestingGroupDetail} />
      <Route path="/deal-desk">{() => <Redirect to="/tools/deal-desk" />}</Route>
      <Route path="/offer" component={Offer} />
      <Route path="/crm" component={CrmHome} />
      <Route path="/community/meetups/new" component={MeetupNew} />
      <Route path="/sponsor/:slug" component={SponsorPackagePage} />
      <Route path="/admin/sponsors" component={AdminSponsors} />
      <Route path="/crm/contacts/:id" component={CrmContact} />
      <Route path="/tools/deal-desk" component={DealDesk} />
      <Route path="/tools/true-cost" component={TrueCost} />
      <Route path="/tools/rent-vs-buy" component={RentVsBuy} />
      <Route path="/tools/rent-to-own" component={RentToOwn} />
      <Route path="/tools/cap-rates" component={CapRates} />
      <Route path="/listing-intelligence">{() => <Redirect to="/tools/listing-intelligence" />}</Route>
      <Route path="/tools/listing-intelligence" component={ListingIntelligence} />
      <Route path="/listings/us" component={UsListings} />
      <Route path="/listings/:mlsNumber" component={ListingDetailPage} />
      <Route path="/join/experts" component={JoinExperts} />
      <Route path="/experts" component={Experts} />
      <Route path="/experts/:userId" component={ExpertProfile} />
      <Route path="/tools/investor-os" component={InvestorOperatingSystem} />
      <Route path="/deals">{() => <Redirect to="/watchlist" />}</Route>
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/deal-challenge">{() => <Redirect to="/tools/investor-os" />}</Route>
      <Route path="/professionals">{() => <Redirect to="/power-team" />}</Route>
      <Route path="/tools/will-it-plex" component={WillItPlex} />
      <Route path="/tools/fixed-vs-variable" component={FixedVsVariable} />
      <Route path="/tools/hst-rebate" component={OntarioHstRebateCalculator} />
      <Route path="/tools/land-claim-screener" component={LandClaimScreener} />
      <Route path="/tools/distress-deals">{() => <Redirect to="/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1" />}</Route>
      <Route path="/tools/motivated-deals">{() => <Redirect to="/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1" />}</Route>
      <Route path="/tools/multiplex-feasibility" component={MultiplexFeasibilityPage} />
      <Route path="/tools/multiplex-underwriter" component={MultiplexUnderwriterPage} />
      <Route path="/power-team" component={PowerTeam} />
      <Route path="/power-team/profile" component={PowerTeamProfile} />
      <Route path="/work-with-realist" component={WorkWithRealist} />
      <Route path="/multiplex-investor-fit" component={MultiplexFit} />
      <Route path="/masterclass" component={MultiplexMasterclass} />
      <Route path="/course" component={Course} />
      <Route path="/insights/distress-report">{() => <Redirect to="/insights/motivated-report" />}</Route>
      <Route path="/insights/motivated-report" component={DistressReport} />
      <Route path="/community/leaderboard" component={Leaderboard} />
      <Route path="/community/leaderboard/full" component={FullLeaderboard} />
      <Route path="/u/:userId" component={PublicProfile} />
      <Route path="/my-performance" component={MyPerformance} />
      <Route path="/stats">{() => <Redirect to="/tools/stats" />}</Route>
      <Route path="/tools/stats" component={Stats} />
      <Route path="/analyses/:id/deck" component={PitchDeck} />
      <Route path="/underwriting/:token" component={UnderwritingShare} />
      <Route path="/account/api-keys" component={AccountApiKeys} />
      <Route path="/account/notifications" component={NotificationPreferences} />
      <Route path="/insights/market-report" component={MarketReport} />
      <Route path="/insights/mortgage-rates" component={MortgageRates} />
      <Route path="/insights/market-report-builder" component={MarketReportBuilder} />
      <Route path="/insights/building-permits" component={BuildingPermitsReport} />
      <Route path="/insights/productivity-gap" component={ProductivityGapReport} />
      <Route path="/insights/new-construction-canada" component={NewConstructionCanadaReport} />
      <Route path="/insights/gta-precon-pricing" component={GtaPreconPricingReport} />
      <Route path="/insights/cpi-march-2026" component={CpiInflationReport} />
      <Route path="/insights/the-spread-that-ate-the-economy" component={CreditSpreadEconomyReport} />
      <Route path="/insights/spring-economic-update-2026" component={SpringEconomicUpdate2026Report} />
      <Route path="/insights/precon-vs-resale-1990s" component={PreconResale1990sReport} />
      <Route path="/insights/bank-of-canada-april-2026">{() => <BankOfCanadaApril2026Report />}</Route>
      <Route path="/embed/insights/bank-of-canada-april-2026" component={BankOfCanadaApril2026ReportEmbed} />
      <Route path="/insights/statcan-labour-force-survey-may-2026" component={LabourForceSurveyMay2026Report} />
      <Route path="/insights/statcan-labour-force-survey-april-2026" component={LabourForceSurveyApril2026Report} />
      <Route path="/insights/statcan-gdp-q1-2026" component={StatCanGdpQ12026Report} />
      <Route path="/insights/housing-correction-locked-out-2026" component={HousingCorrectionLockedOut2026Report} />
      <Route path="/insights/labour-mortgage-stress-april-2026" component={LabourMortgageStressApril2026Report} />
      <Route path="/insights/monthly-market-report-may-2026" component={MonthlyMarketReportMay2026} />
      <Route path="/insights/canada-interprovincial-migration-2026" component={InterprovincialMigrationCanada2026Report} />
      <Route path="/insights/market-report/homebench-ai-realtor-benchmark">{() => <Redirect to="/reports/realbench-ai-realtor-benchmark" />}</Route>
      {/* SEO landing pages — programmatic + query-driven */}
      <Route path="/canada-housing-market" component={CanadaHousingMarketPage} />
      <Route path="/toronto-housing-market" component={TorontoHousingMarketPage} />
      <Route path="/toronto-condo-prices-dropping" component={TorontoCondoPricesDroppingPage} />
      <Route path="/biggest-price-drops-gta" component={BiggestPriceDropsGtaPage} />
      <Route path="/projects/:slug" component={SeoProjectDetail} />
      <Route path="/premium" component={Premium} />
      <Route path="/premium/branding" component={PremiumBranding} />

      {/* New Community routes */}
      <Route path="/community" component={CommunityHub} />
      <Route path="/community/questions" component={PropertyQuestions} />
      <Route path="/community/events" component={Events} />
      <Route path="/meetups" component={Meetups} />
      <Route path="/community/meetups">{() => <Redirect to="/meetups" />}</Route>
      <Route path="/community/events/unpacking-multiplexes-toronto" component={UnpackingMultiplexesToronto} />
      <Route path="/community/network" component={NetworkHub} />

      {/* New Insights routes */}
      <Route path="/insights" component={InsightsHub} />
      {/* Config-driven reports (data + narrative content files, no bespoke code) */}
      <Route path="/insights/reports/:slug" component={ConfigReportPage} />
      <Route path="/insights/podcast" component={Podcast} />
      <Route path="/insights/podcast/:slug" component={PodcastEpisodeDetail} />
      <Route path="/insights/videos" component={Videos} />
      <Route path="/insights/videos/:slug" component={VideoDetail} />
      <Route path="/insights/blog" component={Blog} />
      <Route path="/insights/blog/:slug" component={BlogPost} />
      <Route path="/insights/guides" component={GuidesHub} />
      <Route path="/insights/encyclopedia" component={EncyclopediaIndex} />
      <Route path="/insights/encyclopedia/:slug" component={EncyclopediaDetail} />
      <Route path="/insights/guides/capital-stack-canada" component={CapitalStackCanadaGuide} />
      <Route path="/insights/guides/a-vs-b-vs-c-lenders-canada" component={ABCLendersCanadaGuide} />
      <Route path="/insights/guides/:slug" component={GuidePage} />
      <Route path="/reports" component={ReportsHub} />
      <Route path="/reports/canada-immigration-dashboard-2026" component={IrccImmigrationDashboardReport} />
      <Route path="/reports/realbench-ai-realtor-benchmark" component={RealBenchReport} />
      <Route path="/reports/:slug" component={ReportPage} />
      <Route path="/markets" component={MarketsHub} />
      <Route path="/markets/:city" component={ProgrammaticMarketPage} />
      <Route path="/investing" component={StrategiesHub} />
      <Route path="/investing/:strategy" component={ProgrammaticStrategyPage} />

      {/* New About routes */}
      <Route path="/about" component={About} />
      <Route path="/about/local-experts" component={LocalExperts} />
      <Route path="/about/team">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/programs">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/shop" component={Shop} />
      <Route path="/about/contact" component={ContactPage} />
      <Route path="/book-a-call" component={BookACall} />
      <Route path="/deal-room" component={DealRoom} />
      <Route path="/tools/financing-readiness" component={FinancingReadiness} />
      <Route path="/thank-you/vancouver-multiplex-2026" component={ThankYouVancouver} />

      {/* Event-day landing — Realist Multiplex Edmonton (QR target; /yeg is the stage-friendly alias) */}
      <Route path="/edmonton" component={EdmontonEvent} />
      <Route path="/yeg" component={EdmontonEvent} />

      {/* Redirects from old routes to new routes */}
      <Route path="/buybox">{() => <Redirect to="/tools/buybox" />}</Route>
      <Route path="/buybox/agreement">{() => <Redirect to="/tools/buybox/agreement" />}</Route>
      <Route path="/buybox/checkout">{() => <Redirect to="/tools/buybox/checkout" />}</Route>
      <Route path="/buybox/confirmation/:id">{(props: any) => <Redirect to={`/tools/buybox/confirmation/${props.params?.id}`} />}</Route>
      <Route path="/coinvesting">{() => <Redirect to="/tools/coinvest" />}</Route>
      <Route path="/coinvesting/opportunities">{() => <Redirect to="/tools/coinvest/opportunities" />}</Route>
      <Route path="/coinvesting/checklist">{() => <Redirect to="/tools/coinvest/checklist" />}</Route>
      <Route path="/coinvesting/groups/new">{() => <Redirect to="/tools/coinvest/groups/new" />}</Route>
      <Route path="/coinvesting/groups/:id">{(props: any) => <Redirect to={`/tools/coinvest/groups/${props.params?.id}`} />}</Route>
      <Route path="/events">{() => <Redirect to="/community/events" />}</Route>
      <Route path="/notebook" component={Notebook} />
      <Route path="/notebook/print" component={NotebookPrint} />
      <Route path="/danielfoch" component={DanielFoch} />
      <Route path="/nickhill" component={NickHill} />
      <Route path="/podcast">{() => <Redirect to="/insights/podcast" />}</Route>
      <Route path="/blog">{() => <Redirect to="/insights/blog" />}</Route>
      <Route path="/shop">{() => <Redirect to="/about/shop" />}</Route>
      <Route path="/dashboard" component={DailyGlance} />
      {/* Existing routes that remain unchanged */}
      <Route path="/compare" component={Compare} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/deal-desk" component={AdminDealDesk} />
      <Route path="/admin/power-team" component={AdminPowerTeam} />
      <Route path="/admin/events" component={AdminEvents} />
      <Route path="/admin/events/new" component={AdminEventNew} />
      <Route path="/admin/events/:id/edit" component={AdminEventEdit} />
      <Route path="/admin/events/:id/roster" component={AdminEventRoster} />
      <Route path="/events/:slug/success" component={EventSuccess} />
      <Route path="/events/:slug" component={EventDetail} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/investor" component={InvestorPortal} />
      <Route path="/partner" component={PartnerPortal} />
      <Route path="/professional/dashboard" component={ProfessionalDashboard} />
      <Route path="/signup" component={Signup} />
      <Route path="/get-started">{() => <Redirect to="/signup" />}</Route>
      <Route path="/login" component={Login} />
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/verify-phone" component={VerifyPhone} />
      <Route path="/realtor/buyboxes" component={RealtorBuyBoxes} />
      <Route path="/partner/network" component={RealtorNetwork} />
      <Route path="/partner/onboarding" component={PartnerOnboarding} />
      <Route path="/join/realtors" component={JoinRealtors} />
      <Route path="/join/mortgage-brokers" component={JoinMortgageBrokers} />
      <Route path="/join/lenders" component={JoinLenders} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
    </Suspense>
    <SiteFooter />
    </>
  );
}

function App() {
  useEffect(() => {
    initNativePush();
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <TrafficAnalyticsTracker />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
