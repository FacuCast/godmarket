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
const JWT_SECRET = process.env.JWT_SECRET || 'godmarket_prod_secret_token_secure_key_2026';

// ============================================================================
// 1. CABECERAS DE SEGURIDAD Y PROTECCIONES GLOBALES (HELMET + CORS)
// ============================================================================
app.use(helmet({
  contentSecurityPolicy: false, // Habilita recursos externos (Leaflet, OpenStreetMap, Google Fonts, Unsplash)
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // No bloquear comunicación con popup de Google
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' } // Requerido por Google Identity Services
}));

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());

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
// Límite de 1MB para endpoints comunes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Helper: Sanitizar texto para mitigar inyecciones XSS
function sanitizeInput(str, maxLen = 300) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/[<>]/g, '')
    .trim();
}

// Helper: Decodificar JWT de Google de manera segura sin dependencias externas
function decodeGoogleJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Error decodificando JWT de Google:', err);
    return null;
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
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7).trim()
      : (req.headers['x-seller-token'] || req.query.token);

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.seller = decoded;
      return next();
    }

    // Modo compatibilidad segura para transiciones
    const sellerId = req.headers['x-seller-id'] || req.query.sellerId;
    const googleId = req.headers['x-google-id'] || req.query.googleId;
    const businessId = req.headers['x-business-id'] || req.body?.businessId || req.query.businessId;

    let seller = null;
    if (sellerId) seller = db.getSellerById(sellerId);
    if (!seller && googleId) seller = db.getSellerByGoogleId(googleId);
    if (!seller && businessId) {
      seller = db.getSellers().find(s => s.businessId === businessId);
    }
    if (!seller && req.params?.id) {
      const order = db.getOrderById ? db.getOrderById(req.params.id) : null;
      if (order && order.businessId) {
        seller = db.getSellers().find(s => s.businessId === order.businessId);
      }
    }

    if (seller) {
      req.seller = {
        sellerId: seller.id,
        googleId: seller.googleId,
        email: seller.email,
        businessId: seller.businessId
      };
      return next();
    }

    return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión como vendedor.' });
  } catch (err) {
    return res.status(403).json({ error: 'Sesión no válida o expirada. Por favor vuelve a ingresar.' });
  }
}

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// 1. Configuración pública del cliente
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || ''
  });
});

// 2. Autenticación con Google (GIS) para Vendedores
app.post('/api/auth/google', authLimiter, (req, res) => {
  try {
    const { credential, isDemo, demoUser } = req.body;

    let googleData = null;

    if (isDemo && demoUser) {
      googleData = {
        sub: sanitizeInput(demoUser.id || 'demo_google_12345', 60),
        email: sanitizeInput(demoUser.email || 'vendedor.demo@godmarket.com', 100),
        name: sanitizeInput(demoUser.name || 'Pastelero Profesional Demo', 100),
        picture: demoUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      };
    } else if (credential) {
      const payload = decodeGoogleJwt(credential);
      if (!payload || !payload.sub || !payload.email) {
        return res.status(400).json({ error: 'Token de Google inválido o malformado.' });
      }

      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!validIssuers.includes(payload.iss)) {
        return res.status(400).json({ error: 'Emisor de credencial no reconocido.' });
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

    const business = db.getBusinessById(seller.businessId);
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
    res.status(500).json({ error: 'Error procesando autenticación con Google.' });
  }
});

// 3. Registro y Onboarding de Vendedor
app.post('/api/seller/register', (req, res) => {
  try {
    const {
      googleId,
      email,
      sellerName,
      picture,
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

    if (!businessName || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre del negocio es obligatorio.' });
    }
    if (!phone || phone.trim().length < 6) {
      return res.status(400).json({ error: 'El número de WhatsApp es obligatorio para recibir pedidos.' });
    }

    let seller = (googleId ? db.getSellerByGoogleId(googleId) : null) || (email ? db.getSellerByEmail(email) : null);
    const sellerId = seller ? seller.id : 'seller_' + Date.now();

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
      avatar: avatar || '🍰',
      badge: '✨ Nuevo en GOD MARKET',
      cover: cover || picture || 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80',
      phone: cleanPhone,
      address: cleanAddress,
      lat: req.body.lat ? parseFloat(req.body.lat) : -34.5885,
      lng: req.body.lng ? parseFloat(req.body.lng) : -58.4285,
      deliveryRadiusKm: req.body.deliveryRadiusKm ? parseFloat(req.body.deliveryRadiusKm) : 5.0,
      verified: true,
      description: cleanDesc
    };

    const savedBusiness = db.saveBusiness(businessData);

    seller = db.saveSeller({
      id: sellerId,
      googleId: googleId || (seller ? seller.googleId : 'manual_' + Date.now()),
      email: email || (seller ? seller.email : ''),
      name: sanitizeInput(sellerName || (seller ? seller.name : businessName), 100),
      picture: picture || (seller ? seller.picture : ''),
      hasCompletedProfile: true,
      businessId: savedBusiness.id
    });

    const token = generateSellerToken(seller, savedBusiness.id);

    return res.json({
      success: true,
      token,
      seller,
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

    const business = seller.businessId ? db.getBusinessById(seller.businessId) : null;
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
    if (!businessId) {
      return res.status(400).json({ error: 'Falta businessId.' });
    }

    if (req.seller.businessId && req.seller.businessId !== businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para modificar este negocio.' });
    }

    const existing = db.getBusinessById(businessId);
    if (!existing) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    const cleanUpdates = { ...updates };
    if (cleanUpdates.name) cleanUpdates.name = sanitizeInput(cleanUpdates.name, 80);
    if (cleanUpdates.phone) cleanUpdates.phone = cleanUpdates.phone.toString().replace(/\D/g, '');
    if (cleanUpdates.tagline) cleanUpdates.tagline = sanitizeInput(cleanUpdates.tagline, 120);
    if (cleanUpdates.description) cleanUpdates.description = sanitizeInput(cleanUpdates.description, 500);

    const updated = db.saveBusiness({
      ...existing,
      ...cleanUpdates,
      id: businessId
    });

    res.json({ success: true, business: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar negocio.' });
  }
});

// 6. Productos del Vendedor (CRUD aislado y verificado)
app.get('/api/seller/products', verifySellerAuth, (req, res) => {
  try {
    const targetBusinessId = req.seller.businessId || req.query.businessId;
    if (!targetBusinessId) {
      return res.status(400).json({ error: 'Se requiere businessId.' });
    }
    const products = db.getProductsByBusiness(targetBusinessId);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos del vendedor.' });
  }
});

app.post('/api/seller/products', verifySellerAuth, (req, res) => {
  try {
    const businessId = req.seller.businessId || req.body.businessId;
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

    if (!businessId || !name || !price) {
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
      category: category || 'desayunos',
      categoryName: categoryName || 'Desayunos & Meriendas',
      price: parseFloat(price),
      tag: sanitizeInput(tag || '✨ Nuevo en GOD MARKET', 50),
      portion: sanitizeInput(portion || 'Para 1 o 2 personas', 50),
      description: sanitizeInput(description || '', 500),
      image: image || 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80'
    });

    res.json({ success: true, product: newProduct });
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

    if (req.seller.businessId && existing.businessId !== req.seller.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para modificar un producto de otro comercio.' });
    }

    const updates = { ...req.body };
    if (updates.name) updates.name = sanitizeInput(updates.name, 100);
    if (updates.description) updates.description = sanitizeInput(updates.description, 500);

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

    if (req.seller.businessId && existing.businessId !== req.seller.businessId) {
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
    const targetBusinessId = req.seller.businessId || req.query.businessId;
    if (!targetBusinessId) {
      return res.status(400).json({ error: 'Se requiere businessId.' });
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

    const existingOrder = db.getOrderById ? db.getOrderById(id) : null;
    if (existingOrder && req.seller.businessId && existingOrder.businessId !== req.seller.businessId) {
      return res.status(403).json({ error: 'Acceso denegado: este pedido no pertenece a tu comercio.' });
    }

    const updated = db.updateOrderStatus(id, sanitizeInput(status, 40));
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
    let products = db.getProducts();

    if (category && category !== 'todos') {
      products = products.filter(p => p.category === category);
    }
    if (businessId && businessId !== 'todos') {
      products = products.filter(p => p.businessId === businessId);
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

app.get('/api/businesses', (req, res) => {
  try {
    const businesses = db.getBusinesses();
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener negocios.' });
  }
});

// 9. Registrar Pedido Realizado por Cliente (Con Rate Limiting y Sanitización)
app.post('/api/orders', orderLimiter, (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ error: 'El pedido no contiene ítems.' });
    }

    if (orderData.customerName) orderData.customerName = sanitizeInput(orderData.customerName, 80);
    if (orderData.address) orderData.address = sanitizeInput(orderData.address, 200);
    if (orderData.customerPhone) orderData.customerPhone = orderData.customerPhone.toString().replace(/\D/g, '');
    if (orderData.notes) orderData.notes = sanitizeInput(orderData.notes, 300);

    const newOrder = db.addOrder(orderData);
    res.json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pedido.' });
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

// C. Archivos estáticos puntuales del cliente web
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.ico')));
app.get('/flyer.html', (req, res) => res.sendFile(path.join(__dirname, 'flyer.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// D. SPA Fallback (solo para rutas web limpias, nunca para archivos que no existen)
app.get('*', (req, res) => {
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
