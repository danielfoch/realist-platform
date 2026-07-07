import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { backlinkUserRecords } from "../../personSpine";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // PERSON SPINE (phase 1): backlink only on genuine creation — this upsert
    // also runs on every Replit-auth login, and rows created after signup are
    // forward-linked at insert time, so re-running the backlink adds nothing.
    const isNewUser = userData.id ? !(await this.getUser(userData.id)) : true;
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (isNewUser) {
      await backlinkUserRecords(user.id, user.email);
    }
    return user;
  }
}

export const authStorage = new AuthStorage();
