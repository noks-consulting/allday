# NOK'S Consulting — Preview Server

Serveur de partage sécurisé de prototypes. Chaque client reçoit un lien unique à durée limitée.

---

## Installation

```bash
cd ~/Desktop/noks-preview
npm install
```

---

## Lancer le serveur

```bash
node server.js
```

Le serveur tourne sur **http://localhost:3000**

---

## Créer un lien client

```bash
# Valable 30 jours (défaut)
node manage.js create "Société Dupont" 30

# Valable 7 jours
node manage.js create "Cabinet Martin" 7
```

→ Un lien est généré, à envoyer directement au client par email.

---

## Gérer les accès

```bash
node manage.js list              # Voir tous les clients
node manage.js revoke <token>    # Bloquer un accès immédiatement
node manage.js extend <token> 15 # Prolonger de 15 jours
```

---

## Partage en dehors du réseau local (ngrok)

Pour partager sans déployer sur un serveur :

```bash
# Terminal 1 — lancer le serveur
node server.js

# Terminal 2 — exposer avec ngrok
npx ngrok http 3000
```

ngrok donne une URL publique type `https://abc123.ngrok.io`.
Définir la variable d'environnement pour que les liens générés soient corrects :

```bash
BASE_URL=https://abc123.ngrok.io node manage.js create "Société Dupont" 30
```

---

## Déploiement permanent (Railway)

1. Créer un dépôt GitHub avec ce dossier
2. Sur [railway.app](https://railway.app) → "New Project" → "Deploy from GitHub"
3. Ajouter la variable d'environnement : `BASE_URL=https://votre-app.railway.app`
4. Lancer `node manage.js create ...` en local (le `clients.json` est lu depuis le serveur)

---

## Ce qui est protégé

| Protection | Détail |
|---|---|
| Lien à durée limitée | Expire automatiquement à la date choisie |
| Session cookie | Navigation authentifiée sans token visible dans l'URL |
| Révocation instantanée | `node manage.js revoke <token>` |
| Clic droit désactivé | Prévient l'accès rapide au code source |
| Ctrl+U / F12 bloqués | Réduit l'accès aux DevTools |
| Détection DevTools | Overlay si les outils de développement sont ouverts |
| Watermark bas de page | Rappel visuel "NOK'S Consulting — Confidentiel" |
| Cache désactivé | `Cache-Control: no-store` sur toutes les pages |
| Sélection texte désactivée | Empêche le copier-coller du contenu |
# allday
# allday
