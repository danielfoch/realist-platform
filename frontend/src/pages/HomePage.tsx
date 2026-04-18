/**
 * HomePage — Landing page explaining Realist's value proposition for investors and realtors
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  TrendingUp,
  Users,
  Search,
  BarChart3,
  DollarSign,
  MapPin,
  Building2,
  Star,
  Check,
} from 'lucide-react';
import { track } from '@/lib/event-tracking';

export function HomePage() {
  track('page_view', { page: 'home' });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-emerald-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border-blue-500/30">
              Canadian Real Estate Intelligence
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Find Deals. Analyze{' '}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Faster.
              </span>{' '}
              Invest Smarter.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl">
              Realist is the intelligence layer for Canadian real estate — connecting property data, underwriting
              tools, and a network of investor-ready realtors.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/properties"
                onClick={() => track('homepage_cta_click', { cta: 'browse_listings' })}
              >
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
                  Browse Properties <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link
                to="/6ixplex"
                onClick={() => track('homepage_cta_click', { cta: 'analyze_deal' })}
              >
                <Button size="lg" variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700 px-8 py-6 text-lg">
                  <BarChart3 className="mr-2 h-5 w-5" /> Analyze a Deal
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span>Active listings across Canada</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                <span>Built-in deal analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                <span>Investor–Realtor network</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual-Side CTA: Investor vs Realtor */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Two sides of the same deal
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you're looking for your next property or your next client, Realist puts the right information — and the right people — in front of you.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Investor Card */}
            <Card className="overflow-hidden border-2 border-blue-100 hover:border-blue-300 transition-colors">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">For Investors</h3>
                </div>

                <ul className="space-y-4 mb-8">
                  {[
                    'Browse active investment listings with built-in cap rates and yield estimates',
                    'Analyze any property in seconds — cash flow, returns, and scenarios',
                    'Save and compare deals, build your analysis history',
                    'Get matched with a local investor-savvy realtor when you\'re ready',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700">
                      <Check className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/investor"
                    onClick={() => track('homepage_cta_click', { cta: 'join_investor' })}
                    className="flex-1"
                  >
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
                      Join as Investor <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link
                    to="/properties"
                    onClick={() => track('homepage_cta_click', { cta: 'browse_as_investor' })}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full text-lg py-6 border-gray-300">
                      Browse First
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Realtor Card */}
            <Card className="overflow-hidden border-2 border-purple-100 hover:border-purple-300 transition-colors">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                    <Building2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">For Realtors</h3>
                </div>

                <ul className="space-y-4 mb-8">
                  {[
                    'Connect with serious buyer and seller leads actively analyzing deals',
                    'Set your own referral fee and define your specialty markets',
                    'Build a profile that shows investors why you\'re the right partner',
                    'Receive qualified leads routed by market, strategy, and intent',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700">
                      <Check className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/realtor"
                    onClick={() => track('homepage_cta_click', { cta: 'join_realtor' })}
                    className="flex-1"
                  >
                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-6">
                      Join the Network <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link
                    to="/insights/blog"
                    onClick={() => track('homepage_cta_click', { cta: 'read_insights' })}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full text-lg py-6 border-gray-300">
                      Read Insights
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features / What You Get */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything in one platform
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Stop juggling spreadsheets, listing sites, and half the internet.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Search className="h-7 w-7" />,
                title: 'Live Listings',
                desc: 'Browse active properties across Canada with investment-ready data — cap rates, yield estimates, cash flow projections.',
                color: 'bg-blue-50 text-blue-600 border-blue-100',
              },
              {
                icon: <BarChart3 className="h-7 w-7" />,
                title: 'Deal Analyzer',
                desc: 'Underwrite any property in seconds. Model scenarios, stress-test assumptions, and save your analysis for later.',
                color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
              },
              {
                icon: <DollarSign className="h-7 w-7" />,
                title: 'Saved Deals',
                desc: 'Bookmark properties, track their history, and get notified on changes. Build a personal pipeline.',
                color: 'bg-amber-50 text-amber-600 border-amber-100',
              },
              {
                icon: <Users className="h-7 w-7" />,
                title: 'Investor–Realtor Network',
                desc: 'Get matched with realtors who specialize in investment properties. Set referral terms, skip the guesswork.',
                color: 'bg-purple-50 text-purple-600 border-purple-100',
              },
              {
                icon: <Star className="h-7 w-7" />,
                title: 'Analysis Memory',
                desc: 'Every analysis you run is saved. Compare assumptions across deals and see what\'s working.',
                color: 'bg-rose-50 text-rose-600 border-rose-100',
              },
              {
                icon: <MapPin className="h-7 w-7" />,
                title: 'Market Intelligence',
                desc: 'City-level yield rankings, guides, and data-driven insights to inform your next move.',
                color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
              },
            ].map((feature, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow border">
                <CardContent className="pt-6">
                  <div className={`inline-flex items-center justify-center rounded-lg p-3 border mb-4 ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-900 text-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to invest with better information?
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Join thousands of Canadian investors and realtors already using Realist to make smarter decisions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/investor" onClick={() => track('homepage_cta_click', { cta: 'investor_final' })}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
                Join as Investor
              </Button>
            </Link>
            <Link to="/realtor" onClick={() => track('homepage_cta_click', { cta: 'realtor_final' })}>
              <Button size="lg" variant="outline" className="border-gray-500 text-gray-200 hover:bg-gray-700 px-8 py-6 text-lg">
                Join as Realtor
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
