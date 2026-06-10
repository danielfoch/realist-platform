import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold mb-8" data-testid="text-privacy-title">
            Privacy Policy
          </h1>

          <Card>
            <CardContent className="pt-6 prose prose-neutral dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                Last updated: January 2025
              </p>

              <h2>Information We Collect</h2>
              <p>
                When you use our Deal Analyzer tool, we collect the following information:
              </p>
              <ul>
                <li>Name, email address, and phone number (required for analysis results)</li>
                <li>Property information you enter for analysis</li>
                <li>UTM parameters and referral source</li>
                <li>Usage data and analytics</li>
              </ul>

              <h2>How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul>
                <li>Provide you with deal analysis results and insights</li>
                <li>Send you relevant communications about real estate investing (if consented)</li>
                <li>Improve our tools and services</li>
                <li>Connect you with relevant partners and services</li>
              </ul>

              <h2>Data Sharing</h2>
              <p>
                We may share your information with trusted partners for CRM and marketing purposes. 
                We do not sell your personal information to third parties.
              </p>

              <h2>Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction.
              </p>

              <h2>Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal information</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt out of marketing communications</li>
              </ul>

              <h2>Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@realist.ca" className="text-primary hover:underline">
                  privacy@realist.ca
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span>Realist.ca</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/about" className="hover:text-foreground transition-colors">About</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
