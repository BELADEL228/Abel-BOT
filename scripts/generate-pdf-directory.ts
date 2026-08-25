import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import pluginManager from '../src/core/plugin-system/plugin-manager.js';
import { config } from '../src/config/env.js';

async function generatePdf() {
  console.log('🔄 Initialisation du PluginManager pour la génération de l\'annuaire PDF...');
  await pluginManager.loadPlugins();

  const outputPath = path.resolve(process.cwd(), 'Abel-Bot_Annuaire_Des_Commandes.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  const primaryColor = '#1a365d';    // Deep Blue
  const secondaryColor = '#2b6cb0';  // Slate Blue
  const accentColor = '#319795';     // Teal
  const textColor = '#2d3748';       // Dark Grey
  const lightBg = '#edf2f7';         // Light Grey Background
  const borderColor = '#cbd5e0';

  // ─── PAGE DE GARDE ────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 180).fill(primaryColor);

  doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold')
    .text('✦ ABEL-BOT ✦', 40, 50, { align: 'center' });

  doc.fontSize(14).font('Helvetica')
    .text('ANNUAIRE OFFICIEL DES COMMANDES & GUIDE TECHNIQUE', 40, 85, { align: 'center' });

  doc.fontSize(10).font('Helvetica-Oblique')
    .text('Manuel de référence complet pour l\'assistant personnel WhatsApp intelligent', 40, 115, { align: 'center' });

  doc.moveDown(5);
  doc.y = 200;

  // Metadata Card
  doc.rect(40, 200, 515, 80).fillAndStroke(lightBg, borderColor);
  doc.fillColor(textColor).fontSize(10).font('Helvetica');
  doc.text(`• Version du Framework : v1.0.0`, 55, 215);
  doc.text(`• Préfixe par défaut : ${config.botPrefix}`, 55, 230);
  doc.text(`• Moteur IA : Groq Cloud LLM (Llama 3.3 70B Versatile / Gemini)`, 55, 245);
  doc.text(`• Nombre total de plugins chargés : ${pluginManager.getAllCommands().length}`, 55, 260);

  doc.y = 300;

  // ─── INTRODUCTION & RÔLES ────────────────────────────────────────────────
  doc.fillColor(secondaryColor).fontSize(14).font('Helvetica-Bold')
    .text('1. SYSTÈME DE RÔLES & PERMISSIONS', 40, doc.y);
  doc.moveDown(0.5);

  const roles = [
    { role: '👑 OWNER', desc: 'Accès absolu et contrôle total du bot, du mode (public/privé), des règles et de la maintenance.' },
    { role: '⚡ SUDO', desc: 'Numéros autorisés bénéficiant de privilèges équivalents à l\'Owner via la commande .addsudo.' },
    { role: '🛡️ ADMIN', desc: 'Administrateurs de groupes WhatsApp pour les commandes de modération (.kick, .promote, .rules).' },
    { role: '🔑 GRANTED', desc: 'Utilisateurs ayant reçu une permission granulaire ciblée via .grant @contact <commande>.' },
    { role: '🌐 PUBLIC / USER', desc: 'Tous les utilisateurs réguliers (en mode Public ou en conversations privées autorisées).' }
  ];

  for (const r of roles) {
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(r.role, 45, doc.y);
    doc.fillColor(textColor).fontSize(9).font('Helvetica').text(r.desc, 130, doc.y - 12, { width: 420 });
    doc.moveDown(0.4);
  }

  doc.moveDown(1);

  // ─── ANNUAIRE DES COMMANDES PAR CATÉGORIE ──────────────────────────────────
  const categoriesMap = pluginManager.getCommandsByCategory();

  for (const [category, commands] of categoriesMap.entries()) {
    // Check if new page needed
    if (doc.y > 680) {
      doc.addPage();
    } else {
      doc.moveDown(1);
    }

    // Category Header Banner
    const startY = doc.y;
    doc.rect(40, startY, 515, 24).fill(secondaryColor);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
      .text(`📂 CATÉGORIE : ${category.toUpperCase()} (${commands.length} Plugins)`, 50, startY + 6);
    doc.y = startY + 32;

    for (const cmd of commands) {
      if (doc.y > 700) {
        doc.addPage();
      }

      const boxY = doc.y;
      const allAliases = cmd.aliases && cmd.aliases.length > 0
        ? cmd.aliases.map(a => `.${a}`).join(', ')
        : 'Aucun';

      const scopeTag = cmd.ownerOnly
        ? '👑 Owner / Sudo'
        : cmd.groupOnly
        ? '👥 Groupe'
        : cmd.privateOnly
        ? '🔐 Privé'
        : '🌐 Public';

      // Command Card Box
      doc.rect(40, boxY, 515, 58).strokeColor(borderColor).stroke();

      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
        .text(`.${cmd.name}`, 50, boxY + 6);

      doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
        .text(`[ ${scopeTag} | Cooldown: ${cmd.cooldown || 3}s ]`, 400, boxY + 8, { align: 'right', width: 145 });

      doc.fillColor(textColor).fontSize(9).font('Helvetica')
        .text(`Description : ${cmd.description}`, 50, boxY + 22, { width: 495 });

      doc.fillColor('#4a5568').fontSize(8).font('Helvetica-Oblique')
        .text(`Syntaxe : ${cmd.usage || `.${cmd.name}`}  |  Alias : ${allAliases}`, 50, boxY + 42, { width: 495 });

      doc.y = boxY + 64;
    }
  }

  // ─── FOOTER & NUMÉROTATION DES PAGES ──────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Bottom bar
    doc.rect(40, doc.page.height - 35, 515, 0.5).fill(borderColor);
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
      .text('Abel-Bot Framework — Document Officiel & Référence des Commandes', 40, doc.page.height - 28, { align: 'left' });
    doc.text(`Page ${i + 1} sur ${range.count}`, 400, doc.page.height - 28, { align: 'right', width: 155 });
  }

  doc.end();

  await new Promise(resolve => writeStream.on('finish', resolve));
  console.log(`✅ Annuaire PDF généré avec succès : ${outputPath}`);
}

generatePdf().catch(console.error);
