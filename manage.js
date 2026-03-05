#!/usr/bin/env node
/**
 * NOK'S Consulting — Gestionnaire de liens clients
 *
 * Commandes :
 *   node manage.js create "Nom Client" [jours]    → crée un lien (défaut: 30 jours)
 *   node manage.js list                           → liste tous les clients
 *   node manage.js revoke <token>                 → révoque un accès
 *   node manage.js extend <token> [jours]         → prolonge un accès
 */

const fs      = require('fs');
const crypto  = require('crypto');
const path    = require('path');

const FILE    = path.join(__dirname, 'clients.json');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function load()       { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function save(data)   { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function token(name) {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 7) || 'CLIENT';
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  return `${prefix}-${suffix}`;
}
function addDays(n)   {
  const d = new Date();
  d.setDate(d.getDate() + parseInt(n));
  return d.toISOString().split('T')[0];
}
function expireLabel(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  if (diff < 0)  return `\x1b[31mExpiré\x1b[0m`;
  if (diff === 0) return `\x1b[33mAujourd'hui\x1b[0m`;
  return `\x1b[32m${diff} jour(s)\x1b[0m`;
}

const [,, cmd, arg1, arg2] = process.argv;

switch (cmd) {

  case 'create': {
    if (!arg1) { console.error('Usage: node manage.js create "Nom Client" [jours]'); process.exit(1); }
    const days   = parseInt(arg2) || 30;
    const t      = token(arg1);
    const expire = addDays(days);
    const data   = load();
    data[t] = { name: arg1, expires: expire, createdAt: new Date().toISOString() };
    save(data);

    console.log('\n  ✓ Lien créé\n');
    console.log(`  Client  : \x1b[1m${arg1}\x1b[0m`);
    console.log(`  Expire  : \x1b[33m${expire}\x1b[0m (${days} jours)`);
    console.log(`\n  \x1b[36m━━━━ CODE D'ACCÈS À COMMUNIQUER ━━━━\x1b[0m`);
    console.log(`  \x1b[1m${t}\x1b[0m`);
    console.log(`\n  URL : \x1b[1m${BASE_URL}\x1b[0m`);
    console.log('\x1b[36m  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
    break;
  }

  case 'list': {
    const data = load();
    const keys = Object.keys(data);
    if (!keys.length) { console.log('\n  Aucun client.\n'); break; }

    console.log('\n  NOK\'S Consulting — Clients actifs');
    console.log('  ─────────────────────────────────────────────────────────────────');
    console.log('  Nom                           Expire          Reste     Token');
    console.log('  ─────────────────────────────────────────────────────────────────');
    for (const [t, c] of Object.entries(data)) {
      const name  = c.name.padEnd(30);
      const exp   = c.expires.padEnd(14);
      const left  = expireLabel(c.expires).padEnd(22);
      console.log(`  ${name}  ${exp}  ${left}  ${t.slice(0,12)}…`);
    }
    console.log('');
    break;
  }

  case 'revoke': {
    if (!arg1) { console.error('Usage: node manage.js revoke <token>'); process.exit(1); }
    const data = load();
    if (!data[arg1]) { console.error(`  ✗ Token "${arg1}" introuvable.`); process.exit(1); }
    const name = data[arg1].name;
    delete data[arg1];
    save(data);
    console.log(`\n  ✓ Accès révoqué pour \x1b[1m${name}\x1b[0m\n`);
    break;
  }

  case 'extend': {
    if (!arg1) { console.error('Usage: node manage.js extend <token> [jours]'); process.exit(1); }
    const data = load();
    if (!data[arg1]) { console.error(`  ✗ Token "${arg1}" introuvable.`); process.exit(1); }
    const days = parseInt(arg2) || 30;
    data[arg1].expires = addDays(days);
    save(data);
    console.log(`\n  ✓ Accès prolongé pour \x1b[1m${data[arg1].name}\x1b[0m`);
    console.log(`  Nouvelle expiration : \x1b[33m${data[arg1].expires}\x1b[0m\n`);
    break;
  }

  default:
    console.log(`
  NOK'S Consulting — Gestionnaire de liens

  \x1b[1mCommandes :\x1b[0m

    node manage.js create "Nom Client" [jours]    Créer un lien (défaut 30j)
    node manage.js list                           Lister tous les clients
    node manage.js revoke <token>                 Révoquer un accès
    node manage.js extend <token> [jours]         Prolonger un accès

  \x1b[1mExemples :\x1b[0m

    node manage.js create "Société Dupont" 14
    node manage.js create "Cabinet Martin" 7
    node manage.js list
    node manage.js revoke abc123...
    node manage.js extend abc123... 30
`);
}
