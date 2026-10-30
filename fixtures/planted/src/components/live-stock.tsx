"use client";

import { useEffect, useState } from "react";

export function LiveStock({ productId }: { productId: string }) {
  const [stock, setStock] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/stock/${productId}`)
      .then((res) => res.json())
      .then((data: { stock: number }) => setStock(data.stock));
  }, [productId]);

  return <p>{stock === null ? "Checking stock…" : `${stock} in stock`}</p>;
}
