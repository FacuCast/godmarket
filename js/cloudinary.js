/**
 * DULCE ATELIER - SERVICIO DE SUBIDA DE IMÁGENES CON CLOUDINARY
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
   * Sube una imagen mediante el endpoint /api/upload de Vercel (Firmado de forma segura)
   */
  async uploadImage(file) {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const cloudName = this.getCloudName();

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: window.sellerPortal.getAuthHeaders(),
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
        const errorData = await response.json();
        console.warn("API de Cloudinary devolvió error:", errorData);
      }
    } catch (err) {
      console.warn("Fallo el endpoint /api/upload, usando fallback:", err);
    }

    // Fallback si no hay conexión al backend
    return base64Data;
  }
}

// Instancia global
window.cloudinaryService = new CloudinaryService();
