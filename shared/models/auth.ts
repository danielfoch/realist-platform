import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table with email/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  phoneVerified: boolean("phone_verified").default(false),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("investor"),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OAuth accounts linked to users (Google, etc.)
export const userOAuthAccounts = pgTable("user_oauth_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: varchar("provider").notNull(), // 'google', 'facebook', etc.
  providerUserId: varchar("provider_user_id").notNull(),
  providerEmail: varchar("provider_email"),
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Phone verification codes for OTP
export const phoneVerificationCodes = pgTable("phone_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  phone: varchar("phone").notNull(),
  code: varchar("code").notNull(),
  attempts: varchar("attempts").default("0"),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Validation schemas for auth
export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertUserOAuthAccountSchema = createInsertSchema(userOAuthAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserOAuthAccount = z.infer<typeof insertUserOAuthAccountSchema>;
export type UserOAuthAccount = typeof userOAuthAccounts.$inferSelect;

export const insertPhoneVerificationCodeSchema = createInsertSchema(phoneVerificationCodes).omit({
  id: true,
  createdAt: true,
});
export type InsertPhoneVerificationCode = z.infer<typeof insertPhoneVerificationCodeSchema>;
export type PhoneVerificationCode = typeof phoneVerificationCodes.$inferSelect;

export const phoneVerificationSchema = z.object({
  phone: z.string().min(10, "Please enter a valid phone number"),
});

export const verifyPhoneCodeSchema = z.object({
  code: z.string().length(6, "Please enter the 6-digit code"),
});

export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
export type VerifyPhoneCodeInput = z.infer<typeof verifyPhoneCodeSchema>;
