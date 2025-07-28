/**
 * Module de filtrage géographique - Version Node.js
 * Conversion du module Python geo_filter.py
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config/config');
const logger = require('../utils/logger');

class GeoFilter {
  constructor() {
    this.allowedCountries = new Set(config.geo.allowedCountries);
    this.cache = new NodeCache({ 
      stdTTL: config.geo.cacheTimeout,
      checkperiod: 600 // Vérifier les expirations toutes les 10 minutes
    });
    this.apis = config.geo.apis;
    this.localIPs = config.localIPs;
    
    logger.info(`GeoFilter initialisé - Pays autorisés: ${Array.from(this.allowedCountries).join(', ')}`);
  }

  /**
   * Vérifier si une IP est autorisée
   */
  async isIPAllowed(ip) {
    try {
      // Vérifier si c'est une IP locale
      if (this.isLocalIP(ip)) {
        return {
          allowed: true,
          geoInfo: {
            ip: ip,
            country_code: 'LOCAL',
            country_name: 'Local/Development',
            reason: 'IP locale autorisée'
          }
        };
      }

      // Vérifier le cache
      const cacheKey = `geo_${ip}`;
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult) {
        logger.info(`Résultat géolocalisation depuis le cache pour ${ip}: ${cachedResult.geoInfo.country_code}`);
        return cachedResult;
      }

      // Obtenir les informations géographiques
      const geoInfo = await this.getGeoInfo(ip);
      
      if (!geoInfo || !geoInfo.country_code) {
        const result = {
          allowed: false,
          geoInfo: {
            ip: ip,
            country_code: 'UNKNOWN',
            country_name: 'Unknown',
            reason: 'Impossible de déterminer le pays'
          }
        };
        
        // Mettre en cache pour éviter les requêtes répétées
        this.cache.set(cacheKey, result, 300); // 5 minutes pour les erreurs
        return result;
      }

      // Vérifier si le pays est autorisé
      const allowed = this.allowedCountries.has(geoInfo.country_code);
      
      const result = {
        allowed,
        geoInfo: {
          ...geoInfo,
          reason: allowed ? 'Pays autorisé' : 'Pays non autorisé'
        }
      };

      // Mettre en cache
      this.cache.set(cacheKey, result);
      
      logger.logAccess(ip, geoInfo.country_name, allowed, result.geoInfo.reason);
      
      return result;

    } catch (error) {
      logger.logError(error, `Erreur vérification IP ${ip}`);
      
      // En cas d'erreur, bloquer par sécurité
      return {
        allowed: false,
        geoInfo: {
          ip: ip,
          country_code: 'ERROR',
          country_name: 'Error',
          reason: 'Erreur de géolocalisation'
        }
      };
    }
  }

  /**
   * Obtenir les informations géographiques d'une IP
   */
  async getGeoInfo(ip) {
    for (const api of this.apis) {
      try {
        const geoInfo = await this.queryAPI(api, ip);
        if (geoInfo && geoInfo.country_code) {
          logger.logGeoAPI(ip, api.name, true, geoInfo.country_code);
          return geoInfo;
        }
      } catch (error) {
        logger.logGeoAPI(ip, api.name, false);
        logger.logError(error, `API ${api.name} pour IP ${ip}`);
        continue;
      }
    }
    
    logger.warn(`Aucune API de géolocalisation n'a pu traiter l'IP ${ip}`);
    return null;
  }

  /**
   * Interroger une API de géolocalisation
   */
  async queryAPI(api, ip) {
    const url = api.url.replace('{ip}', ip);
    
    try {
      const response = await axios.get(url, {
        timeout: api.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GeoFilter/1.0)'
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = response.data;
      
      // Normaliser les réponses selon l'API
      return this.normalizeAPIResponse(api.name, data);

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout');
      }
      throw error;
    }
  }

  /**
   * Normaliser les réponses des différentes APIs
   */
  normalizeAPIResponse(apiName, data) {
    switch (apiName) {
      case 'ip-api.com':
        if (data.status === 'fail') {
          throw new Error(data.message || 'API error');
        }
        return {
          ip: data.query,
          country_code: data.countryCode,
          country_name: data.country,
          region: data.region,
          city: data.city,
          latitude: data.lat,
          longitude: data.lon,
          isp: data.isp,
          org: data.org,
          as: data.as
        };

      case 'freeipapi.com':
        return {
          ip: data.ipAddress,
          country_code: data.countryCode,
          country_name: data.countryName,
          region: data.regionName,
          city: data.cityName,
          latitude: data.latitude,
          longitude: data.longitude,
          isp: data.isp
        };

      case 'country.is':
        return {
          ip: data.ip,
          country_code: data.country,
          country_name: this.getCountryName(data.country)
        };

      default:
        throw new Error(`API inconnue: ${apiName}`);
    }
  }

  /**
   * Obtenir le nom du pays à partir du code
   */
  getCountryName(countryCode) {
    const countries = {
      'AT': 'Austria',
      'MA': 'Morocco',
      'FR': 'France',
      'DE': 'Germany',
      'US': 'United States',
      'GB': 'United Kingdom',
      'ES': 'Spain',
      'IT': 'Italy',
      'CA': 'Canada',
      'AU': 'Australia'
    };
    
    return countries[countryCode] || countryCode;
  }

  /**
   * Vérifier si une IP est locale
   */
  isLocalIP(ip) {
    if (!ip) return false;
    
    // IPs exactes
    if (['127.0.0.1', 'localhost', '::1'].includes(ip)) {
      return true;
    }
    
    // Préfixes d'IPs privées
    for (const prefix of this.localIPs) {
      if (ip.startsWith(prefix)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Générer le message de blocage HTML
   */
  getBlockedMessage(geoInfo) {
    const countryName = geoInfo.country_name || 'votre région';
    const allowedCountriesText = Array.from(this.allowedCountries)
      .map(code => this.getCountryName(code))
      .join(', ');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Non Disponible</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #2c3e50;
            font-size: 2em;
            margin-bottom: 20px;
        }
        
        .message {
            color: #7f8c8d;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        
        .info-box {
            background: #e8f4fd;
            border: 1px solid #3498db;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            color: #2c3e50;
        }
        
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #95a5a6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🌍</div>
        <h1>Service Non Disponible</h1>
        <div class="message">
            Nous sommes désolés, mais ce service n'est pas disponible 
            dans votre région (${countryName}).
        </div>
        <div class="message">
            Notre service est actuellement limité à certaines zones 
            géographiques pour des raisons réglementaires.
        </div>
        <div class="info-box">
            <strong>Régions autorisées :</strong> ${allowedCountriesText}
        </div>
        <div class="footer">
            Si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre support technique.
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0
    };
  }

  /**
   * Vider le cache
   */
  clearCache() {
    this.cache.flushAll();
    logger.info('Cache géolocalisation vidé');
  }

  /**
   * Ajouter un pays autorisé
   */
  addAllowedCountry(countryCode) {
    this.allowedCountries.add(countryCode.toUpperCase());
    logger.info(`Pays ajouté aux autorisations: ${countryCode}`);
  }

  /**
   * Supprimer un pays autorisé
   */
  removeAllowedCountry(countryCode) {
    this.allowedCountries.delete(countryCode.toUpperCase());
    logger.info(`Pays supprimé des autorisations: ${countryCode}`);
  }

  /**
   * Obtenir la liste des pays autorisés
   */
  getAllowedCountries() {
    return Array.from(this.allowedCountries);
  }
}

module.exports = GeoFilter;

