// Seed script to create Stripe products and prices
// Run with: npx tsx server/scripts/seedStripeProducts.ts

import { getUncachableStripeClient } from '../stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Creating Stripe products and prices...');

  // Professional Subscription - Starter ($10/month, 25 pulls)
  const starterProduct = await stripe.products.create({
    name: 'Professional Starter',
    description: '25 deal analyses per month with basic branding',
    metadata: {
      tier: 'starter',
      pullLimit: '25',
    },
  });

  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 1000, // $10.00
    currency: 'cad',
    recurring: { interval: 'month' },
    metadata: { tier: 'starter' },
  });

  console.log(`Created Starter plan: ${starterProduct.id} / ${starterPrice.id}`);

  // Professional Subscription - Pro ($25/month, unlimited pulls)
  const proProduct = await stripe.products.create({
    name: 'Professional Pro',
    description: 'Unlimited deal analyses per month with full branding',
    metadata: {
      tier: 'pro',
      pullLimit: 'unlimited',
    },
  });

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 2500, // $25.00
    currency: 'cad',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro' },
  });

  console.log(`Created Pro plan: ${proProduct.id} / ${proPrice.id}`);

  // Featured Market Expert ($1000/month + 20% referral)
  const expertProduct = await stripe.products.create({
    name: 'Featured Market Expert',
    description: 'Featured expert listing with platform analytics and leads',
    metadata: {
      type: 'featured_expert',
      referralFee: '20',
    },
  });

  const expertPrice = await stripe.prices.create({
    product: expertProduct.id,
    unit_amount: 100000, // $1000.00
    currency: 'cad',
    recurring: { interval: 'month' },
    metadata: { type: 'featured_expert' },
  });

  console.log(`Created Expert plan: ${expertProduct.id} / ${expertPrice.id}`);

  // Meetup Host Add-on ($250/month)
  const meetupProduct = await stripe.products.create({
    name: 'Meetup Host',
    description: 'Host investor meetups in your market',
    metadata: {
      type: 'meetup_host',
    },
  });

  const meetupPrice = await stripe.prices.create({
    product: meetupProduct.id,
    unit_amount: 25000, // $250.00
    currency: 'cad',
    recurring: { interval: 'month' },
    metadata: { type: 'meetup_host' },
  });

  console.log(`Created Meetup Host add-on: ${meetupProduct.id} / ${meetupPrice.id}`);

  console.log('\n=== Environment Variables to Add ===');
  console.log(`STRIPE_STARTER_PRICE_ID=${starterPrice.id}`);
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log(`STRIPE_EXPERT_PRICE_ID=${expertPrice.id}`);
  console.log(`STRIPE_MEETUP_PRICE_ID=${meetupPrice.id}`);
  console.log('\nProducts seeded successfully!');
}

seedProducts().catch(console.error);
