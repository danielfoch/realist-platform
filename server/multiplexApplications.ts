import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

export const multiplexApplicationSchema = z.object({
  submissionId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(40).default(""),
  company: z.string().trim().max(160).default(""),
  attendedEvent: z.enum(["yes", "registered", "no"]),
  location: z.string().trim().min(2).max(300),
  stage: z.enum(["Searching for a site", "Evaluating a site", "Under contract", "Own the property", "Permits in progress", "Ready to build", "Under construction"]),
  units: z.number().int().min(2).max(100),
  totalBudget: z.string().trim().max(80).default(""),
  capitalRequested: z.string().trim().max(80).default(""),
  ownCapital: z.string().trim().max(80).default(""),
  timeline: z.string().trim().min(2).max(160),
  experience: z.string().trim().min(10).max(3000),
  project: z.string().trim().min(20).max(5000),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});
export type MultiplexApplication = z.infer<typeof multiplexApplicationSchema>;
export function createMultiplexApplicationRouter(save: (data: MultiplexApplication) => Promise<void>) {
  const router = Router();
  router.post("/", rateLimit({windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false}), async (req, res) => {
    const parsed = multiplexApplicationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: "Please complete all required fields and confirm permission to contact you."});
    try {
      await save(parsed.data);
      return res.status(201).json({success: true, reference: parsed.data.submissionId});
    } catch {
      return res.status(503).json({error: "Your application could not be saved. Please try again; your entries are still here."});
    }
  });
  return router;
}
