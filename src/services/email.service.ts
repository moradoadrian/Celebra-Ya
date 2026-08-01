import { Resend } from 'resend';
import type { QuoteFormData } from '../types';

export class EmailService {
  /**
   * Send a quote request notification email to studio owner via Resend
   */
  static async sendQuoteNotification(data: QuoteFormData): Promise<{ success: boolean; error?: string }> {
    const apiKey = import.meta.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not defined. Email dispatch skipped in dev mode.');
      return {
        success: true,
      };
    }

    const resend = new Resend(apiKey);

    // Format WhatsApp link for 1-click reply
    const cleanWhatsapp = data.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Hola ${data.name}, recibí tu solicitud de cotización en Celebra-Ya para tu evento de ${data.eventType}.`)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
            .title { color: #7c3aed; font-size: 22px; font-weight: 800; margin: 0; }
            .badge { display: inline-block; background: #f3e8ff; color: #6d28d9; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 9999px; margin-top: 6px; }
            .field-group { margin-bottom: 16px; }
            .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; tracking: 0.05em; margin-bottom: 4px; }
            .value { font-size: 15px; font-weight: 600; color: #0f172a; }
            .comments-box { background: #f8fafc; border-left: 4px solid #7c3aed; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 14px; color: #334155; }
            .btn { display: inline-block; background: #25d366; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 9999px; margin-top: 20px; }
            .footer { margin-top: 32px; pt-16 border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">🎉 Nueva Solicitud de Cotización</h1>
              <span class="badge">Celebra-Ya Studio</span>
            </div>

            <div class="field-group">
              <div class="label">Cliente</div>
              <div class="value">${data.name}</div>
            </div>

            <div style="display: flex; gap: 20px; margin-bottom: 16px;">
              <div style="flex: 1;">
                <div class="label">WhatsApp</div>
                <div class="value">${data.whatsapp}</div>
              </div>
              <div style="flex: 1;">
                <div class="label">Correo Electrónico</div>
                <div class="value">${data.email}</div>
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

            <div style="display: flex; gap: 20px; margin-bottom: 16px;">
              <div style="flex: 1;">
                <div class="label">Tipo de Evento</div>
                <div class="value" style="text-transform: capitalize;">${data.eventType}</div>
              </div>
              <div style="flex: 1;">
                <div class="label">Fecha del Evento</div>
                <div class="value">${data.eventDate || 'No especificada'}</div>
              </div>
            </div>

            <div style="display: flex; gap: 20px; margin-bottom: 16px;">
              <div style="flex: 1;">
                <div class="label">Invitados Estimados</div>
                <div class="value">${data.estimatedGuests || 'No especificado'}</div>
              </div>
              <div style="flex: 1;">
                <div class="label">Estilo Deseado</div>
                <div class="value">${data.desiredStyle || 'Libre / Por asesorar'}</div>
              </div>
            </div>

            ${data.comments ? `
              <div class="field-group">
                <div class="label">Comentarios / Requerimientos</div>
                <div class="comments-box">${data.comments}</div>
              </div>
            ` : ''}

            <div style="text-align: center; margin-top: 28px;">
              <a href="${whatsappUrl}" class="btn" target="_blank">
                💬 Responder a ${data.name} por WhatsApp
              </a>
            </div>

            <div class="footer">
              Este correo fue enviado automáticamente desde el formulario de cotización de <strong>Celebra-Ya Studio</strong>.
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const result = await resend.emails.send({
        from: 'Celebra-Ya Studio <onboarding@resend.dev>',
        to: ['hola@celebra-ya.com'],
        subject: `Nueva Cotización: ${data.eventType.toUpperCase()} de ${data.name}`,
        html: htmlContent,
        replyTo: data.email,
      });

      if (result.error) {
        console.error('[EmailService] Error sending email via Resend:', result.error);
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error sending email';
      console.error('[EmailService] Exception sending email:', err);
      return { success: false, error: errorMessage };
    }
  }
}
