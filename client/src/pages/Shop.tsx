import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShoppingBag } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  url: string;
}

const products: Product[] = [
  // Add your products here. Example format:
  // {
  //   id: "1",
  //   name: "Realist Logo Tee",
  //   price: "$29.99",
  //   image: "https://vangogh.teespring.com/v3/image/YOUR_IMAGE_ID/1/1.jpg",
  //   url: "https://my-store-108d526.creator-spring.com/listing/your-product-slug"
  // },
];

const springStoreUrl = "https://my-store-108d526.creator-spring.com";

export default function Shop() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold" data-testid="text-shop-title">
            Realist Merch
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Rep the Realist brand with our official merchandise.
          </p>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {products.map((product) => (
              <a
                key={product.id}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
                data-testid={`link-product-${product.id}`}
              >
                <Card className="overflow-visible hover-elevate transition-all">
                  <CardContent className="p-0">
                    <div className="aspect-square overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4 space-y-1">
                      <h3 className="font-semibold text-sm md:text-base line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-primary font-bold">{product.price}</p>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <Card className="mb-12">
            <CardContent className="py-12 text-center space-y-6">
              <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Visit Our Store</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Browse our full collection of apparel, accessories, and more on our Spring store.
                </p>
              </div>
              <a
                href={springStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2" data-testid="button-visit-store">
                  <ExternalLink className="h-5 w-5" />
                  Shop Now
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <a
            href={springStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg" className="gap-2" data-testid="button-view-all">
              <ShoppingBag className="h-5 w-5" />
              View All Products on Spring
            </Button>
          </a>
        </div>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>
            All orders are processed and fulfilled by Spring. 
          </p>
        </div>
      </div>
    </div>
  );
}
