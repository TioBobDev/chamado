export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPaginationParams(url: string | URL, defaultLimit = 10) {
  const searchParams = typeof url === 'string' ? new URL(url).searchParams : url.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
