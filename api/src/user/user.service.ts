import { Injectable, NotFoundException } from '@nestjs/common';
import db from '../../drizzle';
import { user } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
@Injectable()
export class UserService {
  async createUser(userData: { id: string, name: string, publicKey: string }) {
    console.log('Creating user in database:', userData);
    const [result] = await db.insert(user).values({
      id: userData.id,
      name: userData.name,
      publicKey: userData.publicKey,
    }).returning();
    return result;
  }

  async getUserById(id: string) {
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
