// Resend Email Integration - using Replit Connector
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// Get a fresh Resend client each time
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Get notification recipients from environment
function getNotifyEmails(): string[] {
  const primary = process.env.PODCAST_NOTIFY_EMAIL;
  const cc = process.env.NOTIFY_CC_EMAIL;
  const emails: string[] = [];
  if (primary) emails.push(primary);
  if (cc) emails.push(cc);
  return emails;
}

// Email header template
function emailHeader(title: string, subtitle: string) {
  return `
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${subtitle}</p>
    </div>
  `;
}

// Email footer template
function emailFooter() {
  return `
    <div style="text-align: center; padding: 16px;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Realist.ca - Canada's #1 Real Estate Deal Analyzer
      </p>
    </div>
  `;
}

// Format data row for email
function formatRow(label: string, value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '';
  return `
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${label}</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${value}</td>
    </tr>
  `;
}

// Send form notification with CC support
export async function sendFormNotification(params: {
  formType: 'lead' | 'podcast_question' | 'reno_quote' | 'contact_host' | 'expert_application' | 'market_expert_apply' | 'coaching_waitlist';
  subject: string;
  data: Record<string, any>;
}) {
  const { client, fromEmail } = await getResendClient();
  const recipients = getNotifyEmails();
  
  if (recipients.length === 0) {
    console.log('No notification emails configured, skipping email send');
    return null;
  }

  const formTypeLabels: Record<string, { title: string; subtitle: string }> = {
    lead: { title: 'New Lead Submission', subtitle: 'Deal Analyzer Lead Capture' },
    podcast_question: { title: 'New Podcast Question', subtitle: 'The Canadian Real Estate Investor Podcast' },
    reno_quote: { title: 'New Renovation Quote Request', subtitle: 'Renovation Calculator Submission' },
    contact_host: { title: 'Event Host Contact Request', subtitle: 'Meetup Event Inquiry' },
    expert_application: { title: 'New Expert Application', subtitle: 'Featured Expert Application' },
    market_expert_apply: { title: 'Market Expert Application', subtitle: 'Professional Application' },
    coaching_waitlist: { title: 'New Coaching Waitlist Signup', subtitle: 'Coaching Program Interest' },
  };

  const { title, subtitle } = formTypeLabels[params.formType] || { title: 'New Form Submission', subtitle: 'Realist.ca' };
  
  // Build data rows
  let dataRows = '';
  for (const [key, value] of Object.entries(params.data)) {
    if (value !== undefined && value !== null && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      dataRows += formatRow(label, displayValue);
    }
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader(title, subtitle)}
      
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${dataRows}
        </table>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Submitted on ${new Date().toLocaleString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p style="margin: 8px 0 0 0;">
            <a href="https://realist.ca/admin" style="color: #22c55e; text-decoration: none; font-weight: 500;">View in Admin Dashboard →</a>
          </p>
        </div>
      </div>
      
      ${emailFooter()}
    </div>
  `;

  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: recipients,
    subject: params.subject,
    html,
  });

  if (error) {
    console.error(`Failed to send ${params.formType} notification email:`, error);
    throw error;
  }

  console.log(`Form notification sent to: ${recipients.join(', ')}`);
  return data;
}

// Convenience wrappers for specific form types
export async function sendLeadNotification(lead: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  strategy?: string;
  purchasePrice?: number;
  source?: string;
}) {
  return sendFormNotification({
    formType: 'lead',
    subject: `New Lead: ${lead.name} - ${lead.address || 'Deal Analyzer'}`,
    data: {
      Name: lead.name,
      Email: lead.email,
      Phone: lead.phone,
      'Property Address': lead.address,
      'Investment Strategy': lead.strategy,
      'Purchase Price': lead.purchasePrice ? `$${lead.purchasePrice.toLocaleString()}` : undefined,
      Source: lead.source,
    },
  });
}

export async function sendPodcastQuestionNotification(params: {
  name: string;
  email: string;
  question: string;
  notifyEmail?: string; // kept for backwards compatibility
}) {
  return sendFormNotification({
    formType: 'podcast_question',
    subject: `New Podcast Question from ${params.name}`,
    data: {
      Name: params.name,
      Email: params.email,
      Question: params.question,
    },
  });
}

export async function sendRenoQuoteNotification(quote: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  projectType?: string;
  squareFootage?: number;
  estimatedTotal?: number;
}) {
  return sendFormNotification({
    formType: 'reno_quote',
    subject: `New Reno Quote Request${quote.name ? `: ${quote.name}` : ''}`,
    data: {
      Name: quote.name,
      Email: quote.email,
      Phone: quote.phone,
      Address: quote.address,
      'Project Type': quote.projectType,
      'Square Footage': quote.squareFootage,
      'Estimated Total': quote.estimatedTotal ? `$${quote.estimatedTotal.toLocaleString()}` : undefined,
    },
  });
}

export async function sendContactHostNotification(contact: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  eventTitle?: string;
  hostName?: string;
}) {
  return sendFormNotification({
    formType: 'contact_host',
    subject: `Event Host Contact: ${contact.eventTitle || 'Meetup Inquiry'}`,
    data: {
      'Contact Name': contact.name,
      'Contact Email': contact.email,
      'Contact Phone': contact.phone,
      Event: contact.eventTitle,
      Host: contact.hostName,
      Message: contact.message,
    },
  });
}

export async function sendCoachingWaitlistNotification(entry: {
  fullName: string;
  email: string;
  phone: string;
  mainProblem: string;
}) {
  return sendFormNotification({
    formType: 'coaching_waitlist',
    subject: `Coaching Waitlist: ${entry.fullName}`,
    data: {
      'Full Name': entry.fullName,
      Email: entry.email,
      Phone: entry.phone,
      'Main Problem': entry.mainProblem,
    },
  });
}

export async function sendExpertApplicationNotification(application: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  expertise?: string;
  markets?: string[];
  website?: string;
  message?: string;
}) {
  return sendFormNotification({
    formType: 'expert_application',
    subject: `New Expert Application: ${application.name}`,
    data: {
      Name: application.name,
      Email: application.email,
      Phone: application.phone,
      Company: application.company,
      Expertise: application.expertise,
      Markets: application.markets?.join(', '),
      Website: application.website,
      Message: application.message,
    },
  });
}

export async function sendMarketExpertApplyNotification(application: {
  userId: number;
  userName?: string;
  userEmail?: string;
  markets?: string[];
  specialties?: string[];
  bio?: string;
}) {
  return sendFormNotification({
    formType: 'market_expert_apply',
    subject: `Market Expert Application: ${application.userName || 'User #' + application.userId}`,
    data: {
      'User ID': application.userId,
      Name: application.userName,
      Email: application.userEmail,
      Markets: application.markets?.join(', '),
      Specialties: application.specialties?.join(', '),
      Bio: application.bio,
    },
  });
}

export async function sendRealtorIntroEmail(params: {
  leadName: string;
  leadEmail: string;
  realtorName: string;
  realtorEmail: string;
  realtorPhone?: string;
  realtorCompany?: string;
  dealAddress?: string;
  dealCity?: string;
  dealStrategy?: string;
}) {
  const { client, fromEmail } = await getResendClient();

  const subject = `Introduction: ${params.leadName}, meet ${params.realtorName} — Your Local Real Estate Expert`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader('Realist — Local Expert Introduction', 'Connecting you with your area specialist')}
      
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #111827; font-size: 15px; line-height: 1.6;">
          Hi ${params.leadName},
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          I wanted to connect you with <strong>${params.realtorName}</strong>${params.realtorCompany ? ` from <strong>${params.realtorCompany}</strong>` : ''}, a trusted real estate expert in ${params.dealCity || 'your market'}.
        </p>
        ${params.dealAddress ? `
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          I noticed you were analyzing a deal at <strong>${params.dealAddress}</strong>${params.dealStrategy ? ` (${params.dealStrategy.replace(/_/g, ' ')})` : ''}. ${params.realtorName} is well-versed in this market and can help you with your investment goals.
        </p>
        ` : ''}
        
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827; font-size: 14px;">${params.realtorName}</p>
          ${params.realtorCompany ? `<p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px;">${params.realtorCompany}</p>` : ''}
          <p style="margin: 0 0 4px 0; color: #374151; font-size: 13px;">📧 ${params.realtorEmail}</p>
          ${params.realtorPhone ? `<p style="margin: 0; color: #374151; font-size: 13px;">📱 ${params.realtorPhone}</p>` : ''}
        </div>

        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          I've CC'd ${params.realtorName} on this email so you can connect directly. They're expecting your message!
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Best,<br/>
          <strong>The Realist Team</strong>
        </p>
      </div>
      
      ${emailFooter()}
    </div>
  `;

  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: params.leadEmail,
    cc: [params.realtorEmail],
    subject,
    html,
  });

  if (error) {
    console.error('Failed to send realtor intro email:', error);
    throw error;
  }

  console.log(`Realtor intro email sent: ${params.leadName} <-> ${params.realtorName}`);
  return { data, subject, html };
}

export async function sendRealtorLeadAlert(params: {
  realtorEmail: string;
  realtorName: string;
  leadName: string;
  dealAddress?: string;
  dealCity?: string;
  dealStrategy?: string;
  claimUrl: string;
}) {
  const { client, fromEmail } = await getResendClient();

  const subject = `New Lead in Your Market: ${params.dealCity || 'Your Area'} — ${params.dealAddress || 'Property Analysis'}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader('New Lead Available', 'Someone is analyzing a deal in your market')}
      
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #111827; font-size: 15px; line-height: 1.6;">
          Hi ${params.realtorName},
        </p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          A potential client just analyzed a deal in your claimed market. Here are the details:
        </p>
        
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          ${params.dealAddress ? `<p style="margin: 0 0 8px 0; color: #111827; font-size: 14px;"><strong>Property:</strong> ${params.dealAddress}</p>` : ''}
          ${params.dealCity ? `<p style="margin: 0 0 8px 0; color: #111827; font-size: 14px;"><strong>Market:</strong> ${params.dealCity}</p>` : ''}
          ${params.dealStrategy ? `<p style="margin: 0 0 8px 0; color: #111827; font-size: 14px;"><strong>Strategy:</strong> ${params.dealStrategy.replace(/_/g, ' ')}</p>` : ''}
          <p style="margin: 0; color: #111827; font-size: 14px;"><strong>Lead:</strong> ${params.leadName}</p>
        </div>

        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Log in to your Realtor Portal to review this lead and send an introduction. First to claim gets the connection!
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.claimUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View & Claim This Lead
          </a>
        </div>

        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin-top: 16px;">
          You're receiving this because you've claimed ${params.dealCity || 'this market'} as your service area on Realist.ca. To stop receiving these, you can release your market claim in the partner portal.
        </p>
      </div>
      
      ${emailFooter()}
    </div>
  `;

  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: params.realtorEmail,
    subject,
    html,
  });

  if (error) {
    console.error('Failed to send realtor lead alert:', error);
    return null;
  }

  console.log(`Realtor lead alert sent to ${params.realtorEmail} for ${params.dealCity}`);
  return data;
}

export async function sendMasterclassWelcomeEmail(params: {
  toEmail: string;
  customerName: string;
}) {
  try {
    const { client, fromEmail } = await getResendClient();
    const firstName = params.customerName?.split(' ')[0] || 'there';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 32px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Welcome to the Multiplex Masterclass</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">You're in. Let's build.</p>
        </div>
        
        <div style="background: #f9fafb; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #111827; font-size: 16px; margin: 0 0 16px 0;">
            Hi ${firstName},
          </p>
          
          <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
            Thank you for purchasing the Multiplex Masterclass Canada. Your payment has been confirmed and you now have full access to the course, community, and weekly coaching calls.
          </p>

          <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
            Click the button below to join the Realist community on Skool, where you'll find all the course materials, connect with other students, and access the coaching schedule:
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://www.skool.com/realist/about" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px;">
              Access Your Course on Skool
            </a>
          </div>

          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #111827; font-size: 15px;">What's included:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Full Multiplex Masterclass course</td></tr>
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Weekly group coaching calls</td></tr>
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Underwriting templates & financial models</td></tr>
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Private community access</td></tr>
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Access to a team of professionals</td></tr>
              <tr><td style="padding: 6px 0; color: #374151; font-size: 14px;">✅ Lifetime access — no recurring fees</td></tr>
            </table>
          </div>

          <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
            If you have any questions, just reply to this email. We're here to help.
          </p>

          <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 16px 0 0 0;">
            See you inside,<br/>
            <strong>The Realist Team</strong>
          </p>
        </div>
        
        ${emailFooter()}
      </div>
    `;

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: params.toEmail,
      subject: `Your Multiplex Masterclass Access — Welcome, ${firstName}!`,
      html,
    });

    if (error) {
      console.error('Failed to send masterclass welcome email:', error);
      throw error;
    }

    console.log(`Masterclass welcome email sent to: ${params.toEmail}`);
    return data;
  } catch (err) {
    console.error('Masterclass welcome email error:', err);
    throw err;
  }
}

// Send a generic notification email (backwards compatible)
export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const { client, fromEmail } = await getResendClient();
  
  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw error;
  }

  return data;
}

export async function sendMLIQuoteNotification(quote: {
  name: string;
  email: string;
  phone: string;
  location?: string;
  totalPoints?: number;
  tier?: string;
  dscr?: number;
  equityRequired?: number;
  noi?: number;
  purchasePrice?: number;
  loanAmount?: number;
  interestRate?: number;
  stressTestResults?: any;
}) {
  const { client, fromEmail } = await getResendClient();
  
  const recipients = ['nick@bldfinancial.ca'];
  
  const ccEmails = getNotifyEmails();
  
  let dataRows = '';
  const data: Record<string, any> = {
    Name: quote.name,
    Email: quote.email,
    Phone: quote.phone,
    Location: quote.location,
    'Total Points': quote.totalPoints,
    Tier: quote.tier,
    DSCR: quote.dscr ? quote.dscr.toFixed(2) + 'x' : undefined,
    'Equity Required': quote.equityRequired ? `$${quote.equityRequired.toLocaleString()}` : undefined,
    NOI: quote.noi ? `$${quote.noi.toLocaleString()}` : undefined,
    'Purchase Price': quote.purchasePrice ? `$${quote.purchasePrice.toLocaleString()}` : undefined,
    'Loan Amount': quote.loanAmount ? `$${quote.loanAmount.toLocaleString()}` : undefined,
    'Interest Rate': quote.interestRate ? `${quote.interestRate}%` : undefined,
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      dataRows += formatRow(key, String(value));
    }
  }

  if (quote.stressTestResults) {
    dataRows += `
      <tr>
        <td colspan="2" style="padding: 16px 0 8px 0; color: #111827; font-size: 14px; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Stress Test Results</td>
      </tr>
    `;
    if (quote.stressTestResults.base) {
      dataRows += formatRow('Base Case NOI', quote.stressTestResults.base.noi ? `$${quote.stressTestResults.base.noi.toLocaleString()}` : '-');
      dataRows += formatRow('Base Case DSCR', quote.stressTestResults.base.dscr ? quote.stressTestResults.base.dscr.toFixed(2) + 'x' : '-');
      dataRows += formatRow('Base Case Cash Flow', quote.stressTestResults.base.cashFlow ? `$${quote.stressTestResults.base.cashFlow.toLocaleString()}` : '-');
    }
    if (quote.stressTestResults.bear) {
      dataRows += formatRow('Bear Case NOI', quote.stressTestResults.bear.noi ? `$${quote.stressTestResults.bear.noi.toLocaleString()}` : '-');
      dataRows += formatRow('Bear Case DSCR', quote.stressTestResults.bear.dscr ? quote.stressTestResults.bear.dscr.toFixed(2) + 'x' : '-');
    }
    if (quote.stressTestResults.bull) {
      dataRows += formatRow('Bull Case NOI', quote.stressTestResults.bull.noi ? `$${quote.stressTestResults.bull.noi.toLocaleString()}` : '-');
      dataRows += formatRow('Bull Case DSCR', quote.stressTestResults.bull.dscr ? quote.stressTestResults.bull.dscr.toFixed(2) + 'x' : '-');
    }
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${emailHeader('New MLI Select Quote Request', 'CMHC Multi-Unit Financing Inquiry')}
      
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${dataRows}
        </table>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Submitted on ${new Date().toLocaleString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
      
      ${emailFooter()}
    </div>
  `;

  const emailPayload: any = {
    from: fromEmail,
    to: recipients,
    subject: `MLI Select Quote Request: ${quote.name}`,
    html,
  };
  
  if (ccEmails.length > 0) {
    emailPayload.cc = ccEmails;
  }

  const { data: emailData, error } = await client.emails.send(emailPayload);

  if (error) {
    console.error('Failed to send MLI quote notification:', error);
    throw error;
  }

  console.log(`MLI quote notification sent to: ${recipients.join(', ')}`);
  return emailData;
}

export async function sendWelcomeAccountEmail(params: {
  toEmail: string;
  firstName: string;
  setupLink: string;
  leadSource?: string;
}) {
  try {
    const { client, fromEmail } = await getResendClient();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${emailHeader('Welcome to Realist.ca', 'Your account is ready')}
        
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #111827; font-size: 16px; margin: 0 0 16px 0;">
            Hi ${params.firstName || 'there'},
          </p>
          
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            Thanks for using Realist.ca${params.leadSource ? ` (${params.leadSource})` : ''}! We've created an account for you so you can save your analyses, track deals, and access all our tools without filling out forms again.
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${params.setupLink}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Set Your Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
            This link expires in 7 days. If you didn't use Realist.ca, you can safely ignore this email.
          </p>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              You're receiving this because you used a tool on Realist.ca
            </p>
          </div>
        </div>
        
        ${emailFooter()}
      </div>
    `;

    const { data: emailData, error } = await client.emails.send({
      from: fromEmail,
      to: [params.toEmail],
      subject: `Welcome to Realist.ca — Set Your Password`,
      html,
    });

    if (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }

    console.log(`Welcome email sent to: ${params.toEmail}`);
    return emailData;
  } catch (error) {
    console.error(`Error sending welcome email to ${params.toEmail}:`, error);
    return null;
  }
}
