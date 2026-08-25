# 🚀 Abel-Bot — Guide de Setup Rapide

## ⚡ Démarrage Immédiat (3 minutes)

### 1. Installation des dépendances
```bash
npm install
```
**Durée estimée :** 25-40 secondes  
**Résultat attendu :** "0 vulnerabilities"

### 2. Configuration de l'environnement
Crée un fichier `.env` à la racine :
```env
# WhatsApp & Bot
OWNER_ID=your_phone_number@s.whatsapp.net
BOT_NAME=Abel-Bot
BOT_PREFIX=.

# Groq LLM (pour IA: .chat, .summarize, .translate)
GROQ_API_KEY=your_groq_api_key_here
GROQ_FALLBACK_MODEL=mixtral-8x7b-32768

# Prisma (base de données - sessions WhatsApp)
DATABASE_URL=file:./bot.db

# Express (serveur /health et /status)
EXPRESS_PORT=3000

# Logging
LOG_LEVEL=info
```

**Où obtenir les clés :**
- **GROQ_API_KEY** : https://console.groq.com/keys
- **OWNER_ID** : Ton numéro WhatsApp au format international (ex: `33612345678@s.whatsapp.net`)

### 3. Initialiser la base de données
```bash
npx prisma migrate dev --name init
```

### 4. Démarrer le bot
```bash
npm run dev
```

**Tu devrais voir :**
```
🚀 Starting Abel-Bot WhatsApp Personal Assistant Framework (Multi-Session)...
```

Puis un QR code s'affichera → Scanne-le avec ton téléphone WhatsApp.

---

## 📋 Commandes Disponibles (17 au total)

### 🤖 AI & Résumé
| Commande | Alias | Fonction |
|----------|-------|----------|
| `.chat` | `.ai` | Chat avec IA Groq |
| `.summarize` | `.summary` | Résumé simple de texte |
| `.groupsummary` | (none) | Résumé intelligent de groupe |
| `.translate` | `.rewrite`, `.correct`, `.reply` | Traduction, réécriture, adaptation de ton |

### 📥 Téléchargement
| Commande | Alias | Supporte |
|----------|-------|----------|
| `.download` | `.tiktok`, `.yt`, `.fb`, `.ig`, etc. | TikTok, YouTube, Instagram, Facebook, Twitter, CapCut, MediaFire, Pinterest, APK, YTS |

### 🔄 Auto-Réponse
| Commande | Fonction |
|----------|----------|
| `.autoreply` | Configure les réponses automatiques |

### 👥 Gestion de Groupe
| Commande | Alias | Fonction |
|----------|-------|----------|
| `.kick` | `.add`, `.promote`, `.demote`, `.hidetag`, `.tagall`, `.mute`, `.warn` | Modération |
| `.groupinfo` | (none) | Infos du groupe |
| `.antilink` | (none) | Sécurité (anti-bot, anti-link) |
| `.purge` | `.del`, `.clear`, `.clearchat` | Supprimer messages en masse |

### 👤 Admin Bot
| Commande | Alias | Fonction |
|----------|-------|----------|
| `.mode` | (none) | Public/Privé/Maintenance |
| `.restart` | (none) | Redémarrer le bot |
| `.broadcast` | (none) | Envoyer un msg à tous les chats |
| `.block` / `.unblock` | (none) | Bloquer/débloquer un utilisateur |
| `.addsudo` / `.delsudo` | (none) | Ajouter/retirer co-admin |
| `.announcements` | (none) | Menu owner |
| `.sessions` | (none) | Gérer les multi-sessions |

### ℹ️ Général
| Commande | Alias | Fonction |
|----------|-------|----------|
| `.ping` | `.alive`, `.uptime` | Vérifier que le bot répond |
| `.help` | (none) | Lister les commandes |
| `.owner` | `.botinfo`, `.time` | Infos du bot et heure |

---

## ⚙️ Configuration Avancée

### Multi-Session (feature clef)

**Connecter un 2e compte WhatsApp :**

```
.sessions
```

Tu recevras un **code de jumelage 8 chiffres** → Entre-le dans WhatsApp pour connecter le compte.

Après ça, **toutes les commandes fonctionnent sur tous les comptes connectés** :
- `.download` sur les 2 numéros
- `.chat` en multi-session
- `.autoreply` spécifique par numéro

### Auto-Réponse Intelligent

```
.autoreply on "Je suis indisponible, je reviens demain"
```

Ou version **IA** (adapte la réponse au contexte) :
```
.autoreply on --ai
```

### Mode Privé (sécurité)

```
.mode private
```

Seul toi peux utiliser le bot. Les autres reçoivent :
```
"🔒 Bot en mode privé. Accès réservé au propriétaire."
```

---

## 🐛 Troubleshooting

### "Cannot find module 'pino'"
**Solution :** `npm install` n'a probablement pas fini.
```bash
npm install
npm run build
npm run dev
```

### "GROQ_API_KEY is undefined"
**Solution :** Ajoute ta clé Groq dans `.env`.
```bash
echo "GROQ_API_KEY=your_key" >> .env
npm run dev
```

### "PluginManager: Registered plugin: .download (Download) — but command doesn't work"
**Solution :** Vérifie que tu importes bien le nouveau `media-downloader.ts` (avec les fixes Facebook).
- Supprime `node_modules/.cache/` si tu en as un
- Relance `npm run dev`

### Bot disconnect en permanence
**Solution :** 
1. Supprime `node_modules/` et `package-lock.json`
2. `npm install`
3. Supprime le dossier `./.auth_info` (reco avec QR)
4. `npm run dev`

### "Port 3000 already in use"
**Solution :** 
```bash
# Change le port dans .env
EXPRESS_PORT=3001

# Ou tue le process
# Windows: taskkill /PID xxxxx /F
# Linux: kill -9 xxxxx
```

---

## 📊 Monitoring

### Logs en temps réel
```bash
npm run dev
```

### Vérifier l'état du bot
**Endpoint HTTP :**
```bash
curl http://localhost:3000/health
# Output: { status: "online", uptime: 12345, sessions: 1 }
```

### Vérifier les commandes chargées
Envoie `.help` sur WhatsApp → Affiche toutes les 17 commandes.

---

## 🔐 Sécurité

### ✅ Best Practices
- Garde `.env` **privé** (pas dans Git)
- Utilise `OWNER_ID` pour limiter aux admins
- Teste `.mode private` pour vérifier l'isolation
- Surveille les logs pour les `ERROR:` en rouge

### ⚠️ Risques Minimisés
- ✅ 0 vulnérabilités npm
- ✅ TypeScript strict mode
- ✅ Validation des inputs
- ✅ Rate limiting par utilisateur (auto-réponse)

---

## 🚀 Production

### Build pour déployer
```bash
npm run build
npm start
```

**Déployer sur Render / Railway / Heroku :**

1. Push sur GitHub
2. Connecte le repo à Render/Railway
3. Ajoute les env vars :
   ```
   GROQ_API_KEY=...
   OWNER_ID=...
   DATABASE_URL=...
   ```
4. Déploie

### Logs en production
```bash
npm run dev 2>&1 | tee bot.log
```

---

## 📞 Support Rapide

**Si un problème :**
1. Regarde les logs → `ERROR:` ou `WARN:`
2. Cherche le message d'erreur dans ce guide
3. Relance : `npm install && npm run build && npm run dev`

---

## ✨ Prochaines Étapes

- [ ] Teste `.ping` pour vérifier le bot
- [ ] Teste `.download https://www.tiktok.com/video/xyz` 
- [ ] Configure `.autoreply` pour tes absences
- [ ] Connecte un 2e compte avec `.sessions`
- [ ] Mets le bot en mode privé avec `.mode private`

**Bienvenue dans Abel-Bot v2.0 optimisé !** 🎉

