import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShoppingBag } from "lucide-react";

export default function Shop() {
  const springStoreUrl = "https://realist-ca.creator-spring.com";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold" data-testid="text-shop-title">
            Realist Merch
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Rep the Realist brand with our official merchandise. All items are fulfilled through our Spring store.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Official Realist Store
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Browse our collection of apparel, accessories, and more. Click below to visit our store and complete your purchase.
            </p>
            
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted">
              <iframe
                src={springStoreUrl}
                title="Realist Spring Store"
                className="w-full h-full"
                loading="lazy"
                data-testid="iframe-spring-store"
              />
            </div>

            <div className="flex justify-center">
              <a 
                href={springStoreUrl} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2" data-testid="button-open-store">
                  <ExternalLink className="h-5 w-5" />
                  Open Store in New Tab
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            All orders are processed and fulfilled by Spring (formerly Teespring). 
            For order inquiries, please contact Spring support directly.
          </p>
        </div>
      </div>
    </div>
  );
}
