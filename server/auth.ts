import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { users, passwordResetTokens, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/models/auth";
import { eq, and, gt } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: string;
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
}
