const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('No se pudo crear el directorio local data:', err.message);
}

function getFilePath(file) {
  return path.join(DATA_DIR, file);
}

function readJsonFile(file, fallback = []) {
  try {
    const filePath = getFilePath(file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error leyendo ${file}:`, err.message);
    return fallback;
  }
}

function writeJsonFile(file, data) {
  try {
    const filePath = getFilePath(file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error guardando ${file}:`, err.message);
    return false;
  }
}

// Caches en memoria inicializadas desde JSON local
let sellersCache = readJsonFile('sellers.json', []);
let businessesCache = readJsonFile('businesses.json', []);
let productsCache = readJsonFile('products.json', []);
let ordersCache = readJsonFile('orders.json', []);
let disputesCache = readJsonFile('disputes.json', []);

const DEFAULT_PROMO_SETTINGS = {
  enabled: true,
  maxPromoBusinesses: 5,
  promoDurationDays: 30,
  standardServiceFeeRate: 0.20
};
let promoSettingsCache = {
  ...DEFAULT_PROMO_SETTINGS,
  ...(readJsonFile('promo_settings.json', DEFAULT_PROMO_SETTINGS) || {})
};

const DEFAULT_VISIT_STATS = {
  total: 0,
  uniqueSessions: 0,
  daily: {},
  byBusiness: {},
  updatedAt: null
};
let visitStatsCache = {
  ...DEFAULT_VISIT_STATS,
  ...(readJsonFile('visits.json', DEFAULT_VISIT_STATS) || {})
};

function getArgentinaDateKey() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Conexión PostgreSQL (Supabase)
let sqlPool = null;
const pendingSqlWrites = new Set();

function createPostgresAdapter(pool) {
  return {
    async query(statement, values = []) {
      let parameterIndex = 0;
      const postgresStatement = statement.replace(/\?/g, () => `$${++parameterIndex}`);
      const result = await pool.query(postgresStatement, values);
      return [result.rows];
    },
    end() {
      return pool.end();
    }
  };
}

function trackSqlWrite(query, operation) {
  const write = Promise.resolve(query).then(
    () => null,
    error => {
      console.error(`PostgreSQL write error (${operation}):`, error.message);
      return new Error(`No se pudo guardar ${operation} en PostgreSQL.`, { cause: error });
    }
  );
  pendingSqlWrites.add(write);
  write.then(() => pendingSqlWrites.delete(write));
}

async function flush() {
  const results = await Promise.all([...pendingSqlWrites]);
  const failure = results.find(Boolean);
  if (failure) throw failure;
}

async function initSql() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL es obligatorio en producción (Supabase PostgreSQL).');
    }
    console.log('📦 Base de Datos: Modo local JSON en ./data (configura DATABASE_URL para PostgreSQL/Supabase).');
    return;
  }

  try {
    const postgresPool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false }
    });
    sqlPool = createPostgresAdapter(postgresPool);

    // Probar conexión
    await sqlPool.query('SELECT 1');
    console.log('🐘 PostgreSQL: conectado a la base configurada.');

    const schemaStatements = [
      `
      CREATE TABLE IF NOT EXISTS sellers (
        id VARCHAR(100) PRIMARY KEY,
        google_id VARCHAR(100),
        email VARCHAR(255),
        name VARCHAR(255),
        picture TEXT,
        has_completed_profile BOOLEAN NOT NULL DEFAULT FALSE,
        business_id VARCHAR(100),
        created_at VARCHAR(50),
        updated_at VARCHAR(50),
        data_json TEXT
      )`,
      `
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        address VARCHAR(255),
        rating DECIMAL(3,2) DEFAULT 5.0,
        reviews INTEGER DEFAULT 1,
        phone VARCHAR(50),
        whatsapp VARCHAR(50),
        instagram VARCHAR(100),
        cover_image TEXT,
        logo TEXT,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        verified BOOLEAN NOT NULL DEFAULT TRUE,
        seller_id VARCHAR(100),
        created_at VARCHAR(50),
        data_json TEXT
      )`,
      `
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        category VARCHAR(100),
        image TEXT,
        business_id VARCHAR(100),
        rating DECIMAL(3,2) DEFAULT 5.0,
        reviews INTEGER DEFAULT 1,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        created_at VARCHAR(50),
        updated_at VARCHAR(50),
        data_json TEXT
      )`,
      `
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address VARCHAR(255),
        payment_method VARCHAR(50),
        delivery_type VARCHAR(50),
        total DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pendiente',
        business_id VARCHAR(100),
        created_at VARCHAR(50),
        updated_at VARCHAR(50),
        items_json TEXT,
        data_json TEXT
      )`,
      `
      CREATE TABLE IF NOT EXISTS disputes (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL UNIQUE,
        business_id VARCHAR(100),
        status VARCHAR(50),
        data_json TEXT
      )`,
      `
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        data_json TEXT NOT NULL
      )`,
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_json TEXT',
      'CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers (email)',
      'CREATE INDEX IF NOT EXISTS idx_sellers_google ON sellers (google_id)',
      'CREATE INDEX IF NOT EXISTS idx_sellers_business ON sellers (business_id)',
      'CREATE INDEX IF NOT EXISTS idx_businesses_seller ON businesses (seller_id)',
      'CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses (category)',
      'CREATE INDEX IF NOT EXISTS idx_products_business ON products (business_id)',
      'CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)',
      'CREATE INDEX IF NOT EXISTS idx_orders_business ON orders (business_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)',
      'CREATE INDEX IF NOT EXISTS idx_disputes_business ON disputes (business_id)',
      ...['sellers', 'businesses', 'products', 'orders', 'disputes', 'app_settings']
        .map(table => `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
      'REVOKE ALL ON TABLE sellers, businesses, products, orders, disputes, app_settings FROM anon, authenticated'
    ];
    for (const statement of schemaStatements) {
      await sqlPool.query(statement);
    }

    // Sincronizar datos: cargar desde PostgreSQL o sembrar si está vacía
    const [dbSellers] = await sqlPool.query('SELECT * FROM sellers');
    if (dbSellers.length > 0) {
      sellersCache = dbSellers.map(r => r.data_json ? JSON.parse(r.data_json) : {
        id: r.id, googleId: r.google_id, email: r.email, name: r.name, picture: r.picture,
        hasCompletedProfile: !!r.has_completed_profile, businessId: r.business_id,
        createdAt: r.created_at, updatedAt: r.updated_at
      });
      writeJsonFile('sellers.json', sellersCache);
    } else if (sellersCache.length > 0) {
      for (const s of sellersCache) {
        await sqlPool.query(
          `INSERT INTO sellers (id, google_id, email, name, picture, has_completed_profile, business_id, created_at, updated_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json`,
          [s.id, s.googleId || null, s.email || null, s.name || '', s.picture || '', Boolean(s.hasCompletedProfile), s.businessId || null, s.createdAt || null, s.updatedAt || null, JSON.stringify(s)]
        );
      }
    }

    const [dbBusinesses] = await sqlPool.query('SELECT * FROM businesses');
    if (dbBusinesses.length > 0) {
      businessesCache = dbBusinesses.map(r => r.data_json ? JSON.parse(r.data_json) : {
        id: r.id, name: r.name, category: r.category, address: r.address,
        rating: Number(r.rating) || 5.0, reviews: r.reviews || 1, phone: r.phone,
        whatsapp: r.whatsapp, instagram: r.instagram, coverImage: r.cover_image,
        logo: r.logo, isOpen: !!r.is_open, verified: !!r.verified, sellerId: r.seller_id,
        createdAt: r.created_at
      });
      writeJsonFile('businesses.json', businessesCache);
    } else if (businessesCache.length > 0) {
      for (const b of businessesCache) {
        await sqlPool.query(
          `INSERT INTO businesses (id, name, category, address, rating, reviews, phone, whatsapp, instagram, cover_image, logo, is_open, verified, seller_id, created_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json`,
          [b.id, b.name || '', b.category || '', b.address || '', b.rating || 5.0, b.reviews || 1, b.phone || '', b.whatsapp || '', b.instagram || '', b.coverImage || '', b.logo || '', Boolean(b.isOpen), Boolean(b.verified), b.sellerId || null, b.createdAt || null, JSON.stringify(b)]
        );
      }
    }

    const [dbProducts] = await sqlPool.query('SELECT * FROM products');
    if (dbProducts.length > 0) {
      productsCache = dbProducts.map(r => r.data_json ? JSON.parse(r.data_json) : {
        id: r.id, name: r.name, description: r.description, price: Number(r.price),
        originalPrice: r.original_price ? Number(r.original_price) : null, category: r.category,
        image: r.image, businessId: r.business_id, rating: Number(r.rating) || 5.0,
        reviews: r.reviews || 1, featured: !!r.featured, isAvailable: !!r.is_available,
        createdAt: r.created_at, updatedAt: r.updated_at
      });
      writeJsonFile('products.json', productsCache);
    } else if (productsCache.length > 0) {
      for (const p of productsCache) {
        await sqlPool.query(
          `INSERT INTO products (id, name, description, price, original_price, category, image, business_id, rating, reviews, featured, is_available, created_at, updated_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json`,
          [p.id, p.name || '', p.description || '', p.price || 0, p.originalPrice || null, p.category || '', p.image || '', p.businessId || null, p.rating || 5.0, p.reviews || 1, Boolean(p.featured), p.isAvailable !== false, p.createdAt || null, p.updatedAt || null, JSON.stringify(p)]
        );
      }
    }

    const [dbOrders] = await sqlPool.query('SELECT * FROM orders');
    if (dbOrders.length > 0) {
      ordersCache = dbOrders.map(r => {
        if (r.data_json) {
          try {
            const fullOrder = JSON.parse(r.data_json);
            if (fullOrder && typeof fullOrder === 'object' && !Array.isArray(fullOrder)) {
              return { ...fullOrder, id: r.id, status: r.status, updatedAt: r.updated_at || fullOrder.updatedAt };
            }
          } catch (e) {
            console.warn(`No se pudo leer la orden ${r.id} desde data_json:`, e.message);
          }
        }
        let items = [];
        try { if (r.items_json) items = JSON.parse(r.items_json); } catch (e) {}
        return {
          id: r.id, customerName: r.customer_name, customerPhone: r.customer_phone,
          customerAddress: r.customer_address, paymentMethod: r.payment_method,
          deliveryType: r.delivery_type, total: Number(r.total) || 0, status: r.status,
          businessId: r.business_id, createdAt: r.created_at, updatedAt: r.updated_at,
          items
        };
      });
      writeJsonFile('orders.json', ordersCache);
    } else if (ordersCache.length > 0) {
      for (const o of ordersCache) {
        await sqlPool.query(
          `INSERT INTO orders (id, customer_name, customer_phone, customer_address, payment_method, delivery_type, total, status, business_id, created_at, updated_at, items_json, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, items_json = EXCLUDED.items_json, data_json = EXCLUDED.data_json`,
          [o.id, o.customerName || '', o.customerPhone || '', o.customerAddress || '', o.paymentMethod || '', o.deliveryType || '', o.total || 0, o.status || 'pendiente', o.businessId || null, o.createdAt || null, o.updatedAt || null, JSON.stringify(o.items || []), JSON.stringify(o)]
        );
      }
    }

    const [dbDisputes] = await sqlPool.query('SELECT data_json FROM disputes');
    if (dbDisputes.length > 0) {
      disputesCache = dbDisputes.flatMap(row => {
        try {
          const dispute = JSON.parse(row.data_json);
          return dispute && typeof dispute === 'object' && !Array.isArray(dispute) ? [dispute] : [];
        } catch (error) {
          console.warn('No se pudo leer una disputa desde PostgreSQL:', error.message);
          return [];
        }
      });
      writeJsonFile('disputes.json', disputesCache);
    } else if (disputesCache.length > 0) {
      for (const dispute of disputesCache) {
        await sqlPool.query(
          `INSERT INTO disputes (id, order_id, business_id, status, data_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, data_json = EXCLUDED.data_json`,
          [dispute.id, dispute.orderId, dispute.businessId || null, dispute.status || '', JSON.stringify(dispute)]
        );
      }
    }

    const [dbPromoSettings] = await sqlPool.query(
      'SELECT data_json FROM app_settings WHERE setting_key = ?',
      ['promo_settings']
    );
    if (dbPromoSettings.length > 0) {
      try {
        promoSettingsCache = {
          ...DEFAULT_PROMO_SETTINGS,
          ...promoSettingsCache,
          ...JSON.parse(dbPromoSettings[0].data_json)
        };
        writeJsonFile('promo_settings.json', promoSettingsCache);
      } catch (error) {
        console.warn('No se pudieron leer las opciones de promoción desde PostgreSQL:', error.message);
      }
    } else {
      await sqlPool.query(
        'INSERT INTO app_settings (setting_key, data_json) VALUES (?, ?)',
        ['promo_settings', JSON.stringify(promoSettingsCache)]
      );
    }

    const [dbVisitStats] = await sqlPool.query(
      'SELECT data_json FROM app_settings WHERE setting_key = ?',
      ['visit_stats']
    );
    if (dbVisitStats.length > 0) {
      try {
        const parsedVisits = JSON.parse(dbVisitStats[0].data_json);
        visitStatsCache = {
          ...DEFAULT_VISIT_STATS,
          ...visitStatsCache,
          ...parsedVisits,
          total: Math.max(Number(visitStatsCache.total) || 0, Number(parsedVisits && parsedVisits.total) || 0),
          uniqueSessions: Math.max(Number(visitStatsCache.uniqueSessions) || 0, Number(parsedVisits && parsedVisits.uniqueSessions) || 0),
          daily: { ...(visitStatsCache.daily || {}), ...((parsedVisits && parsedVisits.daily) || {}) },
          byBusiness: { ...(visitStatsCache.byBusiness || {}), ...((parsedVisits && parsedVisits.byBusiness) || {}) }
        };
        writeJsonFile('visits.json', visitStatsCache);
      } catch (error) {
        console.warn('No se pudieron leer las estadísticas de visitas desde PostgreSQL:', error.message);
      }
    } else {
      await sqlPool.query(
        'INSERT INTO app_settings (setting_key, data_json) VALUES (?, ?)',
        ['visit_stats', JSON.stringify(visitStatsCache)]
      );
    }

    console.log(`📊 PostgreSQL sincronizado: ${businessesCache.length} negocios, ${productsCache.length} productos, ${ordersCache.length} órdenes`);

  } catch (err) {
    if (sqlPool) await sqlPool.end().catch(() => {});
    sqlPool = null;
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    console.warn('⚠️ No se pudo conectar a PostgreSQL:', err.message, '-> Continuando en modo local JSON.');
    sqlPool = null;
  }
}

// Inicializar conexión
const ready = initSql();

const db = {
  ready,
  flush,
  // SELLERS
  getSellers() {
    return sellersCache;
  },
  getSellerByGoogleId(googleId) {
    return sellersCache.find(s => s.googleId === googleId) || null;
  },
  getSellerByEmail(email) {
    return sellersCache.find(s => s.email && s.email.toLowerCase() === email.toLowerCase()) || null;
  },
  getSellerById(id) {
    return sellersCache.find(s => s.id === id) || null;
  },
  saveSeller(sellerData) {
    const index = sellersCache.findIndex(s => s.id === sellerData.id || s.googleId === sellerData.googleId);
    let saved;
    if (index >= 0) {
      sellersCache[index] = { ...sellersCache[index], ...sellerData, updatedAt: new Date().toISOString() };
      saved = sellersCache[index];
    } else {
      saved = {
        id: sellerData.id || 'seller_' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...sellerData
      };
      sellersCache.push(saved);
    }
    writeJsonFile('sellers.json', sellersCache);

    if (sqlPool) {
      trackSqlWrite(sqlPool.query(
        `INSERT INTO sellers (id, google_id, email, name, picture, has_completed_profile, business_id, created_at, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           google_id = EXCLUDED.google_id, email = EXCLUDED.email, name = EXCLUDED.name,
           picture = EXCLUDED.picture, has_completed_profile = EXCLUDED.has_completed_profile,
           business_id = EXCLUDED.business_id, updated_at = EXCLUDED.updated_at, data_json = EXCLUDED.data_json`,
        [saved.id, saved.googleId || null, saved.email || null, saved.name || '', saved.picture || '', Boolean(saved.hasCompletedProfile), saved.businessId || null, saved.createdAt || null, saved.updatedAt || null, JSON.stringify(saved)]
      ), 'vendedor');
    }
    return saved;
  },

  // BUSINESSES
  getBusinesses() {
    return businessesCache;
  },
  getBusinessById(id) {
    return businessesCache.find(b => b.id === id) || null;
  },
  saveBusiness(businessData) {
    const index = businessesCache.findIndex(b => b.id === businessData.id);
    let saved;
    if (index >= 0) {
      businessesCache[index] = { ...businessesCache[index], ...businessData };
      saved = businessesCache[index];
    } else {
      saved = {
        id: businessData.id || 'biz-' + Date.now(),
        rating: 5.0,
        reviews: 1,
        isOpen: true,
        verified: true,
        ...businessData
      };
      businessesCache.unshift(saved);
    }
    writeJsonFile('businesses.json', businessesCache);

    // Sincronizar metadatos del negocio en productos asociados
    let productsUpdated = false;
    productsCache.forEach(p => {
      if (p.businessId === saved.id) {
        if (saved.name && p.businessName !== saved.name) { p.businessName = saved.name; productsUpdated = true; }
        if (saved.neighborhood && p.businessNeighborhood !== saved.neighborhood) { p.businessNeighborhood = saved.neighborhood; productsUpdated = true; }
        if (saved.avatar && p.businessAvatar !== saved.avatar) { p.businessAvatar = saved.avatar; productsUpdated = true; }
      }
    });
    if (productsUpdated) {
      writeJsonFile('products.json', productsCache);
    }

    if (sqlPool) {
      trackSqlWrite(sqlPool.query(
        `INSERT INTO businesses (id, name, category, address, rating, reviews, phone, whatsapp, instagram, cover_image, logo, is_open, verified, seller_id, created_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, category = EXCLUDED.category, address = EXCLUDED.address,
           rating = EXCLUDED.rating, reviews = EXCLUDED.reviews, phone = EXCLUDED.phone,
           whatsapp = EXCLUDED.whatsapp, instagram = EXCLUDED.instagram, cover_image = EXCLUDED.cover_image,
           logo = EXCLUDED.logo, is_open = EXCLUDED.is_open, verified = EXCLUDED.verified,
           seller_id = EXCLUDED.seller_id, data_json = EXCLUDED.data_json`,
        [saved.id, saved.name || '', saved.category || '', saved.address || '', saved.rating || 5.0, saved.reviews || 1, saved.phone || '', saved.whatsapp || '', saved.instagram || '', saved.coverImage || '', saved.logo || '', Boolean(saved.isOpen), Boolean(saved.verified), saved.sellerId || null, saved.createdAt || null, JSON.stringify(saved)]
      ), 'negocio');
    }
    return saved;
  },

  // PRODUCTS
  getProducts() {
    return productsCache;
  },
  getProductById(id) {
    return productsCache.find(p => p.id === id) || null;
  },
  getProductsByBusiness(businessId) {
    return productsCache.filter(p => p.businessId === businessId);
  },
  addProduct(productData) {
    const newProduct = {
      id: productData.id || 'prod-' + Date.now(),
      rating: 5.0,
      reviews: 1,
      featured: true,
      createdAt: new Date().toISOString(),
      ...productData
    };
    productsCache.unshift(newProduct);
    writeJsonFile('products.json', productsCache);

    if (sqlPool) {
      trackSqlWrite(sqlPool.query(
        `INSERT INTO products (id, name, description, price, original_price, category, image, business_id, rating, reviews, featured, is_available, created_at, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price,
           original_price = EXCLUDED.original_price, category = EXCLUDED.category, image = EXCLUDED.image,
           business_id = EXCLUDED.business_id, rating = EXCLUDED.rating, reviews = EXCLUDED.reviews,
           featured = EXCLUDED.featured, is_available = EXCLUDED.is_available, updated_at = EXCLUDED.updated_at,
           data_json = EXCLUDED.data_json`,
        [newProduct.id, newProduct.name || '', newProduct.description || '', newProduct.price || 0, newProduct.originalPrice || null, newProduct.category || '', newProduct.image || '', newProduct.businessId || null, newProduct.rating || 5.0, newProduct.reviews || 1, Boolean(newProduct.featured), newProduct.isAvailable !== false, newProduct.createdAt || null, newProduct.updatedAt || null, JSON.stringify(newProduct)]
      ), 'producto');
    }
    return newProduct;
  },
  updateProduct(id, updates) {
    const index = productsCache.findIndex(p => p.id === id);
    if (index >= 0) {
      productsCache[index] = { ...productsCache[index], ...updates, updatedAt: new Date().toISOString() };
      const updated = productsCache[index];
      writeJsonFile('products.json', productsCache);

      if (sqlPool) {
        trackSqlWrite(sqlPool.query(
          `INSERT INTO products (id, name, description, price, original_price, category, image, business_id, rating, reviews, featured, is_available, created_at, updated_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price,
             original_price = EXCLUDED.original_price, category = EXCLUDED.category, image = EXCLUDED.image,
             business_id = EXCLUDED.business_id, rating = EXCLUDED.rating, reviews = EXCLUDED.reviews,
             featured = EXCLUDED.featured, is_available = EXCLUDED.is_available, updated_at = EXCLUDED.updated_at,
             data_json = EXCLUDED.data_json`,
          [updated.id, updated.name || '', updated.description || '', updated.price || 0, updated.originalPrice || null, updated.category || '', updated.image || '', updated.businessId || null, updated.rating || 5.0, updated.reviews || 1, Boolean(updated.featured), updated.isAvailable !== false, updated.createdAt || null, updated.updatedAt || null, JSON.stringify(updated)]
        ), 'producto');
      }
      return updated;
    }
    return null;
  },
  deleteProduct(id) {
    const initialLen = productsCache.length;
    productsCache = productsCache.filter(p => p.id !== id);
    if (productsCache.length !== initialLen) {
      writeJsonFile('products.json', productsCache);

      if (sqlPool) {
        trackSqlWrite(sqlPool.query('DELETE FROM products WHERE id = ?', [id]), 'producto');
      }
      return true;
    }
    return false;
  },

  // ORDERS
  getOrders() {
    return ordersCache;
  },
  getOrderById(id) {
    return ordersCache.find(o => o.id === id) || null;
  },
  getOrdersByBusiness(businessId) {
    return ordersCache.filter(o => {
      if (o.businessId === businessId) return true;
      if (Array.isArray(o.items)) {
        return o.items.some(item => item.businessId === businessId || (item.product && item.product.businessId === businessId));
      }
      return false;
    });
  },
  addOrder(orderData) {
    const newOrder = {
      id: orderData.id || 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      createdAt: new Date().toISOString(),
      status: 'pendiente',
      ...orderData
    };
    ordersCache.unshift(newOrder);
    writeJsonFile('orders.json', ordersCache);

    if (sqlPool) {
      trackSqlWrite(
        sqlPool.query(
          `INSERT INTO orders (id, customer_name, customer_phone, customer_address, payment_method, delivery_type, total, status, business_id, created_at, updated_at, items_json, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
             customer_address = EXCLUDED.customer_address, payment_method = EXCLUDED.payment_method,
             delivery_type = EXCLUDED.delivery_type, total = EXCLUDED.total, status = EXCLUDED.status,
             business_id = EXCLUDED.business_id, updated_at = EXCLUDED.updated_at,
             items_json = EXCLUDED.items_json, data_json = EXCLUDED.data_json`,
          [newOrder.id, newOrder.customerName || '', newOrder.customerPhone || '', newOrder.customerAddress || '', newOrder.paymentMethod || '', newOrder.deliveryType || '', newOrder.total || 0, newOrder.status || 'pendiente', newOrder.businessId || null, newOrder.createdAt || null, newOrder.updatedAt || null, JSON.stringify(newOrder.items || []), JSON.stringify(newOrder)]
        ),
        'pedido'
      );
    }
    return newOrder;
  },
  updateOrderStatus(orderId, status) {
    const order = ordersCache.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      writeJsonFile('orders.json', ordersCache);

      if (sqlPool) {
        trackSqlWrite(
          sqlPool.query('UPDATE orders SET status = ?, updated_at = ?, data_json = ? WHERE id = ?', [
            status, order.updatedAt, JSON.stringify(order), orderId
          ]),
          'estado del pedido'
        );
      }
      return order;
    }
    return null;
  },

  // DISPUTES — Sistema de Disputas y Reembolsos
  getDisputes() {
    return disputesCache;
  },
  getDisputeByOrderId(orderId) {
    return this.getDisputes().find(d => d.orderId === orderId) || null;
  },
  createDispute(disputeData) {
    const existing = disputesCache.find(d => d.orderId === disputeData.orderId);
    if (existing) return existing; // Evitar duplicados

    const newDispute = {
      id: 'DISP-' + Math.floor(100000 + Math.random() * 900000),
      orderId: disputeData.orderId,
      relatedOrderIds: Array.isArray(disputeData.relatedOrderIds) ? disputeData.relatedOrderIds : [disputeData.orderId],
      customerName: disputeData.customerName || '',
      customerPhone: disputeData.customerPhone || '',
      businessId: disputeData.businessId || '',
      businessName: disputeData.businessName || '',
      total: disputeData.total || 0,
      reason: disputeData.reason || 'no_response',
      status: 'abierta', // abierta | en_revision | reembolsada | rechazada | cerrada
      resolution: null,
      resolutionNote: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    disputesCache.unshift(newDispute);
    writeJsonFile('disputes.json', disputesCache);
    if (sqlPool) {
      trackSqlWrite(
        sqlPool.query(
          `INSERT INTO disputes (id, order_id, business_id, status, data_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, data_json = EXCLUDED.data_json`,
          [newDispute.id, newDispute.orderId, newDispute.businessId || null, newDispute.status, JSON.stringify(newDispute)]
        ),
        'disputa'
      );
    }
    return newDispute;
  },
  resolveDispute(disputeId, resolution, resolutionNote) {
    const index = disputesCache.findIndex(d => d.id === disputeId);
    if (index < 0) return null;

    disputesCache[index].status = resolution === 'reembolso' ? 'reembolsada' : 'rechazada';
    disputesCache[index].resolution = resolution;
    disputesCache[index].resolutionNote = resolutionNote || '';
    disputesCache[index].updatedAt = new Date().toISOString();
    disputesCache[index].resolvedAt = new Date().toISOString();
    writeJsonFile('disputes.json', disputesCache);
    if (sqlPool) {
      const dispute = disputesCache[index];
      trackSqlWrite(
        sqlPool.query(
          'UPDATE disputes SET status = ?, data_json = ? WHERE id = ?',
          [dispute.status, JSON.stringify(dispute), dispute.id]
        ),
        'resolución de disputa'
      );
    }
    return disputesCache[index];
  },

  // PROMO LANZAMIENTO — 1er Mes con 0% Servicio (20% Bonificado) & Contador 30 Días
  getPromoSettings() {
    return { ...DEFAULT_PROMO_SETTINGS, ...promoSettingsCache };
  },
  savePromoSettings(updates = {}) {
    const clean = { ...this.getPromoSettings() };
    if (typeof updates.enabled === 'boolean') clean.enabled = updates.enabled;
    if (updates.maxPromoBusinesses !== undefined) {
      const maxBiz = parseInt(updates.maxPromoBusinesses, 10);
      if (Number.isInteger(maxBiz) && maxBiz >= 0 && maxBiz <= 500) {
        clean.maxPromoBusinesses = maxBiz;
      }
    }
    if (updates.promoDurationDays !== undefined) {
      const days = parseInt(updates.promoDurationDays, 10);
      if (Number.isInteger(days) && days >= 1 && days <= 365) {
        clean.promoDurationDays = days;
      }
    }
    if (updates.standardServiceFeeRate !== undefined) {
      const rate = Number(updates.standardServiceFeeRate);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 0.5) {
        clean.standardServiceFeeRate = rate;
      }
    }
    promoSettingsCache = clean;
    writeJsonFile('promo_settings.json', promoSettingsCache);
    if (sqlPool) {
      trackSqlWrite(
        sqlPool.query(
          `INSERT INTO app_settings (setting_key, data_json) VALUES (?, ?)
           ON CONFLICT (setting_key) DO UPDATE SET data_json = EXCLUDED.data_json`,
          ['promo_settings', JSON.stringify(promoSettingsCache)]
        ),
        'configuración de promociones'
      );
    }
    return { ...promoSettingsCache };
  },
  getPromoBusinessesCount() {
    return businessesCache.filter(b => b && (b.promoEligible === true || b.promoGrantedEver === true)).length;
  },
  getRemainingPromoSlots() {
    const settings = this.getPromoSettings();
    if (!settings.enabled) return 0;
    return Math.max(0, (Number(settings.maxPromoBusinesses) || 0) - this.getPromoBusinessesCount());
  },
  computeBusinessPromoState(business) {
    const settings = this.getPromoSettings();
    const standardRate = Number.isFinite(Number(settings.standardServiceFeeRate))
      ? Number(settings.standardServiceFeeRate)
      : 0.20;
    const durationDays = Number(business && business.promoDurationDays) || Number(settings.promoDurationDays) || 30;
    const fullDurationMs = durationDays * 24 * 60 * 60 * 1000;

    if (!business || !business.promoEligible) {
      return {
        promoEligible: false,
        promoState: business && business.promoGrantedEver ? 'expired' : 'standard',
        isPromoActive: false,
        serviceFeeRate: standardRate,
        standardServiceFeeRate: standardRate,
        promoDurationDays: durationDays,
        promoStartedAt: (business && business.promoStartedAt) || null,
        promoExpiresAt: (business && business.promoExpiresAt) || null,
        promoMsRemaining: 0,
        promoSlotNumber: (business && business.promoSlotNumber) || null
      };
    }

    // Beneficio asignado al comercio fundador, esperando que suba su 1° producto con foto para no perder días
    if (!business.promoStartedAt || !business.promoExpiresAt) {
      return {
        promoEligible: true,
        promoState: 'pending_first_product',
        isPromoActive: true,
        serviceFeeRate: 0,
        standardServiceFeeRate: standardRate,
        promoDurationDays: durationDays,
        promoStartedAt: null,
        promoExpiresAt: null,
        promoMsRemaining: fullDurationMs,
        promoSlotNumber: business.promoSlotNumber || null
      };
    }

    const expiresMs = new Date(business.promoExpiresAt).getTime();
    const nowMs = Date.now();
    const msRemaining = Number.isFinite(expiresMs) ? Math.max(0, expiresMs - nowMs) : 0;

    if (msRemaining > 0) {
      return {
        promoEligible: true,
        promoState: 'active',
        isPromoActive: true,
        serviceFeeRate: 0,
        standardServiceFeeRate: standardRate,
        promoDurationDays: durationDays,
        promoStartedAt: business.promoStartedAt,
        promoExpiresAt: business.promoExpiresAt,
        promoMsRemaining: msRemaining,
        promoSlotNumber: business.promoSlotNumber || null
      };
    }

    return {
      promoEligible: true,
      promoState: 'expired',
      isPromoActive: false,
      serviceFeeRate: standardRate,
      standardServiceFeeRate: standardRate,
      promoDurationDays: durationDays,
      promoStartedAt: business.promoStartedAt,
      promoExpiresAt: business.promoExpiresAt,
      promoMsRemaining: 0,
      promoSlotNumber: business.promoSlotNumber || null
    };
  },
  enrichBusinessWithPromo(business) {
    if (!business) return null;
    return {
      ...business,
      ...this.computeBusinessPromoState(business)
    };
  },
  isBusinessPromoActive(businessOrId) {
    const biz = typeof businessOrId === 'string' ? this.getBusinessById(businessOrId) : businessOrId;
    if (!biz) return false;
    return this.computeBusinessPromoState(biz).isPromoActive;
  },
  activateBusinessPromoTimerIfNeeded(businessId) {
    const business = this.getBusinessById(businessId);
    if (!business) return { activated: false, business: null };
    if (!business.promoEligible || (business.promoStartedAt && business.promoExpiresAt)) {
      return { activated: false, business: this.enrichBusinessWithPromo(business) };
    }

    const settings = this.getPromoSettings();
    const durationDays = Number(business.promoDurationDays) || Number(settings.promoDurationDays) || 30;
    const now = new Date();
    const expires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const saved = this.saveBusiness({
      ...business,
      promoEligible: true,
      promoGrantedEver: true,
      promoDurationDays: durationDays,
      promoStartedAt: now.toISOString(),
      promoExpiresAt: expires.toISOString(),
      badge: '🎁 Precio de Local · 0% Servicio'
    });

    return { activated: true, business: this.enrichBusinessWithPromo(saved) };
  },
  adminUpdateBusinessPromo(businessId, action) {
    const business = this.getBusinessById(businessId);
    if (!business) return null;

    const settings = this.getPromoSettings();
    const durationDays = Number(settings.promoDurationDays) || 30;
    const now = new Date();

    let updates = {};
    if (action === 'start_30d') {
      const expires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      updates = {
        promoEligible: true,
        promoGrantedEver: true,
        promoDurationDays: durationDays,
        promoStartedAt: now.toISOString(),
        promoExpiresAt: expires.toISOString(),
        promoSlotNumber: business.promoSlotNumber || (this.getPromoBusinessesCount() + 1),
        badge: '🎁 Precio de Local · 0% Servicio'
      };
    } else if (action === 'pending_first_product') {
      updates = {
        promoEligible: true,
        promoGrantedEver: true,
        promoDurationDays: durationDays,
        promoStartedAt: null,
        promoExpiresAt: null,
        promoSlotNumber: business.promoSlotNumber || (this.getPromoBusinessesCount() + 1),
        badge: '🎁 Precio de Local · 0% Servicio'
      };
    } else if (action === 'extend_15d') {
      const currentExpMs = business.promoExpiresAt ? new Date(business.promoExpiresAt).getTime() : 0;
      const baseMs = currentExpMs > now.getTime() ? currentExpMs : now.getTime();
      const newExpires = new Date(baseMs + 15 * 24 * 60 * 60 * 1000);
      updates = {
        promoEligible: true,
        promoGrantedEver: true,
        promoStartedAt: business.promoStartedAt || now.toISOString(),
        promoExpiresAt: newExpires.toISOString(),
        badge: '🎁 Precio de Local · 0% Servicio'
      };
    } else if (action === 'end_promo') {
      updates = {
        promoEligible: false,
        promoGrantedEver: business.promoGrantedEver || business.promoEligible || false,
        promoExpiresAt: now.toISOString(),
        badge: business.badge === '🎁 Precio de Local · 0% Servicio' ? '✨ Destacado en GOD MARKET' : business.badge
      };
    } else {
      return null;
    }

    const saved = this.saveBusiness({ ...business, ...updates });
    return this.enrichBusinessWithPromo(saved);
  },

  // CONTADOR DE VISITAS EN TIEMPO REAL
  getVisitStats(businessId = null) {
    const todayKey = getArgentinaDateKey();
    const daily = (visitStatsCache && typeof visitStatsCache.daily === 'object' && visitStatsCache.daily) || {};
    const byBusiness = (visitStatsCache && typeof visitStatsCache.byBusiness === 'object' && visitStatsCache.byBusiness) || {};
    const total = Math.max(0, Number(visitStatsCache.total) || 0);
    const today = Math.max(0, Number(daily[todayKey]) || 0);
    const uniqueSessions = Math.max(0, Number(visitStatsCache.uniqueSessions) || 0);
    const result = {
      total,
      today,
      uniqueSessions,
      date: todayKey,
      updatedAt: visitStatsCache.updatedAt || null
    };
    if (businessId) {
      result.businessVisits = Math.max(0, Number(byBusiness[businessId]) || 0);
    }
    return result;
  },
  recordVisit({ isNewVisitor = false, businessId = null } = {}) {
    const todayKey = getArgentinaDateKey();
    if (!visitStatsCache.daily || typeof visitStatsCache.daily !== 'object') {
      visitStatsCache.daily = {};
    }
    if (!visitStatsCache.byBusiness || typeof visitStatsCache.byBusiness !== 'object') {
      visitStatsCache.byBusiness = {};
    }

    if (businessId && typeof businessId === 'string' && /^[a-z0-9_-]{2,80}$/i.test(businessId)) {
      visitStatsCache.byBusiness[businessId] = (Number(visitStatsCache.byBusiness[businessId]) || 0) + 1;
    } else {
      visitStatsCache.total = (Number(visitStatsCache.total) || 0) + 1;
      visitStatsCache.daily[todayKey] = (Number(visitStatsCache.daily[todayKey]) || 0) + 1;
      if (isNewVisitor) {
        visitStatsCache.uniqueSessions = (Number(visitStatsCache.uniqueSessions) || 0) + 1;
      }
    }

    // Mantener solo los últimos 30 días en daily para no inflar el almacenamiento
    const keys = Object.keys(visitStatsCache.daily).sort();
    while (keys.length > 30) {
      const oldest = keys.shift();
      delete visitStatsCache.daily[oldest];
    }

    visitStatsCache.updatedAt = new Date().toISOString();
    writeJsonFile('visits.json', visitStatsCache);

    if (sqlPool) {
      trackSqlWrite(
        sqlPool.query(
          `INSERT INTO app_settings (setting_key, data_json) VALUES (?, ?)
           ON CONFLICT (setting_key) DO UPDATE SET data_json = EXCLUDED.data_json`,
          ['visit_stats', JSON.stringify(visitStatsCache)]
        ),
        'contador de visitas'
      );
    }
    return this.getVisitStats(businessId);
  }
};


module.exports = db;
