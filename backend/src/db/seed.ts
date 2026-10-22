import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import {
  users,
  characters,
  portals,
  monsters,
  items,
  inventory,
  crystalLedger,
} from './schema.js';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('DATABASE_URL not set. Skipping live DB seed.');
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client);

  console.log('Seeding initial game content...');

  // 1. Create Portal Rank E "Caverna Sombria" with 10x10 Grid
  const grid10x10 = [
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 1, 0],
    [1, 1, 0, 1, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 0, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0], // (9,9) is Boss Room
  ];

  const [portal] = await db.insert(portals).values({
    name: 'Caverna Sombria',
    rank: 'E',
    gridWidth: 10,
    gridHeight: 10,
    gridData: grid10x10,
    bossX: 9,
    bossY: 9,
  }).returning();

  console.log(`Created Portal: ${portal.name} (${portal.id})`);

  // 2. Insert 3 Monsters
  const [slime] = await db.insert(monsters).values({
    portalId: portal.id,
    name: 'Slime',
    hp: 30,
    maxHp: 30,
    atk: 5,
    def: 2,
    isBoss: false,
  }).returning();

  const [goblin] = await db.insert(monsters).values({
    portalId: portal.id,
    name: 'Goblin',
    hp: 50,
    maxHp: 50,
    atk: 8,
    def: 3,
    isBoss: false,
  }).returning();

  const [reiSlime] = await db.insert(monsters).values({
    portalId: portal.id,
    name: 'Rei Slime',
    hp: 150,
    maxHp: 150,
    atk: 12,
    def: 5,
    isBoss: true,
  }).returning();

  console.log(`Created Monsters: ${slime.name}, ${goblin.name}, ${reiSlime.name} (Boss)`);

  // 3. Insert 2 Items
  const [pergaminho] = await db.insert(items).values({
    name: 'Pergaminho Básico',
    type: 'SCROLL',
    bonusDamage: 0,
    description: 'Pergaminho em branco necessário para criar Feitiços Matriz.',
  }).returning();

  const [componenteFogo] = await db.insert(items).values({
    name: 'Componente de Fogo',
    type: 'COMPONENT',
    bonusDamage: 5,
    description: 'Essência elemental incandescente que concede +5 de dano ao feitiço.',
  }).returning();

  console.log(`Created Items: ${pergaminho.name}, ${componenteFogo.name}`);

  // 4. Create Test User & Character
  const passwordHash = await bcrypt.hash('123456', 10);
  const [user] = await db.insert(users).values({
    username: 'mago_teste',
    passwordHash,
  }).returning();

  const [char] = await db.insert(characters).values({
    userId: user.id,
    name: 'Merlin Teste',
    level: 1,
    hp: 100,
    maxHp: 100,
    atk: 10,
    def: 5,
    energy: 100,
    maxEnergy: 100,
  }).returning();

  // Initial crystals in ledger
  await db.insert(crystalLedger).values({
    characterId: char.id,
    amount: 500,
    transactionType: 'INITIAL',
    referenceId: 'seed_bonus',
  });

  // Give items to character inventory
  await db.insert(inventory).values([
    { characterId: char.id, itemId: pergaminho.id, quantity: 3 },
    { characterId: char.id, itemId: componenteFogo.id, quantity: 5 },
  ]);

  console.log(`Created Test User: ${user.username} with Character: ${char.name}`);
  console.log('Seed completed successfully!');

  await client.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
