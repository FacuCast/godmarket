const crypto = require('crypto');

/**
 * Serverless Function para Vercel (/api/upload)
 * Sube imágenes a Cloudinary de manera segura usando API Key y API Secret
 * Las credenciales se obtienen EXCLUSIVAMENTE de las variables de entorno de Vercel (process.env)
 */
module.exports = async (req, res) => {
  // CORS Headers restringidos y seguros
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const finalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!finalCloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: 'Configuración del servidor incompleta. Faltan variables de entorno de Cloudinary en Vercel.' 
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { image } = body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'No se envió ninguna imagen válida para subir.' });
    }

    // Validación de seguridad: solo formatos de imagen permitidos
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'El archivo enviado no es una imagen válida (debe ser JPEG, PNG o WebP).' });
    }

    // Validación de tamaño máximo (10 MB aproximados en base64)
    if (image.length > 14 * 1024 * 1024) {
      return res.status(413).json({ error: 'La imagen excede el límite máximo permitido de 10 MB.' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'pasteleria_productos';
    
    // Generar firma SHA-1 requerida por Cloudinary
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    // Preparar payload para Cloudinary
    const formData = new URLSearchParams();
    formData.append('file', image);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', signature);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${finalCloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await uploadRes.json();

    if (data.error) {
      throw new Error(data.error.message || 'Error en Cloudinary');
    }

    return res.status(200).json({ 
      success: true,
      secure_url: data.secure_url,
      public_id: data.public_id
    });

  } catch (error) {
    console.error('Error en /api/upload:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
};
