const crypto = require('crypto');

/**
 * Serverless Function para Vercel (/api/upload)
 * Lee las credenciales de forma 100% segura desde las Variables de Entorno de Vercel (process.env)
 * Ningún visitante ni usuario de la web puede ver tu API Secret.
 */
module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { image, cloudName } = body || {};

    // Obtener credenciales desde las variables de entorno de Vercel
    const finalCloudName = process.env.CLOUDINARY_CLOUD_NAME || cloudName;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!finalCloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: 'Credenciales de Cloudinary no configuradas en las Variables de Entorno de Vercel.' 
      });
    }

    if (!image) {
      return res.status(400).json({ error: 'No se envió ninguna imagen para subir.' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'pasteleria_productos';
    
    // Generar firma SHA-1 requerida por Cloudinary en el servidor
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
