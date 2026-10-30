type CartLine = { productId: string; quantity: number; addedAt: string };
type Cart = { id: string; lines: CartLine[] };

export function snapshotCart(cart: Cart): Cart {
  return JSON.parse(JSON.stringify(cart));
}
