import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { characters, items, inventory, spellMatrices } from '../db/schema.js';
import { getAuthUser } from './auth.js';
import { getDb } from '../db/index.js';

export const craftRoutes = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

// GET /api/craft/items - List character inventory items for crafting
craftRoutes.get('/inventory', async (c) => {
  const auth = await getAuthUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env?.DATABASE_URL);
  if (!db) return c.json({ inventory: [] });

  const [char] = await db.select().from(characters).where(eq(characters.userId, auth.userId));
  if (!char) return c.json({ inventory: [] });

  const invItems = await db
    .select({
      inventoryId: inventory.id,
      itemId: items.id,
      name: items.name,
      type: items.type,
      bonusDamage: items.bonusDamage,
      quantity: inventory.quantity,
    })
    .from(inventory)
    .innerJoin(items, eq(inventory.itemId, items.id))
    .where(eq(inventory.characterId, char.id));

  return c.json({ inventory: invItems });
});

// POST /api/craft/spell - Fuse Basic Scroll + Components to create soulbound Spell Matrix
// Body: { spellName: string, scrollItemId: string, componentItemIds: string[] }
craftRoutes.post('/spell', async (c) => {
  const auth = await getAuthUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { spellName, scrollItemId, componentItemIds = [] } = await c.req.json();

  if (!spellName || !scrollItemId) {
    return c.json({ error: 'Spell name and scroll item ID are required' }, 400);
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

  // Validate scroll in inventory
  const [scrollInv] = await db
    .select({
      invId: inventory.id,
      quantity: inventory.quantity,
      itemType: items.type,
      bonusDamage: items.bonusDamage,
    })
    .from(inventory)
    .innerJoin(items, eq(inventory.itemId, items.id))
    .where(and(eq(inventory.characterId, char.id), eq(inventory.itemId, scrollItemId)));

  if (!scrollInv || scrollInv.quantity < 1 || scrollInv.itemType !== 'SCROLL') {
    return c.json({ error: 'Valid scroll item required in inventory' }, 400);
  }

  // Validate components
  let componentBonusTotal = 0;
  const componentsToConsume: { invId: string; quantity: number }[] = [];

  if (componentItemIds.length > 0) {
    const compInvs = await db
      .select({
        invId: inventory.id,
        itemId: items.id,
        quantity: inventory.quantity,
        bonusDamage: items.bonusDamage,
      })
      .from(inventory)
      .innerJoin(items, eq(inventory.itemId, items.id))
      .where(and(eq(inventory.characterId, char.id), inArray(inventory.itemId, componentItemIds)));

    for (const compId of componentItemIds) {
      const found = compInvs.find((ci) => ci.itemId === compId && ci.quantity > 0);
      if (!found) {
        return c.json({ error: `Missing required component item ID: ${compId}` }, 400);
      }
      componentBonusTotal += found.bonusDamage;
      componentsToConsume.push({ invId: found.invId, quantity: found.quantity });
    }
  }

  // Calculate Base Damage = Scroll Base (15) + Component Bonuses
  const baseDamage = 15 + scrollInv.bonusDamage + componentBonusTotal;

  // Deduct scroll material
  if (scrollInv.quantity === 1) {
    await db.delete(inventory).where(eq(inventory.id, scrollInv.invId));
  } else {
    await db
      .update(inventory)
      .set({ quantity: scrollInv.quantity - 1 })
      .where(eq(inventory.id, scrollInv.invId));
  }

  // Deduct component materials
  for (const comp of componentsToConsume) {
    if (comp.quantity === 1) {
      await db.delete(inventory).where(eq(inventory.id, comp.invId));
    } else {
      await db
        .update(inventory)
        .set({ quantity: comp.quantity - 1 })
        .where(eq(inventory.id, comp.invId));
    }
  }

  // Create Soulbound Spell Matrix
  const [spellMatrix] = await db
    .insert(spellMatrices)
    .values({
      creatorId: char.id,
      name: spellName,
      baseDamage,
      element: 'FIRE',
      copyCount: 0,
    })
    .returning();

  return c.json({
    message: 'Spell Matrix created successfully!',
    spellMatrix,
  });
});
