/**
 * DULCE ATELIER - SERVICIO DE SUBIDA DE IMÁGENES CON CLOUDINARY
 * Permite subir fotos de pasteles directo a la nube de Cloudinary
 * Si no hay credenciales configuradas, utiliza fallback a Base64/DataURL
 */

const CLOUDINARY_CONFIG_KEY = 'dulce_atelier_cloudinary_cfg';

class CloudinaryService {
  constructor() {
    this.config = this.loadConfig();
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
      cloudName: "", // El usuario puede ingresarlo en el panel o pasar sus credenciales
      uploadPreset: "" // Preset unsigned configurado en Cloudinary
    };
  }

  saveConfig(cloudName, uploadPreset) {
    this.config = {
      cloudName: cloudName.trim(),
      uploadPreset: uploadPreset.trim()
    };
    localStorage.setItem(CLOUDINARY_CONFIG_KEY, JSON.stringify(this.config));
  }

  isConfigured() {
    return Boolean(this.config.cloudName && this.config.uploadPreset);
  }

  /**
   * Sube una imagen a Cloudinary mediante REST API (Unsigned Upload)
   * @param {File} file - Archivo de imagen seleccionado
   * @param {Function} onProgress - Callback de progreso opcional (porcentaje)
   * @returns {Promise<string>} - URL segura de la imagen en Cloudinary
   */
  async uploadImage(file, onProgress = null) {
    // Si no está configurado Cloudinary, fallback a Base64 para que la app funcione siempre
    if (!this.isConfigured()) {
      console.warn("Cloudinary no está configurado aún. Utilizando almacenamiento local de imagen.");
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    }

    const url = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.config.uploadPreset);
    formData.append('folder', 'pasteleria_productos');

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Error al subir a Cloudinary");
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Fallo la subida a Cloudinary:", error);
      // Fallback a Base64 si falla la red o credencial
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    }
  }
}

// Instancia global
window.cloudinaryService = new CloudinaryService();
