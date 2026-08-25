import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import songService from '../../services/media/song-service.js';
import logger from '../../core/logger/logger.js';

const SongCommand: IPluginCommand = {
  name: 'song',
  aliases: ['play', 'music', 'mp3', 'audio', 'musique', 'chanson', 'son'],
  category: 'Download',
  description: 'Recherche et télécharge instantanément une musique en audio MP3 par son titre ou artiste.',
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
    await ctx.reply(`🔍 *Recherche du morceau :* _"${query}"_...`);

    try {
      // 1. Recherche
      const metadata = await songService.searchSong(query);

      if (!metadata) {
        await ctx.reply(`❌ *Aucun morceau trouvé pour :* _"${query}"_.\nEssayez de préciser le nom de l'artiste ou le titre exact.`);
        return;
      }

      // Carte d'information sur le morceau trouvé
      const infoCard =
        `╭━━━〔 🎵 MUSIQUE TROUVÉE 〕━━━╮\n` +
        `┃\n` +
        `┃ 📌 *Titre :* ${metadata.title}\n` +
        `┃ 👤 *Artiste :* ${metadata.artist}\n` +
        `┃ ⏱️ *Durée :* ${metadata.duration}\n` +
        `┃ 🔗 *Lien :* ${metadata.url}\n` +
        `┃\n` +
        `┃ ⏳ *Téléchargement audio en cours...*\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(infoCard);

      // 2. Téléchargement de l'audio
      const result = await songService.downloadSongAudio(metadata);

      if (result.success && result.audioBuffer) {
        await ctx.provider.sendPresence(ctx.chat.id, 'recording');

        // Envoi de l'audio sur WhatsApp
        await ctx.provider.sendMedia(
          ctx.chat.id,
          'audio',
          result.audioBuffer,
          undefined,
          {
            mimetype: 'audio/mp4',
            fileName: `${metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`
          }
        );
        logger.info(`[SongCommand] Sent song "${metadata.title}" to ${ctx.chat.id}`);
      } else {
        await ctx.reply(`⚠️ ${result.error || 'Impossible de télécharger ce fichier audio pour le moment.'}`);
      }
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongCommand] Execution failed');
      await ctx.reply(`❌ *Erreur lors du traitement de la musique :* ${err.message || 'Erreur inconnue'}`);
    }
  }
};

export default SongCommand;
