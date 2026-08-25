import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import songService from '../../services/media/song-service.js';
import logger from '../../core/logger/logger.js';

/** Map extension -> MIME type pour WhatsApp audio */
function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
  };
  return map[ext.toLowerCase()] ?? 'audio/mp4';
}

const SongCommand: IPluginCommand = {
  name: 'song',
  aliases: ['play', 'music', 'mp3', 'audio', 'musique', 'chanson', 'son'],
  category: 'Download',
  description: 'Recherche et télécharge instantanément une musique en audio par son titre ou artiste.',
  usage: '.song <titre ou artiste> (ex: .song Burna Boy City Boys)',
  cooldown: 5,

  async execute(ctx: CommandContext) {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `🎵 *COMMANDE SONG / MUSIQUE*\n\n` +
        `Usage : \`.song <titre ou artiste>\`\n\n` +
        `*Exemples :*\n` +
        `• \`.song Burna Boy City Boys\`\n` +
        `• \`.song Fally Ipupa Science Fiction\`\n` +
        `• \`.song Asake Lonely At The Top\`\n` +
        `• \`.song https://youtu.be/...\``
      );
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'recording');
    await ctx.reply(`🔍 *Recherche et téléchargement de :* _"${query}"_...\n_Patientez quelques secondes..._`);

    try {
      // Recherche + téléchargement en une seule étape
      const result = await songService.findAndDownload(query);

      if (!result.success || !result.audioBuffer || !result.metadata) {
        await ctx.reply(`❌ ${result.error || 'Aucun morceau trouvé. Essayez un titre plus précis.'}`);
        return;
      }

      const { metadata, audioBuffer } = result;
      const mime = getMimeType(metadata.fileExt);
      const safeName = metadata.title.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
      const fileName = `${safeName}.${metadata.fileExt}`;

      // Carte d'information sur le morceau
      const infoCard =
        `╭━━━〔 🎵 MUSIQUE 〕━━━╮\n` +
        `┃\n` +
        `┃ 📌 *Titre :* ${metadata.title}\n` +
        `┃ 👤 *Artiste :* ${metadata.artist}\n` +
        `┃ ⏱️ *Durée :* ${metadata.duration}\n` +
        `┃ 🔗 *Lien :* ${metadata.url}\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(infoCard);
      await ctx.provider.sendPresence(ctx.chat.id, 'recording');

      // Envoi de l'audio directement dans le chat
      await ctx.provider.sendMedia(
        ctx.chat.id,
        'audio',
        audioBuffer,
        undefined,
        {
          mimetype: mime,
          fileName,
        }
      );

      logger.info(`[SongCommand] Sent "${metadata.title}" [${mime}] (${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB) to ${ctx.chat.id}`);
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongCommand] Execution failed');
      await ctx.reply(`❌ *Erreur lors du traitement de la musique :* ${err.message || 'Erreur inconnue'}`);
    }
  }
};

export default SongCommand;
