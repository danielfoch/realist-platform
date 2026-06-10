// GoHighLevel CRM Integration Service
// Pushes contacts to GHL when new signups occur

interface GHLContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  source: string;
}

interface GHLConfig {
  token: string | undefined;
  locationId: string | undefined;
}

const getConfig = (): GHLConfig => {
  return {
    token: process.env.HIGHLEVEL_TOKEN,
    locationId: process.env.HIGHLEVEL_LOCATION_ID,
  };
};

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

/**
 * Push a contact to GoHighLevel as a background operation
 * Does not throw - errors are logged but don't fail the main flow
 */
export async function pushToGHL(contact: GHLContact): Promise<void> {
  const config = getConfig();
  
  // Skip if no credentials configured
  if (!config.token || !config.locationId) {
    console.log('[GHL] Skipping - no credentials configured');
    return;
  }

  try {
    // Split name into first/last
    const nameParts = contact.email.split('@')[0].split('.');
    const firstName = contact.firstName || nameParts[0] || 'Unknown';
    const lastName = contact.lastName || nameParts.slice(1).join(' ') || '';

    const payload = {
      locationId: config.locationId,
      firstName,
      lastName,
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags,
      source: contact.source,
    };

    const response = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GHL] Failed to create contact:', response.status, error);
      return;
    }

    const result = await response.json();
    console.log('[GHL] Contact pushed successfully:', result.contact?.id || 'unknown');
  } catch (error) {
    // Log but don't fail - this is a background operation
    console.error('[GHL] Error pushing contact:', error);
  }
}

/**
 * Helper to push a realtor signup to GHL
 */
export async function pushRealtorToGHL(
  name: string,
  email: string,
  phone: string,
  brokerage?: string
): Promise<void> {
  await pushToGHL({
    firstName: name.split(' ')[0],
    lastName: name.split(' ').slice(1).join(' ') || '',
    email,
    phone,
    tags: ['realist.ca', 'realtor'],
    source: 'realtor_join',
  });
}

/**
 * Helper to push a lender signup to GHL
 */
export async function pushLenderToGHL(
  contactName: string,
  companyName: string,
  email: string,
  phone: string
): Promise<void> {
  await pushToGHL({
    firstName: contactName.split(' ')[0],
    lastName: contactName.split(' ').slice(1).join(' ') || '',
    email,
    phone,
    tags: ['realist.ca', 'lender', companyName],
    source: 'lender_join',
  });
}

/**
 * Helper to push a deal lead to GHL
 */
export async function pushDealLeadToGHL(
  email: string,
  phone: string,
  name?: string,
  city?: string,
  province?: string
): Promise<void> {
  const tags = ['realist.ca', 'deal_lead'];
  if (city) tags.push(`city:${city}`);
  if (province) tags.push(`province:${province}`);

  await pushToGHL({
    firstName: name?.split(' ')[0] || email.split('@')[0],
    lastName: name?.split(' ').slice(1).join(' ') || '',
    email,
    phone: phone || '',
    tags,
    source: 'deal_lead',
  });
}
