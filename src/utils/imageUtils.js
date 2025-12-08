// Utility para manejar URLs de imágenes de forma consistente
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://vibratickets.online';

/**
 * Obtiene la URL completa de una imagen
 * @param {string} imageUrl - URL de la imagen (puede ser relativa o absoluta)
 * @param {string} placeholder - Texto para el placeholder si no hay imagen
 * @returns {string} URL completa de la imagen
 */
export const getImageUrl = (imageUrl, placeholder = 'Image') => {
  // Si no hay imagen o no es string, devolver placeholder
  if (!imageUrl || typeof imageUrl !== 'string') {
    return `https://via.placeholder.com/300x300/667eea/ffffff?text=${encodeURIComponent(placeholder)}`;
  }
  
  // Si ya es URL completa (http/https), usarla tal cual
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Si es ruta relativa, agregar base URL
  // Asegurar que haya un solo slash entre base y path
  const cleanBase = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${cleanBase}${cleanPath}`;
};

/**
 * Obtiene la URL de imagen para un evento, con fallbacks
 * @param {object} event - Objeto del evento
 * @param {string} preferredType - Tipo de imagen preferido ('square' | 'horizontal')
 * @returns {string} URL de la imagen
 */
export const getEventImageUrl = (event, preferredType = 'square') => {
  let imageUrl = null;
  
  if (preferredType === 'square') {
    // Priorizar cover_square (300x300) para cards en grilla
    imageUrl = event.cover_square_url || 
               event.cover_horizontal_url || 
               event.image_url;
  } else {
    // Priorizar cover_horizontal para banners
    imageUrl = event.cover_horizontal_url || 
               event.cover_square_url || 
               event.image_url;
  }
  
  return getImageUrl(imageUrl, event.name || 'Evento');
};

/**
 * Obtiene la URL del banner principal de un evento
 * @param {object} event - Objeto del evento
 * @returns {string} URL del banner
 */
export const getEventBannerUrl = (event) => {
  const bannerUrl = event.banner_main_url || 
                    event.banner_alt_url || 
                    event.cover_horizontal_url ||
                    event.image_url;
  
  return getImageUrl(bannerUrl, event.name || 'Evento');
};

export default {
  getImageUrl,
  getEventImageUrl,
  getEventBannerUrl
};
