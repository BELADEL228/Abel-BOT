/**
 * Todo Command — Gestionnaire de tâches WhatsApp
 *
 * Commandes :
 *   .todo add <titre> [@high|@urgent|@low] [le <date>]
 *   .todo list
 *   .todo done <ID>
 *   .todo del <ID>
 *   .todo clear
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import todoService, { TodoPriority } from '../../services/automation/todo-service.js';

const PRIORITY_EMOJI: Record<TodoPriority, string> = {
  urgent: '🔴',
  high: '🟠',
  normal: '🟡',
  low: '🟢'
};

function formatDate(d?: Date): string {
  if (!d) return '';
  return ` _(avant le ${d.toLocaleDateString('fr-FR')})_`;
}

const TodoCommand: IPluginCommand = {
  name: 'todo',
  aliases: ['tâche', 'task', 'tasks'],
  category: 'Automation',
  description: 'Gérer vos tâches directement depuis WhatsApp.',
  usage: '.todo add <titre> | .todo list | .todo done <ID> | .todo del <ID>',
  cooldown: 2,
  ownerOnly: true,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();
    const ownerJid = ctx.sender.id;

    // ── ADD ────────────────────────────────────────────────────────────────────
    if (action === 'add' || action === 'ajouter' || !action) {
      const raw = ctx.args.slice(1).join(' ');
      if (!raw.trim()) {
        await ctx.reply(
          '📋 *GESTIONNAIRE DE TÂCHES*\n\n' +
          'Commandes :\n' +
          '• `.todo add <titre>` — Ajouter une tâche\n' +
          '• `.todo add <titre> @urgent` — Tâche urgente 🔴\n' +
          '• `.todo add <titre> @high` — Priorité haute 🟠\n' +
          '• `.todo list` — Voir toutes les tâches\n' +
          '• `.todo done <ID>` — Marquer comme terminée\n' +
          '• `.todo del <ID>` — Supprimer une tâche\n' +
          '• `.todo clear` — Effacer les tâches terminées'
        );
        return;
      }

      // Detect priority tag (@urgent, @high, @low)
      let priority: TodoPriority = 'normal';
      let title = raw;
      const prioMatch = raw.match(/@(urgent|high|low|normal)/i);
      if (prioMatch) {
        priority = prioMatch[1].toLowerCase() as TodoPriority;
        title = raw.replace(prioMatch[0], '').trim();
      }

      // Detect due date
      let dueDate: Date | undefined;
      const dateMatch = title.match(/\b(?:avant le|le|pour le|deadline)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{4})?)\b/i);
      if (dateMatch) {
        const parts = dateMatch[1].split(/[\/\-]/);
        dueDate = new Date(
          parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear(),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[0], 10)
        );
        title = title.replace(dateMatch[0], '').trim();
      }

      const item = todoService.add(ownerJid, title, priority, dueDate);
      await ctx.reply(
        `✅ *Tâche ajoutée !* \`[${item.id}]\`\n\n` +
        `${PRIORITY_EMOJI[item.priority]} *${item.title}*${formatDate(item.dueDate)}\n\n` +
        `_Tapez \`.todo list\` pour voir toutes vos tâches._`
      );
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────────
    if (action === 'list' || action === 'liste') {
      await todoService.loadForOwner(ownerJid);
      const pending = todoService.getPending(ownerJid);
      const done = todoService.getDone(ownerJid);

      if (pending.length === 0 && done.length === 0) {
        await ctx.reply('📋 Aucune tâche pour le moment.\n\n💡 `.todo add <titre>` pour créer une tâche !');
        return;
      }

      let out = `╭━━〔 📋 MES TÂCHES 〕━━╮\n\n`;

      if (pending.length > 0) {
        out += `🔖 *EN COURS (${pending.length}) :*\n`;
        for (const t of pending) {
          out += `• ${PRIORITY_EMOJI[t.priority]} \`[${t.id}]\` ${t.title}${formatDate(t.dueDate)}\n`;
        }
        out += '\n';
      }

      if (done.length > 0) {
        out += `✅ *TERMINÉES (${done.length}) :*\n`;
        for (const t of done.slice(0, 5)) {
          out += `• ~~\`[${t.id}]\` ${t.title}~~\n`;
        }
        if (done.length > 5) out += `• _...et ${done.length - 5} autres_\n`;
      }

      out += `\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
      out += `_Marquer terminée : \`.todo done <ID>\`_`;
      await ctx.reply(out);
      return;
    }

    // ── DONE ───────────────────────────────────────────────────────────────────
    if (action === 'done' || action === 'ok' || action === 'terminé' || action === 'termine') {
      const id = ctx.args[1];
      if (!id) {
        await ctx.reply('⚠️ Format : `.todo done <ID>` (ex: `.todo done AB1C2`)');
        return;
      }
      const item = todoService.complete(ownerJid, id);
      if (!item) {
        await ctx.reply(`❌ Tâche \`${id}\` introuvable ou déjà terminée.`);
        return;
      }
      await ctx.reply(`✅ *Tâche marquée comme terminée !*\n\n${PRIORITY_EMOJI[item.priority]} ~~${item.title}~~`);
      return;
    }

    // ── DEL ───────────────────────────────────────────────────────────────────
    if (action === 'del' || action === 'delete' || action === 'rm' || action === 'supprimer') {
      const id = ctx.args[1];
      if (!id) {
        await ctx.reply('⚠️ Format : `.todo del <ID>`');
        return;
      }
      const ok = todoService.remove(ownerJid, id);
      await ctx.reply(ok ? `🗑️ Tâche \`${id}\` supprimée.` : `❌ Tâche \`${id}\` introuvable.`);
      return;
    }

    // ── CLEAR ─────────────────────────────────────────────────────────────────
    if (action === 'clear' || action === 'clean') {
      const done = todoService.getDone(ownerJid);
      for (const t of done) todoService.remove(ownerJid, t.id);
      await ctx.reply(`🧹 *${done.length} tâche(s) terminée(s) supprimée(s).*`);
      return;
    }

    // ── UNKNOWN ───────────────────────────────────────────────────────────────
    await ctx.reply('⚠️ Commande inconnue.\n\nAide : `.todo add <titre>` | `.todo list` | `.todo done <ID>`');
  }
};

export default TodoCommand;
