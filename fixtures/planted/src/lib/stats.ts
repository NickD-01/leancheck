import _ from "lodash";

export function summarizeOrderTotals(totals: number[]) {
  return {
    count: totals.length,
    sumCents: _.sum(totals),
    maxCents: _.max(totals) ?? 0,
  };
}
