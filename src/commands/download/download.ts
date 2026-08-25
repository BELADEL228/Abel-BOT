import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import mediaDownloader from '../../services/media/media-downloader.js';

const DownloadCommand: IPluginCommand = {
  name: 'download',
  aliases: [
    'tiktok', 'tt', 'ttdl', 'tiktokaudio',
    'youtube', 'yt', 'ytmp4', 'ytmp3', 'video',
    'instagram', 'ig', 'igdl', 'igaudio',
    'facebook', 'fb', 'fbdl', 'fbaudio', 'fbvideo', 'fbmp4',
    'twitter', 'twdl', 'x', 'tw',
    'pixabay', 'image'
  ],
  category: 'Download',
  description: 'Téléchargement de vidéos & audios : Facebook, TikTok, YouTube, Instagram, Twitter / X, etc.',
  usage: '.fb <url> ou .tiktok <url> ou .ytmp4 <url> ou .ig <url> ou .twitter <url>',
  cooldown: 5,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `📥 *MODULE DE TÉLÉCHARGEMENT MÉDIA*\n\n` +
        `Usage disponible :\n` +
        `• \`.fb <url facebook>\` (Vidéo / Reel / Watch Facebook)\n` +
        `• \`.fbaudio <url facebook>\` (Audio Facebook)\n` +
        `• \`.tiktok <url tiktok>\` (Vidéo TikTok sans filigrane)\n` +
        `• \`.tiktokaudio <url tiktok>\` (Audio TikTok)\n` +
        `• \`.ig <url instagram>\` (Reel / Vidéo Instagram)\n` +
        `• \`.ytmp4 <url youtube>\` (Vidéo YouTube MP4)\n` +
        `• \`.ytmp3 <url youtube>\` (Audio YouTube MP3)\n` +
        `• \`.twitter <url twitter/x>\` (Vidéo Twitter / X)`
      );
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'recording');

    // 1. Facebook Download
    if (
      ['facebook', 'fb', 'fbdl', 'fbaudio', 'fbvideo', 'fbmp4'].includes(sub) ||
      query.includes('facebook.com') ||
      query.includes('fb.watch') ||
      query.includes('fb.me')
    ) {
      const isAudioOnly = sub === 'fbaudio';
      await ctx.reply(`⏳ *Téléchargement Facebook (${isAudioOnly ? 'Audio' : 'Vidéo'}) en cours...*\n_Veuillez patienter..._`);
      const result = await mediaDownloader.downloadFacebook(query, isAudioOnly);

      if (result.success && result.buffer) {
        const caption = `🎬 *FACEBOOK ${isAudioOnly ? 'AUDIO' : 'VIDÉO'}*\n\n📌 *Titre :* ${result.title || 'Vidéo Facebook'}\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined,
          {
            fileName: result.fileName || `facebook_${Date.now()}.${isAudioOnly ? 'm4a' : 'mp4'}`,
            mimetype: isAudioOnly ? 'audio/mp4' : 'video/mp4',
          }
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo Facebook. Assurez-vous que le lien est public.'}`);
        return;
      }
    }

    // 2. TikTok Download
    if (['tiktok', 'tt', 'ttdl', 'tiktokaudio'].includes(sub) || query.includes('tiktok.com')) {
      const isAudioOnly = sub === 'tiktokaudio';
      await ctx.reply(`⏳ *Téléchargement TikTok (${isAudioOnly ? 'Audio' : 'Vidéo sans filigrane'}) en cours...*`);
      const result = await mediaDownloader.downloadTikTok(query, isAudioOnly);

      if (result.success && result.buffer) {
        const caption = `🎬 *TIKTOK TÉLÉCHARGÉ*\n\n📌 *Titre :* ${result.title || 'Sans titre'}\n👤 *Créateur :* ${result.author || 'Inconnu'}\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined,
          {
            fileName: result.fileName || `tiktok_${Date.now()}.${isAudioOnly ? 'm4a' : 'mp4'}`,
            mimetype: isAudioOnly ? 'audio/mp4' : 'video/mp4',
          }
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo TikTok. Vérifiez le lien.'}`);
        return;
      }
    }

    // 3. YouTube Download
    if (['youtube', 'yt', 'ytmp4', 'ytmp3', 'video'].includes(sub) || query.includes('youtube.com') || query.includes('youtu.be')) {
      const isAudioOnly = sub === 'ytmp3';
      await ctx.reply(`⏳ *Téléchargement YouTube (${isAudioOnly ? 'Audio MP3' : 'Vidéo MP4'}) en cours...*`);
      const result = await mediaDownloader.downloadYouTube(query, isAudioOnly);

      if (result.success && result.buffer) {
        const caption = `🎬 *YOUTUBE ${isAudioOnly ? 'MP3' : 'MP4'}*\n\n📌 *Titre :* ${result.title || 'Vidéo YouTube'}\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined,
          {
            fileName: result.fileName || `youtube_${Date.now()}.${isAudioOnly ? 'm4a' : 'mp4'}`,
            mimetype: isAudioOnly ? 'audio/mp4' : 'video/mp4',
          }
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo YouTube. Vérifiez le lien.'}`);
        return;
      }
    }

    // 4. Instagram Download
    if (['instagram', 'ig', 'igdl', 'igaudio'].includes(sub) || query.includes('instagram.com')) {
      await ctx.reply('⏳ *Téléchargement Instagram en cours...*');
      const result = await mediaDownloader.downloadInstagram(query);

      if (result.success && result.buffer) {
        const caption = `📸 *INSTAGRAM MÉDIA*\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          result.type === 'video' ? caption : undefined,
          {
            fileName: result.fileName || `instagram_${Date.now()}.${result.type === 'video' ? 'mp4' : 'jpg'}`,
          }
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger le contenu Instagram. Assurez-vous que le compte est public.'}`);
        return;
      }
    }

    // 5. Twitter / X Download
    if (['twitter', 'twdl', 'x', 'tw'].includes(sub) || query.includes('twitter.com') || query.includes('x.com')) {
      await ctx.reply('⏳ *Téléchargement Twitter / X en cours...*');
      const result = await mediaDownloader.downloadTwitter(query);

      if (result.success && result.buffer) {
        const caption = `🐦 *TWITTER / X VIDÉO*\n⚡ *Téléchargé par Abel-Bot*`;
        await ctx.provider.sendMedia(
          ctx.chat.id,
          result.type,
          result.buffer,
          caption,
          {
            fileName: result.fileName || `twitter_${Date.now()}.mp4`,
            mimetype: 'video/mp4',
          }
        );
        return;
      } else {
        await ctx.reply(`❌ ${result.error || 'Impossible de télécharger la vidéo Twitter / X. Vérifiez le lien.'}`);
        return;
      }
    }

    // 6. Pixabay / Image Search
    if (sub === 'pixabay' || sub === 'image') {
      await ctx.reply(`🖼️ *RECHERCHE D'IMAGE POUR "${query.toUpperCase()}" :*\n\n🔗 Pixabay: https://pixabay.com/images/search/${encodeURIComponent(query)}/`);
      return;
    }

    await ctx.reply(`📥 Commande de téléchargement \`.${sub}\` pour "${query}" non reconnue. Utilisez \`.download\` pour voir l'aide.`);
  }
};

export default DownloadCommand;
