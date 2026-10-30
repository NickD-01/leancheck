"use client";

import { useState } from "react";

export function QuantityPicker({ max }: { max: number }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div>
      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
        -
      </button>
      <input name="quantity" readOnly value={quantity} />
      <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))}>
        +
      </button>
    </div>
  );
}
