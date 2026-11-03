const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const uploadHandler = require('./api/upload');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

const allowedOrigins = new Set(
  (process.env.APP_ORIGINS || 'https://somosgodmarket.com,https://www.somosgodmarket.com')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://localhost:3001');
}

// ============================================================================
// 1. CABECERAS DE SEGURIDAD Y PROTECCIONES GLOBALES (HELMET + CORS)
// ============================================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://apis.google.com', 'https://www.gstatic.com', 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://fonts.googleapis.com', 'https://unpkg.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://oauth2.googleapis.com', 'https://api.cloudinary.com', 'https://nominatim.openstreetmap.org', 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // No bloquear comunicación con popup de Google
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' } // Requerido por Google Identity Services
}));

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
  maxAge: 600
}));

// ============================================================================
// 2. RATE LIMITING (DEFENSA CONTRA BRUTE-FORCE, SPAM Y DOS)
// ============================================================================
// Límite general para la API: 180 peticiones por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta dirección IP. Intenta en un minuto.' }
});
app.use('/api/', apiLimiter);

// Límite estricto para creación de pedidos: máximo 30 pedidos en 10 min por IP
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite temporal de pedidos alcanzado. Por favor aguarda unos minutos.' }
});

// Límite estricto para subida de fotos: máximo 40 subidas en 10 min por IP (protege Cloudinary)
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de subida de imágenes alcanzado. Aguarda unos minutos.' }
});

// Límite para autenticación: máximo 30 intentos en 5 min por IP
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Por favor intenta más tarde.' }
});

// ============================================================================
// 3. PARSERS DE CUERPO (LIMITACIÓN ESTRICTA DE PAYLOADS CONTRA DOS)
// ============================================================================
// Límite de 1MB para endpoints comunes; las imágenes usan su parser limitado por ruta.
app.use((req, res, next) => {
  if (req.path === '/api/upload') return next();
  return express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Helper: Sanitizar texto para mitigar inyecciones XSS
function sanitizeInput(str, maxLen = 300) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/[<>]/g, '')
    .trim();
}

function sanitizeImageUrl(value, fallback) {
  if (typeof value !== 'string' || value.length > 1_400_000) return fallback;
  const trimmed = value.trim();
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^\/?assets\/images\/[a-zA-Z0-9._-]+\.(?:webp|jpg|jpeg|png|svg)$/i.test(trimmed)) {
    return trimmed.replace(/^\//, '');
  }

  try {
    const url = new URL(trimmed);
    const allowedHosts = ['images.unsplash.com', 'res.cloudinary.com', 'lh3.googleusercontent.com'];
    if (url.protocol !== 'https:' || url.username || url.password ||
        !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return fallback;
    }
    return url.href;
  } catch {
    return fallback;
  }
}

// Helper: Slugify para IDs de negocios
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Helper: Generar JWT firmado criptográficamente para vendedores
function generateSellerToken(seller, businessId) {
  return jwt.sign(
    {
      sellerId: seller.id,
      googleId: seller.googleId,
      email: seller.email,
      businessId: businessId || seller.businessId || null
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Middleware: Autenticación y Autorización de Vendedor
function verifySellerAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión como vendedor.' });
    }

    const decoded = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET, { algorithms: ['HS256'] });
    const seller = db.getSellerById(decoded.sellerId);
    if (!seller) {
      return res.status(401).json({ error: 'La cuenta de vendedor asociada a esta sesión ya no existe.' });
    }

    req.seller = {
      sellerId: seller.id,
      googleId: seller.googleId,
      email: seller.email,
      businessId: seller.businessId || null
    };
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Sesión no válida o expirada. Por favor vuelve a ingresar.' });
  }
}

async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google Identity no está configurado en el servidor.');
  if (typeof credential !== 'string' || credential.length > 10_000) return null;

  let response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    err.code = 'GOOGLE_AUTH_UNAVAILABLE';
    throw err;
  }
  if (!response.ok) return null;

  const payload = await response.json();
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (payload.aud !== clientId || !validIssuers.includes(payload.iss) ||
      payload.email_verified !== 'true' || !payload.sub || !payload.email ||
      Number(payload.exp) <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// 1. Configuración pública del cliente
app.get('/api/config', (req, res) => {
  const promoSettings = db.getPromoSettings();
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    demoLoginEnabled: process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_LOGIN === 'true',
    promoProgram: {
      enabled: promoSettings.enabled,
      maxPromoBusinesses: promoSettings.maxPromoBusinesses,
      usedSlots: db.getPromoBusinessesCount(),
      remainingSlots: db.getRemainingPromoSlots(),
      promoDurationDays: promoSettings.promoDurationDays,
      standardServiceFeeRate: promoSettings.standardServiceFeeRate
    }
  });
});

// 2. Autenticación con Google (GIS) para Vendedores
app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    const { credential, isDemo, demoUser } = req.body;

    let googleData = null;

    if (isDemo && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'El acceso demo no está disponible en producción.' });
    }

    if (isDemo && demoUser &&
        process.env.NODE_ENV !== 'production' &&
        process.env.ENABLE_DEMO_LOGIN === 'true') {
      googleData = {
        sub: sanitizeInput(demoUser.id || 'demo_google_12345', 60),
        email: sanitizeInput(demoUser.email || 'vendedor.demo@godmarket.com', 100),
        name: sanitizeInput(demoUser.name || 'Pastelero Profesional Demo', 100),
        picture: demoUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      };
    } else if (credential) {
      const payload = await verifyGoogleCredential(credential);
      if (!payload) {
        return res.status(400).json({ error: 'Token de Google inválido o malformado.' });
      }

      googleData = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture || ''
      };
    } else {
      return res.status(400).json({ error: 'No se envió credencial de autenticación.' });
    }

    let seller = db.getSellerByGoogleId(googleData.sub) || db.getSellerByEmail(googleData.email);

    if (!seller) {
      seller = db.saveSeller({
        id: 'seller_' + Date.now(),
        googleId: googleData.sub,
        email: googleData.email,
        name: googleData.name,
        picture: googleData.picture,
        hasCompletedProfile: false,
        businessId: null
      });

      const token = generateSellerToken(seller, null);

      return res.json({
        success: true,
        token,
        isNewSeller: true,
        seller,
        business: null,
        message: 'Bienvenido. Por favor completa los datos de tu pastelería/negocio.'
      });
    }

    if (!seller.hasCompletedProfile || !seller.businessId) {
      const token = generateSellerToken(seller, null);
      return res.json({
        success: true,
        token,
        isNewSeller: true,
        seller,
        business: null,
        message: 'Perfil de vendedor pendiente de completar.'
      });
    }

    const rawBusiness = db.getBusinessById(seller.businessId);
    const business = rawBusiness ? db.enrichBusinessWithPromo(rawBusiness) : null;
    const token = generateSellerToken(seller, business ? business.id : seller.businessId);

    return res.json({
      success: true,
      token,
      isNewSeller: false,
      seller,
      business,
      message: `¡Bienvenido de nuevo, ${seller.name}!`
    });

  } catch (err) {
    console.error('Error en /api/auth/google:', err);
    const status = err.code === 'GOOGLE_AUTH_UNAVAILABLE' ||
      err.name === 'TimeoutError' || String(err.message || '').includes('no está configurado') ? 503 : 500;
    res.status(status).json({ error: status === 503 ? 'El servicio de autenticación no está disponible temporalmente.' : 'Error procesando autenticación con Google.' });
  }
});

// 3. Registro y Onboarding de Vendedor
app.post('/api/seller/register', verifySellerAuth, (req, res) => {
  try {
    const {
      businessName,
      tagline,
      neighborhood,
      address,
      phone,
      schedule,
      deliveryTime,
      deliveryFee,
      avatar,
      cover,
      description
    } = req.body;

    const seller = db.getSellerById(req.seller.sellerId);
    if (!seller) {
      return res.status(401).json({ error: 'La cuenta de vendedor asociada a esta sesión ya no existe.' });
    }
    if (seller.hasCompletedProfile || seller.businessId) {
      return res.status(409).json({ error: 'Esta cuenta ya tiene un negocio registrado.' });
    }

    if (typeof businessName !== 'string' || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre del negocio es obligatorio.' });
    }
    if (typeof phone !== 'string' || phone.trim().length < 6) {
      return res.status(400).json({ error: 'El número de WhatsApp es obligatorio para recibir pedidos.' });
    }

    const sellerId = seller.id;

    let baseSlug = slugify(businessName) || 'local';
    let businessId = baseSlug;
    let counter = 1;
    while (db.getBusinessById(businessId) && (!seller || seller.businessId !== businessId)) {
      businessId = `${baseSlug}-${counter++}`;
    }

    const cleanBizName = sanitizeInput(businessName, 80);
    const cleanTagline = sanitizeInput(tagline || 'Pastelería & Cafetería Artesanal', 120);
    const cleanNeighborhood = sanitizeInput(neighborhood || 'Buenos Aires', 80);
    const cleanAddress = sanitizeInput(address || 'Buenos Aires', 120);
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanSchedule = sanitizeInput(schedule || '08:30 - 20:00 hs', 60);
    const cleanDesc = sanitizeInput(description || 'Elaboración artesanal con los mejores ingredientes.', 500);

    const promoSettings = db.getPromoSettings();
    const remainingPromoSlots = db.getRemainingPromoSlots();
    const grantFoundingPromo = Boolean(promoSettings.enabled && remainingPromoSlots > 0);
    const promoSlotNumber = grantFoundingPromo ? (db.getPromoBusinessesCount() + 1) : null;

    const businessData = {
      id: businessId,
      sellerId: sellerId,
      name: cleanBizName,
      tagline: cleanTagline,
      neighborhood: cleanNeighborhood,
      rating: 5.0,
      reviews: 1,
      deliveryTime: sanitizeInput(deliveryTime || '30-45 min', 40),
      deliveryFee: parseFloat(deliveryFee) || 1500,
      freeShippingFrom: 45000,
      shippingType: 'Envío propio del vendedor',
      shippingNote: 'Cadete exclusivo del local con packaging térmico',
      distance: '1.0 km',
      isOpen: true,
      schedule: cleanSchedule,
      avatar: ['🍰', '☕', '🥐', '🥑', '🎁', '🍪'].includes(avatar) ? avatar : '🍰',
      badge: grantFoundingPromo ? '🎁 Precio de Local · 0% Servicio' : '✨ Nuevo en GOD MARKET',
      cover: sanitizeImageUrl(cover || seller.picture, 'assets/images/hero_breakfast.webp'),
      phone: cleanPhone,
      address: cleanAddress,
      lat: req.body.lat ? parseFloat(req.body.lat) : -34.5885,
      lng: req.body.lng ? parseFloat(req.body.lng) : -58.4285,
      deliveryRadiusKm: req.body.deliveryRadiusKm ? parseFloat(req.body.deliveryRadiusKm) : 5.0,
      verified: true,
      description: cleanDesc,
      createdAt: new Date().toISOString(),
      promoEligible: grantFoundingPromo,
      promoGrantedEver: grantFoundingPromo,
      promoDurationDays: Number(promoSettings.promoDurationDays) || 30,
      promoStartedAt: null,
      promoExpiresAt: null,
      promoSlotNumber
    };

    const savedBusiness = db.enrichBusinessWithPromo(db.saveBusiness(businessData));

    const updatedSeller = db.saveSeller({
      id: sellerId,
      googleId: seller.googleId,
      email: seller.email,
      name: seller.name,
      picture: seller.picture,
      hasCompletedProfile: true,
      businessId: savedBusiness.id
    });

    const token = generateSellerToken(updatedSeller, savedBusiness.id);

    return res.json({
      success: true,
      token,
      seller: updatedSeller,
      business: savedBusiness,
      message: '¡Perfil de negocio creado con éxito! Ya puedes publicar productos y recibir pedidos.'
    });

  } catch (err) {
    console.error('Error en /api/seller/register:', err);
    res.status(500).json({ error: 'Error al registrar perfil de vendedor.' });
  }
});

// 4. Obtener información del vendedor autenticado
app.get('/api/seller/me', verifySellerAuth, (req, res) => {
  try {
    const sellerId = req.seller.sellerId;
    const seller = db.getSellerById(sellerId);

    if (!seller) {
      return res.status(404).json({ error: 'Vendedor no encontrado.' });
    }

    const rawBusiness = seller.businessId ? db.getBusinessById(seller.businessId) : null;
    const business = rawBusiness ? db.enrichBusinessWithPromo(rawBusiness) : null;
    const products = seller.businessId ? db.getProductsByBusiness(seller.businessId) : [];
    const orders = seller.businessId ? db.getOrdersByBusiness(seller.businessId) : [];

    res.json({
      seller,
      business,
      productsCount: products.length,
      ordersCount: orders.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos del vendedor.' });
  }
});

// 5. Actualizar perfil del negocio (Solo por el vendedor propietario)
app.put('/api/seller/profile', verifySellerAuth, (req, res) => {
  try {
    const { businessId, updates } = req.body;
    if (!req.seller.businessId) {
      return res.status(403).json({ error: 'Completa el registro del negocio antes de actualizar el perfil.' });
    }
    if (businessId && businessId !== req.seller.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para modificar este negocio.' });
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Los datos de actualización no son válidos.' });
    }

    const existing = db.getBusinessById(req.seller.businessId);
    if (!existing) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    const allowedFields = new Set([
      'name', 'tagline', 'neighborhood', 'address', 'phone', 'schedule', 'deliveryTime',
      'deliveryFee', 'avatar', 'cover', 'lat', 'lng', 'deliveryRadiusKm', 'description'
    ]);
    const cleanUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.has(key)) cleanUpdates[key] = value;
    }
    if (cleanUpdates.name !== undefined) cleanUpdates.name = sanitizeInput(cleanUpdates.name, 80);
    if (cleanUpdates.tagline !== undefined) cleanUpdates.tagline = sanitizeInput(cleanUpdates.tagline, 120);
    if (cleanUpdates.neighborhood !== undefined) cleanUpdates.neighborhood = sanitizeInput(cleanUpdates.neighborhood, 80);
    if (cleanUpdates.address !== undefined) cleanUpdates.address = sanitizeInput(cleanUpdates.address, 120);
    if (cleanUpdates.phone !== undefined) cleanUpdates.phone = String(cleanUpdates.phone).replace(/\D/g, '').slice(0, 20);
    if (cleanUpdates.schedule !== undefined) cleanUpdates.schedule = sanitizeInput(cleanUpdates.schedule, 60);
    if (cleanUpdates.deliveryTime !== undefined) cleanUpdates.deliveryTime = sanitizeInput(cleanUpdates.deliveryTime, 40);
    if (cleanUpdates.description !== undefined) cleanUpdates.description = sanitizeInput(cleanUpdates.description, 500);
    if (cleanUpdates.avatar !== undefined) {
      cleanUpdates.avatar = ['🍰', '☕', '🥐', '🥑', '🎁', '🍪'].includes(cleanUpdates.avatar) ? cleanUpdates.avatar : existing.avatar;
    }
    if (cleanUpdates.cover !== undefined) {
      cleanUpdates.cover = sanitizeImageUrl(cleanUpdates.cover, existing.cover);
    }
    for (const field of ['deliveryFee', 'lat', 'lng', 'deliveryRadiusKm']) {
      if (cleanUpdates[field] !== undefined) {
        const numericValue = Number(cleanUpdates[field]);
        if (!Number.isFinite(numericValue)) {
          return res.status(400).json({ error: `El valor de ${field} no es válido.` });
        }
        cleanUpdates[field] = numericValue;
      }
    }
    if (cleanUpdates.lat !== undefined && (cleanUpdates.lat < -90 || cleanUpdates.lat > 90)) {
      return res.status(400).json({ error: 'La latitud no es válida.' });
    }
    if (cleanUpdates.lng !== undefined && (cleanUpdates.lng < -180 || cleanUpdates.lng > 180)) {
      return res.status(400).json({ error: 'La longitud no es válida.' });
    }
    if (cleanUpdates.deliveryRadiusKm !== undefined && (cleanUpdates.deliveryRadiusKm < 1 || cleanUpdates.deliveryRadiusKm > 15)) {
      return res.status(400).json({ error: 'El radio de entrega debe estar entre 1 y 15 km.' });
    }
    if (cleanUpdates.deliveryFee !== undefined && cleanUpdates.deliveryFee < 0) {
      return res.status(400).json({ error: 'El costo de envío no puede ser negativo.' });
    }

    const updated = db.saveBusiness({
      ...existing,
      ...cleanUpdates,
      id: req.seller.businessId,
      sellerId: req.seller.sellerId
    });

    res.json({ success: true, business: db.enrichBusinessWithPromo(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar negocio.' });
  }
});

// 6. Productos del Vendedor (CRUD aislado y verificado)
app.get('/api/seller/products', verifySellerAuth, (req, res) => {
  try {
    const targetBusinessId = req.seller.businessId;
    if (!targetBusinessId) {
      return res.status(403).json({ error: 'Completa el registro del negocio para acceder a sus productos.' });
    }
    if (req.query.businessId && req.query.businessId !== targetBusinessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para ver productos de otro comercio.' });
    }
    const products = db.getProductsByBusiness(targetBusinessId);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos del vendedor.' });
  }
});

app.post('/api/seller/products', verifySellerAuth, (req, res) => {
  try {
    const businessId = req.seller.businessId;
    const {
      name,
      category,
      categoryName,
      price,
      tag,
      portion,
      description,
      image
    } = req.body;

    const numericPrice = Number(price);
    if (!businessId || typeof name !== 'string' || name.trim().length < 3 ||
        !Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Nombre, precio y negocio son obligatorios.' });
    }

    const business = db.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ error: 'Negocio no registrado.' });
    }

    const newProduct = db.addProduct({
      businessId,
      businessName: business.name,
      businessNeighborhood: business.neighborhood,
      businessAvatar: business.avatar,
      name: sanitizeInput(name, 100),
      category: ['desayunos', 'meriendas', 'brunch', 'boxes'].includes(category) ? category : 'desayunos',
      categoryName: sanitizeInput(categoryName || 'Desayunos & Meriendas', 60),
      price: numericPrice,
      tag: sanitizeInput(tag || '✨ Nuevo en GOD MARKET', 50),
      portion: sanitizeInput(portion || 'Para 1 o 2 personas', 50),
      description: sanitizeInput(description || '', 500),
      image: sanitizeImageUrl(image, 'assets/images/hero_breakfast.webp')
    });

    // Activar el contador de 30 días (0% cargo de servicio) recién al publicar el primer producto con foto
    const promoActivation = db.activateBusinessPromoTimerIfNeeded(businessId);
    const enrichedBusiness = promoActivation.business || db.enrichBusinessWithPromo(business);

    res.json({
      success: true,
      product: {
        ...newProduct,
        isPromoActive: Boolean(enrichedBusiness && enrichedBusiness.isPromoActive),
        serviceFeeRate: enrichedBusiness ? enrichedBusiness.serviceFeeRate : 0.20
      },
      promoActivatedNow: promoActivation.activated,
      business: enrichedBusiness
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear producto.' });
  }
});

app.put('/api/seller/products/:id', verifySellerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getProductById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    if (!req.seller.businessId || existing.businessId !== req.seller.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para modificar un producto de otro comercio.' });
    }

    const updates = {};
    for (const key of ['name', 'description', 'price', 'tag', 'portion', 'image', 'category', 'categoryName']) {
      if (Object.hasOwn(req.body, key)) updates[key] = req.body[key];
    }
    if (updates.name) updates.name = sanitizeInput(updates.name, 100);
    if (updates.description) updates.description = sanitizeInput(updates.description, 500);
    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
      if (!Number.isFinite(updates.price) || updates.price <= 0) {
        return res.status(400).json({ error: 'El precio no es válido.' });
      }
    }
    if (updates.tag !== undefined) updates.tag = sanitizeInput(updates.tag, 50);
    if (updates.portion !== undefined) updates.portion = sanitizeInput(updates.portion, 50);
    if (updates.category !== undefined) {
      updates.category = ['desayunos', 'meriendas', 'brunch', 'boxes'].includes(updates.category) ? updates.category : existing.category;
    }
    if (updates.categoryName !== undefined) updates.categoryName = sanitizeInput(updates.categoryName, 60);
    if (updates.image !== undefined) {
      updates.image = sanitizeImageUrl(updates.image, existing.image);
    }

    const updated = db.updateProduct(id, updates);
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar producto.' });
  }
});

app.delete('/api/seller/products/:id', verifySellerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getProductById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    if (!req.seller.businessId || existing.businessId !== req.seller.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para eliminar un producto de otro comercio.' });
    }

    const ok = db.deleteProduct(id);
    res.json({ success: true, message: 'Producto eliminado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto.' });
  }
});

// 7. Pedidos del Vendedor (Aislados por negocio)
app.get('/api/seller/orders', verifySellerAuth, (req, res) => {
  try {
    const targetBusinessId = req.seller.businessId;
    if (!targetBusinessId) {
      return res.status(403).json({ error: 'Completa el registro del negocio para acceder a sus pedidos.' });
    }

    if (req.seller.businessId && req.query.businessId && req.seller.businessId !== req.query.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para ver pedidos de otro comercio.' });
    }

    const orders = db.getOrdersByBusiness(targetBusinessId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

app.patch('/api/seller/orders/:id', verifySellerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.seller.businessId) {
      return res.status(403).json({ error: 'Completa el registro del negocio antes de gestionar pedidos.' });
    }
    const authorizedOrder = db.getOrdersByBusiness(req.seller.businessId).find(order => order.id === id);
    if (!authorizedOrder) {
      return res.status(403).json({ error: 'Acceso denegado: este pedido no pertenece a tu comercio.' });
    }

    const validStatuses = ['pendiente', 'en_preparacion', 'despachado', 'entregado', 'en_disputa', 'reembolsado', 'disputa_cerrada'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado de pedido no válido.' });
    }
    const updated = db.updateOrderStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del pedido.' });
  }
});

// 8. Rutas Públicas de Marketplace para Clientes
app.get('/api/products', (req, res) => {
  try {
    const { category, businessId } = req.query;
    let products = db.getProducts().filter(product => product.isAvailable !== false);

    if (category && category !== 'todos') {
      products = products.filter(p => p.category === category);
    }
    if (businessId && businessId !== 'todos') {
      products = products.filter(p => p.businessId === businessId);
    }

    const enrichedProducts = products.map(p => {
      const biz = p.businessId ? db.getBusinessById(p.businessId) : null;
      const promoState = db.computeBusinessPromoState(biz);
      return {
        ...p,
        isPromoActive: promoState.isPromoActive,
        serviceFeeRate: promoState.serviceFeeRate
      };
    });

    res.json(enrichedProducts);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

app.get('/api/businesses', (req, res) => {
  try {
    const businesses = db.getBusinesses().map(b => db.enrichBusinessWithPromo(b));
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener negocios.' });
  }
});

// 9. Registrar Pedido Realizado por Cliente (Con Rate Limiting y Sanitización)
app.post('/api/orders', orderLimiter, (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !Array.isArray(orderData.items) ||
        orderData.items.length === 0 || orderData.items.length > 30) {
      return res.status(400).json({ error: 'El pedido no contiene ítems.' });
    }

    const items = [];
    for (const item of orderData.items) {
      const productId = item && ((item.product && item.product.id) || item.id);
      const quantity = Number(item && item.quantity);
      const product = typeof productId === 'string' ? db.getProductById(productId) : null;
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 25 ||
          !Number.isFinite(Number(product.price)) || Number(product.price) < 0 ||
          product.isAvailable === false ||
          !product.businessId || !db.getBusinessById(product.businessId)) {
        return res.status(400).json({ error: 'El pedido contiene un producto o una cantidad no válida.' });
      }

      const customization = item.customization && typeof item.customization === 'object'
        ? item.customization
        : {};
      items.push({
        product: {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image: sanitizeImageUrl(product.image, ''),
          businessId: product.businessId,
          businessName: product.businessName,
          businessNeighborhood: product.businessNeighborhood,
          businessAvatar: product.businessAvatar
        },
        quantity,
        customization: {
          flavor: sanitizeInput(customization.flavor, 80),
          dedication: sanitizeInput(customization.dedication, 120),
          candle: customization.candle === true,
          note: sanitizeInput(customization.note, 200)
        }
      });
    }
    const deliveryType = ['delivery', 'pickup'].includes(orderData.deliveryType) ? orderData.deliveryType : 'delivery';
    const paymentMethod = ['cash', 'transfer', 'mercadopago'].includes(orderData.paymentMethod)
      ? orderData.paymentMethod
      : 'cash';
    const itemsByBusiness = new Map();
    for (const item of items) {
      const businessId = item.product.businessId;
      if (!itemsByBusiness.has(businessId)) itemsByBusiness.set(businessId, []);
      itemsByBusiness.get(businessId).push(item);
    }

    const newOrders = [];
    const rawOrderId = orderData.id || orderData.orderId;
    const clientOrderId = typeof rawOrderId === 'string' && /^ORD-[A-Za-z0-9_-]{3,20}$/.test(rawOrderId)
      ? rawOrderId
      : null;
    let bizIndex = 0;

    for (const [businessId, businessItems] of itemsByBusiness) {
      bizIndex += 1;
      const business = db.getBusinessById(businessId);
      const promoState = db.computeBusinessPromoState(business);
      const subtotal = businessItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const serviceFee = Math.round(subtotal * promoState.serviceFeeRate);
      const waivedServiceFee = promoState.isPromoActive
        ? Math.round(subtotal * promoState.standardServiceFeeRate)
        : 0;
      const freeShippingFrom = Number(business.freeShippingFrom) || 45000;
      const deliveryFee = Number(business.deliveryFee) >= 0 ? Number(business.deliveryFee) : 1500;
      const effectiveDeliveryFee = deliveryType === 'delivery' && subtotal < freeShippingFrom ? deliveryFee : 0;
      const merchantPayout = subtotal + effectiveDeliveryFee;
      const total = subtotal + serviceFee + effectiveDeliveryFee;

      let candidateId = undefined;
      if (clientOrderId) {
        const desiredId = itemsByBusiness.size === 1 ? clientOrderId : `${clientOrderId}-${bizIndex}`;
        if (!db.getOrderById(desiredId)) candidateId = desiredId;
      }

      newOrders.push(db.addOrder({
        ...(candidateId ? { id: candidateId } : {}),
        customerName: sanitizeInput(orderData.customerName, 80),
        customerPhone: typeof orderData.customerPhone === 'string'
          ? orderData.customerPhone.replace(/\D/g, '').slice(0, 20)
          : '',
        deliveryType,
        customerAddress: sanitizeInput(orderData.address, 200),
        paymentMethod,
        subtotal,
        serviceFee,
        serviceFeeRate: promoState.serviceFeeRate,
        waivedServiceFee,
        isPromoOrder: promoState.isPromoActive,
        deliveryFee: effectiveDeliveryFee,
        merchantPayout,
        total,
        items: businessItems,
        businessId
      }));
    }
    res.json({ success: true, order: newOrders[0], orders: newOrders });
  } catch (err) {
    console.error('Error al registrar pedido:', err);
    res.status(500).json({ error: 'Error al registrar pedido.' });
  }
});



// ============================================================================
// 10-B. SISTEMA DE DISPUTAS Y REEMBOLSOS
// ============================================================================

// Rate limiter especifico para disputas (5 por hora por IP)
const disputeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas disputas enviadas. Intenta en una hora.' }
});

// POST /api/orders/:id/dispute — El comprador reporta que el local no respondio
app.post('/api/orders/:id/dispute', disputeLimiter, (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, customerPhone, reason } = req.body;
    const order = db.getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const validReasons = ['no_response', 'wrong_order', 'quality_issue', 'cancellation_revocation', 'arrepentimiento', 'other'];
    const safeReason = validReasons.includes(reason) ? reason : 'no_response';
    const existing = db.getDisputeByOrderId(id);
    if (existing) {
      return res.json({ success: true, dispute: existing, alreadyExists: true });
    }
    const dispute = db.createDispute({
      orderId: id,
      customerName: sanitizeInput(customerName || order.customerName, 80),
      customerPhone: typeof (customerPhone || order.customerPhone) === 'string'
        ? (customerPhone || order.customerPhone).replace(/\D/g, '').slice(0, 20)
        : '',
      businessId: order.businessId || '',
      total: order.total || 0,
      reason: safeReason
    });
    db.updateOrderStatus(id, 'en_disputa');
    console.log('Disputa creada: ' + dispute.id + ' para pedido ' + id);
    res.json({ success: true, dispute });
  } catch (err) {
    console.error('Error al crear disputa:', err);
    res.status(500).json({ error: 'Error al procesar la disputa.' });
  }
});

// GET /api/admin/disputes — Faku ve todas las disputas
app.get('/api/admin/disputes', (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const disputes = db.getDisputes();
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener disputas.' });
  }
});

// PATCH /api/admin/disputes/:id — Faku resuelve la disputa
app.patch('/api/admin/disputes/:id', (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const { id } = req.params;
    const { resolution, resolutionNote } = req.body;
    const validResolutions = ['reembolso', 'rechazo', 'en_revision'];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({ error: 'Resolucion no valida.' });
    }
    const disputes = db.getDisputes();
    const dispute = disputes.find(d => d.id === id);
    if (!dispute) {
      return res.status(404).json({ error: 'Disputa no encontrada.' });
    }
    const resolved = db.resolveDispute(id, resolution, sanitizeInput(resolutionNote, 300));
    if (resolution === 'reembolso') {
      db.updateOrderStatus(dispute.orderId, 'reembolsado');
    } else if (resolution === 'rechazo') {
      db.updateOrderStatus(dispute.orderId, 'disputa_cerrada');
    }
    res.json({ success: true, dispute: resolved });
  } catch (err) {
    console.error('Error al resolver disputa:', err);
    res.status(500).json({ error: 'Error al resolver la disputa.' });
  }
});

// ============================================================================
// 10-C. PROGRAMA COMERCIOS FUNDADORES (1ER MES 0% SERVICIO / 20% BONIFICADO)
// ============================================================================

function verifyAdminTokenHeader(req, res) {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken || !adminToken || adminToken !== expectedToken) {
    res.status(403).json({ error: 'Acceso denegado.' });
    return false;
  }
  return true;
}

// GET /api/admin/promo — Estado general de cupos (3 o 5 cafeterías) y contadores de 30 días
app.get('/api/admin/promo', (req, res) => {
  try {
    if (!verifyAdminTokenHeader(req, res)) return;
    const settings = db.getPromoSettings();
    const businesses = db.getBusinesses().map(b => {
      const enriched = db.enrichBusinessWithPromo(b);
      const productsCount = db.getProductsByBusiness(b.id).length;
      const orders = db.getOrdersByBusiness(b.id);
      const revenueTotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      return {
        ...enriched,
        productsCount,
        ordersCount: orders.length,
        revenueTotal
      };
    });

    res.json({
      settings,
      usedSlots: db.getPromoBusinessesCount(),
      remainingSlots: db.getRemainingPromoSlots(),
      businesses
    });
  } catch (err) {
    console.error('Error en GET /api/admin/promo:', err);
    res.status(500).json({ error: 'Error al obtener estado de promociones.' });
  }
});

// PATCH /api/admin/promo/settings — Configurar cantidad de cafeterías fundadoras (ej: 3 o 5) y días
app.patch('/api/admin/promo/settings', (req, res) => {
  try {
    if (!verifyAdminTokenHeader(req, res)) return;
    const updated = db.savePromoSettings(req.body || {});
    res.json({
      success: true,
      settings: updated,
      usedSlots: db.getPromoBusinessesCount(),
      remainingSlots: db.getRemainingPromoSlots()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar configuración de promoción.' });
  }
});

// PATCH /api/admin/promo/business/:id — Activar / reiniciar 30 días / extender / finalizar promo de una cafetería
app.patch('/api/admin/promo/business/:id', (req, res) => {
  try {
    if (!verifyAdminTokenHeader(req, res)) return;
    const { id } = req.params;
    const { action } = req.body || {};
    const validActions = ['start_30d', 'pending_first_product', 'extend_15d', 'end_promo'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Acción no válida.' });
    }
    const updated = db.adminUpdateBusinessPromo(id, action);
    if (!updated) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }
    res.json({ success: true, business: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar promoción del comercio.' });
  }
});

// 10. Subida Segura a Cloudinary (Con Rate Limiting y límite 12MB solo para imágenes)
app.post('/api/upload', uploadLimiter, express.json({ limit: '12mb' }), (req, res) => {
  uploadHandler(req, res);
});

// ============================================================================
// 11. FILTRADO ESTRICTO DE SEGURIDAD Y ARCHIVOS ESTÁTICOS
// ============================================================================

// A. Prohibir acceso directo a archivos confidenciales, bases de datos y scripts de backend
app.use((req, res, next) => {
  const reqPath = decodeURI(req.path).toLowerCase();

  const forbiddenPatterns = [
    /^\/data(\/|$)/i,
    /^\/scratch(\/|$)/i,
    /^\/node_modules(\/|$)/i,
    /^\/\.git(\/|$)/i,
    /\.env/i,
    /\.json$/i,     // Bloquea todos los .json excepto manifest.json
    /\.lock$/i,
    /\.(md|log|yml|yaml|bak|backup|config)$/i,
    /(server|db|package|package-lock)\.js$/i
  ];

  if (reqPath === '/manifest.json') {
    return next();
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(reqPath)) {
      return res.status(403).json({ error: 'Acceso denegado: recurso protegido por directiva de seguridad.' });
    }
  }

  next();
});

// B. Servir únicamente carpetas públicas autorizadas
app.use('/css', express.static(path.join(__dirname, 'css'), { dotfiles: 'ignore', maxAge: '1d' }));
app.use('/js', express.static(path.join(__dirname, 'js'), { dotfiles: 'ignore', maxAge: '1d' }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'ignore', maxAge: '1d' }));

// C. Archivos estáticos puntuales del cliente web y SEO (soporta / y // accidentales)
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get(/^\/+robots\.txt$/, (req, res) => res.type('text/plain').sendFile(path.join(__dirname, 'robots.txt')));
app.get(/^\/+sitemap\.xml$/, (req, res) => res.type('application/xml').sendFile(path.join(__dirname, 'sitemap.xml')));
app.get(/^\/+google6a93c74b42453c48\.html$/, (req, res) => res.sendFile(path.join(__dirname, 'google6a93c74b42453c48.html')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.ico')));
app.get('/flyer.html', (req, res) => res.sendFile(path.join(__dirname, 'flyer.html')));
app.get('/godmarket-qr.html', (req, res) => res.sendFile(path.join(__dirname, 'godmarket-qr.html')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// D. SPA Fallback (solo para rutas web limpias o peticiones HTML, nunca para archivos inexistentes)
app.get('*', (req, res) => {
  if (req.path === '/index.html') {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  if (req.path.includes('.')) {
    return res.status(404).json({ error: 'Recurso no encontrado.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️ GOD MARKET Backend Protegido activo en puerto ${PORT}`);
  console.log(`🔒 Blindaje activo: Helmet + Rate Limiter + JWT + Whitelist`);
  console.log(`🌐 Listo para Hostinger (Node.js en Producción)`);
  console.log(`=======================================================`);
});
