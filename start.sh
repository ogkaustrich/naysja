#!/bin/bash

# Script de démarrage pour le système de redirection WebSocket Node.js
# Version: 1.0.0

echo "🚀 Démarrage du Système de Redirection WebSocket (Node.js)"
echo "=================================================="

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    echo "   Visitez: https://nodejs.org/"
    exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node --version)
echo "✅ Node.js détecté: $NODE_VERSION"

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm détecté: $NPM_VERSION"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Fichier package.json non trouvé."
    echo "   Assurez-vous d'être dans le répertoire du projet."
    exit 1
fi

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances."
        exit 1
    fi
    
    echo "✅ Dépendances installées avec succès."
fi

# Créer le répertoire de logs s'il n'existe pas
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo "📁 Répertoire de logs créé."
fi

# Vérifier les variables d'environnement
echo ""
echo "🔧 Configuration:"
echo "   Port: ${PORT:-5000}"
echo "   Host: ${HOST:-0.0.0.0}"
echo "   Environnement: ${NODE_ENV:-development}"
echo "   Mot de passe admin: ${ADMIN_PASSWORD:-Azerty2025}"

# Afficher les informations de démarrage
echo ""
echo "🌍 Le serveur sera accessible sur:"
echo "   - Interface principale: http://localhost:${PORT:-5000}"
echo "   - Panneau admin: http://localhost:${PORT:-5000}/admin"
echo "   - API de géolocalisation: http://localhost:${PORT:-5000}/api/geo-check"

echo ""
echo "🔐 Informations d'administration:"
echo "   - URL: http://localhost:${PORT:-5000}/admin"
echo "   - Mot de passe: ${ADMIN_PASSWORD:-Azerty2025}"

echo ""
echo "🌍 Pays autorisés:"
echo "   - Autriche (AT)"
echo "   - Maroc (MA)"

echo ""
echo "📋 Pour arrêter le serveur, utilisez Ctrl+C"
echo ""

# Démarrer le serveur
echo "🚀 Démarrage du serveur..."
echo "=================================================="

# Utiliser PM2 si disponible, sinon node directement
if command -v pm2 &> /dev/null; then
    echo "🔄 Démarrage avec PM2..."
    pm2 start server.js --name "redirection-system" --watch
    pm2 logs redirection-system
else
    echo "🔄 Démarrage avec Node.js..."
    node server.js
fi

