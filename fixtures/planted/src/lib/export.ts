type Page = { rows: string[]; nextCursor: string | null };
type FetchPage = (cursor: string | null) => Promise<Page>;

// Each request needs the cursor returned by the previous one, so pages are fetched in order.
export async function exportAllRows(fetchPage: FetchPage): Promise<string[]> {
  let page = await fetchPage(null);
  const rows = [...page.rows];
  while (page.nextCursor) {
    page = await fetchPage(page.nextCursor);
    rows.push(...page.rows);
  }
  return rows;
}
