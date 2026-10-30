import { db } from "../src/db";
import { orders, users } from "../src/db/schema";

const SEED_USERS = [
  { name: "Ann Peeters", email: "ann@example.test" },
  { name: "Bram Claes", email: "bram@example.test" },
];

async function createSeedUser(user: { name: string; email: string }): Promise<void> {
  const [created] = await db.insert(users).values(user).returning({ id: users.id });
  if (!created) throw new Error(`Could not seed ${user.email}`);
  await db.insert(orders).values({ userId: created.id, totalCents: 4200 });
}

// One-off local seeding: a handful of rows, run by hand, so sequential inserts are fine.
async function main(): Promise<void> {
  for (const user of SEED_USERS) {
    await createSeedUser(user);
  }
  process.exit(0);
}

void main();
