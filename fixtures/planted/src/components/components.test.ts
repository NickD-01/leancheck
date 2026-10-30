import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LiveStock } from "./live-stock";
import { OrderTotal } from "./order-total";
import { PriceTag } from "./price-tag";
import { QuantityPicker } from "./quantity-picker";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("components", () => {
  test("PriceTag formats cents as euros", () => {
    expect(render(createElement(PriceTag, { cents: 1999 }))).toContain("€ 19.99");
  });

  test("QuantityPicker starts at one", () => {
    expect(render(createElement(QuantityPicker, { max: 5 }))).toContain('value="1"');
  });

  test("LiveStock shows a placeholder before stock is known", () => {
    expect(render(createElement(LiveStock, { productId: "p1" }))).toContain("Checking stock");
  });

  test("OrderTotal renders a total line", () => {
    expect(render(createElement(OrderTotal, { lines: [] }))).toContain("Total:");
  });
});
