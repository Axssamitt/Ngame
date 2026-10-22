import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, characters, crystalLedger } from '../db/schema';
import { createToken, verifyToken } from '../utils/auth';
import { getDb } from '../db/index';

export const authRoutes = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

// Auth Middleware helper
export async function getAuthUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  return await verifyToken(token);
}

authRoutes.post('/register', async (c) => {
  const { username, password, characterName } = await c.req.json();

  if (!username || !password || !characterName) {
    return c.json({ error: 'Username, password and characterName are required' }, 400);
  }

  const db = getDb(c.env?.DATABASE_URL);

  // Check existing user
  if (db) {
    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing.length > 0) {
      return c.json({ error: 'Username already exists' }, 400);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let userId = crypto.randomUUID() as string;
  let characterId = crypto.randomUUID() as string;

  if (db) {
    const [newUser] = await db.insert(users).values({
      username,
      passwordHash,
    }).returning();
    userId = newUser.id;

    const [newChar] = await db.insert(characters).values({
      userId: newUser.id,
      name: characterName,
      level: 1,
      hp: 100,
      maxHp: 100,
      atk: 10,
      def: 5,
      energy: 100,
      maxEnergy: 100,
    }).returning();
    characterId = newChar.id;

    // Grant initial crystals in ledger
    await db.insert(crystalLedger).values({
      characterId: newChar.id,
      amount: 100,
      transactionType: 'INITIAL',
      referenceId: 'welcome_gift',
    });
  }

  const token = await createToken({ userId, username });

  return c.json({
    token,
    user: { id: userId, username },
    character: { id: characterId, name: characterName },
  });
});

authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  const db = getDb(c.env?.DATABASE_URL);

  if (!db) {
    return c.json({ error: 'Database connection error' }, 500);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const [char] = await db.select().from(characters).where(eq(characters.userId, user.id));

  const token = await createToken({ userId: user.id, username: user.username });

  return c.json({
    token,
    user: { id: user.id, username: user.username },
    character: char ? { id: char.id, name: char.name } : null,
  });
});
