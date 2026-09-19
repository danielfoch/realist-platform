import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Realist.ca collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <div className="prose-notes mt-6 text-[15px]">
        <p className="text-ink-faint">Last updated: January 2025</p>

        <h2>Information We Collect</h2>
        <p>When you use our Deal Analyzer tool, we collect the following information:</p>
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
          We may share your information with trusted partners for CRM and marketing purposes. We
          do not sell your personal information to third parties.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement appropriate security measures to protect your personal information against
          unauthorized access, alteration, disclosure, or destruction.
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
          <a href="mailto:privacy@realist.ca">privacy@realist.ca</a>
        </p>
      </div>
    </article>
  );
}
