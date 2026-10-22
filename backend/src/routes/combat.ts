import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { characters, portalSessions, monsters, spellMatrices, crystalLedger } from '../db/schema.js';
import { getAuthUser } from './auth.js';
import { getDb } from '../db/index.js';

export const combatRoutes = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

// POST /api/combat/action
// Body: { actionType: 'ATTACK' | 'SPELL', spellMatrixId?: string }
combatRoutes.post('/action', async (c) => {
  const auth = await getAuthUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { actionType, spellMatrixId } = await c.req.json();
  if (!['ATTACK', 'SPELL'].includes(actionType)) {
    return c.json({ error: 'Invalid action type' }, 400);
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

  // Find combat session
  const [session] = await db
    .select()
    .from(portalSessions)
    .where(and(eq(portalSessions.characterId, char.id), eq(portalSessions.status, 'IN_COMBAT')));

  if (!session || !session.currentMonsterId) {
    return c.json({ error: 'No active combat session found' }, 400);
  }

  const [monster] = await db.select().from(monsters).where(eq(monsters.id, session.currentMonsterId));
  if (!monster) {
    return c.json({ error: 'Monster not found' }, 404);
  }

  let monsterHp = session.monsterCurrentHp ?? monster.hp;
  let playerHp = char.hp;

  const combatLog: string[] = [];

  // 1. Player Turn Damage Calculation
  let playerDamage = 0;
  if (actionType === 'ATTACK') {
    // Physical Attack: max(1, Player ATK - Monster DEF)
    playerDamage = Math.max(1, char.atk - monster.def);
    combatLog.push(`You physically attacked ${monster.name} for ${playerDamage} damage!`);
  } else if (actionType === 'SPELL') {
    if (!spellMatrixId) {
      return c.json({ error: 'Spell ID required for spell action' }, 400);
    }
    const [spell] = await db.select().from(spellMatrices).where(eq(spellMatrices.id, spellMatrixId));
    if (!spell) {
      return c.json({ error: 'Spell Matrix not found' }, 404);
    }
    // Spell Damage: baseDamage + (Player ATK / 2) - Monster DEF
    playerDamage = Math.max(1, spell.baseDamage + Math.floor(char.atk / 2) - monster.def);
    combatLog.push(`You cast ${spell.name} on ${monster.name} dealing ${playerDamage} damage!`);
  }

  monsterHp = Math.max(0, monsterHp - playerDamage);

  let newSessionStatus: 'IN_COMBAT' | 'EXPLORING' | 'COMPLETED' | 'DEFEATED' = 'IN_COMBAT';
  let rewards = null;

  // 2. Check Monster Defeat
  if (monsterHp <= 0) {
    combatLog.push(`You defeated ${monster.name}!`);

    if (monster.isBoss) {
      newSessionStatus = 'COMPLETED';
      combatLog.push(`Portal Cleared! Boss defeated.`);
    } else {
      newSessionStatus = 'EXPLORING';
    }

    // Award XP and Crystals
    const xpReward = monster.isBoss ? 100 : 25;
    const crystalReward = monster.isBoss ? 50 : 10;

    rewards = { xp: xpReward, crystals: crystalReward };

    // Add crystal reward to ledger
    await db.insert(crystalLedger).values({
      characterId: char.id,
      amount: crystalReward,
      transactionType: 'PORTAL_REWARD',
      referenceId: session.id,
    });

    // Update character XP and Level
    let newExp = char.exp + xpReward;
    let newLevel = char.level;
    if (newExp >= newLevel * 100) {
      newExp -= newLevel * 100;
      newLevel += 1;
      combatLog.push(`Level Up! You reached Level ${newLevel}!`);
    }

    await db
      .update(characters)
      .set({ exp: newExp, level: newLevel })
      .where(eq(characters.id, char.id));
  } else {
    // 3. Monster Turn (Counter-Attack)
    const monsterDamage = Math.max(1, monster.atk - char.def);
    playerHp = Math.max(0, playerHp - monsterDamage);
    combatLog.push(`${monster.name} attacked you for ${monsterDamage} damage!`);

    await db
      .update(characters)
      .set({ hp: playerHp })
      .where(eq(characters.id, char.id));

    if (playerHp <= 0) {
      newSessionStatus = 'DEFEATED';
      combatLog.push(`You were defeated by ${monster.name}! Portal failed.`);
    }
  }

  // Update Portal Session state
  const [updatedSession] = await db
    .update(portalSessions)
    .set({
      status: newSessionStatus,
      monsterCurrentHp: newSessionStatus === 'IN_COMBAT' ? monsterHp : null,
      currentMonsterId: newSessionStatus === 'IN_COMBAT' ? monster.id : null,
      updatedAt: new Date(),
    })
    .where(eq(portalSessions.id, session.id))
    .returning();

  return c.json({
    combatLog,
    playerHp,
    monsterHp,
    session: updatedSession,
    rewards,
  });
});
