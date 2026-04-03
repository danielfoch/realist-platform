import { useEffect } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";

export default function Shop() {
  useEffect(() => {
    const scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
    
    function ShopifyBuyInit() {
      const client = (window as any).ShopifyBuy.buildClient({
        domain: import.meta.env.VITE_SHOPIFY_DOMAIN,
        storefrontAccessToken: import.meta.env.VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      });
      
      (window as any).ShopifyBuy.UI.onReady(client).then(function (ui: any) {
        ui.createComponent('collection', {
          id: '297750102129',
          node: document.getElementById('collection-component-1767716913489'),
          moneyFormat: '%24%7B%7Bamount%7D%7D',
          limit: 50,
          options: {
            "product": {
              "contents": {
                "img": true,
                "title": true,
                "price": true,
                "description": false,
                "button": true,
                "imgWithCarousel": false,
                "buttonWithQuantity": false
              },
              "styles": {
                "product": {
                  "@media (min-width: 601px)": {
                    "max-width": "calc(25% - 20px)",
                    "margin-left": "20px",
                    "margin-bottom": "50px",
                    "width": "calc(25% - 20px)"
                  },
                  "img": {
                    "height": "calc(100% - 15px)",
                    "position": "absolute",
                    "left": "0",
                    "right": "0",
                    "top": "0",
                    "cursor": "pointer"
                  },
                  "imgWrapper": {
                    "padding-top": "calc(75% + 15px)",
                    "position": "relative",
                    "height": "0"
                  },
                  "title": {
                    "cursor": "pointer"
                  }
                },
                "button": {
                  ":hover": { "background-color": "#b82a2a" },
                  "background-color": "#cc2f2f",
                  ":focus": { "background-color": "#b82a2a" },
                  "border-radius": "6px"
                }
              },
              "text": { "button": "Add to cart" },
              "googleFonts": ["Roboto"]
            },
            "productSet": {
              "contents": {
                "products": true,
                "pagination": false
              },
              "styles": {
                "products": {
                  "@media (min-width: 601px)": { "margin-left": "-20px" }
                }
              }
            },
            "modalProduct": {
              "contents": {
                "img": false,
                "imgWithCarousel": true,
                "button": false,
                "buttonWithQuantity": true,
                "description": true,
                "title": true,
                "price": true
              },
              "styles": {
                "product": {
                  "@media (min-width: 601px)": {
                    "max-width": "100%",
                    "margin-left": "0px",
                    "margin-bottom": "0px"
                  }
                },
                "button": {
                  ":hover": { "background-color": "#b82a2a" },
                  "background-color": "#cc2f2f",
                  ":focus": { "background-color": "#b82a2a" },
                  "border-radius": "6px"
                }
              },
              "text": { "button": "Add to cart" }
            },
            "modal": {
              "styles": {
                "modal": {
                  "background-color": "rgba(0, 0, 0, 0.8)"
                }
              }
            },
            "option": {},
            "cart": {
              "styles": {
                "button": {
                  ":hover": { "background-color": "#b82a2a" },
                  "background-color": "#cc2f2f",
                  ":focus": { "background-color": "#b82a2a" },
                  "border-radius": "6px"
                }
              },
              "text": { 
                "total": "Subtotal", 
                "button": "Checkout" 
              },
              "popup": false
            },
            "toggle": {
              "styles": {
                "toggle": {
                  "background-color": "#cc2f2f",
                  ":hover": { "background-color": "#b82a2a" },
                  ":focus": { "background-color": "#b82a2a" }
                }
              }
            }
          },
        });

        setTimeout(() => {
          const container = document.getElementById('collection-component-1767716913489');
          if (container) {
            const products = container.querySelectorAll('.shopify-buy__product');
            products.forEach((product: Element) => {
              const img = product.querySelector('.shopify-buy__product__variant-img');
              const title = product.querySelector('.shopify-buy__product__title');
              const button = product.querySelector('.shopify-buy__btn');
              
              const clickHandler = () => {
                if (button) {
                  (button as HTMLElement).click();
                }
              };
              
              if (img) {
                (img as HTMLElement).style.cursor = 'pointer';
                img.addEventListener('click', clickHandler);
              }
              if (title) {
                (title as HTMLElement).style.cursor = 'pointer';
                title.addEventListener('click', clickHandler);
              }
            });
          }
        }, 2000);
      });
    }

    if ((window as any).ShopifyBuy) {
      if ((window as any).ShopifyBuy.UI) {
        ShopifyBuyInit();
      } else {
        loadScript();
      }
    } else {
      loadScript();
    }

    function loadScript() {
      const existingScript = document.querySelector(`script[src="${scriptURL}"]`);
      if (existingScript) {
        ShopifyBuyInit();
        return;
      }
      
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptURL;
      (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(script);
      script.onload = ShopifyBuyInit;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Canadian Real Estate Investor Podcast Merch - Official Shop"
        description="Shop official merchandise from the Canadian Real Estate Investor Podcast. Rep the Realist.ca community with exclusive apparel and accessories."
        keywords="canadian real estate investor podcast merch, realist.ca shop, real estate investor apparel, daniel foch merchandise"
        canonicalUrl="/shop"
      />
      <Navigation />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-shop-title">
              Realist Merch
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-shop-subtitle">
              Rep the Canadian Real Estate Investor Podcast with our official merchandise
            </p>
          </div>
          
          <div id="collection-component-1767716913489" data-testid="container-shopify-products" />
        </div>
      </main>
      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              2025 Realist.ca. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
