import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadResult {
  name: string;
  path: string;
  mimeType: string;
  size: number;
}

export interface StorageService {
  upload(fileBuffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<UploadResult>;
  delete(filePath: string): Promise<void>;
  getLocalPath(filePath: string): string;
}

// Extensões perigosas bloqueadas
const BLOCKED_EXTENSIONS = ['.exe', '.php', '.sh', '.bat', '.cmd', '.com', '.msi', '.vbs'];

// Limite de tamanho de arquivo (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor() {
    // Armazena no diretório root do projeto em 'storage/uploads'
    this.baseDir = path.resolve(process.cwd(), 'storage', 'uploads');
    
    // Certifica-se de que o diretório base existe
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(fileBuffer: Buffer, originalName: string, mimeType: string, folder: string = 'tickets'): Promise<UploadResult> {
    // 1. Validar tamanho do buffer
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error('O arquivo excede o limite máximo permitido de 10MB.');
    }

    // 2. Validar extensão
    const ext = path.extname(originalName).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new Error(`Arquivos com extensão ${ext} não são permitidos por motivos de segurança.`);
    }

    // 3. Gerar pasta baseada no tipo ou ano/mês para organização
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    const targetDir = folder === 'avatars'
      ? path.join(this.baseDir, 'avatars')
      : path.join(this.baseDir, folder, year, month);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 4. Renomear com UUID + manter a extensão
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${ext}`;
    const fullPath = path.join(targetDir, fileName);

    // 5. Salvar arquivo
    await fs.promises.writeFile(fullPath, fileBuffer);

    // Retorna o caminho relativo que será salvo no banco
    const relativePath = path.relative(this.baseDir, fullPath).replace(/\\/g, '/');

    return {
      name: originalName,
      path: relativePath,
      mimeType,
      size: fileBuffer.length,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  getLocalPath(filePath: string): string {
    return path.join(this.baseDir, filePath);
  }
}

// Instância singleton do serviço de armazenamento atual (LocalStorageService)
export const storageService: StorageService = new LocalStorageService();
