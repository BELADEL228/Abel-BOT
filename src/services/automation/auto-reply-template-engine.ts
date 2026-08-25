/**
 * AutoReplyTemplateEngine — Sélectionne et personnalise le template de réponse optimal.
 *
 * Logique de sélection (par ordre de priorité) :
 * 1. Template personnalisé du contact (customTemplate)
 * 2. Template selon la catégorie du contact (WORK / FRIEND / FAMILY / PERSONAL)
 * 3. Template selon l'état du bot (BUSY / AWAY / VACATION)
 * 4. Template selon la plage horaire (NUIT / SOIR / MATIN / JOUR)
 * 5. Template par défaut
 *
 * Variables disponibles : {name}, {firstName}, {lastName}, {time}, {date}, {day}, {ownerName}, {untilDate}
 */

import { ContactCategory } from './auto-reply-contact-store.js';
import { AutoReplyState } from './auto-reply-config.js';

export interface TemplateContext {
  name: string;
  phone: string;
  ownerName: string;
  untilDate?: string;
}

export interface TemplateSet {
  default: string;
  busy: string;
  away: string;
  vacation: string;
  night: string;
}

const CATEGORY_TEMPLATES: Record<ContactCategory, { default: string; busy: string; away: string }> = {
  FRIEND: {
    default: "Yo {firstName} ! Bien reçu ton message, je suis un peu pris mais je te réponds dès que je me pose 🙏",
    busy: "Yo {firstName} ! Bien chargé en ce moment 😅 Je te réponds dès que j'ai une minute !",
    away: "Hey {firstName} ! Je suis pas à côté de mon tel là, je te réécris très vite 🙌"
  },
  WORK: {
    default: "Bonjour {name}, bien reçu votre message. Je suis actuellement indisponible et reviens vers vous dès que possible.",
    busy: "Bonjour {name}. Je suis actuellement en réunion/très pris. J'ai bien noté votre message et vous réponds au plus vite.",
    away: "Bonjour {name}. Je suis en déplacement pour le moment. Je prendrai connaissance de votre message à mon retour."
  },
  FAMILY: {
    default: "Coucou {firstName} ! J'ai bien vu ton message, je finis ce que je fais et je te rappelle très vite ❤️",
    busy: "Coucou {firstName} ! Je suis un peu occupé là, mais tout va bien. On se parle dès que je me libère 😘",
    away: "Coucou {firstName} ! Je suis pas dispo pour l'instant. Je te fais signe dès que possible ❤️"
  },
  PERSONAL: {
    default: "Salut {firstName} ! Bien reçu ton message, je suis occupé là mais je te réponds tout à l'heure 👍",
    busy: "Salut {firstName} ! Je suis pas mal pris pour l'instant. J'ai bien vu ton message, je reviens vers toi dès que possible.",
    away: "Salut {firstName} ! Je suis absent pour le moment. Je te réécris dès que je suis dispo."
  },
  UNKNOWN: {
    default: "Bonjour, j'ai bien reçu votre message. Je suis actuellement indisponible et vous répondrai dès que possible.",
    busy: "Bonjour, je suis actuellement très pris. Votre message a bien été pris en compte et je vous recontacte au plus vite.",
    away: "Bonjour, je suis absent pour l'instant. Je prendrai connaissance de votre message dès mon retour."
  }
};

function getCurrentPeriod(): 'MATIN' | 'JOUR' | 'SOIR' | 'NUIT' {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'MATIN';
  if (hour >= 12 && hour < 18) return 'JOUR';
  if (hour >= 18 && hour < 23) return 'SOIR';
  return 'NUIT';
}

function interpolate(template: string, ctx: TemplateContext): string {
  const parts = (ctx.name || '').trim().split(' ');
  const firstName = parts[0] || 'ami';
  const lastName = parts.slice(1).join(' ') || '';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dayStr = now.toLocaleDateString('fr-FR', { weekday: 'long' });

  return template
    .replace(/{name}/gi, ctx.name || ctx.phone)
    .replace(/{firstName}/gi, firstName)
    .replace(/{lastName}/gi, lastName)
    .replace(/{time}/gi, timeStr)
    .replace(/{date}/gi, dateStr)
    .replace(/{day}/gi, dayStr)
    .replace(/{ownerName}/gi, ctx.ownerName)
    .replace(/{untilDate}/gi, ctx.untilDate || 'bientôt')
    .replace(/{phone}/gi, ctx.phone);
}

export class AutoReplyTemplateEngine {
  private static instance: AutoReplyTemplateEngine;

  private templates: TemplateSet = {
    default: "Salut {firstName} ! J'ai bien reçu ton message, je suis un peu occupé là mais je te réponds dès que possible 🙏",
    busy: "Salut {firstName} ! Je suis actuellement très pris. J'ai bien noté ton message et je te réponds dès que j'ai un moment libre 🙏",
    away: "Hey {firstName} ! Je suis pas disponible pour l'instant. Je reviens vers toi dès que possible !",
    vacation: "Bonjour {firstName} 👋 Je suis actuellement en congés jusqu'au {untilDate}. Je prendrai connaissance de ton message à mon retour !",
    night: "Bonsoir {firstName}, il est un peu tard. J'ai bien reçu ton message et je te répondrai demain matin !"
  };

  private constructor() {}

  public static getInstance(): AutoReplyTemplateEngine {
    if (!AutoReplyTemplateEngine.instance) {
      AutoReplyTemplateEngine.instance = new AutoReplyTemplateEngine();
    }
    return AutoReplyTemplateEngine.instance;
  }

  public updateTemplates(partial: Partial<TemplateSet>): void {
    this.templates = { ...this.templates, ...partial };
  }

  public getTemplates(): TemplateSet {
    return { ...this.templates };
  }

  /**
   * Returns the final interpolated message to send.
   * Priority: contactCustom > categoryTemplate > stateTemplate > nightTemplate > default
   */
  public resolve(
    state: AutoReplyState,
    category: ContactCategory,
    ctx: TemplateContext,
    contactCustomTemplate?: string,
    vacationUntil?: Date
  ): string {
    // 1. Contact-specific custom template
    if (contactCustomTemplate) {
      return interpolate(contactCustomTemplate, ctx);
    }

    // 2. Vacation mode — always use vacation template
    if (state === 'VACATION') {
      const untilDate = vacationUntil
        ? vacationUntil.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'bientôt';
      return interpolate(this.templates.vacation, { ...ctx, untilDate });
    }

    // 3. Night period override (23h-06h)
    const period = getCurrentPeriod();
    if (period === 'NUIT') {
      return interpolate(this.templates.night, ctx);
    }

    // 4. Category-specific template based on state
    const catTemplates = CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.UNKNOWN;
    if (state === 'BUSY') {
      return interpolate(catTemplates.busy, ctx);
    }
    if (state === 'AWAY') {
      return interpolate(catTemplates.away, ctx);
    }

    // 5. Default category template (ON / SCHEDULED)
    if (state === 'ON' || state === 'SCHEDULED') {
      return interpolate(catTemplates.default, ctx);
    }

    // 6. Absolute fallback
    return interpolate(this.templates.default, ctx);
  }
}

export default AutoReplyTemplateEngine.getInstance();
