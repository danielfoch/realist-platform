import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link2, Loader2, ExternalLink, Home, MapPin, Bed, Bath, Square, Building, ChevronDown, Code } from "lucide-react";

interface ParsedListing {
  listingId: string;
  propertyId: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: "canada" | "usa";
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  propertyType: string;
  buildingType: string;
  buildingStyle: string;
  storeys: number;
  landSize: string;
  imageUrl: string;
  sourceUrl: string;
}

interface ListingImportProps {
  onImport: (listing: ParsedListing) => void;
}

function detectSource(input: string): "realtor" | "zillow" | "unknown" {
  if (input.includes("realtor.ca")) return "realtor";
  if (input.includes("zillow.com") || input.includes("Zillow")) return "zillow";
  return "unknown";
}

export function ListingImport({ onImport }: ListingImportProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [htmlSource, setHtmlSource] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [importedListing, setImportedListing] = useState<ParsedListing | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleImport = async (useHtml = false) => {
    const inputValue = useHtml ? htmlSource : url;
    if (!inputValue.trim()) {
      toast({
        title: useHtml ? "HTML Source Required" : "URL Required",
        description: useHtml 
          ? "Please paste the page source from a listing site." 
          : "Please paste a listing URL from realtor.ca or zillow.com.",
        variant: "destructive",
      });
      return;
    }

    const source = detectSource(inputValue);
    let endpoint = "/api/listings/parse-realtor-ca";
    if (source === "zillow") {
      endpoint = "/api/listings/parse-zillow";
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", endpoint, { 
        url: useHtml ? undefined : url,
        html: useHtml ? htmlSource : undefined,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse listing");
      }

      const listing = data.listing as ParsedListing;
      setImportedListing(listing);
      onImport(listing);

      toast({
        title: "Listing Imported",
        description: `Successfully imported ${listing.address}, ${listing.city}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import listing";
      toast({
        title: "Import Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    const country = importedListing?.country;
    return new Intl.NumberFormat(country === "usa" ? "en-US" : "en-CA", {
      style: "currency",
      currency: country === "usa" ? "USD" : "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Link2 className="h-4 w-4" />
        Import from Realtor.ca or Zillow
      </div>

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <div className="flex gap-2">
          <Input
            placeholder="Paste realtor.ca or zillow.com listing URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            data-testid="input-listing-url"
          />
          <Button
            onClick={() => handleImport(false)}
            disabled={isLoading || !url.trim()}
            data-testid="button-import-listing"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Import"
            )}
          </Button>
        </div>
        
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground">
            <Code className="h-3 w-3 mr-1" />
            {showAdvanced ? "Hide" : "Show"} advanced import (paste HTML source)
            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <p className="font-medium mb-1">If the URL import doesn't work:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open the listing page in your browser</li>
              <li>Right-click and select "View Page Source" (or press Ctrl+U)</li>
              <li>Select all (Ctrl+A) and copy (Ctrl+C)</li>
              <li>Paste the HTML below and click "Import from HTML"</li>
            </ol>
          </div>
          <Textarea
            placeholder="Paste the full HTML source code here..."
            value={htmlSource}
            onChange={(e) => setHtmlSource(e.target.value)}
            className="min-h-[100px] font-mono text-xs"
            data-testid="input-html-source"
          />
          <Button
            onClick={() => handleImport(true)}
            disabled={isLoading || !htmlSource.trim()}
            variant="secondary"
            className="w-full"
            data-testid="button-import-html"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Code className="h-4 w-4 mr-2" />
            )}
            Import from HTML
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {importedListing && (
        <Card className="bg-accent/30 border-accent/50">
          <CardContent className="p-4">
            <div className="flex gap-4">
              {importedListing.imageUrl && (
                <img
                  src={importedListing.imageUrl}
                  alt={importedListing.address}
                  className="w-24 h-24 object-cover rounded-md"
                />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      <Home className="h-4 w-4" />
                      {importedListing.address}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {importedListing.city}, {importedListing.province} {importedListing.postalCode}
                    </div>
                  </div>
                  {importedListing.sourceUrl && (
                    <a
                      href={importedListing.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm flex items-center gap-1"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(importedListing.price)}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {importedListing.bedrooms > 0 && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-3 w-3" /> {importedListing.bedrooms} bed
                    </span>
                  )}
                  {importedListing.bathrooms > 0 && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-3 w-3" /> {importedListing.bathrooms} bath
                    </span>
                  )}
                  {importedListing.squareFootage > 0 && (
                    <span className="flex items-center gap-1">
                      <Square className="h-3 w-3" /> {importedListing.squareFootage.toLocaleString()} sqft
                    </span>
                  )}
                  {importedListing.buildingType && (
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3" /> {importedListing.buildingType}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Paste a realtor.ca or zillow.com property listing URL to auto-fill address, price, and property details.
      </p>
    </div>
  );
}
