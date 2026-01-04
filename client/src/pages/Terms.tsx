import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold mb-8" data-testid="text-terms-title">
            Terms of Service
          </h1>

          <Card>
            <CardContent className="pt-6 prose prose-neutral dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                Last updated: January 2025
              </p>

              <h2>Acceptance of Terms</h2>
              <p>
                By accessing and using Realist.ca and our Deal Analyzer tool, you agree to be 
                bound by these Terms of Service. If you do not agree to these terms, please 
                do not use our services.
              </p>

              <h2>Use of Service</h2>
              <p>
                Our Deal Analyzer tool is provided for informational purposes only. The 
                calculations, projections, and analysis provided are estimates and should 
                not be considered financial advice.
              </p>

              <h2>Disclaimer</h2>
              <p>
                The information provided by our tools is based on the data you input and 
                general market assumptions. We make no guarantees about the accuracy of 
                projections or investment outcomes. Always consult with qualified 
                professionals before making investment decisions.
              </p>

              <h2>User Responsibilities</h2>
              <p>You agree to:</p>
              <ul>
                <li>Provide accurate information when using our tools</li>
                <li>Use the service only for lawful purposes</li>
                <li>Not attempt to access unauthorized areas of the service</li>
                <li>Not use the service to compete with Realist.ca</li>
              </ul>

              <h2>Intellectual Property</h2>
              <p>
                All content, tools, and materials on Realist.ca are the intellectual 
                property of Realist.ca and its partners. You may not reproduce, distribute, 
                or create derivative works without express permission.
              </p>

              <h2>Limitation of Liability</h2>
              <p>
                Realist.ca and its affiliates shall not be liable for any direct, indirect, 
                incidental, or consequential damages arising from your use of our services 
                or reliance on information provided.
              </p>

              <h2>Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of 
                the service after changes constitutes acceptance of the new terms.
              </p>

              <h2>Contact</h2>
              <p>
                For questions about these Terms of Service, contact us at{" "}
                <a href="mailto:legal@realist.ca" className="text-primary hover:underline">
                  legal@realist.ca
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
