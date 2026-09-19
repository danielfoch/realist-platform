import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Realist.ca and its tools.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
      <div className="prose-notes mt-6 text-[15px]">
        <p className="text-ink-faint">Last updated: September 2026</p>

        <h2>Acceptance of Terms</h2>
        <p>
          By accessing and using Realist.ca and its tools — the underwriter, the multiplex
          underwriter, listings, the leaderboard and community features — you agree to be bound by
          these Terms of Service. If you do not agree to these terms, please do not use our
          services.
        </p>

        <h2>Use of Service</h2>
        <p>
          Our tools are provided for informational purposes only. The calculations, projections,
          deal memos (including any written with AI) and community numbers are estimates and
          opinions, and should not be considered financial, legal, tax or real estate advice.
          Realist is not a brokerage: brokerage and mortgage services are provided by the licensed
          professionals and partner brokerages you choose to work with.
        </p>

        <h2>Disclaimer</h2>
        <p>
          The information provided by our tools is based on the data you input and general market
          assumptions. We make no guarantees about the accuracy of projections or investment
          outcomes. Always consult with qualified professionals before making investment
          decisions.
        </p>

        <h2>User Responsibilities</h2>
        <p>You agree to:</p>
        <ul>
          <li>Provide accurate information when using our tools</li>
          <li>Use the service only for lawful purposes</li>
          <li>Not attempt to access unauthorized areas of the service</li>
          <li>Not use the service to compete with Realist.ca</li>
          <li>
            Underwrite deals honestly: not create accounts, analyses or requests in bulk or by
            automated means, and not use a display name that impersonates someone or advertises
            anything. We may remove analyses, leaderboard places or accounts that do.
          </li>
        </ul>

        <h2>Community and what you make public</h2>
        <p>
          The leaderboard and your track-record page show your first name and last initial, your
          city and statistics about the deals you underwrite, never an address. Aggregated,
          anonymous medians from members&rsquo; analyses are shown on listings and used to improve the
          starting numbers the tools offer. You can leave the leaderboard at any time in your
          account. See our <a href="/privacy">Privacy Policy</a> for the detail.
        </p>

        <h2>Referral fees</h2>
        <p>
          Realtors and mortgage brokers in our network pay Realist a referral fee when a deal closes
          or funds. It costs you nothing extra, and it is disclosed to you in writing before you
          sign anything with them. Any commission rebate is paid by the brokerage handling your
          transaction, where provincial rules permit it, on the terms they confirm in writing.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          All content, tools, and materials on Realist.ca are the intellectual property of
          Realist.ca and its partners. You may not reproduce, distribute, or create derivative
          works without express permission.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          Realist.ca and its affiliates shall not be liable for any direct, indirect, incidental,
          or consequential damages arising from your use of our services or reliance on
          information provided.
        </p>

        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the service
          after changes constitutes acceptance of the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these Terms of Service, contact us at{" "}
          <a href="mailto:legal@realist.ca">legal@realist.ca</a>
        </p>
      </div>
    </article>
  );
}
