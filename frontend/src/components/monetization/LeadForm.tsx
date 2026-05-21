import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../../hooks/use-toast';

interface LeadFormData {
  full_name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  inquiry_type: 'partnership' | 'advertising' | 'sponsorship' | 'other';
  message: string;
  source: string;
}

const defaultFormData: LeadFormData = {
  full_name: '',
  email: '',
  phone: '',
  company: '',
  role: '',
  inquiry_type: 'partnership',
  message: '',
  source: 'website',
};

export function LeadForm() {
  const [formData, setFormData] = useState<LeadFormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof LeadFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Your inquiry has been submitted. We\'ll contact you soon.',
        });
        setFormData(defaultFormData);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit inquiry.',
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Realtor Partnership Inquiry</CardTitle>
        <CardDescription>
          Interested in partnering with Realist.ca? Fill out this form and our team will reach out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="full_name" className="text-sm font-medium">
                Full Name *
              </label>
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
              <label htmlFor="email" className="text-sm font-medium">
                Email *
              </label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(123) 456-7890"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium">
                Company
              </label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Your brokerage"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Input
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="Realtor, Broker, etc."
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="inquiry_type" className="text-sm font-medium">
                Inquiry Type *
              </label>
              <Select
                value={formData.inquiry_type}
                onValueChange={(value) => handleSelectChange('inquiry_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="advertising">Advertising</SelectItem>
                  <SelectItem value="sponsorship">Sponsorship</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tell us about your interest in partnering with Realist.ca..."
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Submitting...' : 'Submit Inquiry'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By submitting this form, you agree to be contacted by Realist.ca regarding your inquiry.
            We respect your privacy and will not share your information with third parties.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}