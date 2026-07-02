import { Switch, Route } from "wouter";
import { GetAppBanner } from "@/components/GetAppBanner";
import { useEffect } from "react";
import { initNativePush } from "@/lib/capacitorPush";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Redirect } from "@/components/Redirect";

// Pages
import MapHomepage from "@/pages/MapHomepage";
import Home from "@/pages/Home";
import InvestorStart from "@/pages/InvestorStart";
import About from "@/pages/About";
import Events from "@/pages/Events";
import Notebook from "@/pages/Notebook";
import NotebookPrint from "@/pages/NotebookPrint";
import DanielFoch from "@/pages/DanielFoch";
import NickHill from "@/pages/NickHill";
import UnpackingMultiplexesToronto from "@/pages/UnpackingMultiplexesToronto";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Shop from "@/pages/Shop";
import Compare from "@/pages/Compare";
import Podcast from "@/pages/Podcast";
import PodcastEpisodeDetail from "@/pages/PodcastEpisodeDetail";
import Admin from "@/pages/Admin";
import AdminDealDesk from "@/pages/AdminDealDesk";
import AdminEvents from "@/pages/AdminEvents";
import AdminEventNew from "@/pages/AdminEventNew";
import AdminEventEdit from "@/pages/AdminEventEdit";
import EventDetail from "@/pages/EventDetail";
import Meetups from "@/pages/Meetups";
import EventSuccess from "@/pages/EventSuccess";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import InvestorPortal from "@/pages/InvestorPortal";
import PartnerPortal from "@/pages/PartnerPortal";
import ProfessionalDashboard from "@/pages/ProfessionalDashboard";
import Signup from "@/pages/Signup";
import Login from "@/pages/Login";
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
import DistressDeals from "@/pages/DistressDeals";
import DistressReport from "@/pages/DistressReport";
import MultiplexFit from "@/pages/MultiplexFit";
import MultiplexMasterclass from "@/pages/MultiplexMasterclass";
import MultiplexFeasibilityPage from "@/pages/MultiplexFeasibilityPage";
import MultiplexUnderwriterPage from "@/pages/MultiplexUnderwriterPage";
import PowerTeam from "@/pages/PowerTeam";
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
import HomeBenchReport from "@/pages/HomeBenchReport";
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
import Stats from "@/pages/Stats";
import PitchDeck from "@/pages/PitchDeck";
import UnderwritingShare from "@/pages/UnderwritingShare";
import AccountApiKeys from "@/pages/AccountApiKeys";
import ThankYouVancouver from "@/pages/ThankYouVancouver";
import EdmontonEvent from "@/pages/EdmontonEvent";
import NotFound from "@/pages/not-found";

// Hub Pages
import ToolsHub from "@/pages/ToolsHub";
import CommunityHub from "@/pages/CommunityHub";
import InsightsHub from "@/pages/InsightsHub";
import GuidesHub from "@/pages/GuidesHub";
import EncyclopediaIndex from "@/pages/EncyclopediaIndex";
import GuidePage from "@/pages/GuidePage";
import EncyclopediaDetail from "@/pages/EncyclopediaDetail";
import CapitalStackCanadaGuide from "@/pages/CapitalStackCanadaGuide";
import ABCLendersCanadaGuide from "@/pages/ABCLendersCanadaGuide";
import ReportsHub from "@/pages/ReportsHub";
import ReportPage from "@/pages/ReportPage";
import IrccImmigrationDashboardReport from "@/pages/IrccImmigrationDashboardReport";
import RealBenchReport from "@/pages/RealBenchReport";
import MarketsHub from "@/pages/MarketsHub";
import ProgrammaticMarketPage from "@/pages/ProgrammaticMarketPage";
import StrategiesHub from "@/pages/StrategiesHub";
import ProgrammaticStrategyPage from "@/pages/ProgrammaticStrategyPage";
import NetworkHub from "@/pages/NetworkHub";
import ContactPage from "@/pages/ContactPage";
import InvestorOperatingSystem from "@/pages/InvestorOperatingSystem";
import Watchlist from "@/pages/Watchlist";

function Router() {
  return (
    <>
    <GetAppBanner />
    <Switch>
      {/* Main entry - simplified investor homepage */}
      <Route path="/" component={InvestorStart} />
      <Route path="/discover" component={MapHomepage} />
      <Route path="/deal-analyzer">{() => <Home />}</Route>
      
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
      <Route path="/deal-desk" component={DealDesk} />
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
      <Route path="/listing-intelligence" component={ListingIntelligence} />
      <Route path="/tools/listing-intelligence" component={ListingIntelligence} />
      <Route path="/listings/:mlsNumber" component={ListingDetailPage} />
      <Route path="/join/experts" component={JoinExperts} />
      <Route path="/experts" component={Experts} />
      <Route path="/experts/:userId" component={ExpertProfile} />
      <Route path="/tools/investor-os" component={InvestorOperatingSystem} />
      <Route path="/deals" component={Watchlist} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/deal-challenge" component={InvestorOperatingSystem} />
      <Route path="/professionals" component={InvestorOperatingSystem} />
      <Route path="/tools/will-it-plex" component={WillItPlex} />
      <Route path="/tools/fixed-vs-variable" component={FixedVsVariable} />
      <Route path="/tools/hst-rebate" component={OntarioHstRebateCalculator} />
      <Route path="/tools/land-claim-screener" component={LandClaimScreener} />
      <Route path="/tools/distress-deals" component={DistressDeals} />
      <Route path="/tools/motivated-deals" component={DistressDeals} />
      <Route path="/tools/multiplex-feasibility" component={MultiplexFeasibilityPage} />
      <Route path="/tools/multiplex-underwriter" component={MultiplexUnderwriterPage} />
      <Route path="/power-team" component={PowerTeam} />
      <Route path="/multiplex-investor-fit" component={MultiplexFit} />
      <Route path="/masterclass" component={MultiplexMasterclass} />
      <Route path="/course" component={Course} />
      <Route path="/insights/distress-report" component={DistressReport} />
      <Route path="/insights/motivated-report" component={DistressReport} />
      <Route path="/community/leaderboard" component={Leaderboard} />
      <Route path="/community/leaderboard/full" component={FullLeaderboard} />
      <Route path="/my-performance" component={MyPerformance} />
      <Route path="/stats" component={Stats} />
      <Route path="/tools/stats" component={Stats} />
      <Route path="/analyses/:id/deck" component={PitchDeck} />
      <Route path="/underwriting/:token" component={UnderwritingShare} />
      <Route path="/account/api-keys" component={AccountApiKeys} />
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
      <Route path="/insights/market-report/homebench-ai-realtor-benchmark" component={HomeBenchReport} />
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
      <Route path="/community/events" component={Events} />
      <Route path="/meetups" component={Meetups} />
      <Route path="/community/meetups">{() => <Redirect to="/meetups" />}</Route>
      <Route path="/community/events/unpacking-multiplexes-toronto" component={UnpackingMultiplexesToronto} />
      <Route path="/community/network" component={NetworkHub} />
      
      {/* New Insights routes */}
      <Route path="/insights" component={InsightsHub} />
      <Route path="/insights/podcast" component={Podcast} />
      <Route path="/insights/podcast/:slug" component={PodcastEpisodeDetail} />
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
      <Route path="/about/team">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/programs">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/shop" component={Shop} />
      <Route path="/about/contact" component={ContactPage} />
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
      <Route path="/events" component={Events} />
      <Route path="/notebook" component={Notebook} />
      <Route path="/notebook/print" component={NotebookPrint} />
      <Route path="/danielfoch" component={DanielFoch} />
      <Route path="/nickhill" component={NickHill} />
      <Route path="/podcast">{() => <Redirect to="/insights/podcast" />}</Route>
      <Route path="/blog">{() => <Redirect to="/insights/blog" />}</Route>
      <Route path="/shop">{() => <Redirect to="/about/shop" />}</Route>
      <Route path="/dashboard">{() => <Redirect to="/my-performance" />}</Route>
      
      {/* Existing routes that remain unchanged */}
      <Route path="/compare" component={Compare} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/deal-desk" component={AdminDealDesk} />
      <Route path="/admin/events" component={AdminEvents} />
      <Route path="/admin/events/new" component={AdminEventNew} />
      <Route path="/admin/events/:id/edit" component={AdminEventEdit} />
      <Route path="/events/:slug/success" component={EventSuccess} />
      <Route path="/events/:slug" component={EventDetail} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/investor" component={InvestorPortal} />
      <Route path="/partner" component={PartnerPortal} />
      <Route path="/professional/dashboard" component={ProfessionalDashboard} />
      <Route path="/signup" component={Signup} />
      <Route path="/get-started" component={Signup} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
