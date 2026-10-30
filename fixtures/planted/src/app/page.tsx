import { listOrdersForUser, listProductNames } from "../lib/customers";
import { summarizeOrderTotals } from "../lib/stats";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function DashboardPage() {
  const products = await listProductNames();
  const orders = await listOrdersForUser(DEMO_USER_ID);
  const summary = summarizeOrderTotals(orders.map((o) => o.totalCents));

  return (
    <section>
      <h1>Dashboard</h1>
      <p>
        {products.length} products, {summary.count} orders
      </p>
    </section>
  );
}
