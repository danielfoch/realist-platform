/**
 * Investor Portal - Signup/Login Page
 * Collects investor profile data and captures referral agreement acceptance
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

import { useToast } from '../hooks/use-toast';
import { Loader2, TrendingUp } from 'lucide-react';
import { track } from '../lib/event-tracking';

interface LoginFormData {
  email: string;
  password: string;
}

interface SignupFormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  // Investor-specific
  strategy: string[];
  preferred_cities: string;
  budget_range: string;
  property_types: string[];
  experience_level: string;
  agreed_to_platform_terms: boolean;
  agreed_to_referral_terms: boolean;
  source: string;
}

const STRATEGY_OPTIONS = [
  { value: 'cashflow', label: 'Cash Flow' },
  { value: 'appreciation', label: 'Appreciation' },
  { value: 'fix_and_flip', label: 'Fix & Flip' },
  { value: 'brrrr', label: 'BRRRR' },
  { value: 'short_term_rental', label: 'Short-Term Rental (Airbnb)' },
  { value: 'multi_family', label: 'Multi-Family' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'detached', label: 'Detached' },
  { value: 'semi_detached', label: 'Semi-Detached' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'multiplex', label: 'Multiplex' },
  { value: 'land', label: 'Vacant Land' },
];

const EXPERIENCE_LEVELS = [
  { value: 'first_time', label: 'First-Time Investor' },
  { value: '1_3', label: '1-3 Properties' },
  { value: '4_10', label: '4-10 Properties' },
  { value: '10_plus', label: '10+ Properties' },
];

const BUDGET_RANGES = [
  { value: 'under_500k', label: 'Under $500K' },
  { value: '500k_750k', label: '$500K - $750K' },
  { value: '750k_1m', label: '$750K - $1M' },
  { value: '1m_1500k', label: '$1M - $1.5M' },
  { value: '1500k_plus', label: '$1.5M+' },
];

export function InvestorAuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleModeChange = (newMode: string) => {
    setMode(newMode as 'login' | 'signup');
    if (newMode === 'signup') {
      track('investor_signup_started');
    }
  };

  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [signupData, setSignupData] = useState<SignupFormData>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    strategy: [],
    preferred_cities: '',
    budget_range: '',
    property_types: [],
    experience_level: '',
    agreed_to_platform_terms: false,
    agreed_to_referral_terms: false,
    source: 'organic',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('investor_token', result.data.token);
        localStorage.setItem('investor_user', JSON.stringify(result.data.user));
        track('login', { role: 'investor' });
        toast({ title: 'Welcome back!' });
        navigate('/investor/dashboard');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!signupData.agreed_to_platform_terms || !signupData.agreed_to_referral_terms) {
      toast({
        title: 'Agreements Required',
        description: 'Please accept both the platform terms and referral agreement to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (signupData.password !== signupData.confirm_password) {
      toast({
        title: 'Password Mismatch',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (signupData.password.length < 8) {
      toast({
        title: 'Weak Password',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/investor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: signupData.full_name,
          email: signupData.email,
          phone: signupData.phone,
          password: signupData.password,
          strategy: signupData.strategy,
          preferred_cities: signupData.preferred_cities,
          budget_range: signupData.budget_range,
          property_types: signupData.property_types,
          experience_level: signupData.experience_level,
          agreed_to_platform_terms: true,
          agreed_to_referral_terms: true,
          source: signupData.source,
        }),
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('investor_token', result.data.token);
        localStorage.setItem('investor_user', JSON.stringify(result.data.user));
        track('investor_signup_completed', {
          strategy: signupData.strategy,
          experience_level: signupData.experience_level,
          budget_range: signupData.budget_range,
        });
        toast({
          title: 'Welcome to Realist.ca!',
          description: 'Your investor profile is set up. Start analyzing deals.',
        });
        navigate('/investor/dashboard');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayValue = (
    field: 'strategy' | 'property_types',
    value: string,
  ) => {
    setSignupData((prev) => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const CheckboxGroup = ({
    field,
    options,
    label,
  }: {
    field: 'strategy' | 'property_types';
    options: Array<{ value: string; label: string }>;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
          >
            <input
              type="checkbox"
              checked={signupData[field].includes(opt.value)}
              onChange={() => toggleArrayValue(field, opt.value)}
              className="h-4 w-4"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <TrendingUp className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Investor Portal</CardTitle>
          <CardDescription>
            Analyze deals, track your underwriting, connect with qualified realtors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            {/* Login */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login_email">Email</Label>
                  <Input
                    id="login_email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login_password">Password</Label>
                  <Input
                    id="login_password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            {/* Signup */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5">
                {/* Basic Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Basic Info</h4>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      value={signupData.full_name}
                      onChange={(e) =>
                        setSignupData((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="signup_email">Email *</Label>
                      <Input
                        id="signup_email"
                        name="email"
                        type="email"
                        value={signupData.email}
                        onChange={(e) =>
                          setSignupData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup_phone">Phone</Label>
                      <Input
                        id="signup_phone"
                        name="phone"
                        type="tel"
                        value={signupData.phone}
                        onChange={(e) =>
                          setSignupData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="signup_password">Password *</Label>
                      <Input
                        id="signup_password"
                        name="password"
                        type="password"
                        value={signupData.password}
                        onChange={(e) =>
                          setSignupData((prev) => ({ ...prev, password: e.target.value }))
                        }
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm *</Label>
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        value={signupData.confirm_password}
                        onChange={(e) =>
                          setSignupData((prev) => ({ ...prev, confirm_password: e.target.value }))
                        }
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                </div>

                {/* Investor Profile */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Investor Profile <span className="font-normal">(helps us match you with deals & realtors)</span>
                  </h4>

                  <div className="space-y-2">
                    <Label htmlFor="experience_level">Experience Level</Label>
                    <select
                      id="experience_level"
                      value={signupData.experience_level}
                      onChange={(e) =>
                        setSignupData((prev) => ({ ...prev, experience_level: e.target.value }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select your experience</option>
                      {EXPERIENCE_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <CheckboxGroup field="strategy" options={STRATEGY_OPTIONS} label="Investment Strategy" />

                  <CheckboxGroup field="property_types" options={PROPERTY_TYPE_OPTIONS} label="Property Types of Interest" />

                  <div className="space-y-2">
                    <Label htmlFor="budget_range">Budget Range</Label>
                    <select
                      id="budget_range"
                      value={signupData.budget_range}
                      onChange={(e) =>
                        setSignupData((prev) => ({ ...prev, budget_range: e.target.value }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select your range</option>
                      {BUDGET_RANGES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferred_cities">
                      Preferred Cities <span className="text-muted-foreground font-normal">(comma-separated)</span>
                    </Label>
                    <Input
                      id="preferred_cities"
                      name="preferred_cities"
                      value={signupData.preferred_cities}
                      onChange={(e) =>
                        setSignupData((prev) => ({ ...prev, preferred_cities: e.target.value }))
                      }
                      placeholder="e.g. Toronto, Hamilton, London"
                    />
                  </div>
                </div>

                {/* Agreements */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">Agreements</h4>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signupData.agreed_to_platform_terms}
                      onChange={(e) =>
                        setSignupData((prev) => ({
                          ...prev,
                          agreed_to_platform_terms: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span className="text-sm text-muted-foreground">
                      I agree to the{' '}
                      <a href="/investor/terms" className="text-primary hover:underline">
                        Platform Terms & Conditions</a> of Realist.ca.
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signupData.agreed_to_referral_terms}
                      onChange={(e) =>
                        setSignupData((prev) => ({
                          ...prev,
                          agreed_to_referral_terms: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span className="text-sm text-muted-foreground">
                      I agree to the{' '}
                      <a href="/investor/referral-agreement" className="text-primary hover:underline">
                        Referral Fee Agreement</a>, which allows Realist.ca to
                      connect me with qualified realtor members when I'm ready to act on a deal.
                    </span>
                  </label>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Investor Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default InvestorAuthPage;