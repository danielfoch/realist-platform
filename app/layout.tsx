import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, organizationNode, webSiteNode } from "@/lib/seo/jsonld";
import { SITE_BASE_URL } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  title: {
    default: "Realist — Institutional-grade tools for regular real estate investors",
    template: "%s | Realist",
  },
  description:
    "Canada's real estate investing platform from the hosts of The Canadian Real Estate Investor podcast: pre-underwritten listings, the Toronto multiplex underwriter, motivated-seller deals, and investor research.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    siteName: "Realist",
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    site: "@RealistCA",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <JsonLd json={jsonLdDocument(organizationNode(), webSiteNode())} />
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
