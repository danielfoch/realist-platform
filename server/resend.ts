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

// Send podcast question notification email
export async function sendPodcastQuestionNotification(params: {
  name: string;
  email: string;
  question: string;
  notifyEmail: string;
}) {
  const { client, fromEmail } = await getResendClient();
  
  const { data, error } = await client.emails.send({
    from: fromEmail,
    to: params.notifyEmail,
    subject: `New Podcast Question from ${params.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Podcast Question</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">The Canadian Real Estate Investor Podcast</p>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${params.name}</p>
            <p style="margin: 4px 0 0 0; color: #4b5563;">${params.email}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Question</p>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #374151; line-height: 1.6; white-space: pre-wrap;">${params.question}</p>
            </div>
          </div>
          
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
              <a href="https://realist.ca/admin" style="color: #22c55e; text-decoration: none; font-weight: 500;">View all questions in Admin Dashboard →</a>
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 16px;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            Realist.ca - Canada's #1 Real Estate Deal Analyzer
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send podcast question email:', error);
    throw error;
  }

  return data;
}

// Send a generic notification email
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
