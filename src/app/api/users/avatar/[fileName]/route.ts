import { storageService } from '@/shared/storage/storage';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const sanitizedFileName = path.basename(fileName);

    const localPath = storageService.getLocalPath(path.join('avatars', sanitizedFileName));

    if (!fs.existsSync(localPath)) {
      return new Response('Avatar não encontrado.', { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(localPath);
    const ext = path.extname(sanitizedFileName).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    return new Response('Erro ao carregar avatar.', { status: 500 });
  }
}
