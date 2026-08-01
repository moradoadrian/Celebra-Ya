import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import "resend";
//#region src/services/email.service.ts
var EmailService = class {
	/**
	* Send a quote request notification email to studio owner via Resend
	*/
	static async sendQuoteNotification(data) {
		console.warn("[EmailService] RESEND_API_KEY is not defined. Email dispatch skipped in dev mode.");
		return { success: true };
	}
};
//#endregion
//#region src/pages/api/quote.ts
var quote_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request }) => {
	try {
		let payload = {};
		const contentType = request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) payload = await request.json();
		else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
			const formData = await request.formData();
			payload = {
				name: formData.get("name")?.toString() || "",
				whatsapp: formData.get("whatsapp")?.toString() || "",
				email: formData.get("email")?.toString() || "",
				eventType: formData.get("eventType")?.toString() || "",
				eventDate: formData.get("eventDate")?.toString() || "",
				estimatedGuests: formData.get("estimatedGuests")?.toString() || "",
				desiredStyle: formData.get("desiredStyle")?.toString() || "",
				comments: formData.get("comments")?.toString() || ""
			};
		} else return new Response(JSON.stringify({
			success: false,
			error: "Formato de contenido no soportado"
		}), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
		const { name, whatsapp, email, eventType, eventDate, estimatedGuests, desiredStyle, comments } = payload;
		if (!name || !whatsapp || !email || !eventType) return new Response(JSON.stringify({
			success: false,
			error: "Por favor completa todos los campos requeridos (*): Nombre, WhatsApp, Correo y Tipo de evento."
		}), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
		const quoteData = {
			name: name.trim(),
			whatsapp: whatsapp.trim(),
			email: email.trim(),
			eventType: eventType.trim(),
			eventDate: (eventDate || "").trim(),
			estimatedGuests: (estimatedGuests || "").trim(),
			desiredStyle: (desiredStyle || "").trim(),
			comments: (comments || "").trim()
		};
		const emailResult = await EmailService.sendQuoteNotification(quoteData);
		if (!emailResult.success) return new Response(JSON.stringify({
			success: false,
			error: emailResult.error || "Ocurrió un error al procesar el envío del correo."
		}), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
		return new Response(JSON.stringify({
			success: true,
			message: "¡Gracias! Tu solicitud de cotización ha sido recibida con éxito. Te responderemos por WhatsApp a la brevedad."
		}), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		const errMessage = error instanceof Error ? error.message : "Error interno del servidor";
		console.error("[API /api/quote] Error:", error);
		return new Response(JSON.stringify({
			success: false,
			error: errMessage
		}), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/quote@_@ts
var page = () => quote_exports;
//#endregion
export { page };
