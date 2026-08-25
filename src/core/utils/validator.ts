import { z } from 'zod';

/**
 * Validates data against a Zod schema.
 * Returns the parsed data or throws an error with a user-friendly message.
 */
export function validate<T>(schema: z.Schema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => i.message).join(', ');
    throw new Error(`Données invalides : ${issues}`);
  }
  return result.data;
}

// Example schemas for common command arguments
export const schemas = {
  phone: z.string().regex(/^\d{7,15}$/, "Numéro de téléphone invalide (format international requis, sans +)"),
  amount: z.number().min(0, "Le montant doit être positif"),
  jid: z.string().includes('@s.whatsapp.net', { message: "JID WhatsApp invalide" })
};
