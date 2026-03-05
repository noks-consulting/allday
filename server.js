const express      = require('express');
const cookieParser = require('cookie-parser');
const bcrypt       = require('bcryptjs');
const fs           = require('fs');
const path         = require('path');
const crypto       = require('crypto');

const app        = express();
const PORT       = process.env.PORT || 3000;
const PAGES_DIR  = path.join(__dirname, 'projects', 'allday');
const SECRET     = process.env.SECRET || 'noks2026secret';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'noks-admin-2026';
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASS, 10);

const CLIENT_COOKIE = 'noks_session';
const ADMIN_COOKIE  = 'noks_admin';

app.use(cookieParser(SECRET));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function loadClients() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'clients.json'), 'utf8'));
}

function saveClients(data) {
  fs.writeFileSync(path.join(__dirname, 'clients.json'), JSON.stringify(data, null, 2));
}

function getSession(req) {
  try {
    const raw = req.signedCookies[CLIENT_COOKIE];
    return raw ? JSON.parse(Buffer.from(raw, 'base64').toString()) : null;
  } catch { return null; }
}

function setSession(res, data) {
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64');
  res.cookie(CLIENT_COOKIE, encoded, {
    signed: true, httpOnly: true, sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 90
  });
}

function isAdmin(req) {
  try {
    return req.signedCookies[ADMIN_COOKIE] === 'authenticated';
  } catch { return false; }
}

function setAdmin(res) {
  res.cookie(ADMIN_COOKIE, 'authenticated', {
    signed: true, httpOnly: true, sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  });
}

function generateCode(name) {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 7) || 'CLIENT';
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  return `${prefix}-${suffix}`;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + parseInt(n));
  return d.toISOString().split('T')[0];
}

function findClientByCode(code) {
  const clients = loadClients();
  for (const [token, client] of Object.entries(clients)) {
    if (token === code) return { token, client };
  }
  return null;
}

// ─────────────────────────────────────────────
//  Page templates
// ─────────────────────────────────────────────
const BASE_STYLE = `
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html{height:100%;background:#0a0a0a;color:#fff;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif}
  body{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}
  a{color:inherit;text-decoration:none}
`;

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NOK'S Consulting — Accès Prototype</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_STYLE}
    body{padding:40px 20px;text-align:center}
    .brand{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:5px;color:rgba(255,255,255,.25);margin-bottom:48px}
    .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:48px 40px;width:100%;max-width:400px}
    .card h1{font-size:1.2rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px}
    .card p{font-size:.8rem;color:rgba(255,255,255,.35);margin-bottom:32px;line-height:1.6}
    .field{position:relative;margin-bottom:20px}
    .field input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;color:#fff;font-family:inherit;font-size:.85rem;letter-spacing:2px;text-align:center;text-transform:uppercase;outline:none;transition:border-color .2s}
    .field input:focus{border-color:rgba(255,255,255,.3)}
    .field input::placeholder{color:rgba(255,255,255,.2);text-transform:none;letter-spacing:0}
    .btn{width:100%;background:#fff;color:#0a0a0a;border:none;border-radius:10px;padding:14px;font-family:inherit;font-size:.8rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:opacity .2s}
    .btn:hover{opacity:.9}
    .error{background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.2);border-radius:8px;padding:10px 16px;font-size:.75rem;color:#ff6b6b;margin-bottom:20px;display:${error ? 'block' : 'none'}}
    .footer{margin-top:48px;font-size:.65rem;color:rgba(255,255,255,.15);letter-spacing:1px;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="brand">NOK'S Consulting</div>
  <div class="card">
    <h1>Prototype sécurisé</h1>
    <p>Entrez le code d'accès communiqué<br>par votre interlocuteur NOK'S Consulting.</p>
    <div class="error">${error || ''}</div>
    <form method="POST" action="/login">
      <div class="field">
        <input type="text" name="code" placeholder="Code d'accès" autocomplete="off" autofocus required>
      </div>
      <button type="submit" class="btn">Accéder au prototype</button>
    </form>
  </div>
  <div class="footer">Tous droits réservés — NOK'S Consulting</div>
</body>
</html>`;
}

function adminLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NOK'S Consulting — Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_STYLE}
    body{padding:40px 20px;text-align:center}
    .brand{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:5px;color:rgba(255,255,255,.25);margin-bottom:48px}
    .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:48px 40px;width:100%;max-width:380px}
    .card h1{font-size:1rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;color:rgba(255,255,255,.8)}
    .card p{font-size:.75rem;color:rgba(255,255,255,.3);margin-bottom:28px}
    input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;color:#fff;font-family:inherit;font-size:.85rem;outline:none;margin-bottom:16px;transition:border-color .2s}
    input:focus{border-color:rgba(255,255,255,.3)}
    input::placeholder{color:rgba(255,255,255,.2)}
    .btn{width:100%;background:#fff;color:#0a0a0a;border:none;border-radius:10px;padding:14px;font-family:inherit;font-size:.8rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:opacity .2s}
    .btn:hover{opacity:.9}
    .error{background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.2);border-radius:8px;padding:10px 16px;font-size:.75rem;color:#ff6b6b;margin-bottom:16px;display:${error ? 'block' : 'none'}}
  </style>
</head>
<body>
  <div class="brand">NOK'S Consulting</div>
  <div class="card">
    <h1>Administration</h1>
    <p>Accès réservé</p>
    <div class="error">${error || ''}</div>
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Mot de passe" autofocus required>
      <button type="submit" class="btn">Connexion</button>
    </form>
  </div>
</body>
</html>`;
}

function adminDashboard(message) {
  const clients = loadClients();
  const entries = Object.entries(clients);

  const rows = entries.map(([code, c]) => {
    const now = new Date();
    const exp = new Date(c.expires);
    const diff = Math.ceil((exp - now) / 86400000);
    let status, statusClass;
    if (diff < 0) { status = 'Expiré'; statusClass = 'expired'; }
    else if (diff === 0) { status = "Aujourd'hui"; statusClass = 'warning'; }
    else { status = `${diff}j restants`; statusClass = 'active'; }

    return `
      <tr>
        <td class="name">${c.name}</td>
        <td class="code"><span class="code-badge">${code}</span></td>
        <td>${c.expires}</td>
        <td><span class="status ${statusClass}">${status}</span></td>
        <td class="actions">
          <form method="POST" action="/admin/extend" style="display:inline">
            <input type="hidden" name="code" value="${code}">
            <input type="number" name="days" value="30" min="1" max="365" class="days-input">
            <button type="submit" class="btn-sm btn-extend">Prolonger</button>
          </form>
          <form method="POST" action="/admin/revoke" style="display:inline" onsubmit="return confirm('Révoquer l\\'accès de ${c.name} ?')">
            <input type="hidden" name="code" value="${code}">
            <button type="submit" class="btn-sm btn-revoke">Révoquer</button>
          </form>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NOK'S Consulting — Dashboard Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_STYLE}
    body{padding:32px 24px;align-items:stretch;justify-content:flex-start;max-width:1100px;margin:0 auto}
    .top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:12px}
    .brand{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:5px;color:rgba(255,255,255,.25)}
    .top-right{display:flex;align-items:center;gap:12px}
    .btn-logout{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 16px;font-size:.65rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s;font-family:inherit}
    .btn-logout:hover{background:rgba(255,80,80,.1);border-color:rgba(255,80,80,.2);color:#ff6b6b}

    .message{background:rgba(80,200,120,.1);border:1px solid rgba(80,200,120,.2);border-radius:8px;padding:12px 20px;font-size:.8rem;color:#50c878;margin-bottom:24px;display:${message ? 'block' : 'none'}}

    .section-title{font-size:.65rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:16px}

    /* Create form */
    .create-form{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:24px;margin-bottom:40px;display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
    .create-form .field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:150px}
    .create-form label{font-size:.6rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3)}
    .create-form input{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.8rem;outline:none}
    .create-form input:focus{border-color:rgba(255,255,255,.3)}
    .create-form input::placeholder{color:rgba(255,255,255,.2)}
    .btn-create{background:#fff;color:#0a0a0a;border:none;border-radius:8px;padding:10px 24px;font-family:inherit;font-size:.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:opacity .2s;white-space:nowrap}
    .btn-create:hover{opacity:.9}

    /* Table */
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse}
    th{font-size:.6rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.3);text-align:left;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
    td{font-size:.8rem;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.04);color:rgba(255,255,255,.7)}
    tr:hover td{background:rgba(255,255,255,.02)}
    .name{font-weight:700;color:#fff}
    .code-badge{background:rgba(255,255,255,.06);border-radius:4px;padding:3px 8px;font-family:'SF Mono',Menlo,monospace;font-size:.7rem;letter-spacing:1px}
    .status{padding:3px 10px;border-radius:20px;font-size:.65rem;font-weight:700;letter-spacing:0.5px}
    .status.active{background:rgba(80,200,120,.1);color:#50c878}
    .status.warning{background:rgba(255,200,50,.1);color:#ffc832}
    .status.expired{background:rgba(255,80,80,.1);color:#ff6b6b}
    .actions{white-space:nowrap}
    .btn-sm{border:none;border-radius:6px;padding:6px 14px;font-family:inherit;font-size:.65rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;transition:all .2s}
    .btn-extend{background:rgba(80,200,120,.1);color:#50c878;margin-right:6px}
    .btn-extend:hover{background:rgba(80,200,120,.2)}
    .btn-revoke{background:rgba(255,80,80,.1);color:#ff6b6b}
    .btn-revoke:hover{background:rgba(255,80,80,.2)}
    .days-input{width:55px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 8px;color:#fff;font-family:inherit;font-size:.7rem;text-align:center;outline:none;margin-right:4px}
    .empty{text-align:center;padding:40px;color:rgba(255,255,255,.25);font-size:.85rem}
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="brand">NOK'S Consulting — Admin</div>
    <div class="top-right">
      <a href="/" target="_blank" class="btn-logout" style="color:rgba(255,255,255,.4)">Voir le site</a>
      <form method="GET" action="/admin/logout" style="display:inline">
        <button type="submit" class="btn-logout">Déconnexion</button>
      </form>
    </div>
  </div>

  <div class="message">${message || ''}</div>

  <div class="section-title">Nouveau client</div>
  <form method="POST" action="/admin/create" class="create-form">
    <div class="field">
      <label>Nom du client</label>
      <input type="text" name="name" placeholder="Société Dupont" required>
    </div>
    <div class="field" style="max-width:120px">
      <label>Durée (jours)</label>
      <input type="number" name="days" value="30" min="1" max="365">
    </div>
    <button type="submit" class="btn-create">Créer l'accès</button>
  </form>

  <div class="section-title">Clients (${entries.length})</div>
  <div class="table-wrap">
    ${entries.length ? `
    <table>
      <thead><tr><th>Client</th><th>Code</th><th>Expiration</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<div class="empty">Aucun client pour le moment.</div>'}
  </div>
</body>
</html>`;
}

function brandedPage(title, message, sub, icon = '🔒') {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NOK'S Consulting — ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;700;800&display=swap" rel="stylesheet">
  <style>
    ${BASE_STYLE}
    body{padding:40px;text-align:center}
    .icon{font-size:3rem;margin-bottom:24px}
    .brand{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:4px;color:rgba(255,255,255,.3);margin-bottom:32px}
    h1{font-size:1.4rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:12px}
    p{font-size:.9rem;color:rgba(255,255,255,.4);line-height:1.7;max-width:380px}
    .divider{width:40px;height:2px;background:rgba(255,255,255,.1);margin:28px auto}
    .contact{font-size:.7rem;color:rgba(255,255,255,.25);letter-spacing:1px;text-transform:uppercase}
    .back{display:inline-block;margin-top:24px;font-size:.75rem;color:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 20px;transition:all .2s}
    .back:hover{border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.5)}
  </style>
</head>
<body>
  <div class="brand">NOK'S Consulting</div>
  <div class="icon">${icon}</div>
  <h1>${message}</h1>
  <p>${sub}</p>
  <div class="divider"></div>
  <div class="contact">contact@noks-consulting.fr</div>
  <a href="/" class="back">Retour</a>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  Security injection (watermark + protections)
// ─────────────────────────────────────────────
function injectProtection(html, client, showWarning = false) {
  const expireDate = new Date(client.expires).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const guard = `
<!-- NOK'S Consulting Preview Guard -->
<style>
  * { -webkit-user-select:none; user-select:none; }
  input, textarea { -webkit-user-select:text; user-select:text; }
  #noks-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 2147483647;
    height: 38px;
    background: rgba(10,10,10,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    font-size: 0.6rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px;
    color: rgba(255,255,255,0.55);
    border-top: 1px solid rgba(255,255,255,0.06);
    pointer-events: none;
  }
  #noks-bar .noks-logo { color: #fff; letter-spacing: 3px; }
  #noks-bar .noks-client { color: rgba(255,255,255,0.4); }
  #noks-bar .noks-expiry { color: rgba(255,255,255,0.3); }
  #noks-devtools-overlay {
    display: none;
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(8,8,8,0.97);
    flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    color: #fff; text-align: center;
  }
  #noks-devtools-overlay.visible { display: flex; }
  #noks-devtools-overlay .noks-lock { font-size: 2.5rem; margin-bottom: 16px; }
  #noks-devtools-overlay h2 { font-size: 1.1rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px; }
  #noks-devtools-overlay p { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin: 0; }
</style>
<div id="noks-bar">
  <span class="noks-logo">NOK'S Consulting</span>
  <span class="noks-client">Confidentiel — ${client.name}</span>
  <span class="noks-expiry">Accès valide jusqu'au ${expireDate}</span>
</div>
<div id="noks-devtools-overlay">
  <div class="noks-lock">🔒</div>
  <h2>NOK'S Consulting</h2>
  <p>Ce prototype est confidentiel.<br>Inspection du code non autorisée.</p>
</div>
<script>
(function() {
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  document.addEventListener('keydown', function(e) {
    var blocked = (e.ctrlKey || e.metaKey) && ['u','s','p','a','c'].includes(e.key.toLowerCase());
    if (blocked || e.key === 'F12') { e.preventDefault(); e.stopPropagation(); return false; }
  });
  var devOpen = false;
  var overlay = document.getElementById('noks-devtools-overlay');
  function checkDevtools() {
    var threshold = 160;
    var open = (window.outerWidth - window.innerWidth > threshold) || (window.outerHeight - window.innerHeight > threshold);
    if (open !== devOpen) { devOpen = open; if (overlay) overlay.classList.toggle('visible', open); }
  }
  setInterval(checkDevtools, 800);
  document.addEventListener('DOMContentLoaded', function() { document.body.style.paddingBottom = '38px'; });
})();
</script>`;

  const warningPopup = showWarning ? `
<style>
  #noks-warning-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:24px}
  .warning-modal{background:#111;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center;animation:noksModalIn .4s ease;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  @keyframes noksModalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .warning-modal .w-icon{font-size:2.2rem;margin-bottom:20px}
  .warning-modal .w-brand{font-size:.55rem;font-weight:800;text-transform:uppercase;letter-spacing:5px;color:rgba(255,255,255,.25);margin-bottom:24px}
  .warning-modal h2{font-size:1.1rem;font-weight:800;letter-spacing:-0.01em;margin-bottom:16px;color:#fff}
  .warning-modal .w-text{font-size:.78rem;color:rgba(255,255,255,.45);line-height:1.8;margin-bottom:28px}
  .warning-modal .w-text strong{color:rgba(255,255,255,.7);font-weight:700}
  .warning-modal .w-divider{width:40px;height:1px;background:rgba(255,255,255,.08);margin:0 auto 24px}
  .warning-modal .w-legal{font-size:.6rem;color:rgba(255,255,255,.2);line-height:1.7;margin-bottom:28px;letter-spacing:.3px}
  .warning-modal .w-btn{display:inline-block;background:#fff;color:#0a0a0a;border:none;border-radius:10px;padding:14px 40px;font-family:inherit;font-size:.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:opacity .2s}
  .warning-modal .w-btn:hover{opacity:.9}
</style>
<div id="noks-warning-overlay">
  <div class="warning-modal">
    <div class="w-brand">NOK'S Consulting</div>
    <div class="w-icon">⚠️</div>
    <h2>Document confidentiel</h2>
    <div class="w-text">
      Ce prototype est la <strong>propriété exclusive de NOK'S Consulting</strong>.<br>
      Il vous est communiqué à titre strictement confidentiel dans le cadre de notre collaboration.<br><br>
      Toute <strong>reproduction, capture d'écran, diffusion ou partage</strong> de ce contenu est formellement interdite sans autorisation écrite préalable.
    </div>
    <div class="w-divider"></div>
    <div class="w-legal">En cliquant sur « J'ai compris », vous acceptez ces conditions de confidentialité.</div>
    <button class="w-btn" onclick="document.getElementById('noks-warning-overlay').remove()">J'ai compris</button>
  </div>
</div>` : '';

  return html.replace('</body>', warningPopup + guard + '\n</body>');
}

// ─────────────────────────────────────────────
//  CLIENT ROUTES
// ─────────────────────────────────────────────

// Login page
app.get('/', (req, res) => {
  const session = getSession(req);
  if (session) {
    const found = findClientByCode(session.code);
    if (found && new Date() <= new Date(found.client.expires)) {
      return res.redirect('/p/AccueilV3.html');
    }
  }
  res.send(loginPage());
});

// Login handler
app.post('/login', (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.send(loginPage('Veuillez entrer un code d\'accès.'));

  const found = findClientByCode(code);
  if (!found) return res.send(loginPage('Code d\'accès invalide ou révoqué.'));
  if (new Date() > new Date(found.client.expires)) {
    return res.send(loginPage('Ce code d\'accès a expiré. Contactez NOK\'S Consulting.'));
  }

  setSession(res, { code: found.token, name: found.client.name, expires: found.client.expires });
  res.redirect('/p/AccueilV3.html?welcome=1');
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie(CLIENT_COOKIE);
  res.redirect('/');
});

// Legacy /demo/:token support (redirect to new system)
app.get('/demo/:token', (req, res) => {
  const clients = loadClients();
  const client = clients[req.params.token];
  if (!client) return res.status(403).send(brandedPage('Lien invalide', 'Lien invalide', 'Ce lien d\'accès n\'existe pas ou a été révoqué.'));
  if (new Date() > new Date(client.expires)) return res.status(403).send(brandedPage('Accès expiré', 'Accès expiré', 'Ce lien a expiré.', '⏳'));

  setSession(res, { code: req.params.token, name: client.name, expires: client.expires });
  res.redirect('/p/AccueilV3.html?welcome=1');
});

// Protected pages under /p/
app.get('/p/*', (req, res) => {
  const session = getSession(req);
  if (!session) return res.redirect('/');

  const found = findClientByCode(session.code);
  if (!found || new Date() > new Date(found.client.expires)) {
    res.clearCookie(CLIENT_COOKIE);
    return res.redirect('/');
  }

  const filename = decodeURIComponent(req.path.replace(/^\/p\//, ''));
  const filepath = path.resolve(PAGES_DIR, filename);

  // Security: ensure we stay within PAGES_DIR
  if (!filepath.startsWith(PAGES_DIR)) {
    return res.status(403).send(brandedPage('Accès refusé', 'Accès refusé', 'Chemin non autorisé.'));
  }

  if (!fs.existsSync(filepath)) {
    return res.status(404).send(brandedPage('404', 'Page introuvable', 'Cette page n\'existe pas.', '🗂'));
  }

  const showWarning = req.query.welcome === '1';
  let html = fs.readFileSync(filepath, 'utf8');
  html = injectProtection(html, found.client, showWarning);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

// ─────────────────────────────────────────────
//  ADMIN ROUTES
// ─────────────────────────────────────────────

app.get('/admin', (req, res) => {
  if (isAdmin(req)) return res.redirect('/admin/dashboard');
  res.send(adminLoginPage());
});

app.post('/admin/login', (req, res) => {
  const password = req.body.password || '';
  if (!bcrypt.compareSync(password, ADMIN_HASH)) {
    return res.send(adminLoginPage('Mot de passe incorrect.'));
  }
  setAdmin(res);
  res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');
  const msg = req.query.msg || '';
  res.send(adminDashboard(msg));
});

app.post('/admin/create', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');

  const name = (req.body.name || '').trim();
  const days = parseInt(req.body.days) || 30;

  if (!name) return res.redirect('/admin/dashboard?msg=Nom requis');

  const code = generateCode(name);
  const clients = loadClients();
  clients[code] = { name, expires: addDays(days), createdAt: new Date().toISOString() };
  saveClients(clients);

  res.redirect(`/admin/dashboard?msg=Client créé : ${name} — Code : ${code}`);
});

app.post('/admin/revoke', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');

  const code = req.body.code;
  const clients = loadClients();
  const name = clients[code]?.name || code;

  if (clients[code]) {
    delete clients[code];
    saveClients(clients);
  }

  res.redirect(`/admin/dashboard?msg=Accès révoqué pour ${name}`);
});

app.post('/admin/extend', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');

  const code = req.body.code;
  const days = parseInt(req.body.days) || 30;
  const clients = loadClients();

  if (clients[code]) {
    clients[code].expires = addDays(days);
    saveClients(clients);
    res.redirect(`/admin/dashboard?msg=Accès prolongé de ${days}j pour ${clients[code].name}`);
  } else {
    res.redirect('/admin/dashboard?msg=Client introuvable');
  }
});

app.get('/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.redirect('/admin');
});

// ─────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ██╗  ██╗ ██████╗ ██╗  ██╗███████╗`);
  console.log(`  ███╗ ██║██╔═══██╗██║ ██╔╝██╔════╝`);
  console.log(`  ████╗██║██║   ██║█████╔╝ ███████╗`);
  console.log(`  ██╔████║██║   ██║██╔═██╗ ╚════██║`);
  console.log(`  ██║╚███║╚██████╔╝██║  ██╗███████║`);
  console.log(`  ╚═╝ ╚══╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝`);
  console.log(`\n  NOK'S Consulting — Preview Platform`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  URL locale  : http://localhost:${PORT}`);
  console.log(`  Admin       : http://localhost:${PORT}/admin`);
  console.log(`  Pages       : ${PAGES_DIR}`);
  console.log(`  Admin pass  : ${ADMIN_PASS === 'noks-admin-2026' ? '⚠️  défaut (définir ADMIN_PASSWORD)' : '✓ personnalisé'}`);
  console.log(`\n  CLI toujours disponible : node manage.js\n`);
});
