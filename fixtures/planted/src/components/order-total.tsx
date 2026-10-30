"use client";

import { useEffect, useState } from "react";
import { PriceTag } from "./price-tag";

type Line = { priceCents: number; quantity: number };

export function OrderTotal({ lines }: { lines: Line[] }) {
  const [totalCents, setTotalCents] = useState(0);

  useEffect(() => {
    setTotalCents(lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0));
  }, [lines]);

  return (
    <p>
      Total: <PriceTag cents={totalCents} />
    </p>
  );
}
