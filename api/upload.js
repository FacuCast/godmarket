const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Serverless Function para Vercel (/api/upload)
 * Sube imágenes a Cloudinary de manera segura usando API Key y API Secret
 * Las credenciales se obtienen EXCLUSIVAMENTE de las variables de entorno de Vercel (process.env)
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set(
    (process.env.APP_ORIGINS || 'https://somosgodmarket.com,https://www.somosgodmarket.com')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:3001');
  }
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(origin && !allowedOrigins.has(origin) ? 403 : 204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      return res.status(503).json({ error: 'La autenticación del servidor no está configurada.' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Debes iniciar sesión como vendedor para subir imágenes.' });
    }

    let claims;
    try {
      claims = jwt.verify(authHeader.slice(7).trim(), secret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'La sesión de vendedor no es válida o expiró.' });
    }
    const seller = db.getSellerById(claims.sellerId);
    if (!seller || !seller.hasCompletedProfile || !seller.businessId) {
      return res.status(403).json({ error: 'Solo un vendedor con negocio registrado puede subir imágenes.' });
    }

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
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(image)) {
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

    if (!uploadRes.ok || data.error || typeof data.secure_url !== 'string' ||
        !data.secure_url.startsWith('https://res.cloudinary.com/')) {
      console.error('Cloudinary rechazó una subida autenticada:', data.error?.message || uploadRes.status);
      return res.status(502).json({ error: 'No se pudo completar la subida de la imagen.' });
    }

    return res.status(200).json({ 
      success: true,
      secure_url: data.secure_url,
      public_id: data.public_id
    });

  } catch (error) {
    console.error('Error en /api/upload:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
