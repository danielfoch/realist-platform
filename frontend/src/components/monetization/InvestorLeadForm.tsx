/**
 * Investor Lead Capture Form
 * Modal form for capturing investor leads on listings
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Loader2, Building2, TrendingUp, Home, Users } from 'lucide-react';

interface InvestorLeadFormProps {
  trigger?: React.ReactNode;
  // Pre-fill from listing context
  listingId?: number;
  listingAddress?: string;
  targetCities?: string[];
  targetProvinces?: string[];
}

interface LeadFormData {
  full_name: string;
  email: string;
  phone: string;
  investment_type: string;
  budget_min: string;
  budget_max: string;
  target_cities: string[];
  target_provinces: string[];
  timeline: string;
  investment_experience: string;
  notes: string;
}

const defaultFormData: LeadFormData = {
  full_name: '',
  email: '',
  phone: '',
  investment_type: '',
  budget_min: '',
  budget_max: '',
  target_cities: [],
  target_provinces: [],
  timeline: '',
  investment_experience: '',
  notes: '',
};

const investmentTypes = [
  { value: 'rental', label: 'Rental Property', icon: Home },
  { value: 'flip', label: 'Fix & Flip', icon: TrendingUp },
  { value: 'hold', label: 'Long-term Hold', icon: Building2 },
  { value: 'multi-family', label: 'Multi-Family (2+ units)', icon: Users },
  { value: 'not-sure', label: 'Not Sure Yet', icon: Building2 },
];

const timelines = [
  { value: 'immediate', label: 'Immediately' },
  { value: '3-months', label: 'Within 3 months' },
  { value: '6-months', label: 'Within 6 months' },
  { value: 'exploring', label: 'Just exploring' },
];

const experienceLevels = [
  { value: 'first-time', label: 'First-time investor' },
  { value: '1-5-deals', label: '1-5 deals completed' },
  { value: '5+-deals', label: '5+ deals completed' },
];

const popularCities = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa',
  'Edmonton', 'Winnipeg', 'Hamilton', 'London', 'Kitchener',
  'Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill',
];

export function InvestorLeadForm({ 
  trigger, 
  listingAddress,
  targetCities = [],
  targetProvinces = ['ON'],
}: InvestorLeadFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>({
    ...defaultFormData,
    target_cities: targetCities.length > 0 ? targetCities : [],
    target_provinces: targetProvinces,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field: keyof LeadFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProvinceSelect = (value: string) => {
    setFormData(prev => ({ ...prev, target_provinces: [value] }));
  };

  const handleCityToggle = (city: string) => {
    setFormData(prev => ({
      ...prev,
      target_cities: prev.target_cities.includes(city)
        ? prev.target_cities.filter(c => c !== city)
        : [...prev.target_cities, city],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || undefined,
        investment_type: formData.investment_type || undefined,
        budget_min: formData.budget_min ? Number(formData.budget_min) : undefined,
        budget_max: formData.budget_max ? Number(formData.budget_max) : undefined,
        target_cities: formData.target_cities,
        target_provinces: formData.target_provinces,
        timeline: formData.timeline || undefined,
        investment_experience: formData.investment_experience || undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/investor/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "You're matched! 🎉",
          description: result.data.message || 'We\'ve notified realtors in your target area.',
        });
        setFormData(defaultFormData);
        setOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button className="w-full">
      <Building2 className="mr-2 h-4 w-4" />
      Get Matched with a Local Investor Realtor
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Get Matched with a Local Investor Realtor
          </DialogTitle>
          <DialogDescription>
            Fill out this form and we'll connect you with a realtor who specializes in investment properties in your target market.
            {listingAddress && <span className="block mt-1 text-primary">Interested in: {listingAddress}</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(123) 456-7890"
              />
            </div>
          </div>

          {/* Investment Criteria */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Investment Criteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Investment Type</Label>
                <Select
                  value={formData.investment_type}
                  onValueChange={(value) => handleSelectChange('investment_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {investmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timeline</Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(value) => handleSelectChange('timeline', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {timelines.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget_min">Min Budget ($)</Label>
                <Input
                  id="budget_min"
                  name="budget_min"
                  type="number"
                  value={formData.budget_min}
                  onChange={handleChange}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_max">Max Budget ($)</Label>
                <Input
                  id="budget_max"
                  name="budget_max"
                  type="number"
                  value={formData.budget_max}
                  onChange={handleChange}
                  placeholder="500000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Experience Level</Label>
              <Select
                value={formData.investment_experience}
                onValueChange={(value) => handleSelectChange('investment_experience', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>
                <SelectContent>
                  {experienceLevels.map((exp) => (
                    <SelectItem key={exp.value} value={exp.value}>{exp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Markets */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Target Markets</h3>
            <div className="space-y-2">
              <Label>Preferred Cities</Label>
              <div className="flex flex-wrap gap-2">
                {popularCities.map((city) => (
                  <Button
                    key={city}
                    type="button"
                    variant={formData.target_cities.includes(city) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleCityToggle(city)}
                    className="text-xs"
                  >
                    {city}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Province</Label>
                <Select
                  value={formData.target_provinces[0] || ''}
                  onValueChange={handleProvinceSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON">Ontario</SelectItem>
                    <SelectItem value="BC">British Columbia</SelectItem>
                    <SelectItem value="AB">Alberta</SelectItem>
                    <SelectItem value="QC">Quebec</SelectItem>
                    <SelectItem value="MB">Manitoba</SelectItem>
                    <SelectItem value="SK">Saskatchewan</SelectItem>
                    <SelectItem value="NS">Nova Scotia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tell us more about your investment goals..."
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Get Matched with a Realtor'
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By submitting, you agree to be contacted by licensed realtors in your target area.
            We'll never share your information with third parties.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InvestorLeadForm;
