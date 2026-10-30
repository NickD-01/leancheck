import { listOrdersForUser, requireUser } from "@/lib/customers";
import { formatOrderDate } from "@/lib/dates";

type AccountPageProps = { params: Promise<{ id: string }> };

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params;
  const user = await requireUser(id);
  const orders = await listOrdersForUser(user.id);

  return (
    <section>
      <h1>{user.name}</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>{formatOrderDate(order.placedAt)}</li>
        ))}
      </ul>
    </section>
  );
}
