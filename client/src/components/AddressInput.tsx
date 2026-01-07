import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { MarketExpertPanel } from "@/components/MarketExpertPanel";

interface AddressInputProps {
  address: string;
  city: string;
  region: string;
  country: "canada" | "usa";
  postalCode: string;
  onAddressChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onCountryChange: (value: "canada" | "usa") => void;
  onPostalCodeChange: (value: string) => void;
  defaultLeadInfo?: { name?: string; email?: string; phone?: string };
}

const canadaProvinces = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
];

const usaStates = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
];

export function AddressInput({
  address,
  city,
  region,
  country,
  postalCode,
  onAddressChange,
  onCityChange,
  onRegionChange,
  onCountryChange,
  onPostalCodeChange,
  defaultLeadInfo,
}: AddressInputProps) {
  const regions = country === "canada" ? canadaProvinces : usaStates;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        Property Location
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <Input
            id="address"
            placeholder="123 Main Street"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            className="h-12"
            data-testid="input-address"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Toronto"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              className="h-12"
              data-testid="input-city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={(value: "canada" | "usa") => onCountryChange(value)}>
              <SelectTrigger className="h-12" data-testid="select-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="canada">Canada</SelectItem>
                <SelectItem value="usa">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="region">{country === "canada" ? "Province" : "State"}</Label>
            <Select value={region} onValueChange={onRegionChange}>
              <SelectTrigger className="h-12" data-testid="select-region">
                <SelectValue placeholder={`Select ${country === "canada" ? "province" : "state"}`} />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">{country === "canada" ? "Postal Code" : "ZIP Code"}</Label>
            <Input
              id="postalCode"
              placeholder={country === "canada" ? "M5V 3L9" : "10001"}
              value={postalCode}
              onChange={(e) => onPostalCodeChange(e.target.value)}
              className="h-12"
              data-testid="input-postal-code"
            />
          </div>
        </div>
      </div>

      {country === "canada" && region && (
        <MarketExpertPanel
          region={region}
          city={city}
          country="canada"
          dealInfo={{
            address: address,
            purchasePrice: 0,
            monthlyRent: 0,
            cashFlow: 0,
            capRate: 0,
          }}
          defaultValues={defaultLeadInfo}
        />
      )}
    </div>
  );
}
