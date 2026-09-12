import type { Page } from "../types/paging.ts";

export async function eachPage<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  use: (item: T) => void,
): Promise<void> {
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const result = await fetchPage(page);

    for (const item of result.items) {
      use(item);
    }

    pages = result.totalPages;
    page += 1;
  }
}
