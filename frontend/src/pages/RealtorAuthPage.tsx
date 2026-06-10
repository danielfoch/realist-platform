/**
 * Realtor Portal - Signup/Login Page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { Loader2, Building2 } from 'lucide-react';
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
  license_number: string;
  license_province: string;
  brokerage_name: string;
  brokerage_phone: string;
  agreed_to_terms: boolean;
}

export function RealtorAuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Track when user switches to signup
  const handleModeChange = (newMode: string) => {
    setMode(newMode as 'login' | 'signup');
    if (newMode === 'signup') {
      track('realtor_signup_started');
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
    license_number: '',
    license_province: 'ON',
    brokerage_name: '',
    brokerage_phone: '',
    agreed_to_terms: false,
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
        localStorage.setItem('realtor_token', result.data.token);
        localStorage.setItem('realtor_user', JSON.stringify(result.data.user));
        track('login', { role: 'realtor' });
        toast({ title: 'Welcome back!' });
        navigate('/realtor/dashboard');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupData.agreed_to_terms) {
      toast({ 
        title: 'Agreement Required', 
        description: 'Please agree to the referral fee agreement',
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/realtor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: signupData.full_name,
          email: signupData.email,
          phone: signupData.phone,
          password: signupData.password,
          license_number: signupData.license_number,
          license_province: signupData.license_province,
          brokerage_name: signupData.brokerage_name,
          brokerage_phone: signupData.brokerage_phone,
        }),
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('realtor_token', result.data.token);
        localStorage.setItem('realtor_user', JSON.stringify(result.data.user));
        track('realtor_signup_completed');
        toast({ title: 'Welcome to Realist.ca!' });
        navigate('/realtor/dashboard');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSignupData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Realtor Portal</CardTitle>
          <CardDescription>
            Join Realist.ca's investor referral network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login_email">Email</Label>
                  <Input
                    id="login_email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login_password">Password</Label>
                  <Input
                    id="login_password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={signupData.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={signupData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={signupData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={signupData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Realtor Information</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="license_number">License Number</Label>
                      <Input
                        id="license_number"
                        name="license_number"
                        value={signupData.license_number}
                        onChange={handleChange}
                        placeholder="OPTIONAL"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="license_province">Province</Label>
                      <select
                        id="license_province"
                        name="license_province"
                        value={signupData.license_province}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="ON">Ontario</option>
                        <option value="BC">British Columbia</option>
                        <option value="AB">Alberta</option>
                        <option value="QC">Quebec</option>
                        <option value="MB">Manitoba</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="brokerage_name">Brokerage Name</Label>
                      <Input
                        id="brokerage_name"
                        name="brokerage_name"
                        value={signupData.brokerage_name}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brokerage_phone">Brokerage Phone</Label>
                      <Input
                        id="brokerage_phone"
                        name="brokerage_phone"
                        type="tel"
                        value={signupData.brokerage_phone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signupData.agreed_to_terms}
                      onChange={(e) => setSignupData(prev => ({ ...prev, agreed_to_terms: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-muted-foreground">
                      I agree to the <a href="/realtor/agreement" className="text-primary hover:underline">25% referral fee agreement</a> and 
                      will pay Realist.ca 25% of any referral fee earned from leads matched through this platform.
                    </span>
                  </label>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default RealtorAuthPage;
