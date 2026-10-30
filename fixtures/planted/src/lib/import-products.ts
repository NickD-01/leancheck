import { db } from "../db";
import { products } from "../db/schema";

type NewProduct = typeof products.$inferInsert;

export async function importProducts(rows: NewProduct[]): Promise<number> {
  await Promise.all(rows.map((row) => db.insert(products).values(row)));
  return rows.length;
}
