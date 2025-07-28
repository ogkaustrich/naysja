/**
 * Gestionnaire de connexions WebSocket - Version Node.js
 * Conversion du module Python connection_manager.py
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ConnectionManager {
  constructor() {
    this.clients = new Map(); // Map<clientId, clientData>
    this.sessionToClient = new Map(); // Map<sessionId, clientId>
    this.stats = {
      totalClients: 0,
      redirections: 0,
      startTime: Date.now()
    };
    
    logger.info('ConnectionManager initialisé avec succès');
  }

  /**
   * Ajouter un nouveau client
   */
  addClient(sessionId, ip, userAgent = '', geoInfo = null) {
    const clientId = `client_${uuidv4().substring(0, 8)}`;
    const now = Date.now();
    
    const clientData = {
      client_id: clientId,
      session_id: sessionId,
      ip: ip,
      user_agent: userAgent,
      connected_at: now,
      last_activity: now,
      current_page: 'Connexion...',
      redirections_count: 0,
      geo_info: geoInfo || {},
      browser: this.extractBrowser(userAgent)
    };
    
    this.clients.set(clientId, clientData);
    this.sessionToClient.set(sessionId, clientId);
    this.stats.totalClients++;
    
    logger.logConnection(sessionId, ip, geoInfo?.country_name);
    
    return clientId;
  }

  /**
   * Supprimer un client
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      this.sessionToClient.delete(client.session_id);
      this.clients.delete(clientId);
      logger.logDisconnection(clientId, client.ip);
      return true;
    }
    return false;
  }

  /**
   * Obtenir un client par son ID
   */
  getClient(clientId) {
    return this.clients.get(clientId) || null;
  }

  /**
   * Obtenir un client par son session ID
   */
  getClientBySession(sessionId) {
    const clientId = this.sessionToClient.get(sessionId);
    return clientId || null;
  }

  /**
   * Vérifier si un client existe
   */
  clientExists(clientId) {
    return this.clients.has(clientId);
  }

  /**
   * Mettre à jour la session d'un client
   */
  updateClientSession(clientId, newSessionId, newIp = null) {
    const client = this.clients.get(clientId);
    if (client) {
      // Supprimer l'ancienne association
      this.sessionToClient.delete(client.session_id);
      
      // Mettre à jour les données
      client.session_id = newSessionId;
      if (newIp) client.ip = newIp;
      client.last_activity = Date.now();
      
      // Créer la nouvelle association
      this.sessionToClient.set(newSessionId, clientId);
      
      return true;
    }
    return false;
  }

  /**
   * Mettre à jour l'activité d'un client
   */
  updateClientActivity(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.last_activity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Mettre à jour la page actuelle d'un client
   */
  updateClientPage(clientId, page) {
    const client = this.clients.get(clientId);
    if (client) {
      client.current_page = page;
      client.last_activity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Mettre à jour les informations géographiques d'un client
   */
  updateClientGeoInfo(clientId, geoInfo) {
    const client = this.clients.get(clientId);
    if (client) {
      client.geo_info = { ...client.geo_info, ...geoInfo };
      return true;
    }
    return false;
  }

  /**
   * Obtenir tous les clients connectés
   */
  getAllClients() {
    const clients = [];
    const now = Date.now();
    
    for (const [clientId, client] of this.clients) {
      const lastActivityMinutes = Math.floor((now - client.last_activity) / 60000);
      
      clients.push({
        client_id: clientId,
        ip: client.ip,
        browser: client.browser,
        current_page: client.current_page,
        last_activity: `${lastActivityMinutes}m`,
        redirections_count: client.redirections_count,
        connected_at: new Date(client.connected_at).toISOString(),
        country: client.geo_info?.country_name || 'Unknown',
        country_code: client.geo_info?.country_code || 'XX'
      });
    }
    
    return clients.sort((a, b) => b.connected_at.localeCompare(a.connected_at));
  }

  /**
   * Obtenir les statistiques du système
   */
  getStats() {
    const now = Date.now();
    const uptimeHours = Math.floor((now - this.stats.startTime) / 3600000);
    
    return {
      active_clients: this.clients.size,
      total_clients: this.stats.totalClients,
      redirections: this.stats.redirections,
      uptime_hours: uptimeHours,
      logs_count: 0 // À implémenter si nécessaire
    };
  }

  /**
   * Incrémenter le compteur de redirections
   */
  incrementRedirections() {
    this.stats.redirections++;
  }

  /**
   * Incrémenter le compteur de redirections pour un client
   */
  incrementClientRedirections(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.redirections_count++;
      this.incrementRedirections();
      return true;
    }
    return false;
  }

  /**
   * Nettoyer les clients inactifs
   */
  cleanupInactiveClients(timeoutSeconds = 180) {
    const now = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    let removedCount = 0;
    
    for (const [clientId, client] of this.clients) {
      if (now - client.last_activity > timeoutMs) {
        this.removeClient(clientId);
        removedCount++;
      }
    }
    
    return removedCount;
  }

  /**
   * Extraire le navigateur depuis l'User-Agent
   */
  extractBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edg')) return 'Edge';
    if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
    if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider')) return 'Bot';
    
    return 'Other';
  }

  /**
   * Obtenir le nombre de clients actifs
   */
  getActiveClientsCount() {
    return this.clients.size;
  }

  /**
   * Obtenir les clients par pays
   */
  getClientsByCountry() {
    const countries = {};
    
    for (const [clientId, client] of this.clients) {
      const country = client.geo_info?.country_name || 'Unknown';
      if (!countries[country]) {
        countries[country] = 0;
      }
      countries[country]++;
    }
    
    return countries;
  }

  /**
   * Vérifier si un client est actif
   */
  isClientActive(clientId, timeoutSeconds = 180) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    const now = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    
    return (now - client.last_activity) <= timeoutMs;
  }
}

module.exports = ConnectionManager;

