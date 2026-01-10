// Stripe Webhook Handlers
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler.'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    
    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.log('[webhook] No webhook secret configured, skipping custom handling');
      return;
    }
    
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      await WebhookHandlers.handleCustomEvents(event);
    } catch (err) {
      console.log('[webhook] Custom event handling skipped:', (err as Error).message);
    }
  }
  
  static async handleCustomEvents(event: Stripe.Event): Promise<void> {
    const expertPriceId = process.env.STRIPE_EXPERT_PRICE_ID;
    const meetupPriceId = process.env.STRIPE_MEETUP_PRICE_ID;
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.metadata?.type === 'featured_expert' && session.metadata?.userId) {
          const userId = session.metadata.userId;
          const application = await storage.getMarketExpertApplication(userId);
          
          if (application) {
            await storage.updateMarketExpertApplication(application.id, {
              status: 'approved',
              stripeSubscriptionId: session.subscription as string,
            });
            console.log(`[webhook] Approved market expert: ${userId}`);
          }
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        
        const application = await storage.getMarketExpertApplicationBySubscription(subscriptionId);
        if (application) {
          await storage.updateMarketExpertApplication(application.id, {
            status: 'cancelled',
          });
          console.log(`[webhook] Cancelled market expert subscription: ${subscriptionId}`);
        }
        break;
      }
    }
  }
}
