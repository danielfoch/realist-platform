import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HideOnHome } from "@/components/HideOnHome";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, organizationNode, webSiteNode } from "@/lib/seo/jsonld";
import { SITE_BASE_URL } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
    <html lang="en-CA" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[3px] focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <JsonLd json={jsonLdDocument(organizationNode(), webSiteNode())} />
        <SiteNav />
        <main id="content" className="flex-1 flex flex-col">{children}</main>
        <HideOnHome>
          <SiteFooter />
        </HideOnHome>
      </body>
    </html>
  );
}
