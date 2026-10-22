import { Hono } from 'hono';
import { eq, sum } from 'drizzle-orm';
import { portals, portalSessions, characters, monsters, crystalLedger, spellMatrices, inventory, items } from '../db/schema.js';
import { getAuthUser } from './auth.js';
import { getDb } from '../db/index.js';

export const portalRoutes = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

// GET /api/portals - List available portals
portalRoutes.get('/portals', async (c) => {
  const db = getDb(c.env?.DATABASE_URL);
  if (!db) return c.json({ portals: [] });

  const allPortals = await db.select().from(portals);
  return c.json({ portals: allPortals });
});

// GET /api/portal/:id - State of current grid and combat session
portalRoutes.get('/portal/:id', async (c) => {
  const auth = await getAuthUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const portalId = c.req.param('id');
  const db = getDb(c.env?.DATABASE_URL);

  if (!db) {
    return c.json({ error: 'Database connection error' }, 500);
  }

  // Get character
  const [char] = await db.select().from(characters).where(eq(characters.userId, auth.userId));
  if (!char) {
    return c.json({ error: 'Character not found' }, 404);
  }

  // Calculate Crystal balance from crystal_ledger
  const ledgerSum = await db
    .select({ total: sum(crystalLedger.amount) })
    .from(crystalLedger)
    .where(eq(crystalLedger.characterId, char.id));

  const crystalBalance = Number(ledgerSum[0]?.total || 0);

  // Get requested portal
  const [portal] = await db.select().from(portals).where(eq(portals.id, portalId));
  if (!portal) {
    return c.json({ error: 'Portal not found' }, 404);
  }

  // Find active session or create new
  let [session] = await db
    .select()
    .from(portalSessions)
    .where(eq(portalSessions.characterId, char.id));

  if (!session || session.portalId !== portalId || session.status === 'COMPLETED' || session.status === 'DEFEATED') {
    // Create new session at spawn (0,0)
    [session] = await db.insert(portalSessions).values({
      characterId: char.id,
      portalId: portal.id,
      posX: 0,
      posY: 0,
      status: 'EXPLORING',
    }).returning();
  }

  // If session is in combat, fetch monster details
  let currentMonster = null;
  if (session.status === 'IN_COMBAT' && session.currentMonsterId) {
    const [m] = await db.select().from(monsters).where(eq(monsters.id, session.currentMonsterId));
    if (m) {
      currentMonster = {
        ...m,
        currentHp: session.monsterCurrentHp ?? m.hp,
      };
    }
  }

  // Get player spell matrices
  const playerSpells = await db.select().from(spellMatrices).where(eq(spellMatrices.creatorId, char.id));

  return c.json({
    character: {
      ...char,
      crystals: crystalBalance,
    },
    portal,
    session,
    currentMonster,
    spells: playerSpells,
  });
});
