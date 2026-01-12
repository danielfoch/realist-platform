import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { google } from "googleapis";
import { db } from "./db";
import { users, passwordResetTokens, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, userOAuthAccounts, phoneVerificationSchema, verifyPhoneCodeSchema } from "@shared/models/auth";
import { eq, and, gt } from "drizzle-orm";
import { storage } from "./storage";
import { sendVerificationSMS, isValidPhoneNumber, normalizePhoneNumber } from "./twilio";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_AUTH_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://realist.ca/api/auth/google/callback"
  : `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
const GOOGLE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

declare module "express-session" {
  interface SessionData {
    userId?: string;
    googleAuthState?: string;
  }
}

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("SESSION_SECRET environment variable is required");
    throw new Error("SESSION_SECRET environment variable is required for authentication");
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

export function setupAuth(app: Express) {
  app.use(getSession());
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ message: "Failed to verify admin status" });
  }
}

export function registerAuthRoutes(app: Express): void {
  // Signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);
      
      // Create user
      const [newUser] = await db.insert(users).values({
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      }).returning();
      
      // Set session
      req.session.userId = newUser.id;
      
      res.json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Verify password
      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Extend session if "Remember me" is checked (30 days instead of 1 week)
      if (data.rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, req.session.userId)).limit(1);
      
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Forgot password - request reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      
      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If an account exists with this email, you will receive a password reset link" });
      }
      
      // Generate reset token and hash it for storage
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Invalidate any existing tokens for this user
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, user.id));
      
      // Store hashed token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: tokenHash,
        expiresAt,
      });
      
      // TODO: Send email with reset link in production
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Password reset link for ${user.email}: /reset-password?token=${rawToken}`);
      }
      
      res.json({ message: "If an account exists with this email, you will receive a password reset link" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);
      
      // Hash the provided token to compare with stored hash
      const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");
      
      // Find valid token by hash
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (!resetToken || resetToken.usedAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(data.password, 12);
      
      // Update user password
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));
      
      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Auto-enroll from deal analyzer (creates account if email doesn't exist)
  app.post("/api/auth/lead-enroll", async (req, res) => {
    try {
      const { email, firstName, lastName, password } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Check if user exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      
      if (existingUser) {
        // If user exists and password provided, attempt login
        if (password && existingUser.passwordHash) {
          const validPassword = await bcrypt.compare(password, existingUser.passwordHash);
          if (validPassword) {
            req.session.userId = existingUser.id;
            return res.json({ 
              user: { id: existingUser.id, email: existingUser.email, firstName: existingUser.firstName, lastName: existingUser.lastName },
              isNewUser: false,
              needsPassword: false,
            });
          }
        }
        
        // User exists but no password set or wrong password
        // Generate a setup token for password creation (sent via email, not in response)
        if (!existingUser.passwordHash) {
          const rawToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await db.insert(passwordResetTokens).values({
            userId: existingUser.id,
            token: tokenHash,
            expiresAt,
          });
          
          // TODO: Send email with setup link in production
          if (process.env.NODE_ENV !== "production") {
            console.log(`[DEV] Password setup link for ${existingUser.email}: /set-password?token=${rawToken}`);
          }
        }
        
        return res.json({ 
          user: null,
          isNewUser: false,
          needsPassword: !existingUser.passwordHash,
          message: existingUser.passwordHash ? "Account exists. Please login." : "Check your email to complete account setup."
        });
      }
      
      // Create new user (without password for now - they can set it later via email token)
      const nameParts = (firstName || "").split(" ");
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        firstName: nameParts[0] || firstName || null,
        lastName: lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null),
      }).returning();
      
      // Generate setup token for new user (sent via email, not in response)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await db.insert(passwordResetTokens).values({
        userId: newUser.id,
        token: tokenHash,
        expiresAt,
      });
      
      // TODO: Send email with setup link in production
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Password setup link for ${newUser.email}: /set-password?token=${rawToken}`);
      }
      
      res.json({
        user: { id: newUser.id, email: newUser.email, firstName: newUser.firstName, lastName: newUser.lastName },
        isNewUser: true,
        needsPassword: true,
        message: "Check your email to complete account setup.",
      });
    } catch (error) {
      console.error("Lead enroll error:", error);
      res.status(500).json({ message: "Failed to process enrollment" });
    }
  });

  // Set password for account created via lead enroll (requires token)
  app.post("/api/auth/set-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password || password.length < 8) {
        return res.status(400).json({ message: "Token and password (min 8 characters) are required" });
      }
      
      // Hash the provided token to compare with stored hash
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      
      // Find valid token by hash
      const [setupToken] = await db.select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, tokenHash),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (!setupToken || setupToken.usedAt) {
        return res.status(400).json({ message: "Invalid or expired setup token. Please request a new one." });
      }
      
      // Find user
      const [user] = await db.select().from(users).where(eq(users.id, setupToken.userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      if (user.passwordHash) {
        return res.status(400).json({ message: "Password already set. Please use login." });
      }
      
      // Hash and set password
      const passwordHash = await bcrypt.hash(password, 12);
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      
      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, setupToken.id));
      
      // Log them in
      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Set password error:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Google OAuth Login/Signup - Start flow
  app.get("/api/auth/google/start", (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.redirect("/login?error=google_not_configured");
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_AUTH_REDIRECT_URI
    );

    // Generate a random state to prevent CSRF
    const state = crypto.randomBytes(32).toString("hex");
    req.session.googleAuthState = state;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GOOGLE_AUTH_SCOPES,
      prompt: "select_account",
      state,
    });

    res.redirect(authUrl);
  });

  // Google OAuth Login/Signup - Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      // Validate state parameter
      if (!state || state !== req.session.googleAuthState) {
        console.error("Google OAuth callback: State mismatch");
        res.redirect("/login?error=auth_failed&reason=state_mismatch");
        return;
      }
      
      // Clear the state from session
      delete req.session.googleAuthState;
      
      if (!code || typeof code !== "string") {
        res.redirect("/login?error=auth_failed");
        return;
      }

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        res.redirect("/login?error=google_not_configured");
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_AUTH_REDIRECT_URI
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email?.toLowerCase();
      const googleId = userInfo.data.id;
      const firstName = userInfo.data.given_name || "";
      const lastName = userInfo.data.family_name || "";
      const profileImageUrl = userInfo.data.picture || null;

      if (!googleEmail || !googleId) {
        res.redirect("/login?error=auth_failed&reason=no_email");
        return;
      }

      // Check if we have an existing OAuth account link
      const existingOAuthAccount = await storage.getUserOAuthAccount("google", googleId);

      if (existingOAuthAccount) {
        // User has linked Google before - log them in
        req.session.userId = existingOAuthAccount.userId;
        
        // Check if phone is verified
        const [user] = await db.select().from(users).where(eq(users.id, existingOAuthAccount.userId)).limit(1);
        if (user && !user.phoneVerified) {
          res.redirect("/verify-phone");
          return;
        }
        
        res.redirect("/investor");
        return;
      }

      // Check if a user with this email already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, googleEmail)).limit(1);

      if (existingUser) {
        // Link Google to existing account
        await storage.createUserOAuthAccount({
          userId: existingUser.id,
          provider: "google",
          providerUserId: googleId,
          providerEmail: googleEmail,
          accessToken: tokens.access_token || undefined,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        });
        
        // Update profile image if not set
        if (!existingUser.profileImageUrl && profileImageUrl) {
          await db.update(users).set({ profileImageUrl }).where(eq(users.id, existingUser.id));
        }
        
        req.session.userId = existingUser.id;
        
        // Check if phone is verified
        if (!existingUser.phoneVerified) {
          res.redirect("/verify-phone");
          return;
        }
        
        res.redirect("/investor");
        return;
      }

      // Create new user
      const [newUser] = await db.insert(users).values({
        email: googleEmail,
        firstName,
        lastName,
        profileImageUrl,
        emailVerified: true, // Google emails are verified
      }).returning();

      // Create OAuth account link
      await storage.createUserOAuthAccount({
        userId: newUser.id,
        provider: "google",
        providerUserId: googleId,
        providerEmail: googleEmail,
        accessToken: tokens.access_token || undefined,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      });

      req.session.userId = newUser.id;

      // Redirect to phone verification for new users
      res.redirect("/verify-phone");
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect("/login?error=auth_failed");
    }
  });

  // Phone Verification - Get status
  app.get("/api/auth/phone/status", isAuthenticated, async (req, res) => {
    try {
      const [user] = await db.select({
        phone: users.phone,
        phoneVerified: users.phoneVerified,
      }).from(users).where(eq(users.id, req.session.userId!)).limit(1);
      
      res.json({
        phone: user?.phone || null,
        phoneVerified: user?.phoneVerified || false,
      });
    } catch (error) {
      console.error("Error checking phone status:", error);
      res.status(500).json({ message: "Failed to check phone status" });
    }
  });

  // Phone Verification - Send code
  app.post("/api/auth/phone/send-code", isAuthenticated, async (req, res) => {
    let verificationCode: { id: string } | null = null;
    let smsSent = false;
    
    try {
      const data = phoneVerificationSchema.parse(req.body);
      const userId = req.session.userId!;
      
      // Validate phone number format
      if (!isValidPhoneNumber(data.phone)) {
        return res.status(400).json({ message: "Please enter a valid phone number" });
      }
      
      const normalizedPhone = normalizePhoneNumber(data.phone);
      
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store the verification code
      verificationCode = await storage.createPhoneVerificationCode({
        userId,
        phone: normalizedPhone,
        code,
        expiresAt,
      });
      
      // Send SMS via Twilio
      const smsResult = await sendVerificationSMS(normalizedPhone, code);
      
      if (!smsResult.success) {
        console.error("Failed to send SMS:", smsResult.error);
        return res.status(500).json({ message: smsResult.error || "Failed to send verification code" });
      }
      
      smsSent = true;
      res.json({ message: "Verification code sent", phone: normalizedPhone });
    } catch (error: any) {
      console.error("Error sending phone verification code:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid phone number" });
      }
      res.status(500).json({ message: "Failed to send verification code" });
    } finally {
      // Clean up orphaned verification code if SMS was not successfully sent
      if (verificationCode && !smsSent) {
        try {
          await storage.deletePhoneVerificationCode(verificationCode.id);
        } catch (cleanupError) {
          console.error("Failed to clean up verification code:", cleanupError);
        }
      }
    }
  });

  // Phone Verification - Verify code
  app.post("/api/auth/phone/verify", isAuthenticated, async (req, res) => {
    try {
      const data = verifyPhoneCodeSchema.parse(req.body);
      const userId = req.session.userId!;
      
      // Get the active verification code
      const verificationCode = await storage.getActivePhoneVerificationCode(userId);
      
      if (!verificationCode) {
        return res.status(400).json({ message: "No active verification code. Please request a new one." });
      }
      
      // Check attempts (max 5)
      const attempts = parseInt(verificationCode.attempts || "0");
      if (attempts >= 5) {
        return res.status(400).json({ message: "Too many attempts. Please request a new code." });
      }
      
      // Verify the code
      if (verificationCode.code !== data.code) {
        await storage.incrementVerificationAttempts(verificationCode.id);
        return res.status(400).json({ message: "Invalid verification code" });
      }
      
      // Mark phone as verified
      await storage.markPhoneVerified(userId, verificationCode.phone);
      
      res.json({ message: "Phone verified successfully" });
    } catch (error: any) {
      console.error("Error verifying phone code:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid code" });
      }
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Phone Verification - Skip (optional, for users who don't want to verify)
  app.post("/api/auth/phone/skip", isAuthenticated, async (req, res) => {
    try {
      // Just redirect them without marking as verified
      res.json({ message: "Phone verification skipped" });
    } catch (error) {
      console.error("Error skipping phone verification:", error);
      res.status(500).json({ message: "Failed to skip verification" });
    }
  });
}
