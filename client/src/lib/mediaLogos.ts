import reutersLogo from "@assets/image_1767559636706.png";
import wsjLogo from "@assets/image_1767563210169.png";
import investingLogo from "@assets/image_1767559017226.png";
import cbcLogo from "@assets/image_1767559058457.png";
import torontoStarLogo from "@assets/image_1767559616553.png";
import ctvLogo from "@assets/image_1767559371656.png";
import financialPostLogo from "@assets/image_1767559424338.png";
import bnnBloombergLogo from "@assets/image_1767559654950.png";
import globeMailLogo from "@assets/image_1767559703750.png";

export interface MediaLogo {
  name: string;
  image: string;
  /**
   * Deep link to the actual coverage. Only set when we can point at the real
   * article/segment — a logo linking to a bare homepage reads as fake proof
   * and poisons the legitimate links beside it. Logos without a url render
   * unlinked.
   */
  url?: string;
}

export const mediaLogos: MediaLogo[] = [
  { name: "Reuters", image: reutersLogo, url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/" },
  { name: "WSJ", image: wsjLogo, url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da" },
  { name: "Investing.com", image: investingLogo, url: "https://ca.investing.com/members/contributors/245556786" },
  { name: "Globe and Mail", image: globeMailLogo, url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/" },
  { name: "CBC", image: cbcLogo, url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728" },
  { name: "Financial Post", image: financialPostLogo, url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market" },
  { name: "Toronto Star", image: torontoStarLogo, url: "https://www.thestar.com/real-estate" },
  { name: "BNN Bloomberg", image: bnnBloombergLogo, url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/" },
  { name: "CTV", image: ctvLogo, url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-" },
];
