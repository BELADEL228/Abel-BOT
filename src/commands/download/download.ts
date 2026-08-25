import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import mediaDownloader from '../../services/media/media-downloader.js';

const DownloadCommand: IPluginCommand = {
  name: 'download',
  aliases: [
    'tiktok', 'tt', 'ttdl', 'tiktokaudio',
    'youtube', 'yt', 'ytmp4', 'ytmp3', 'video',
    'instagram', 'ig', 'igdl', 'igaudio',
    'facebook', 'fb', 'fbaudio', 'twitter', 'twdl',
    'capcut', 'mediafire', 'pin', 'pixabay', 'image', 'apk', 'yts'
  ],
  category: 'Download',
  description: 'Téléchargement de contenu média : TikTok (vidéo/audio sans filigrane), YouTube (MP4/MP3), Instagram, etc.',
  usage: '.tiktok <url> ou .ytmp4 <url> ou .ytmp3 <url> ou .instagram <url>',
  cooldown: 5,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(`⚠️ Veuillez fournir un lien ou terme de recherche. Exemple : \`.${sub} https://vm.tiktok.com/...\``);
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'recording');

    // 1. TikTok Download
    if (['tiktok', 'tt', 'ttdl', 'tiktokaudio'].includes(sub) || query.includes('tiktok.com')) {
      await ctx.reply('⏳ *Téléchargement TikTok en cours...* (sans filigrane)');
      const isAudioOnly = sub === 'tiktokaudio';
      const result = await mediaDownloader.downloadTikTok(query, isAudioOnly);

      if (result.success && result.buffer) {
        const caption = `🎬 *TIKTOK TÉLÉCHARGÉ*\n\n📌 *Titre :* ${result.title || 'Sans titre'}\n👤 *Créateur :* ${result.author || 'Inconnu'}\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo TikTok. Vérifiez le lien.'}`);
        return;
      }
    }

    // 2. YouTube Download
    if (['youtube', 'yt', 'ytmp4', 'ytmp3', 'video'].includes(sub) || query.includes('youtube.com') || query.includes('youtu.be')) {
      const isAudioOnly = sub === 'ytmp3' || sub === 'song' || sub === 'song2';
      await ctx.reply(`⏳ *Téléchargement YouTube (${isAudioOnly ? 'Audio MP3' : 'Vidéo MP4'}) en cours...*`);
      const result = await mediaDownloader.downloadYouTube(query, isAudioOnly);

      if (result.success && result.buffer) {
        const caption = `🎬 *YOUTUBE ${isAudioOnly ? 'MP3' : 'MP4'}*\n\n📌 *Titre :* ${result.title || 'Vidéo YouTube'}\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo YouTube. Vérifiez le lien.'}`);
        return;
      }
    }

    // 3. Instagram Download
    if (['instagram', 'ig', 'igdl', 'igaudio'].includes(sub) || query.includes('instagram.com')) {
      await ctx.reply('⏳ *Téléchargement Instagram en cours...*');
      const result = await mediaDownloader.downloadInstagram(query);

      if (result.success && result.buffer) {
        const caption = `📸 *INSTAGRAM POST*\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          caption
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger le post Instagram.'}`);
        return;
      }
    }

    // 4. Pixabay / Image Search
    if (sub === 'pixabay' || sub === 'image') {
      const imgUrl = `https://pixabay.com/api/?key=sample&q=${encodeURIComponent(query)}`;
      await ctx.reply(`🖼️ *RECHERCHE D'IMAGE POUR "${query.toUpperCase()}" :*\n\n🔗 Pixabay: https://pixabay.com/images/search/${encodeURIComponent(query)}/`);
      return;
    }

    // 5. General / Spotify
    if (sub === 'song' || sub === 'song2' || sub === 'spotify') {
      await ctx.reply(`🎵 *RECHERCHE MUSICALE : ${query.toUpperCase()}*\n\nRecherche en cours... Utilisez \`.ytmp3 <lien youtube>\` pour télécharger la musique en MP3 haute qualité.`);
      return;
    }

    await ctx.reply(`📥 Commande de téléchargement \`.${sub}\` pour "${query}" traitée.`);
  }
};

export default DownloadCommand;
