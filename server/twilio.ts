import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }
    client = twilio(accountSid, authToken);
  }
  return client;
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  if (digits.startsWith("1") && digits.length > 11) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}

export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\+[1-9]\d{10,14}$/.test(normalized);
}

export async function sendVerificationSMS(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!accountSid || !authToken || !fromNumber) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Would send SMS to ${phone}: Your Realist.ca verification code is: ${code}`);
      return { success: true };
    }
    return { success: false, error: "SMS service not configured" };
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    if (!isValidPhoneNumber(phone)) {
      return { success: false, error: "Invalid phone number format" };
    }

    const twilioClient = getClient();
    
    await twilioClient.messages.create({
      body: `Your Realist.ca verification code is: ${code}. This code expires in 10 minutes.`,
      from: fromNumber,
      to: normalizedPhone,
    });

    console.log(`SMS sent successfully to ${normalizedPhone}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send SMS:", error.message);
    return { 
      success: false, 
      error: error.code === 21211 ? "Invalid phone number" : "Failed to send verification code" 
    };
  }
}
