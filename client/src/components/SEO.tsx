import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  structuredData?: object;
}

const BASE_URL = "https://realist.ca";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage = DEFAULT_IMAGE,
  ogType = "website",
  structuredData,
}: SEOProps) {
  const fullTitle = title.includes("Realist.ca") ? title : `${title} | Realist.ca`;
  const fullCanonical = canonicalUrl ? `${BASE_URL}${canonicalUrl}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}
      
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      <meta property="og:site_name" content="Realist.ca" />
      <meta property="og:locale" content="en_CA" />
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      <meta name="geo.region" content="CA" />
      <meta name="geo.placename" content="Toronto" />
      
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

export const organizationSchema = {
  "@type": "Organization",
  "@id": "https://realist.ca/#organization",
  "name": "Realist.ca",
  "alternateName": "The Canadian Real Estate Investor Podcast",
  "url": "https://realist.ca",
  "logo": "https://realist.ca/logo.png",
  "description": "Canada's biggest real estate investor community. Home of the Canadian Real Estate Investor Podcast with Daniel Foch.",
  "foundingDate": "2020",
  "founders": [
    {
      "@type": "Person",
      "name": "Daniel Foch",
      "jobTitle": "Chief Real Estate Officer",
      "description": "Canadian real estate analyst, broker, and host of Canada's #1 real estate podcast"
    },
    {
      "@type": "Person",
      "name": "Nick Hill",
      "jobTitle": "Mortgage Expert"
    },
    {
      "@type": "Person",
      "name": "Jonathan Woo",
      "jobTitle": "CEO"
    }
  ],
  "sameAs": [
    "https://www.youtube.com/@TheCanadianInvestorPodcast",
    "https://www.instagram.com/thecanadianinvestorpodcast",
    "https://twitter.com/RealistCA",
    "https://www.tiktok.com/@thecanadianinvestor"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": ["English", "French"]
  },
  "areaServed": {
    "@type": "Country",
    "name": "Canada"
  }
};

export const websiteSchema = {
  "@type": "WebSite",
  "@id": "https://realist.ca/#website",
  "name": "Realist.ca",
  "alternateName": "Canadian Real Estate Deal Analyzer",
  "url": "https://realist.ca",
  "description": "The most powerful real estate deal analyzer for Canadian investors. Analyze properties in Toronto, Vancouver, Calgary and across Canada.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://realist.ca/?search={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export const softwareSchema = {
  "@type": "SoftwareApplication",
  "@id": "https://realist.ca/#software",
  "name": "Realist.ca Deal Analyzer",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  },
  "description": "Free real estate deal analyzer for Canadian investors. Calculate cap rates, cash-on-cash returns, IRR, and compare investment strategies like Buy & Hold, BRRR, Flip, and Airbnb.",
  "featureList": [
    "Cap Rate Calculator",
    "Cash-on-Cash Return Analysis",
    "IRR Calculation",
    "BRRR Strategy Analysis",
    "Airbnb Revenue Projections",
    "Multiplex Investment Analysis",
    "Deal Comparison Tool",
    "PDF Export"
  ]
};

export const personSchema = {
  "@type": "Person",
  "@id": "https://realist.ca/#danielfoch",
  "name": "Daniel Foch",
  "alternateName": "Dan Foch",
  "jobTitle": "Chief Real Estate Officer",
  "worksFor": [
    {
      "@type": "Organization",
      "name": "Realist.ca"
    },
    {
      "@type": "Organization",
      "name": "Valery Real Estate"
    }
  ],
  "description": "Daniel Foch is a Canadian real estate analyst, broker, and host of the Canadian Real Estate Investor Podcast - Canada's #1 real estate podcast. Expert in Toronto real estate, Canadian housing market analysis, and real estate investing strategies.",
  "knowsAbout": [
    "Canadian Real Estate",
    "Toronto Real Estate",
    "Real Estate Investing",
    "Housing Market Analysis",
    "BRRR Strategy",
    "Multiplex Investing"
  ],
  "sameAs": [
    "https://twitter.com/daniel_foch",
    "https://www.linkedin.com/in/danielfoch"
  ]
};
