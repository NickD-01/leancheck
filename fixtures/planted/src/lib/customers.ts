import { eq } from "drizzle-orm";
import { db } from "../db";
import { orders, products, users } from "../db/schema";

export async function loadCustomers(ids: string[]) {
  return Promise.all(ids.map((id) => db.query.users.findFirst({ where: eq(users.id, id) })));
}

export async function listOrdersForUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).limit(50);
}

export async function listProductNames() {
  return db.select({ id: products.id, name: products.name }).from(products);
}

export async function requireUser(id: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, id));
  if (!user) throw new Error("User not found");
  return user;
}
