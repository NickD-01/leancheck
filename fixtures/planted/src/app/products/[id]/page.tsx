import { LiveStock } from "@/components/live-stock";
import { OrderTotal } from "@/components/order-total";
import { PriceTag } from "@/components/price-tag";
import { QuantityPicker } from "@/components/quantity-picker";
import { SubmitButton } from "@/components/submit-button";

type ProductPageProps = { params: Promise<{ id: string }> };

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  return (
    <form action="/api/cart" method="post">
      <PriceTag cents={1999} />
      <LiveStock productId={id} />
      <QuantityPicker max={10} />
      <OrderTotal lines={[{ priceCents: 1999, quantity: 1 }]} />
      <SubmitButton label="Add to cart" />
    </form>
  );
}
