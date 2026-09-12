export interface Page<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export const MAX_PAGE_SIZE = 200;
