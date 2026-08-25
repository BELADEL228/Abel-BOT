# 📖 Abel-Bot — Annuaire Complet des Commandes

> **Version :** 1.0.0 | **Préfixe :** `.` | **Total :** 30 commandes principales · 460+ aliases  
> Toutes les commandes commencent par le préfixe **`.`** (ex: `.help`, `.autoreply`, `.ping`, `.purge`, `.sessions`)

---

## 🗺️ Navigation Rapide par Catégorie

| Catégorie | Description | Nb de commandes |
|-----------|-------------|----------------|
| [🤖 AI](#-ia--intelligence-artificielle) | Traduction, Chat IA, Résumé, Intelligence Conversationnelle | 4 |
| [🎵 Audio](#-audio) | Conversion audio, recherche Spotify | 2 |
| [⚙️ Automation](#️-automation--auto-reply) | Moteur Auto-Reply IA complet | 4 |
| [👥 Contacts](#-contacts) | Gestion des contacts, VCF, fiche contact | 1 |
| [🛠️ Developer](#️-developer) | Logs, debug, santé système | 1 |
| [📥 Download](#-download) | Téléchargement YouTube, TikTok, Instagram | 1 |
| [📁 Files](#-fichiers) | Gestion de fichiers, téléversement, notes | 1 |
| [🎭 Fun](#-fun) | Jeux, horoscope, blagues, devinettes | 1 |
| [🏠 General](#-général) | Aide, ping, informations du bot, carte propriétaire | 4 |
| [👑 Group](#-groupes) | Administration groupe, purge, sécurité, gestion membres | 4 |
| [🖼️ Media](#️-media) | Médias, stickers, images, GIF, vidéos | 1 |
| [🔐 Owner](#-owner--administration) | Mode, multi-sessions, permissions, sudo, liste noire | 4 |
| [🕌 Religion](#-religion) | Horaires de prières, Coran, Bible, Hadith | 1 |
| [🔍 Search](#-recherche) | Recherche Web, Wikipedia, Météo | 1 |
| [🛡️ Security](#️-sécurité) | Protection groupe, anti-spam, filtres | 1 |
| [⚙️ Settings](#️-paramètres) | Réglages bot, thème, langue, informations système | 2 |
| [⚽ Sports](#-sports) | Football, NBA, UFC/MMA, WWE, résultats | 1 |
| [📊 Stats](#-statistiques) | Statistiques d'utilisation, uptime, RAM | 1 |
| [🔧 Tools](#-outils) | Calculatrice, capture web, QR code, URL courte | 2 |

---

## 🤖 IA / Intelligence Artificielle

### `.aitranslate` — Traduction IA

| Champ | Détail |
|-------|--------|
| **Commande** | `.aitranslate` |
| **Aliases** | `.translate`, `.trad`, `.traduire`, `.tr` |
| **Catégorie** | AI |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Traduit un texte dans la langue cible en utilisant le moteur LLM (Groq/Gemini). Supporte plus de 100 langues. Si aucun texte n'est fourni et qu'un message est cité, traduit le message cité. |
| **Syntaxe** | `.aitranslate <texte> <langue>` |

**Exemples :**
```
.aitranslate Bonjour comment ça va ? english
.translate Hello, how are you? français
.trad Buenos días amigo español
```

---

### `.ask` — Chat IA Conversationnel

| Champ | Détail |
|-------|--------|
| **Commande** | `.ask` |
| **Aliases** | `.ai`, `.gpt`, `.chat`, `.assistant`, `.abel`, `.gemini`, `.groq`, `.llm`, `.query`, `.question`, `.respond`, `.reply` |
| **Catégorie** | AI |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Pose une question ou engage une conversation avec l'IA (Groq LLM — modèle LLaMA 70B). L'IA répond de manière naturelle et conversationnelle. Si un message est cité, il est inclus comme contexte. |
| **Syntaxe** | `.ask <votre question ou message>` |

**Exemples :**
```
.ask Explique-moi comment fonctionne la photosynthèse
.ai Donne-moi une recette de tiramisu
.chat Qui est Albert Einstein ?
.gemini Écris un poème sur la mer
```

---

### `.groupsummary` — Résumé de Groupe IA

| Champ | Détail |
|-------|--------|
| **Commande** | `.groupsummary` |
| **Aliases** | `.groupdigest`, `.resumegroupe`, `.resumeconvo`, `.digest`, `.summarize`, `.tldr`, `.summary`, `.catchup`, `.missed`, `.groupreport` |
| **Catégorie** | AI |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 10s |
| **Description** | Génère un résumé intelligent des **vrais messages échangés** dans le groupe ou le chat depuis que le bot est en ligne. L'IA extrait les sujets principaux, les décisions prises, les tâches et les questions ouvertes. Si aucun historique n'est disponible, indique honnêtement que le bot n'a pas encore capté d'échanges. Si un message est cité avec `.groupsummary`, résume ce message spécifique. |
| **Syntaxe** | `.groupsummary` (dans un groupe) ou `.summary` (en DM) |

**Exemples :**
```
.groupsummary
.tldr
.digest
[Citer un long message] → .summary
```

> ⚠️ **Note :** Le buffer d'historique est en mémoire. Il se réinitialise au redémarrage du bot. Activez le bot avant les discussions importantes.

---

### `.summarize` — Résumé de Texte IA

| Champ | Détail |
|-------|--------|
| **Commande** | `.summarize` |
| **Aliases** | `.sum`, `.recap`, `.abstract`, `.brief`, `.condense`, `.shorten` |
| **Catégorie** | AI |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Résume un long texte fourni en argument ou un message cité. L'IA produit un résumé concis et structuré en français avec les points clés. |
| **Syntaxe** | `.summarize <texte long>` ou [citer un message] `.summarize` |

**Exemples :**
```
.summarize [Long texte d'article...]
.sum [Citer un message long]
.recap Ce texte très long que je veux résumer rapidement...
```

---

## 🎵 Audio

### `.tomp3` — Conversion Audio

| Champ | Détail |
|-------|--------|
| **Commande** | `.tomp3` |
| **Aliases** | `.audio`, `.mp3`, `.convert`, `.voice`, `.voicenote`, `.ptt` |
| **Catégorie** | Audio |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Convertit une vidéo ou un fichier média envoyé en message audio MP3 ou PTT (Push To Talk / message vocal). |
| **Syntaxe** | [Envoyer/Citer une vidéo] + `.tomp3` |

---

### `.spotify` — Recherche Spotify

| Champ | Détail |
|-------|--------|
| **Commande** | `.spotify` |
| **Aliases** | `.music`, `.song`, `.lyrics`, `.musique`, `.chanson`, `.paroles`, `.shazam` |
| **Catégorie** | Audio |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Recherche une chanson sur Spotify et retourne les informations (titre, artiste, album, durée, popularité). Affiche aussi les paroles si disponibles. |
| **Syntaxe** | `.spotify <nom de la chanson> [artiste]` |

**Exemples :**
```
.spotify Bohemian Rhapsody Queen
.lyrics Shape of You Ed Sheeran
.chanson Dernière Danse Indila
```

---

## ⚙️ Automation / Auto-Reply

### `.autoreply` — Moteur Auto-Reply IA

| Champ | Détail |
|-------|--------|
| **Commande** | `.autoreply` |
| **Aliases** | `.setautoreply`, `.autoresponse` |
| **Catégorie** | Automation |
| **Permissions** | Owner uniquement |
| **Cooldown** | 2s |
| **Description** | Moteur complet de réponse automatique avec IA. Répond naturellement à vos contacts quand vous êtes occupé, avec délai humain simulé, gestion des urgences, cooldown, horaires, mots-clés et règles par contact. |

**Sous-commandes complètes :**

| Sous-commande | Description | Exemple |
|---------------|-------------|---------|
| `.autoreply on` | Active l'auto-reply | `.autoreply on` |
| `.autoreply off` | Désactive l'auto-reply | `.autoreply off` |
| `.autoreply status` | Tableau de bord complet | `.autoreply status` |
| `.autoreply stats` | Statistiques d'utilisation | `.autoreply stats` |
| `.autoreply ai on/off` | Active/désactive le moteur IA | `.autoreply ai on` |
| `.autoreply context on/off` | Active/désactive le contexte de conversation | `.autoreply context on` |
| `.autoreply tone <ton>` | Définit la personnalité IA | `.autoreply tone casual` |
| `.autoreply set <message>` | Définit le message par défaut | `.autoreply set Bonjour {firstName} !` |
| `.autoreply reset` | Réinitialise le message par défaut | `.autoreply reset` |
| `.autoreply add @contact <msg>` | Réponse personnalisée par contact | `.autoreply add @228xx Salut ! Je te rappelle` |
| `.autoreply remove @contact` | Supprime la règle contact | `.autoreply remove @228xx` |
| `.autoreply list` | Liste les règles par contact | `.autoreply list` |
| `.autoreply keyword add <mot> <msg>` | Ajoute un mot-clé déclencheur | `.autoreply keyword add urgent Appelle le 112` |
| `.autoreply keyword remove <mot>` | Supprime un mot-clé | `.autoreply keyword remove urgent` |
| `.autoreply keyword list` | Liste les mots-clés | `.autoreply keyword list` |
| `.autoreply whitelist add @contact` | Ajoute à la liste blanche | `.autoreply whitelist add @228xx` |
| `.autoreply whitelist remove @contact` | Retire de la liste blanche | `.autoreply whitelist remove @228xx` |
| `.autoreply blacklist add @contact` | Ajoute à la liste noire (jamais répondu) | `.autoreply blacklist add @228xx` |
| `.autoreply blacklist remove @contact` | Retire de la liste noire | `.autoreply blacklist remove @228xx` |
| `.autoreply mode <mode>` | Définit le mode (all/private/groups/whitelist) | `.autoreply mode private` |
| `.autoreply cooldown <durée>` | Définit le cooldown entre deux réponses | `.autoreply cooldown 30m` |
| `.autoreply delay <min-max>` | Délai de simulation de frappe humaine | `.autoreply delay 5-15` |
| `.autoreply delay off` | Désactive la simulation de frappe | `.autoreply delay off` |
| `.autoreply wait <durée>` | Délai d'attente avant réponse auto (15m par défaut) | `.autoreply wait 15m` |
| `.autoreply ownerremind <durée>` | Délai notification propriétaire après réponse auto (2h par défaut) | `.autoreply ownerremind 2h` |
| `.autoreply schedule <hh:mm-hh:mm>` | Définit les horaires d'activation | `.autoreply schedule 18:00-08:00` |
| `.autoreply schedule off` | Désactive les horaires (24h/24) | `.autoreply schedule off` |
| `.autoreply until <hh:mm>` | Active jusqu'à une heure précise | `.autoreply until 22:00` |
| `.autoreply for <durée>` | Active pour une durée limitée | `.autoreply for 2h` |
| `.autoreply groups on/off` | Active/désactive dans les groupes | `.autoreply groups off` |

**Tons IA disponibles :**
- `casual` — Décontracté, naturel (défaut)
- `friendly` — Chaleureux et amical
- `formal` — Formel et professionnel
- `professional` — Professionnel et concis
- `short` — Très court et direct

**Variables de personnalisation dans les messages :**
- `{firstName}` — Prénom du contact
- `{fullName}` — Nom complet
- `{phone}` — Numéro de téléphone

---

### `.followup` — Suivi de Contact

| Champ | Détail |
|-------|--------|
| **Commande** | `.followup` |
| **Catégorie** | Automation |
| **Permissions** | Owner uniquement |
| **Cooldown** | 2s |
| **Description** | Programme un rappel pour penser à recontacter une personne après un délai défini. Le bot vous alertera automatiquement quand le délai est écoulé. |
| **Syntaxe** | `.followup @contact <durée>` |

**Exemples :**
```
.followup @228xxxxxxxx 2d    (rappel dans 2 jours)
.followup @David 3h          (rappel dans 3 heures)
.followup @Client 30m        (rappel dans 30 minutes)
```

---

### `.remind` — Rappel Personnel

| Champ | Détail |
|-------|--------|
| **Commande** | `.remind` |
| **Catégorie** | Automation |
| **Permissions** | Owner uniquement |
| **Cooldown** | 2s |
| **Description** | Programme un rappel personnel avec un texte libre. Le bot vous alertera dans les logs quand le délai est écoulé. Unités : m (minutes), h (heures), d (jours). |
| **Syntaxe** | `.remind <texte du rappel> <durée>` |

**Exemples :**
```
.remind Appeler le médecin 2h
.remind Envoyer le devis au client 30m
.remind Réunion Zoom demain 1d
```

---

### `.setautoreply` — Définir Message par Défaut (Alias Direct)

| Champ | Détail |
|-------|--------|
| **Commande** | `.setautoreply` |
| **Catégorie** | Automation |
| **Permissions** | Owner uniquement |
| **Description** | Alias direct pour définir le message par défaut de l'auto-reply. Équivalent à `.autoreply set <message>`. |
| **Syntaxe** | `.setautoreply <votre message>` |

---

## 👥 Contacts

### `.contacts` — Gestion des Contacts

| Champ | Détail |
|-------|--------|
| **Commande** | `.contacts` |
| **Aliases** | `.addcontact`, `.delcontact`, `.listcontacts`, `.vcf`, `.vcard`, `.contactcard`, `.getcontact`, `.searchcontact`, `.importcontacts`, `.exportcontacts`, `.contactinfo`, `.whois`, `.lookup` |
| **Catégorie** | Contacts |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Gestion complète des contacts WhatsApp. Permet d'obtenir une fiche contact (VCard), rechercher un contact par numéro, exporter des contacts au format VCF, et consulter les informations d'un numéro. |
| **Syntaxe** | `.contacts <sous-commande> [arguments]` |

**Exemples :**
```
.vcard @228xxxxxxxx           (générer une fiche VCard)
.whois @228xxxxxxxx           (informations sur ce numéro)
.contactinfo 228xxxxxxxx      (lookup d'un numéro)
```

---

## 🛠️ Developer

### `.dev` — Outils Développeur

| Champ | Détail |
|-------|--------|
| **Commande** | `.dev` |
| **Aliases** | `.debug`, `.logs`, `.health`, `.restart`, `.reboot`, `.status`, `.ping2`, `.uptime2`, `.memory`, `.gc`, `.cleardb`, `.reload`, `.update`, `.version`, `.changelog`, `.test`, `.echo`, `.eval`, `.exec`, `.shell` |
| **Catégorie** | Developer |
| **Permissions** | Owner uniquement |
| **Cooldown** | 3s |
| **Description** | Suite d'outils de développement et de débogage pour le bot. Accès aux logs, santé du système, informations mémoire, redémarrage, évaluation de code, et gestion du cache. |

**Sous-commandes :**

| Sous-commande | Description |
|---------------|-------------|
| `.health` | État général du système Node.js |
| `.memory` | Utilisation mémoire RAM |
| `.uptime2` | Temps de fonctionnement du bot |
| `.version` | Version actuelle du bot |
| `.eval <code>` | ⚠️ Évalue du code JavaScript (Owner only) |
| `.echo <texte>` | Renvoie le texte (test d'écho) |

---

## 📥 Download

### `.ytmp4` — Téléchargement de Vidéos

| Champ | Détail |
|-------|--------|
| **Commande** | `.ytmp4` |
| **Aliases** | `.ytmp3`, `.yt`, `.youtube`, `.tiktok`, `.ttdl`, `.instagram`, `.igdl`, `.fb`, `.fbdl`, `.twitter`, `.twdl`, `.pinterest`, `.mediafire`, `.gdrive`, `.googledrive`, `.dl`, `.download`, `.media` |
| **Catégorie** | Download |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 10s |
| **Description** | Télécharge des vidéos ou de la musique depuis YouTube (MP4/MP3), TikTok, Instagram, Facebook, Twitter/X, Pinterest et d'autres plateformes. Retourne le fichier directement sur WhatsApp. |
| **Syntaxe** | `.ytmp4 <url>` ou `.ytmp3 <url>` |

**Exemples :**
```
.ytmp4 https://youtube.com/watch?v=xxxxx
.ytmp3 https://youtube.com/watch?v=xxxxx
.tiktok https://vm.tiktok.com/xxxxx
.instagram https://www.instagram.com/p/xxxxx
```

> ⚠️ **Note :** Les téléchargements dépendent de la disponibilité des services tiers.

---

## 📁 Fichiers

### `.upload` — Gestion de Fichiers

| Champ | Détail |
|-------|--------|
| **Commande** | `.upload` |
| **Aliases** | `.file`, `.sendfile`, `.getfile`, `.savefile`, `.listfiles`, `.deletefile`, `.rename`, `.move`, `.copy`, `.zip`, `.unzip`, `.pdf`, `.doc`, `.note`, `.notes`, `.savenote`, `.listnotes`, `.deletenote` |
| **Catégorie** | Files |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Gestion de fichiers et notes. Permet de sauvegarder des notes texte, envoyer et recevoir des fichiers, compresser des dossiers, et accéder aux documents stockés. |
| **Syntaxe** | `.note <texte>` ou `.listnotes` |

**Exemples :**
```
.note Penser à rappeler Pierre demain matin
.listnotes
.deletenote 1
```

---

## 🎭 Fun

### `.fun` — Divertissement

| Champ | Détail |
|-------|--------|
| **Commande** | `.fun` |
| **Aliases** | `.joke`, `.blague`, `.meme`, `.dare`, `.truth`, `.riddle`, `.devinette`, `.fact`, `.funfact`, `.quote`, `.citation`, `.horoscope`, `.astro`, `.8ball`, `.boule8`, `.would`, `.wyr`, `.neverhave`, `.ahm`, `.rps`, `.chinchirorin`, `.shipper`, `.prank`, `.dare2`, `.spin`, `.roll`, `.coinflip`, `.dice`, `.lotto` |
| **Catégorie** | Fun |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Large collection de jeux et divertissements : blagues, mèmes, devinettes, faits insolites, citations, horoscope, boule magique 8, pile ou face, dés, et jeux de groupe. |
| **Syntaxe** | `.joke` ou `.horoscope <signe>` ou `.8ball <question>` |

**Exemples :**
```
.joke                          (blague aléatoire)
.fact                          (fait insolite)
.horoscope Bélier              (horoscope du jour)
.8ball Est-ce que je vais réussir ?
.coinflip                      (pile ou face)
.dice                          (lancé de dés)
.quote                         (citation inspirante)
```

---

## 🏠 Général

### `.help` — Menu d'Aide Principal

| Champ | Détail |
|-------|--------|
| **Commande** | `.help` |
| **Aliases** | `.menu`, `.aide`, `.commands`, `.cmds`, `.list`, `.h`, `.?` |
| **Catégorie** | General |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Affiche le menu principal du bot avec toutes les catégories disponibles, le nombre de commandes et l'état en temps réel du moteur Auto-Reply IA. |
| **Syntaxe** | `.help` ou `.help <commande>` pour l'aide détaillée sur une commande |

**Exemples :**
```
.help
.menu
.help autoreply
.help groupsummary
```

---

### `.ping` — Test de Connexion

| Champ | Détail |
|-------|--------|
| **Commande** | `.ping` |
| **Aliases** | `.speed`, `.test`, `.pong`, `.latence`, `.latency`, `.alive`, `.bot` |
| **Catégorie** | General |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Teste la connexion et mesure le temps de réponse du bot (latence en millisecondes). Affiche également l'uptime et l'état général du système. |
| **Syntaxe** | `.ping` |

---

### `.owner` — Carte du Propriétaire

| Champ | Détail |
|-------|--------|
| **Commande** | `.owner` |
| **Aliases** | `.creator`, `.admin`, `.contact`, `.contactowner`, `.reportbug`, `.support`, `.about2` |
| **Catégorie** | General |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Affiche les informations de contact du propriétaire du bot (Abel). Permet de contacter le développeur pour du support ou signaler un bug. |
| **Syntaxe** | `.owner` |

---

### `.about` — Informations Système

| Champ | Détail |
|-------|--------|
| **Commande** | `.about` |
| **Aliases** | `.systeminfo`, `.botinfo`, `.info`, `.system`, `.sysinfo` |
| **Catégorie** | Settings |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Affiche les informations techniques du bot : version, uptime, RAM utilisée, nombre de commandes chargées, moteur IA actif, préfixe, et mode de fonctionnement. |
| **Syntaxe** | `.about` ou `.systeminfo` |

---

## 👑 Groupes

### `.kick` — Gestion des Membres

| Champ | Détail |
|-------|--------|
| **Commande** | `.kick` |
| **Aliases** | `.add`, `.promote`, `.demote`, `.mute`, `.unmute`, `.ban`, `.unban`, `.warn`, `.resetwarn`, `.warnings`, `.kickall`, `.addadmin`, `.removeadmin`, `.grouplink`, `.revoke`, `.groupname`, `.groupdesc`, `.grouppic`, `.groupinfo`, `.members`, `.tagall`, `.mentionall`, `.hidetag`, `.broadcast`, `.poll`, `.event`, `.invite`, `.joinchat` |
| **Catégorie** | Group |
| **Permissions** | Admin de groupe ou Owner |
| **Cooldown** | 3s |
| **Description** | Administration complète d'un groupe WhatsApp. Expulser/ajouter des membres, promouvoir/rétrograder des admins, mettre en sourdine, gérer les avertissements (kick auto après 3 warns), modifier le nom/description/photo du groupe, générer le lien d'invitation, mentionner tous les membres, et créer des sondages. |
| **Syntaxe** | `.kick @contact` ou `.add 228xxxxxxxx` ou `.warn @contact` |

**Exemples :**
```
.kick @contact_indésirable
.add 228xxxxxxxx
.promote @contact_fiable
.demote @ex-admin
.warn @membre          (avertissement, 3x = kick auto)
.warnings @membre      (voir les avertissements)
.tagall                (mentionner tous les membres)
.grouplink             (obtenir le lien du groupe)
.groupname Mon Groupe  (renommer le groupe)
.poll "Sujet?" Oui Non (créer un sondage)
```

---

### `.antilink` — Sécurité Groupe & Gestion des Bots

| Champ | Détail |
|-------|--------|
| **Commande** | `.antilink` |
| **Aliases** | `.detectbots`, `.pausebot`, `.neutralizebot`, `.activatebot`, `.unpausebot`, `.listedbots`, `.botstatus`, `.antispam`, `.antibot`, `.antinsfw`, `.nsfw`, `.antiflood`, `.captcha`, `.setcaptcha`, `.antitoxic`, `.antivirus`, `.antiscam`, `.protect`, `.filter`, `.wordfilter`, `.badwords`, `.addword`, `.removeword`, `.listwords`, `.setlanguage`, `.setgreet`, `.setbye`, `.greet`, `.bye`, `.setrules`, `.rules` |
| **Catégorie** | Group |
| **Permissions** | Owner, Sudo ou Admin de groupe |
| **Cooldown** | 3s |
| **Description** | Protection automatique du groupe et neutralisation des bots concurrents : détection automatique intelligente (préfixes, pushName absent, rythme mécanique, JID LID), mise en pause silencieuse des bots indésirables, réactivation à la demande, blocage des liens, et filtrage anti-spam. |
| **Syntaxe** | `.detectbots` ou `.pausebot @bot` ou `.activatebot @bot` |

**Commandes Anti-Bot Dédiées :**
- `.detectbots` / `.botstatus` — Scanne l'historique du groupe et affiche la liste des bots détectés
- `.pausebot @bot` / `.neutralizebot @bot` — Met en pause et neutralise le bot (toutes ses interactions sont coupées)
- `.activatebot @bot` / `.unpausebot @bot` — Réactive un bot précédemment neutralisé

**Exemples :**
```
.detectbots                       (scanner les bots du groupe)
.pausebot @228xxxxxxxx            (mettre un bot en pause)
.activatebot @228xxxxxxxx         (réactiver le bot)
.antilink on                      (bloquer tous les liens)
.antispam on                      (limiter les messages trop rapides)
.setgreet Bienvenue {name} !     (message de bienvenue)
.setbye Au revoir {name} !        (message de départ)
.setrules 1. Respectez-vous...    (règlement du groupe)
.rules                            (afficher le règlement)
```

---

### `.groupmanage` — Gestion Avancée de Groupe

| Champ | Détail |
|-------|--------|
| **Commande** | `.groupmanage` |
| **Aliases** | `.lock`, `.unlock`, `.open`, `.close`, `.lockgroup`, `.unlockgroup`, `.restrict`, `.unrestrict` |
| **Catégorie** | Group |
| **Permissions** | Admin de groupe ou Owner |
| **Cooldown** | 3s |
| **Description** | Verrouillage/déverrouillage du groupe (seuls les admins peuvent envoyer des messages), et gestion des restrictions des membres. |
| **Syntaxe** | `.lock` ou `.unlock` |

---

### `.purge` — Purge et Nettoyage de Messages

| Champ | Détail |
|-------|--------|
| **Commande** | `.purge` |
| **Aliases** | `.del`, `.delete`, `.dlt`, `.supprimer`, `.clear`, `.clearchat`, `.clearhistory`, `.purgeme`, `.purgebot` |
| **Catégorie** | Group |
| **Permissions** | Admin de groupe ou Owner |
| **Cooldown** | 5s |
| **Description** | Suppression en masse de messages récents, suppression d'un message cité, purge ciblée d'un membre ou du bot, et vidage de l'historique en mémoire. |
| **Syntaxe** | `.purge [nombre]` ou `.del` (en répondant à un message) ou `.purge @contact [nombre]` |

**Exemples :**
```
.purge 20                     (supprimer les 20 derniers messages du chat)
.del                          (supprimer le message cité)
.purge                        (en répondant à un message : supprime depuis ce message jusqu'à maintenant)
.purge @contact 15            (supprimer les 15 derniers messages de ce contact)
.purgeme                      (supprimer les messages récents du bot)
.clearchat                    (effacer la mémoire/historique du chat)
```

---

## 🖼️ Media

### `.sticker` — Stickers, GIF & Conversions Vidéo

| Champ | Détail |
|-------|--------|
| **Commande** | `.sticker` |
| **Aliases** | `.s`, `.stiker`, `.autosticker`, `.towebp`, `.stickergif`, `.togif`, `.gif`, `.toimage`, `.tovideo`, `.tomp4`, `.mp4`, `.webp2mp4`, `.toaudio`, `.tomp3`, `.videodoc` |
| **Catégorie** | Media |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Suite de conversion et manipulation multimédia complète : Image/Vidéo ⇄ Sticker WhatsApp, Sticker animé ou Vidéo ⇄ GIF animé, Sticker ⇄ Image JPG, Sticker/GIF ⇄ Vidéo MP4, et extraction Audio MP3. |
| **Syntaxe** | `.sticker` ou `.togif` ou `.tovideo` ou `.toimage` en répondant au média |

**Sous-commandes & Usages :**

| Commande | Action | Utilisation |
|---|---|---|
| `.sticker` / `.s` | Convertit une image ou vidéo courte en sticker WhatsApp | Envoyer image + `.sticker` ou citer une image |
| `.togif` / `.gif` | Convertit un sticker animé ou une vidéo en **GIF animé** | Citer un sticker animé/vidéo avec `.togif` |
| `.tovideo` / `.tomp4` | Convertit un sticker animé ou GIF en **vidéo MP4** | Citer un sticker/GIF avec `.tovideo` |
| `.toimage` | Convertit un sticker en **image JPG standard** | Citer un sticker avec `.toimage` |
| `.tomp3` / `.toaudio` | Extrait la piste audio d'une vidéo en **MP3** | Citer une vidéo avec `.tomp3` |
| `.videodoc` | Renvoie la vidéo sous forme de document non compressé | Citer une vidéo avec `.videodoc` |

**Exemples :**
```
[Envoyer une image] + .sticker     (créer un sticker)
[Citer un sticker animé] .togif    (sticker animé → GIF)
[Citer un sticker animé] .tovideo  (sticker animé → Vidéo MP4)
[Citer un sticker] .toimage        (sticker → Image JPG)
[Citer une vidéo] .tomp3           (vidéo → Audio MP3)
```

---

## 🔐 Owner / Administration

### `.mode` — Contrôle du Mode et des Permissions

| Champ | Détail |
|-------|--------|
| **Commande** | `.mode` |
| **Aliases** | `.public`, `.private`, `.maintenance`, `.blacklist`, `.unblacklist`, `.whitelist`, `.unwhitelist`, `.addsudo`, `.delsudo`, `.listsudo`, `.grant`, `.revoke`, `.grants`, `.permissions`, `.block`, `.unblock`, `.listblocked`, `.setlimit`, `.resetlimit` |
| **Catégorie** | Owner |
| **Permissions** | Owner uniquement |
| **Cooldown** | 2s |
| **Description** | Contrôle total du mode de fonctionnement du bot (Public/Privé/Maintenance), gestion des permissions granulaires par contact, gestion des administrateurs Sudo, liste noire/blanche, et limitation de taux. Chaque action de permission envoie une notification WhatsApp directe au contact concerné. |

**Sous-commandes :**

| Commande | Description | Exemple |
|----------|-------------|---------|
| `.public` | Passe le bot en mode PUBLIC (tous peuvent l'utiliser) | `.public` |
| `.private` | Passe le bot en mode PRIVÉ (liste blanche seulement) | `.private` |
| `.maintenance` | Mode MAINTENANCE (owner et sudo seulement) | `.maintenance` |
| `.grant @contact <commande>` | Donne accès à une commande + notification DM | `.grant @228xx autoreply` |
| `.revoke @contact <commande>` | Retire un accès + notification DM | `.revoke @228xx autoreply` |
| `.grants` | Liste tous les droits accordés | `.grants` |
| `.permissions` | Alias de `.grants` | `.permissions` |
| `.addsudo @contact` | Nomme un admin Sudo (plein accès) + notification DM | `.addsudo @228xx` |
| `.delsudo @contact` | Retire les droits Sudo | `.delsudo @228xx` |
| `.listsudo` | Liste tous les Sudo users | `.listsudo` |
| `.blacklist @contact` | Bloque un contact (refuse tout accès au bot) | `.blacklist @228xx` |
| `.unblacklist @contact` | Débloque un contact | `.unblacklist @228xx` |
| `.block @contact` | Alias de `.blacklist` | `.block @228xx` |
| `.unblock @contact` | Alias de `.unblacklist` | `.unblock @228xx` |
| `.listblocked` | Liste tous les contacts bloqués | `.listblocked` |
| `.whitelist @contact` | Ajoute à la liste blanche (accès en mode privé) | `.whitelist @228xx` |
| `.unwhitelist @contact` | Retire de la liste blanche | `.unwhitelist @228xx` |
| `.setlimit <max> <fenêtre_s>` | Configure le rate limit global | `.setlimit 8 60` |
| `.resetlimit` | Réinitialise tous les compteurs de taux | `.resetlimit` |

**Niveaux d'accès du bot :**
- `all` — Accès complet à toutes les commandes
- `ai` — Catégorie IA uniquement
- `autoreply` — Moteur auto-reply uniquement
- `<nom_commande>` — Commande individuelle

---

### `.sessions` — Gestionnaire Multi-Sessions / Multi-Comptes WhatsApp

| Champ | Détail |
|-------|--------|
| **Commande** | `.sessions` |
| **Aliases** | `.session`, `.listsessions`, `.paircode`, `.pair`, `.addsession`, `.stopsession`, `.delsession`, `.removesession`, `.sessionstatus` |
| **Catégorie** | Owner |
| **Permissions** | Owner / Sudo |
| **Cooldown** | 3s |
| **Description** | Permet à plusieurs personnes de connecter leur propre compte WhatsApp sur le même bot. Génère des codes de jumelage à 8 chiffres pour connecter un compte sans caméra ou liste les sessions en direct avec uptime et statut. |
| **Syntaxe** | `.sessions` ou `.paircode <nom> <numéro>` ou `.stopsession <nom>` ou `.delsession <nom>` |

**Exemples :**
```
.sessions                         (afficher toutes les sessions connectées)
.paircode kevin 22890123456       (générer un code de jumelage 8 chiffres pour Kevin)
.stopsession kevin                (déconnecter temporairement la session)
.delsession kevin                 (supprimer définitivement la session)
```

| Champ | Détail |
|-------|--------|
| **Commande** | `.owneradmin` |
| **Aliases** | `.getuser`, `.listusers`, `.banuser`, `.unbanuser`, `.clearstate`, `.botconfig`, `.setprefix`, `.setname`, `.setbio`, `.setpp`, `.setstatus`, `.broadcast2`, `.clearall`, `.resetbot`, `.reloadplugins` |
| **Catégorie** | Owner |
| **Permissions** | Owner uniquement |
| **Cooldown** | 3s |
| **Description** | Outils d'administration avancés pour le propriétaire : gestion des utilisateurs, configuration du profil du bot, diffusion de messages, et rechargement des plugins. |

**Exemples :**
```
.setprefix !        (changer le préfixe en !)
.setname Abel-Bot   (renommer le bot)
.broadcast2 Annonce importante pour tous les contacts
.reloadplugins      (recharger les commandes sans redémarrer)
```

---

### `.ownermenu` — Menu Owner

| Champ | Détail |
|-------|--------|
| **Commande** | `.ownermenu` |
| **Aliases** | `.owner2`, `.ownerhelp`, `.ownerlist`, `.adminmenu`, `.adminhelp` |
| **Catégorie** | Owner |
| **Permissions** | Owner uniquement |
| **Cooldown** | 3s |
| **Description** | Affiche le menu complet des commandes réservées au propriétaire du bot avec descriptions et usage. |

---

## 🕌 Religion

### `.prayer` — Horaires de Prière et Contenu Religieux

| Champ | Détail |
|-------|--------|
| **Commande** | `.prayer` |
| **Aliases** | `.priere`, `.prayertime`, `.prayertimes`, `.fajr`, `.dhuhr`, `.asr`, `.maghrib`, `.isha`, `.quran`, `.coran`, `.hadith`, `.dua`, `.doua`, `.surah`, `.sourate`, `.verse`, `.verset`, `.verset`, `.ayat`, `.islam`, `.bible`, `.christianity`, `.chretien`, `.psalms`, `.psaume` |
| **Catégorie** | Religion |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Contenu religieux : horaires de prière islamiques par ville, versets coraniques, hadiths, sourates, douaas, versets bibliques et psaumes. Couvre l'Islam et le Christianisme. |
| **Syntaxe** | `.prayertime <ville>` ou `.quran <numéro de sourate>:<verset>` |

**Exemples :**
```
.prayertime Paris              (horaires du jour à Paris)
.prayertime Dakar              (horaires à Dakar)
.quran 1:1                     (Al-Fatiha, verset 1)
.hadith                        (hadith aléatoire)
.dua protection                (doua de protection)
.bible John 3:16               (Jean 3:16)
.psaume 23                     (Psaume 23)
```

---

## 🔍 Recherche

### `.search` — Recherche Web et Informations

| Champ | Détail |
|-------|--------|
| **Commande** | `.search` |
| **Aliases** | `.google`, `.web`, `.wiki`, `.wikipedia`, `.news`, `.actualites`, `.meteo`, `.weather`, `.forecast`, `.map`, `.maps`, `.image`, `.imagesearch`, `.translate2`, `.currency`, `.convert2`, `.define`, `.definition`, `.dictionary`, `.thesaurus`, `.synonyme`, `.antonym`, `.urban`, `.urbandict`, `.etymology` |
| **Catégorie** | Search |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Moteur de recherche multi-sources : Google, Wikipedia, actualités, météo, conversion de devises, définitions, dictionnaire, Urban Dictionary. Retourne les résultats directement sur WhatsApp. |
| **Syntaxe** | `.search <requête>` ou `.meteo <ville>` ou `.wiki <sujet>` |

**Exemples :**
```
.google Tour Eiffel
.wiki Intelligence Artificielle
.meteo Paris
.weather London tomorrow
.currency 100 EUR USD          (conversion de devises)
.define serendipité            (définition)
.urban slay                    (définition Urban Dictionary)
```

---

## 🛡️ Sécurité

### `.security` — Protection Avancée

| Champ | Détail |
|-------|--------|
| **Commande** | `.security` |
| **Aliases** | `.antidelete`, `.antidelete2`, `.viewonce`, `.vv`, `.saveviewonce`, `.unsave`, `.spy`, `.spygroup`, `.log`, `.logchat`, `.loggroup`, `.report`, `.reportuser`, `.securityinfo`, `.audit`, `.checklist` |
| **Catégorie** | Security |
| **Permissions** | Owner uniquement |
| **Cooldown** | 5s |
| **Description** | Outils de sécurité avancés : anti-suppression de messages (intercepte les messages avant suppression), accès aux messages "View Once", logs de conversations, rapport sur un utilisateur, et audit de sécurité du bot. |
| **Syntaxe** | `.antidelete on/off` ou `.vv` [citer un message view once] |

**Exemples :**
```
.antidelete on        (activer l'anti-suppression)
.antidelete off       (désactiver)
[Citer un view once] .vv    (voir un message éphémère)
.log on               (activer les logs)
.audit                (rapport de sécurité)
```

---

## ⚙️ Paramètres

### `.about` — Informations du Bot

| Champ | Détail |
|-------|--------|
| **Commande** | `.about` |
| **Aliases** | `.systeminfo`, `.botinfo`, `.info`, `.system`, `.sysinfo` |
| **Catégorie** | Settings |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Affiche une carte complète des informations du bot : nom, version, préfixe, mode actuel (Public/Privé/Maintenance), fuseau horaire, état de la clé API IA, et statistiques système. |

---

### `.settings` — Menu des Paramètres

| Champ | Détail |
|-------|--------|
| **Commande** | `.settings` |
| **Aliases** | `.config`, `.setup`, `.configure`, `.options`, `.preferences`, `.theme`, `.langue`, `.language`, `.timezone`, `.settz`, `.setlang`, `.settheme`, `.notifications`, `.notif` |
| **Catégorie** | Settings |
| **Permissions** | Owner uniquement |
| **Cooldown** | 3s |
| **Description** | Menu de configuration général du bot : langue, thème, fuseau horaire, notifications, et préférences de comportement. |

---

## ⚽ Sports

### `.football` — Sports & Compétitions

| Champ | Détail |
|-------|--------|
| **Commande** | `.football` |
| **Aliases** | `.soccer`, `.matches`, `.standings`, `.scorers`, `.upcoming`, `.ligue1`, `.ligue1matches`, `.ligue1standings`, `.premierleague`, `.plmatches`, `.plstandings`, `.laliga`, `.laligamatches`, `.laligastandings`, `.seriea`, `.serieamatches`, `.bundesliga`, `.ucl`, `.uclmatches`, `.europa`, `.nba`, `.nbamatches`, `.nbastandings`, `.nbapoints`, `.nba2`, `.mma`, `.ufc`, `.ufcevents`, `.ufcfighters`, `.boxing`, `.wrestlingevents`, `.wwenews`, `.wweschedule` |
| **Catégorie** | Sports |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 5s |
| **Description** | Informations sportives en temps réel sur les principales compétitions mondiales : Football (Ligue 1, Premier League, LaLiga, Serie A, Bundesliga, Champions League, Europa League), Basketball (NBA), MMA/UFC, Boxe, et WWE. Résultats, classements, meilleurs buteurs, et prochains matchs. |
| **Syntaxe** | `.matches` ou `.ligue1standings` ou `.nbamatches` |

**Exemples :**
```
.matches                   (matchs du week-end)
.ligue1standings            (classement Ligue 1)
.plmatches                  (matchs Premier League)
.nbamatches                 (matchs NBA)
.ufcevents                  (prochains événements UFC)
.wweschedule                (calendrier WWE)
```

> 💡 **Note :** Pour les données temps réel, configurez `FOOTBALL_API_KEY` dans le fichier `.env`.

---

## 📊 Statistiques

### `.stats` — Statistiques du Bot

| Champ | Détail |
|-------|--------|
| **Commande** | `.stats` |
| **Aliases** | `.msgstats`, `.topcontacts`, `.mostactive`, `.chatstats`, `.usage`, `.commandstats` |
| **Catégorie** | General |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Tableau de bord des statistiques d'utilisation du bot : uptime, nombre de plugins chargés, utilisation RAM, activité IA, et contact le plus actif. |
| **Syntaxe** | `.stats` ou `.commandstats` |

---

## 🔧 Outils

### `.calculate` — Boîte à Outils

| Champ | Détail |
|-------|--------|
| **Commande** | `.calculate` |
| **Aliases** | `.analyze`, `.browse`, `.device`, `.disk`, `.emojimix`, `.fancy`, `.forward`, `.gitclone`, `.gsmarena`, `.hostip`, `.itunes`, `.mediatag`, `.memes`, `.obfuscate`, `.open`, `.opentime`, `.quotes`, `.react`, `.readmore`, `.readreceipts`, `.recipe`, `.remini`, `.removebg`, `.reverse`, `.savestatus`, `.say`, `.sendasviewonce`, `.smeme`, `.ssweb`, `.sswebpc`, `.sswebtab`, `.statusdelay`, `.statussettings`, `.story`, `.summerbeach`, `.take`, `.telesticker`, `.tinyurl`, `.tostatus`, `.tourl`, `.toviewonce`, `.trackip`, `.userid`, `.vcc`, `.vcf2`, `.videodoc`, `.vv2`, `.wallpaper` |
| **Catégorie** | Tools |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 3s |
| **Description** | Boîte à outils polyvalente : calculatrice mathématique, capture d'écran de site web, raccourcisseur d'URL (TinyURL), informations système, générateur de mèmes, suppression de fond d'image, traçage IP, et nombreux convertisseurs. |
| **Syntaxe** | `.calculate <expression>` ou `.ssweb <url>` ou `.tinyurl <url>` |

**Exemples :**
```
.calculate 12 * 8 + 5 / 2        (calcul mathématique)
.ssweb https://google.com         (capture d'écran du site)
.tinyurl https://mon-long-lien.com (raccourcir une URL)
.device                           (infos système)
.trackip 8.8.8.8                  (localiser une IP)
.removebg                         [Citer une image] (supprimer le fond)
.say Bonjour tout le monde !      (bot dit le texte)
```

---

### `.sticker` (Media Tools) — Stickers et QR Code

| Champ | Détail |
|-------|--------|
| **Commande** | `.sticker` |
| **Aliases** | `.toimage`, `.tovideo`, `.qrcode`, `.toaudio`, `.tomp3`, `.aza`, `.robot` |
| **Catégorie** | Tools / Media |
| **Permissions** | Tous les utilisateurs |
| **Cooldown** | 4s |
| **Description** | Conversion de médias : créer des stickers WhatsApp depuis une image, convertir un sticker en image, générer un QR code depuis un texte ou une URL. |
| **Syntaxe** | [Image] `.sticker` ou `.qrcode <texte>` |

---

## 🛡️ Protections Anti-Ban WhatsApp

> **Important** — Ces mesures sont automatiques et transparentes. Elles protègent le compte WhatsApp du bot contre la détection et la suspension.

| Protection | Limite | Comportement en cas de dépassement |
|------------|--------|-------------------------------------|
| **Rate limit global** | 8 requêtes / minute / utilisateur | Message d'erreur + délai |
| **Burst limiter** | 8 commandes / minute / utilisateur | Silence total (aucune réponse) |
| **Loop/spam auto-reply** | 3 réponses auto / minute / chat | Silence total |
| **Cooldown par commande** | 5s par défaut (variable) | Message d'attente |
| **Cap par chat (auto-reply)** | 30 messages / heure / chat | Silence total |
| **Cap global journalier** | 500 messages / 24h (bot entier) | Silence total |
| **Cap auto-reply journalier** | 150 réponses auto / 24h | Silence total |
| **Echo/loop dupliquer** | Même message dans 10s | Silence total (ignore le doublon) |
| **Délai humain (auto-reply)** | 4-25s selon l'heure | Simulation de frappe humaine |
| **Cooldown entre réponses** | 30 minutes par contact (défaut) | Ignore les messages suivants |

> 💡 **Conseil :** Le bot étant en mode **silencieux** pour la plupart des dépassements (sans réponse), cela évite de générer du trafic supplémentaire qui pourrait alerter WhatsApp.

---

## 📝 Glossaire des Permissions

| Niveau | Description |
|--------|-------------|
| **Owner** | Le propriétaire du compte WhatsApp du bot. Accès total à toutes les commandes. |
| **Sudo** | Administrateur nommé par l'Owner via `.addsudo`. Presque tous les droits sauf les commandes critiques. |
| **Granted** | Utilisateur ayant reçu une permission spécifique via `.grant @contact <commande>`. |
| **Whitelisted** | Contact en liste blanche — peut utiliser le bot en mode Privé. |
| **Blacklisted** | Contact bloqué — toutes ses commandes sont ignorées. |
| **Public** | Tous les utilisateurs WhatsApp (quand le bot est en mode PUBLIC). |

---

## 🔑 Variables de Templates

Ces variables peuvent être utilisées dans les messages personnalisés (`.autoreply set`, `.setgreet`, etc.) :

| Variable | Remplacement |
|----------|-------------|
| `{firstName}` | Prénom du contact (ou son numéro si non connu) |
| `{fullName}` | Nom complet affiché WhatsApp |
| `{phone}` | Numéro de téléphone du contact |
| `{name}` | Alias de `{fullName}` |
| `{time}` | Heure actuelle (HH:MM) |
| `{date}` | Date du jour (DD/MM/YYYY) |

---

*Annuaire généré automatiquement depuis le code source d'Abel-Bot v1.0.0*  
*Dernière mise à jour : Août 2026*
