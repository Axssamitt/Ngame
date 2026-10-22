import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { characters, portals, portalSessions, monsters } from '../db/schema.js';
import { getAuthUser } from './auth.js';
import { getDb } from '../db/index.js';

export const moveRoutes = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

// POST /api/move
// Body: { direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' }
moveRoutes.post('/move', async (c) => {
  const auth = await getAuthUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { direction } = await c.req.json();
  if (!['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(direction)) {
    return c.json({ error: 'Invalid direction' }, 400);
  }

  const db = getDb(c.env?.DATABASE_URL);
  if (!db) {
    return c.json({ error: 'Database error' }, 500);
  }

  // Get character
  const [char] = await db.select().from(characters).where(eq(characters.userId, auth.userId));
  if (!char) {
    return c.json({ error: 'Character not found' }, 404);
  }

  // Energy check
  if (char.energy < 1) {
    return c.json({ error: 'Out of energy! Rest required.' }, 400);
  }

  // Get active session
  const [session] = await db
    .select()
    .from(portalSessions)
    .where(and(eq(portalSessions.characterId, char.id), eq(portalSessions.status, 'EXPLORING')));

  if (!session) {
    return c.json({ error: 'No active exploration session found in portal' }, 400);
  }

  // Get portal grid
  const [portal] = await db.select().from(portals).where(eq(portals.id, session.portalId));
  if (!portal) {
    return c.json({ error: 'Portal not found' }, 404);
  }

  let newX = session.posX;
  let newY = session.posY;

  if (direction === 'NORTH') newY -= 1;
  if (direction === 'SOUTH') newY += 1;
  if (direction === 'WEST') newX -= 1;
  if (direction === 'EAST') newX += 1;

  // Boundary check
  const grid = portal.gridData as number[][];
  if (newY < 0 || newY >= portal.gridHeight || newX < 0 || newX >= portal.gridWidth) {
    return c.json({ error: 'Movement blocked: Grid boundary reached' }, 400);
  }

  // Wall check (1 represents wall/obstacle, 0 represents walkable path)
  if (grid[newY][newX] === 1) {
    return c.json({ error: 'Movement blocked: Wall ahead' }, 400);
  }

  // Deduct 1 energy
  await db
    .update(characters)
    .set({ energy: char.energy - 1 })
    .where(eq(characters.id, char.id));

  // Check if target tile is Boss room / encounter trigger
  const isBossRoom = newX === portal.bossX && newY === portal.bossY;

  // Get portal monsters
  const portalMonsters = await db.select().from(monsters).where(eq(monsters.portalId, portal.id));

  let encounterMonster = null;
  let newStatus: 'EXPLORING' | 'IN_COMBAT' = 'EXPLORING';

  if (isBossRoom) {
    encounterMonster = portalMonsters.find((m) => m.isBoss) || portalMonsters[0];
    newStatus = 'IN_COMBAT';
  } else {
    // 25% random encounter chance on movement
    const encounterRoll = Math.random();
    if (encounterRoll < 0.25 && portalMonsters.length > 0) {
      const nonBossMonsters = portalMonsters.filter((m) => !m.isBoss);
      const pool = nonBossMonsters.length > 0 ? nonBossMonsters : portalMonsters;
      encounterMonster = pool[Math.floor(Math.random() * pool.length)];
      newStatus = 'IN_COMBAT';
    }
  }

  // Update session position and combat status
  const [updatedSession] = await db
    .update(portalSessions)
    .set({
      posX: newX,
      posY: newY,
      status: newStatus,
      currentMonsterId: encounterMonster ? encounterMonster.id : null,
      monsterCurrentHp: encounterMonster ? encounterMonster.hp : null,
      updatedAt: new Date(),
    })
    .where(eq(portalSessions.id, session.id))
    .returning();

  return c.json({
    message: encounterMonster ? `Encountered ${encounterMonster.name}!` : 'Moved successfully',
    session: updatedSession,
    energyRemaining: char.energy - 1,
    encounter: encounterMonster
      ? {
          ...encounterMonster,
          currentHp: encounterMonster.hp,
        }
      : null,
  });
});
