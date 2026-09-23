export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/chamado';

/**
 * Retorna o caminho devidamente prefixado com o BASE_PATH (ex: /chamado/api/...).
 * Se o caminho já contiver o prefixo ou for vazio, ele é retornado sem duplicação.
 */
export function withBasePath(path: string): string {
  if (!BASE_PATH || BASE_PATH === '/') return path;
  if (path.startsWith(BASE_PATH)) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${cleanPath}`;
}

/**
 * Wrapper sobre o fetch nativo para requisições no cliente.
 * Se uma URL relativa iniciando com '/' for passada, prefixa automaticamente com o BASE_PATH.
 */
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/')) {
    return fetch(withBasePath(input), init);
  }
  return fetch(input, init);
}
