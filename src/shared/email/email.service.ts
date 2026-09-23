import nodemailer from 'nodemailer';
import { logger } from '@/shared/logger/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      logger.info(`[EMAIL] Provedor SMTP configurado com sucesso: ${host}:${port}`);
    } else {
      logger.info('[EMAIL] SMTP não configurado. Modo de simulação local ativo (links serão impressos no console).');
    }
  }

  async sendMail(options: SendEmailOptions): Promise<{ success: boolean; simulated: boolean }> {
    const from = process.env.SMTP_FROM || 'ChamadoFlow <nao-responda@chamadoflow.com>';

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        logger.info(`[EMAIL ENVIADO] Para: ${options.to} | Assunto: ${options.subject}`);
        return { success: true, simulated: false };
      } catch (error) {
        logger.error(`[EMAIL ERRO] Falha ao enviar para ${options.to}`, error);
        throw error;
      }
    } else {
      // Modo Simulado (Desenvolvimento Local)
      console.log('\n========================================================================');
      console.log('📧 [MODO DESENVOLVIMENTO - E-MAIL SIMULADO]');
      console.log(`De:       ${from}`);
      console.log(`Para:     ${options.to}`);
      console.log(`Assunto:  ${options.subject}`);
      console.log('------------------------------------------------------------------------');
      if (options.text) {
        console.log(options.text);
      }
      console.log('========================================================================\n');

      return { success: true, simulated: true };
    }
  }

  async sendPasswordResetEmail(
    email: string,
    userName: string,
    token: string
  ): Promise<{ success: boolean; simulated: boolean; resetUrl: string }> {
    const baseUrl = process.env.APP_URL || 'http://localhost:3001';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const subject = 'Redefinição de Senha - ChamadoFlow';
    const text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir a sua senha no ChamadoFlow.\n\nPara cadastrar uma nova senha, acesse o link abaixo:\n${resetUrl}\n\nEste link é válido por 1 hora.\nSe você não fez esta solicitação, desconsidere este e-mail.`;

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 30px 15px; }
        .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .logo { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 24px; display: inline-block; }
        .logo span { color: #a855f7; }
        h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 0; margin-bottom: 12px; }
        p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #38bdf8, #818cf8); color: #0b0f19 !important; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3); }
        .url-box { background: #0b0f19; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 12px; color: #38bdf8; margin-top: 16px; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 18px; }
        .alert { background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; padding: 10px 14px; border-radius: 6px; font-size: 13px; color: #bae6fd; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Chamado<span>Flow</span></div>
        <h1>Recuperação de Senha</h1>
        <p>Olá, <strong>${userName}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir a senha de acesso da sua conta. Se você realizou este pedido, clique no botão abaixo para escolher uma nova senha:</p>
        
        <div class="btn-container">
          <a href="${resetUrl}" class="btn" target="_blank">Redefinir Minha Senha</a>
        </div>

        <div class="alert">
          ⏳ <strong>Atenção:</strong> Por motivos de segurança, este link é válido por <strong>1 hora</strong> e pode ser utilizado apenas uma vez.
        </div>

        <p style="font-size: 12px;">Se o botão não funcionar, copie e cole o endereço abaixo no seu navegador:</p>
        <div class="url-box">${resetUrl}</div>

        <p style="margin-top: 24px; font-size: 12px;">Se você <strong>não</strong> solicitou a alteração de sua senha, ignore este e-mail. Sua senha permanecerá inalterada.</p>

        <div class="footer">
          &copy; 2026 ChamadoFlow - Gestão Inteligente de Chamados
        </div>
      </div>
    </body>
    </html>
    `;

    const result = await this.sendMail({
      to: email,
      subject,
      text,
      html,
    });

    return {
      success: result.success,
      simulated: result.simulated,
      resetUrl,
    };
  }
}

export const emailService = new EmailService();
