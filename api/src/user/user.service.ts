import { Injectable, NotFoundException } from '@nestjs/common';
import db from '../../drizzle';
import { user } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
@Injectable()
export class UserService {
  async createUser(userData: { id: string, name: string, publicKey: string }) {
    console.log('Creating user in database:', userData);
    try {
      const [result] = await db.insert(user).values({
        id: userData.id,
        name: userData.name,
        publicKey: userData.publicKey,
      }).returning();
      console.log('User created successfully:', result);
      return result;
    } catch (error: any) {
      console.error('Error creating user:', error);
      // If user already exists, try to get it
      if (error.code === '23505') { // Unique violation
        console.log('User already exists, fetching...');
        const [existing] = await db.select().from(user).where(eq(user.id, userData.id));
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async getUserById(id: string) {
    console.log("Checking for user" + " " + id)
    const [result] = await db.select().from(user).where(eq(user.id, id));
    if (!result) {
      throw new NotFoundException('User not found');
    }
    
    return result;
  }
  async getUserByPublicKey(publicKey: string) {
    const [result] = await db.select().from(user).where(eq(user.publicKey, publicKey));
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return result;
  }

  async getUserByName(name: string) {
    const [result] = await db.select().from(user).where(eq(user.name, name));
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return result;
  }
}
