import type { MetadataRoute } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/chamado';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lumen - Gestão de Chamados',
    short_name: 'Lumen Chamados',
    description: 'Sistema Integrado de Gestão de Chamados, Atendimentos e SLA',
    start_url: `${basePath}/dashboard`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090d16',
    theme_color: '#090d16',
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
