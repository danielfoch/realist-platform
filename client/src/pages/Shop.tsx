import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";

export default function Shop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
    
    const productOptions = {
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
            "top": "0"
          },
          "imgWrapper": {
            "padding-top": "calc(75% + 15px)",
            "position": "relative",
            "height": "0"
          }
        },
        "button": {
          ":hover": { "background-color": "#b82a2a" },
          "background-color": "#cc2f2f",
          ":focus": { "background-color": "#b82a2a" }
        }
      },
      "text": { "button": "Add to cart" }
    };

    const cartOptions = {
      "styles": {
        "button": {
          ":hover": { "background-color": "#b82a2a" },
          "background-color": "#cc2f2f",
          ":focus": { "background-color": "#b82a2a" }
        }
      },
      "text": { "total": "Subtotal", "button": "Checkout" }
    };

    const toggleOptions = {
      "styles": {
        "toggle": {
          "background-color": "#cc2f2f",
          ":hover": { "background-color": "#b82a2a" },
          ":focus": { "background-color": "#b82a2a" }
        }
      }
    };

    const modalProductOptions = {
      "contents": {
        "img": false,
        "imgWithCarousel": true,
        "button": false,
        "buttonWithQuantity": true
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
          ":focus": { "background-color": "#b82a2a" }
        }
      },
      "text": { "button": "Add to cart" }
    };
    
    async function ShopifyBuyInit() {
      const client = (window as any).ShopifyBuy.buildClient({
        domain: 'jytqv6-dh.myshopify.com',
        storefrontAccessToken: 'a1b026dcf583784ef7f274d93c5c97e3',
      });
      
      const ui = await (window as any).ShopifyBuy.UI.onReady(client);
      
      const products = await client.product.fetchAll(250);
      
      if (!containerRef.current) return;
      
      containerRef.current.innerHTML = '';
      
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexWrap = 'wrap';
      wrapper.style.marginLeft = '-20px';
      containerRef.current.appendChild(wrapper);
      
      for (const product of products) {
        const productNode = document.createElement('div');
        productNode.id = `product-${product.id}`;
        wrapper.appendChild(productNode);
        
        ui.createComponent('product', {
          id: product.id,
          node: productNode,
          moneyFormat: '%24%7B%7Bamount%7D%7D',
          options: {
            product: productOptions,
            modalProduct: modalProductOptions,
            cart: cartOptions,
            toggle: toggleOptions,
            option: {}
          }
        });
      }
    }

    if ((window as any).ShopifyBuy?.UI) {
      ShopifyBuyInit();
    } else {
      loadScript();
    }

    function loadScript() {
      const existingScript = document.querySelector(`script[src="${scriptURL}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => ShopifyBuyInit());
        if ((window as any).ShopifyBuy?.UI) {
          ShopifyBuyInit();
        }
        return;
      }
      
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptURL;
      document.head.appendChild(script);
      script.onload = () => ShopifyBuyInit();
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
          
          <div ref={containerRef} data-testid="container-shopify-products">
              <div className="text-center py-8 text-muted-foreground">Loading products...</div>
            </div>
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
