// Stripe Webhook Handlers
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { sendMasterclassWelcomeEmail, sendCommunityInviteEmail } from './resend';
import { db } from './db';
import { courseEnrollments, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';

const processedEventIds = new Set<string>();
const PROCESSED_EVENT_MAX = 1000;

function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false;
  }
  processedEventIds.add(eventId);
  if (processedEventIds.size > PROCESSED_EVENT_MAX) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  return true;
}

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
      if (!markEventProcessed(event.id)) {
        console.log(`[webhook] Skipping duplicate event: ${event.id}`);
        return;
      }
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
        
        if (session.metadata?.product === 'multiplex_masterclass') {
          const customerEmail = session.customer_email || session.customer_details?.email;
          const customerName = session.metadata?.customerName || session.customer_details?.name || '';
          
          if (customerEmail) {
            try {
              await sendMasterclassWelcomeEmail({
                toEmail: customerEmail,
                customerName,
              });
              console.log(`[webhook] Masterclass welcome email sent to ${customerEmail}`);

              setTimeout(async () => {
                try {
                  await sendCommunityInviteEmail({
                    toEmail: customerEmail,
                    customerName,
                  });
                  console.log(`[webhook] Community invite email sent to ${customerEmail}`);
                } catch (communityErr) {
                  console.error(`[webhook] Failed to send community invite email:`, communityErr);
                }
              }, 10 * 60 * 1000);
            } catch (err) {
              console.error(`[webhook] Failed to send masterclass welcome email to ${customerEmail}:`, (err as Error).message);
            }

            try {
              const [user] = await db.select().from(users).where(eq(users.email, customerEmail)).limit(1);
              if (user) {
                const [existing] = await db.select().from(courseEnrollments)
                  .where(and(eq(courseEnrollments.userId, user.id), eq(courseEnrollments.courseId, "multiplex_masterclass")))
                  .limit(1);
                if (!existing) {
                  await db.insert(courseEnrollments).values({
                    userId: user.id,
                    courseId: "multiplex_masterclass",
                    stripeSessionId: session.id,
                  });
                  console.log(`[webhook] Auto-enrolled ${customerEmail} in masterclass course`);
                }
              } else {
                console.log(`[webhook] No Realist account found for ${customerEmail} — will need manual enrollment`);
              }
            } catch (err) {
              console.error(`[webhook] Failed to auto-enroll ${customerEmail}:`, (err as Error).message);
            }
          } else {
            console.error('[webhook] Masterclass purchase completed but no customer email found');
          }
        }
        
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
