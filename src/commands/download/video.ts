import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import videoService from '../../services/media/video-service.js';
import logger from '../../core/logger/logger.js';

const VideoCommand: IPluginCommand = {
  name: 'video',
  aliases: ['ytvideo', 'playvideo', 'film', 'clip', 'videodl', 'ytv'],
  category: 'Download',
  description: 'Recherche et télécharge instantanément une vidéo MP4 par son titre ou sa description.',
  usage: '.video <titre ou mot-clé> (ex: .video Naruto vs Sasuke ou .video https://youtu.be/...)',
  cooldown: 5,

  async execute(ctx: CommandContext) {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `🎬 *COMMANDE VIDÉO*\n\n` +
        `Usage : \`.video <titre ou description de la vidéo>\`\n\n` +
        `*Exemples :*\n` +
        `• \`.video Fally Ipupa concert live\`\n` +
        `• \`.video Burna Boy City Boys clip officiel\`\n` +
        `• \`.video résumé Real Madrid vs Barcelona\`\n` +
        `• \`.video https://youtu.be/...\``
      );
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'recording');
    await ctx.reply(`🔍 *Recherche de la vidéo :* _"${query}"_...\n_Téléchargement en cours, patientez quelques secondes..._`);

    try {
      const result = await videoService.findAndDownloadVideo(query);

      if (!result.success || !result.videoBuffer || !result.metadata) {
        await ctx.reply(`❌ ${result.error || 'Aucune vidéo trouvée. Essayez avec des mots-clés plus précis.'}`);
        return;
      }

      const { metadata, videoBuffer } = result;
      const safeName = metadata.title.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
      const fileName = `${safeName}.mp4`;

      const infoCard =
        `╭━━━〔 🎬 VIDÉO TROUVÉE 〕━━━╮\n` +
        `┃\n` +
        `┃ 📌 *Titre :* ${metadata.title}\n` +
        `┃ 👤 *Chaîne :* ${metadata.author}\n` +
        `┃ ⏱️ *Durée :* ${metadata.duration}\n` +
        `┃ 🔗 *Lien :* ${metadata.url}\n` +
        `┃ 📦 *Taille :* ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(infoCard);
      await ctx.provider.sendPresence(ctx.chat.id, 'recording');

      const videoCaption = `🎬 *${metadata.title}*\n👤 *${metadata.author}* • ⏱️ ${metadata.duration}\n⚡ *Téléchargé par Abel-Bot*`;

      try {
        await ctx.provider.sendMedia(
          ctx.chat.id,
          'video',
          videoBuffer,
          videoCaption,
          {
            fileName,
            mimetype: 'video/mp4',
          }
        );
        logger.info(`[VideoCommand] Sent video "${metadata.title}" (${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB) to ${ctx.chat.id}`);
      } catch (mediaErr: any) {
        logger.warn({ error: mediaErr.message }, '[VideoCommand] Failed to send as video stream, sending as document...');
        await ctx.provider.sendMedia(
          ctx.chat.id,
          'document',
          videoBuffer,
          videoCaption,
          {
            fileName,
            mimetype: 'video/mp4',
          }
        );
        logger.info(`[VideoCommand] Sent video "${metadata.title}" as document to ${ctx.chat.id}`);
      }
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[VideoCommand] Execution failed');
      await ctx.reply(`❌ *Erreur lors du traitement de la vidéo :* ${err.message || 'Erreur inconnue'}`);
    }
  }
};

export default VideoCommand;
