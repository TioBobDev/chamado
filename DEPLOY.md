# Guia de Implantação e Estratégia de Backup (ChamadoFlow)

Este documento descreve as etapas necessárias para realizar o deploy da aplicação em uma VPS Linux (Ubuntu LTS) e as diretrizes para execução de backups automatizados de banco de dados e arquivos.

---

## 1. Requisitos do Servidor VPS
Recomendamos o seguinte ambiente base (ex: VPS Hostinger):
- **Sistema Operacional**: Ubuntu 22.04 LTS (ou superior)
- **Node.js**: v20.x.x LTS (ou superior)
- **Gerenciador de Pacotes**: npm v10.x.x+
- **Banco de Dados**: MySQL v8.0+
- **Servidor Web**: Nginx
- **Gerenciador de Processos**: PM2
- **Versionamento**: Git

---

## 2. Processo de Deploy Inicial

### Etapa A: Instalação de Dependências no Linux
Atualize os repositórios e instale o Nginx, Git e MySQL:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx git mysql-server -y
```

Instale o Node.js v20 (via NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Instale o gerenciador de processos PM2 globalmente:
```bash
sudo npm install pm2 -g
```

### Etapa B: Clonar o Código e Configurar as Variáveis
1. Clone o repositório da aplicação na VPS:
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO_GIT> /var/www/chamado
   cd /var/www/chamado
   ```
2. Crie e configure o arquivo `.env`:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *Certifique-se de configurar a variável `DATABASE_URL` com as credenciais do MySQL de produção e gerar uma chave forte para a variável `JWT_SECRET`.*

### Etapa C: Instalação e Compilação
Execute a instalação de pacotes e faça a compilação do Next.js:
```bash
# Instalação de dependências limpa
npm ci

# Rodar migrations para desenhar a estrutura no MySQL
npx prisma migrate deploy

# (Opcional) Executar carga de dados iniciais
npm run prisma db seed

# Build da aplicação Next.js
npm run build
```

### Etapa D: Executando com PM2
Inicie a aplicação utilizando o PM2 para garantir que o processo reinicie em caso de falha física do servidor:
```bash
pm2 start npm --name "chamadoflow" -- start

# Salvar o estado para reativação automática pós-reboot da VPS
pm2 save
pm2 startup
```

---

## 3. Configuração do Proxy Reverso no Nginx

Crie um novo arquivo de configuração para o Nginx:
```bash
sudo nano /etc/nginx/sites-available/chamado
```

Insira a configuração do bloco de servidor (ajustando para o seu domínio):
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    # Limite máximo de upload para arquivos (10MB) correspondente ao validator
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Bloqueio de segurança adicional para arquivos ocultos e de sistema
    location ~ /\. {
        deny all;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/chamado /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Estratégia de Backup e Recuperação

### A. Backup de Banco de Dados (MySQL)
Escreva um script de backup automático no Linux para exportar dumps diários compactados mantendo retenção de 7 dias.

Crie o arquivo `/opt/backup_db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/storage/backups/db"
DB_NAME="chamado"
DB_USER="root"
DB_PASS="sua_senha_segura"
DATE=$(date +%Y-%m-%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Executar exportação compactada
mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Remover backups mais antigos que 7 dias
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup concluído com sucesso em $DATE"
```
*Torne o script executável e adicione-o ao cron job diário (`crontab -e`):*
```cron
0 2 * * * /bin/bash /opt/backup_db.sh > /dev/null 2>&1
```

### B. Backup dos Arquivos Físicos (Anexos)
Como a aplicação utiliza `storageService` local salvando no diretório `storage/uploads/`, copie ciclicamente esta pasta para um segundo disco ou provedor de storage (ex: Rclone para Cloudflare R2 ou AWS S3):
```bash
# Exemplo de sincronização diária da pasta de anexos para bucket em nuvem via rclone
rclone sync /var/www/chamado/storage/uploads s3-bucket:chamadoflow-uploads
```

---

## 5. Portabilidade e Escalabilidade (Migração futura)
A arquitetura modular construída em serviços isolados (`StorageService`, `NotificationService`) permite expandir e portar a aplicação para plataformas serverless ou nuvens públicas sem alterar a lógica principal de chamados:
1. **Armazenamento**: Para migrar da VPS para o AWS S3 ou Cloudflare R2, basta criar um `S3StorageService` estendendo a interface `StorageService` em `src/shared/storage/storage.ts` e alterar a injeção do singleton. Nenhuma linha de código dos controladores ou serviços de chamado precisará de refatoração.
2. **Processos Assíncronos**: O sistema está pronto para receber drivers do Redis/BullMQ ou Kafka na pasta de infraestrutura compartilhada para processar disparos pesados e automações de SLAs fora das threads HTTP principais.
