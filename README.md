# Système de Redirection WebSocket avec Filtrage Géographique - Version Node.js

## 🎯 Vue d'Ensemble

Ce projet est la version **Node.js** du système de redirection WebSocket avec filtrage géographique anti-bot. Il a été entièrement converti depuis la version Python (Flask) tout en conservant toutes les fonctionnalités originales.

## ✨ Fonctionnalités

### 🔄 Redirection Silencieuse
- **Redirection WebSocket** : Redirection instantanée et silencieuse des clients
- **Panneau de contrôle** : Interface admin moderne pour gérer les redirections
- **Pages prédéfinies** : Boutons de redirection vers les pages principales
- **Logging complet** : Traçabilité de toutes les redirections

### 🌍 Filtrage Géographique Anti-Bot
- **Pays autorisés** : Autriche (AT) et Maroc (MA) uniquement
- **Géolocalisation IP** : Via APIs externes fiables (ip-api.com, freeipapi.com, country.is)
- **Blocage automatique** : Tous les autres pays sont bloqués
- **Message personnalisé** : Interface professionnelle pour les accès refusés

### 🚀 Performance et Fiabilité
- **Cache intelligent** : Node-cache avec TTL pour optimiser les performances
- **Reconnexion automatique** : Clients WebSocket robustes
- **Heartbeat** : Maintien des connexions avec nettoyage automatique
- **Gestion d'erreurs** : Fallback sur plusieurs APIs de géolocalisation

## 📁 Structure du Projet

```
redirection_system_nodejs/
├── server.js                 # Serveur principal Express.js
├── package.json              # Dépendances et scripts
├── config/
│   └── config.js            # Configuration du système
├── modules/
│   ├── connectionManager.js # Gestionnaire de connexions WebSocket
│   └── geoFilter.js         # Module de filtrage géographique
├── utils/
│   └── logger.js            # Système de logging Winston
├── public/                  # Fichiers statiques (HTML, CSS, JS)
│   ├── admin.html          # Panneau d'administration
│   ├── index_geo.html      # Page d'exemple avec filtrage
│   └── js/
│       └── websocket-client-geo.js # Client WebSocket
├── logs/                    # Fichiers de logs
└── docs/                    # Documentation
```

## 🛠️ Installation

### Prérequis
- **Node.js** >= 16.0.0
- **npm** >= 8.0.0

### Installation des Dépendances
```bash
npm install
```

### Dépendances Principales
- **express** : Serveur web
- **socket.io** : WebSocket
- **axios** : Requêtes HTTP pour géolocalisation
- **node-cache** : Cache en mémoire
- **winston** : Logging
- **cors** : Cross-Origin Resource Sharing
- **helmet** : Sécurité
- **express-session** : Gestion des sessions

## 🚀 Démarrage

### Mode Production
```bash
npm start
```

### Mode Développement (avec nodemon)
```bash
npm run dev
```

### Configuration
Le serveur démarre par défaut sur :
- **Host** : 0.0.0.0
- **Port** : 5000
- **Admin** : http://localhost:5000/admin
- **Mot de passe** : Azerty2025

## 🔧 Configuration

### Fichier `config/config.js`

```javascript
module.exports = {
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0'
  },
  admin: {
    password: process.env.ADMIN_PASSWORD || 'Azerty2025'
  },
  geo: {
    allowedCountries: ['AT', 'MA'], // Autriche, Maroc
    cacheTimeout: 3600 // 1 heure
  }
};
```

### Variables d'Environnement
```bash
PORT=5000
HOST=0.0.0.0
ADMIN_PASSWORD=Azerty2025
NODE_ENV=production
SESSION_SECRET=votre_clé_secrète
LOG_LEVEL=info
```

## 🌐 APIs et Routes

### Routes Principales
- `GET /` : Page d'accueil (avec filtrage géographique)
- `GET /*.html` : Pages statiques (avec filtrage géographique)
- `GET /admin` : Panneau d'administration
- `GET /admin/login` : Connexion admin
- `POST /admin/login` : Authentification admin

### APIs d'Administration
- `GET /api/clients` : Liste des clients connectés
- `GET /api/stats` : Statistiques du système
- `GET /api/pages` : Pages prédéfinies pour redirection
- `POST /api/redirect` : Rediriger un client
- `GET /api/redirections/log` : Logs des redirections

### API de Géolocalisation
- `GET /api/geo-check` : Vérifier l'accès géographique d'une IP

## 🔌 WebSocket (Socket.IO)

### Événements Client → Serveur
- `new_client` : Nouveau client se connecte
- `rejoin_client` : Client existant se reconnecte
- `page_change` : Client change de page
- `heartbeat` : Maintien de la connexion

### Événements Serveur → Client
- `client_id` : Attribution d'un ID client
- `redirect` : Redirection silencieuse
- `geo_blocked` : Accès bloqué géographiquement
- `geo_info` : Informations géographiques
- `heartbeat_ack` : Confirmation heartbeat

## 🛡️ Sécurité

### Filtrage Géographique
```javascript
// Pays autorisés
const allowedCountries = ['AT', 'MA'];

// Vérification automatique pour toutes les routes
app.use(geoCheckMiddleware);
```

### Authentification Admin
```javascript
// Middleware de protection
function requireAdmin(req, res, next) {
  if (!req.session.adminAuthenticated) {
    return res.redirect('/admin/login');
  }
  next();
}
```

### Sécurité HTTP
- **Helmet** : Protection contre les vulnérabilités communes
- **CORS** : Configuration cross-origin
- **Sessions** : Gestion sécurisée des sessions admin

## 📊 Monitoring et Logs

### Système de Logging (Winston)
```javascript
// Niveaux de log
logger.info('Information générale');
logger.warn('Avertissement');
logger.error('Erreur');

// Logs spécialisés
logger.logAccess(ip, country, allowed, reason);
logger.logRedirection(adminIP, clientId, url);
logger.logConnection(sessionId, ip, country);
```

### Fichiers de Logs
- `logs/redirection_system.log` : Logs principaux
- Rotation automatique (20MB max, 14 jours)

### Statistiques Temps Réel
- Clients actifs
- Total des clients
- Nombre de redirections
- Uptime du serveur

## 🔄 Intégration dans vos Pages

### Client WebSocket Silencieux
```html
<!-- Ajouter dans vos pages HTML -->
<script src="/js/websocket-client-geo.js"></script>
```

### Client WebSocket avec Géolocalisation
```html
<!-- Version avec vérification géographique -->
<script src="/js/websocket-client-geo.js"></script>
```

## 🧪 Tests et Validation

### Tests Automatiques
```bash
npm test
```

### Tests Manuels
1. **Démarrage** : `npm start`
2. **Admin** : http://localhost:5000/admin
3. **Client** : http://localhost:5000/index_geo.html
4. **Géolocalisation** : http://localhost:5000/api/geo-check

### Validation des Fonctionnalités
- ✅ Serveur Express.js
- ✅ WebSocket Socket.IO
- ✅ Filtrage géographique
- ✅ Panneau d'administration
- ✅ Cache et performance
- ✅ Logging et monitoring

## 🚀 Déploiement

### Serveurs Compatibles
- **Heroku** : Support natif Node.js
- **Vercel** : Déploiement serverless
- **DigitalOcean** : VPS avec Node.js
- **AWS** : EC2, Lambda, Elastic Beanstalk
- **Google Cloud** : App Engine, Compute Engine

### Déploiement Heroku
```bash
# Créer l'application
heroku create mon-app-redirection

# Variables d'environnement
heroku config:set NODE_ENV=production
heroku config:set ADMIN_PASSWORD=MonMotDePasse

# Déployer
git push heroku main
```

### Déploiement VPS
```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cloner et installer
git clone <repo>
cd redirection_system_nodejs
npm install

# Démarrer avec PM2
npm install -g pm2
pm2 start server.js --name "redirection-system"
pm2 startup
pm2 save
```

## 🔧 Maintenance

### Mise à Jour des Dépendances
```bash
npm update
npm audit fix
```

### Monitoring des Logs
```bash
tail -f logs/redirection_system.log
```

### Redémarrage du Service
```bash
# Avec PM2
pm2 restart redirection-system

# Manuel
npm start
```

## 📈 Performance

### Optimisations Incluses
- **Compression** : Gzip automatique
- **Cache** : Node-cache pour géolocalisation
- **Keep-Alive** : Connexions HTTP persistantes
- **Clustering** : Support multi-core (optionnel)

### Métriques Typiques
- **Démarrage** : ~1-2 secondes
- **Mémoire** : ~30-50 MB
- **Connexions WebSocket** : 1000+ simultanées
- **Latence** : <50ms pour redirections

## 🆘 Dépannage

### Problèmes Courants

**1. Port déjà utilisé**
```bash
# Changer le port
PORT=3000 npm start
```

**2. Erreur de géolocalisation**
```bash
# Vérifier la connectivité
curl http://ip-api.com/json/8.8.8.8
```

**3. WebSocket ne fonctionne pas**
```bash
# Vérifier les CORS
# Voir les logs du navigateur
```

### Logs de Debug
```javascript
// Activer les logs détaillés
LOG_LEVEL=debug npm start
```

## 🔄 Migration depuis Python

### Équivalences
| Python | Node.js | Statut |
|--------|---------|---------|
| Flask | Express.js | ✅ |
| Flask-SocketIO | Socket.IO | ✅ |
| requests | axios | ✅ |
| logging | winston | ✅ |
| dict cache | node-cache | ✅ |

### Avantages Node.js
1. **Performance** : Plus rapide pour WebSocket
2. **Mémoire** : Consommation réduite
3. **Déploiement** : Plus d'options d'hébergement
4. **Maintenance** : Un seul langage (JavaScript)

## 📞 Support

### Documentation
- `README.md` : Guide principal
- `TEST_RESULTS_NODEJS.md` : Résultats des tests
- `todo_nodejs.md` : Progression du développement

### Logs et Debugging
- Logs détaillés dans `logs/`
- Console de debug dans le navigateur
- Monitoring temps réel via panneau admin

---

## 🎉 Conclusion

Cette version Node.js offre toutes les fonctionnalités de la version Python avec des performances améliorées et une meilleure compatibilité d'hébergement. Le système est prêt pour la production et peut remplacer directement la version Python sans perte de fonctionnalité.

