type Customer = { id: string; name: string };
type Order = { id: string; userId: string; totalCents: number };

export function attachCustomers(orders: Order[], customers: Customer[]) {
  return orders.map((order) => ({
    ...order,
    customer: customers.find((c) => c.id === order.userId),
  }));
}
