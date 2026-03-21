import { Router } from 'express';
import { db } from '../db';
import { realtors, lenders, dealLeads } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Validation helpers
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone: string) => /^[\d\s\-+()]{10,}$/.test(phone);

interface JoinRealtorBody {
  name: string;
  email: string;
  phone: string;
  brokerage: string;
  marketsServed: string[];
  assetTypes: string[];
  dealTypes: string[];
  avgDealSize: string;
  referralAgreement: boolean;
}

interface JoinLenderBody {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  lendingTypes: string[];
  targetMarkets: string[];
  loanSizeMin: number;
  loanSizeMax: number;
  preferredDscrMin?: number;
  preferredLtvMax?: number;
  turnaroundTime: string;
  referralAgreement: boolean;
}

// POST /api/realtors/join
router.post('/realtors/join', async (req, res) => {
  try {
    const body = req.body as JoinRealtorBody;
    
    // Validation
    if (!body.name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!body.email || !isValidEmail(body.email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!body.phone || !isValidPhone(body.phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (!body.brokerage?.trim()) {
      return res.status(400).json({ error: 'Brokerage is required' });
    }
    if (!body.marketsServed?.length) {
      return res.status(400).json({ error: 'At least one market is required' });
    }
    if (!body.assetTypes?.length) {
      return res.status(400).json({ error: 'At least one asset type is required' });
    }
    if (!body.dealTypes?.length) {
      return res.status(400).json({ error: 'At least one deal type is required' });
    }
    if (!body.referralAgreement) {
      return res.status(400).json({ error: 'Referral agreement is required' });
    }

    // Check for existing email
    const existing = await db.query.realtors.findFirst({
      where: eq(realtors.email, body.email),
    });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // Insert new realtor
    const [newRealtor] = await db.insert(realtors).values({
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.trim(),
      brokerage: body.brokerage.trim(),
      marketsServed: body.marketsServed,
      assetTypes: body.assetTypes,
      dealTypes: body.dealTypes,
      avgDealSize: body.avgDealSize || null,
      referralAgreement: body.referralAgreement,
      status: 'active',
    }).returning();

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful!',
      data: { id: newRealtor.id }
    });
  } catch (error) {
    console.error('Error creating realtor:', error);
    res.status(500).json({ error: 'Failed to register. Please try again.' });
  }
});

// POST /api/lenders/join
router.post('/lenders/join', async (req, res) => {
  try {
    const body = req.body as JoinLenderBody;
    
    // Validation
    if (!body.contactName?.trim()) {
      return res.status(400).json({ error: 'Contact name is required' });
    }
    if (!body.companyName?.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!body.email || !isValidEmail(body.email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!body.phone || !isValidPhone(body.phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (!body.lendingTypes?.length) {
      return res.status(400).json({ error: 'At least one lending type is required' });
    }
    if (!body.targetMarkets?.length) {
      return res.status(400).json({ error: 'At least one target market is required' });
    }
    if (typeof body.loanSizeMin !== 'number' || body.loanSizeMin < 0) {
      return res.status(400).json({ error: 'Valid minimum loan size is required' });
    }
    if (typeof body.loanSizeMax !== 'number' || body.loanSizeMax < body.loanSizeMin) {
      return res.status(400).json({ error: 'Maximum loan size must be greater than minimum' });
    }
    if (!body.turnaroundTime) {
      return res.status(400).json({ error: 'Turnaround time is required' });
    }
    if (!body.referralAgreement) {
      return res.status(400).json({ error: 'Referral agreement is required' });
    }

    // Check for existing email
    const existing = await db.query.lenders.findFirst({
      where: eq(lenders.email, body.email),
    });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // Insert new lender
    const [newLender] = await db.insert(lenders).values({
      contactName: body.contactName.trim(),
      companyName: body.companyName.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.trim(),
      lendingTypes: body.lendingTypes,
      targetMarkets: body.targetMarkets,
      loanSizeMin: body.loanSizeMin,
      loanSizeMax: body.loanSizeMax,
      preferredDscrMin: body.preferredDscrMin || null,
      preferredLtvMax: body.preferredLtvMax || null,
      turnaroundTime: body.turnaroundTime,
      referralAgreement: body.referralAgreement,
      status: 'active',
    }).returning();

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful!',
      data: { id: newLender.id }
    });
  } catch (error) {
    console.error('Error creating lender:', error);
    res.status(500).json({ error: 'Failed to register. Please try again.' });
  }
});

// GET /api/realtors (admin)
router.get('/realtors', async (req, res) => {
  try {
    // Add admin auth check here
    const allRealtors = await db.query.realtors.findMany({
      orderBy: (realtors, { desc }) => [desc(realtors.createdAt)],
    });
    res.json({ data: allRealtors });
  } catch (error) {
    console.error('Error fetching realtors:', error);
    res.status(500).json({ error: 'Failed to fetch realtors' });
  }
});

// GET /api/lenders (admin)
router.get('/lenders', async (req, res) => {
  try {
    // Add admin auth check here
    const allLenders = await db.query.lenders.findMany({
      orderBy: (lenders, { desc }) => [desc(lenders.createdAt)],
    });
    res.json({ data: allLenders });
  } catch (error) {
    console.error('Error fetching lenders:', error);
    res.status(500).json({ error: 'Failed to fetch lenders' });
  }
});

// POST /api/deal-leads (from deal analyzer)
router.post('/deal-leads', async (req, res) => {
  try {
    const { 
      userId, 
      propertyAddress, 
      city, 
      province, 
      purchasePrice, 
      financingNotes,
      investorGoals 
    } = req.body;

    // Match to realtor and lender
    let matchedRealtorId = null;
    let matchedLenderId = null;

    if (city || province) {
      // Find matching realtor
      const matchingRealtor = await db.query.realtors.findFirst({
        where: and(
          eq(realtors.status, 'active'),
          // Would need raw SQL for JSON contains - simplified here
        ),
      });
      if (matchingRealtor) matchedRealtorId = matchingRealtor.id;
    }

    if (purchasePrice) {
      // Find matching lender
      const matchingLender = await db.query.lenders.findFirst({
        where: and(
          eq(lenders.status, 'active'),
          // Would need raw SQL for range check - simplified here
        ),
      });
      if (matchingLender) matchedLenderId = matchingLender.id;
    }

    const [newLead] = await db.insert(dealLeads).values({
      userId: userId || null,
      propertyAddress: propertyAddress || null,
      city: city || null,
      province: province || null,
      purchasePrice: purchasePrice || null,
      financingNotes: financingNotes || null,
      investorGoals: investorGoals || null,
      matchedRealtorId,
      matchedLenderId,
      status: 'new',
    }).returning();

    res.status(201).json({ 
      success: true, 
      data: { 
        id: newLead.id,
        matchedRealtorId,
        matchedLenderId 
      }
    });
  } catch (error) {
    console.error('Error creating deal lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

export default router;