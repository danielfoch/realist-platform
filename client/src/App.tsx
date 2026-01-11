import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Events from "@/pages/Events";
import Blog from "@/pages/Blog";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/events" component={Events} />
      <Route path="/blog" component={Blog} />
      <Route path="/shop" component={Shop} />
      <Route path="/compare" component={Compare} />
      <Route path="/podcast" component={Podcast} />
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
