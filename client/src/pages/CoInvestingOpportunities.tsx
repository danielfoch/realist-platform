import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Search, MapPin, Users, DollarSign, Loader2 } from "lucide-react";
import { 
  propertyTypeLabels, 
  strategyLabels, 
  jurisdictionLabels,
  tierLabels,
  skillLabels 
} from "@/lib/coinvesting";
import type { CoInvestGroup } from "@shared/schema";

export default function CoInvestingOpportunities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ groups: CoInvestGroup[] }>({
    queryKey: ["/api/coinvesting/groups"],
  });

  const groups = data?.groups || [];
  
  const filteredGroups = groups.filter(group => {
    if (searchTerm && !group.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !group.propertyCity?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (jurisdictionFilter !== "all" && group.jurisdiction !== jurisdictionFilter) {
      return false;
    }
    if (strategyFilter !== "all" && group.targetStrategy !== strategyFilter) {
      return false;
    }
    return true;
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Browse Opportunities</h1>
            <p className="text-muted-foreground">
              Find co-investing groups looking for partners
            </p>
          </div>
          <Link href="/coinvesting/groups/new">
            <Button data-testid="button-create-group-header">
              Create a Group
            </Button>
          </Link>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
                <SelectTrigger data-testid="select-jurisdiction">
                  <SelectValue placeholder="Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jurisdictions</SelectItem>
                  {Object.entries(jurisdictionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                <SelectTrigger data-testid="select-strategy">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {Object.entries(strategyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
              <p className="text-muted-foreground mb-4">
                {groups.length === 0 
                  ? "Be the first to create a co-investing group!"
                  : "No groups match your current filters. Try adjusting your search."}
              </p>
              <Link href="/coinvesting/groups/new">
                <Button>Create the First Group</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <Link key={group.id} href={`/coinvesting/groups/${group.id}`}>
                <Card className="hover-elevate h-full cursor-pointer" data-testid={`card-group-${group.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg line-clamp-2">{group.title}</CardTitle>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {group.status === "forming" ? "Forming" : group.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {group.propertyCity || jurisdictionLabels[group.jurisdiction as keyof typeof jurisdictionLabels] || group.jurisdiction}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span>{strategyLabels[group.targetStrategy as keyof typeof strategyLabels] || group.targetStrategy || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Property:</span>
                        <span>{propertyTypeLabels[group.propertyType as keyof typeof propertyTypeLabels] || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min Commitment:</span>
                        <span className="font-medium">{formatCurrency(group.minCommitmentCad)}</span>
                      </div>
                      {group.skillsNeeded && group.skillsNeeded.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs mb-2">Skills Needed:</p>
                          <div className="flex flex-wrap gap-1">
                            {group.skillsNeeded.slice(0, 3).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skillLabels[skill as keyof typeof skillLabels] || skill}
                              </Badge>
                            ))}
                            {group.skillsNeeded.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.skillsNeeded.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
