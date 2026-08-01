import type { APIRoute } from 'astro';
import { EmailService } from '@/services/email.service';
import type { QuoteFormData } from '@/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let payload: Partial<QuoteFormData> = {};

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = {
        name: formData.get('name')?.toString() || '',
        whatsapp: formData.get('whatsapp')?.toString() || '',
        email: formData.get('email')?.toString() || '',
        eventType: formData.get('eventType')?.toString() || '',
        eventDate: formData.get('eventDate')?.toString() || '',
        estimatedGuests: formData.get('estimatedGuests')?.toString() || '',
        desiredStyle: formData.get('desiredStyle')?.toString() || '',
        comments: formData.get('comments')?.toString() || '',
      };
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de contenido no soportado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Server-side Validation
    const { name, whatsapp, email, eventType, eventDate, estimatedGuests, desiredStyle, comments } = payload;

    if (!name || !whatsapp || !email || !eventType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Por favor completa todos los campos requeridos (*): Nombre, WhatsApp, Correo y Tipo de evento.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const quoteData: QuoteFormData = {
      name: name.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      eventType: eventType.trim(),
      eventDate: (eventDate || '').trim(),
      estimatedGuests: (estimatedGuests || '').trim(),
      desiredStyle: (desiredStyle || '').trim(),
      comments: (comments || '').trim(),
    };

    // Dispatch email via Resend
    const emailResult = await EmailService.sendQuoteNotification(quoteData);

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || 'Ocurrió un error al procesar el envío del correo.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '¡Gracias! Tu solicitud de cotización ha sido recibida con éxito. Te responderemos por WhatsApp a la brevedad.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    console.error('[API /api/quote] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
