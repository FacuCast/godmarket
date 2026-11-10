/**
 * GOD MARKET - SERVICIO DE SUBIDA DE IMÁGENES CON CLOUDINARY
 * Conectado con la cuenta Cloudinary: dz6apjevd
 */

const CLOUDINARY_CONFIG_KEY = 'dulce_atelier_cloudinary_cfg';

class CloudinaryService {
  constructor() {
    this.config = this.loadConfig();
    this.apiKey = '327352685728933';
  }

  loadConfig() {
    const saved = localStorage.getItem(CLOUDINARY_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error al cargar config de Cloudinary:", e);
      }
    }
    return {
      cloudName: "dz6apjevd", // Tu Cloud Name configurado
      uploadPreset: ""
    };
  }

  saveConfig(cloudName, uploadPreset = '') {
    this.config = {
      cloudName: (cloudName || 'dz6apjevd').trim(),
      uploadPreset: (uploadPreset || '').trim()
    };
    localStorage.setItem(CLOUDINARY_CONFIG_KEY, JSON.stringify(this.config));
  }

  getCloudName() {
    return this.config.cloudName || 'dz6apjevd';
  }

  /**
   * Comprime y redimensiona imágenes en el cliente para evitar superar límites de payload en móvil/producción
   */
  async compressImageToDataURL(file, maxDimension = 1080, quality = 0.80) {
    const rawDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return rawDataUrl;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (!width || !height) return resolve(rawDataUrl);

          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(rawDataUrl);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed && compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
        } catch (err) {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  }

  /**
   * Sube una imagen mediante el endpoint /api/upload de Vercel (Firmado de forma segura)
   */
  async uploadImage(file) {
    const base64Data = await this.compressImageToDataURL(file);

    const cloudName = this.getCloudName();
    const headers = (window.sellerPortal && typeof window.sellerPortal.getAuthHeaders === 'function')
      ? window.sellerPortal.getAuthHeaders()
      : { 'Content-Type': 'application/json' };

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: base64Data,
          cloudName: cloudName
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.secure_url) {
          return data.secure_url;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn("API de Cloudinary devolvió error:", errorData);
      }
    } catch (err) {
      console.warn("Fallo el endpoint /api/upload, usando fallback:", err);
    }

    // Fallback si no hay conexión al backend o faltan credenciales de Cloudinary
    return base64Data;
  }
}

// Instancia global
window.cloudinaryService = new CloudinaryService();
