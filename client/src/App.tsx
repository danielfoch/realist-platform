import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Redirect } from "@/components/Redirect";

// Pages
import MapHomepage from "@/pages/MapHomepage";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Events from "@/pages/Events";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Shop from "@/pages/Shop";
import Compare from "@/pages/Compare";
import Podcast from "@/pages/Podcast";
import Admin from "@/pages/Admin";
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
import TrueCost from "@/pages/TrueCost";
import RentVsBuy from "@/pages/RentVsBuy";
import WillItPlex from "@/pages/WillItPlex";
import Leaderboard from "@/pages/Leaderboard";
import Premium from "@/pages/Premium";
import PremiumBranding from "@/pages/PremiumBranding";
import CapRates from "@/pages/CapRates";
import RealtorNetwork from "@/pages/RealtorNetwork";
import MarketReport from "@/pages/MarketReport";
import MortgageRates from "@/pages/MortgageRates";
import FixedVsVariable from "@/pages/FixedVsVariable";
import LandClaimScreener from "@/pages/LandClaimScreener";
import DistressDeals from "@/pages/DistressDeals";
import DistressReport from "@/pages/DistressReport";
import MultiplexFit from "@/pages/MultiplexFit";
import MarketReportBuilder from "@/pages/MarketReportBuilder";
import JoinRealtors from "@/pages/JoinRealtors";
import JoinLenders from "@/pages/JoinLenders";
import MyPerformance from "@/pages/MyPerformance";
import NotFound from "@/pages/not-found";

// Hub Pages
import ToolsHub from "@/pages/ToolsHub";
import CommunityHub from "@/pages/CommunityHub";
import InsightsHub from "@/pages/InsightsHub";
import GuidesHub from "@/pages/GuidesHub";
import GuidePage from "@/pages/GuidePage";
import NetworkHub from "@/pages/NetworkHub";
import ContactPage from "@/pages/ContactPage";

function Router() {
  return (
    <Switch>
      {/* Main entry - Map or Deal Analyzer based on env var */}
      <Route path="/" component={import.meta.env.VITE_HOME_VARIANT === "deal" ? Home : MapHomepage} />
      <Route path="/deal-analyzer" component={Home} />
      
      {/* New Tools routes */}
      <Route path="/tools" component={ToolsHub} />
      <Route path="/tools/analyzer" component={Home} />
      <Route path="/tools/buybox" component={BuyBox} />
      <Route path="/tools/buybox/agreement" component={BuyBoxAgreement} />
      <Route path="/tools/buybox/checkout" component={BuyBoxCheckout} />
      <Route path="/tools/buybox/confirmation/:id" component={BuyBoxConfirmation} />
      <Route path="/tools/coinvest" component={CoInvesting} />
      <Route path="/tools/coinvest/opportunities" component={CoInvestingOpportunities} />
      <Route path="/tools/coinvest/checklist" component={CoInvestingChecklist} />
      <Route path="/tools/coinvest/groups/new" component={CoInvestingGroupNew} />
      <Route path="/tools/coinvest/groups/:id" component={CoInvestingGroupDetail} />
      <Route path="/tools/true-cost" component={TrueCost} />
      <Route path="/tools/rent-vs-buy" component={RentVsBuy} />
      <Route path="/tools/cap-rates" component={CapRates} />
      <Route path="/tools/will-it-plex" component={WillItPlex} />
      <Route path="/tools/fixed-vs-variable" component={FixedVsVariable} />
      <Route path="/tools/land-claim-screener" component={LandClaimScreener} />
      <Route path="/tools/distress-deals" component={DistressDeals} />
      <Route path="/multiplex-investor-fit" component={MultiplexFit} />
      <Route path="/insights/distress-report" component={DistressReport} />
      <Route path="/community/leaderboard" component={Leaderboard} />
      <Route path="/my-performance" component={MyPerformance} />
      <Route path="/insights/market-report" component={MarketReport} />
      <Route path="/insights/mortgage-rates" component={MortgageRates} />
      <Route path="/insights/market-report-builder" component={MarketReportBuilder} />
      <Route path="/premium" component={Premium} />
      <Route path="/premium/branding" component={PremiumBranding} />
      
      {/* New Community routes */}
      <Route path="/community" component={CommunityHub} />
      <Route path="/community/events" component={Events} />
      <Route path="/community/network" component={NetworkHub} />
      
      {/* New Insights routes */}
      <Route path="/insights" component={InsightsHub} />
      <Route path="/insights/podcast" component={Podcast} />
      <Route path="/insights/blog" component={Blog} />
      <Route path="/insights/blog/:slug" component={BlogPost} />
      <Route path="/insights/guides" component={GuidesHub} />
      <Route path="/insights/guides/:slug" component={GuidePage} />
      
      {/* New About routes */}
      <Route path="/about" component={About} />
      <Route path="/about/team">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/programs">{() => <Redirect to="/about" />}</Route>
      <Route path="/about/shop" component={Shop} />
      <Route path="/about/contact" component={ContactPage} />
      
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
      <Route path="/podcast">{() => <Redirect to="/insights/podcast" />}</Route>
      <Route path="/blog">{() => <Redirect to="/insights/blog" />}</Route>
      <Route path="/shop">{() => <Redirect to="/about/shop" />}</Route>
      <Route path="/dashboard">{() => <Redirect to="/my-performance" />}</Route>
      
      {/* Existing routes that remain unchanged */}
      <Route path="/compare" component={Compare} />
      <Route path="/admin" component={Admin} />
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
      <Route path="/join/realtors" component={JoinRealtors} />
      <Route path="/join/lenders" component={JoinLenders} />
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
