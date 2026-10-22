import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Characters
export const characters = pgTable('characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  level: integer('level').default(1).notNull(),
  exp: integer('exp').default(0).notNull(),
  hp: integer('hp').default(100).notNull(),
  maxHp: integer('max_hp').default(100).notNull(),
  atk: integer('atk').default(10).notNull(),
  def: integer('def').default(5).notNull(),
  energy: integer('energy').default(100).notNull(),
  maxEnergy: integer('max_energy').default(100).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Portals
export const portals = pgTable('portals', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  rank: text('rank').notNull(), // 'E', 'D', 'C', 'B', 'A', 'S'
  gridWidth: integer('grid_width').default(10).notNull(),
  gridHeight: integer('grid_height').default(10).notNull(),
  gridData: jsonb('grid_data').$type<number[][]>().notNull(), // 2D array 10x10 of 0s and 1s
  bossX: integer('boss_x').default(9).notNull(),
  bossY: integer('boss_y').default(9).notNull(),
});

// 4. Monsters
export const monsters = pgTable('monsters', {
  id: uuid('id').defaultRandom().primaryKey(),
  portalId: uuid('portal_id').notNull().references(() => portals.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hp: integer('hp').notNull(),
  maxHp: integer('max_hp').notNull(),
  atk: integer('atk').notNull(),
  def: integer('def').notNull(),
  isBoss: boolean('is_boss').default(false).notNull(),
});

// 5. Portal Sessions
export const portalSessions = pgTable('portal_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  portalId: uuid('portal_id').notNull().references(() => portals.id, { onDelete: 'cascade' }),
  posX: integer('pos_x').default(0).notNull(),
  posY: integer('pos_y').default(0).notNull(),
  status: text('status').default('EXPLORING').notNull(), // 'EXPLORING', 'IN_COMBAT', 'COMPLETED', 'DEFEATED'
  currentMonsterId: uuid('current_monster_id').references(() => monsters.id),
  monsterCurrentHp: integer('monster_current_hp'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Items
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'SCROLL', 'COMPONENT', 'CONSUMABLE'
  bonusDamage: integer('bonus_damage').default(0).notNull(),
  description: text('description').default('').notNull(),
});

// 7. Inventory
export const inventory = pgTable('inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1).notNull(),
});

// 8. Spell Matrices (Soulbound to Creator)
export const spellMatrices = pgTable('spell_matrices', {
  id: uuid('id').defaultRandom().primaryKey(),
  creatorId: uuid('creator_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  baseDamage: integer('base_damage').notNull(),
  element: text('element').default('FIRE').notNull(),
  copyCount: integer('copy_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Spell Copies (Consumables that can be traded)
export const spellCopies = pgTable('spell_copies', {
  id: uuid('id').defaultRandom().primaryKey(),
  spellMatrixId: uuid('spell_matrix_id').notNull().references(() => spellMatrices.id, { onDelete: 'cascade' }),
  copyNumber: integer('copy_number').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  isUsed: boolean('is_used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    matrixCopyIdx: uniqueIndex('matrix_copy_idx').on(table.spellMatrixId, table.copyNumber),
  };
});

// 10. Market Listings
export const marketListings = pgTable('market_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  spellCopyId: uuid('spell_copy_id').notNull().references(() => spellCopies.id, { onDelete: 'cascade' }),
  priceCrystals: integer('price_crystals').notNull(),
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'SOLD', 'CANCELLED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Crystal Ledger (Append-Only ledger for Premium Currency balance)
export const crystalLedger = pgTable('crystal_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // positive for earnings, negative for expenditures
  transactionType: text('transaction_type').notNull(), // 'INITIAL', 'MARKET_SALE', 'MARKET_PURCHASE', 'ADMIN'
  referenceId: text('reference_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
