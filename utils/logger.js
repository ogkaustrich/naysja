/**
 * Module de logging pour le système de redirection
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Créer le répertoire de logs s'il n'existe pas
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuration du logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
    })
  ),
  transports: [
    // Fichier de log
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true
    }),
    
    // Console (seulement en développement)
    ...(config.server.environment === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

// Méthodes utilitaires
logger.logAccess = (ip, country, allowed, reason = '') => {
  const status = allowed ? 'AUTORISÉ' : 'BLOQUÉ';
  const message = `Accès ${status} pour ${ip} depuis ${country}${reason ? ` - ${reason}` : ''}`;
  
  if (allowed) {
    logger.info(message);
  } else {
    logger.warn(message);
  }
};

logger.logRedirection = (adminIP, clientId, redirectUrl) => {
  logger.info(`Redirection envoyée par admin ${adminIP}: ${clientId} -> ${redirectUrl}`);
};

logger.logConnection = (sessionId, ip, country = 'Unknown') => {
  logger.info(`Nouvelle connexion WebSocket: ${sessionId} depuis ${ip} (${country})`);
};

logger.logDisconnection = (clientId, ip) => {
  logger.info(`Client déconnecté: ${clientId} (${ip})`);
};

logger.logError = (error, context = '') => {
  logger.error(`${context ? context + ': ' : ''}${error.message}`, { stack: error.stack });
};

logger.logGeoAPI = (ip, api, success, country = null) => {
  if (success) {
    logger.info(`Géolocalisation réussie pour ${ip} via ${api}: ${country}`);
  } else {
    logger.warn(`Erreur de géolocalisation pour ${ip} via ${api}`);
  }
};

module.exports = logger;

