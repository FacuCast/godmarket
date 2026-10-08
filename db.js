const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

// Conexión MySQL / MariaDB (Hostinger Database)
let sqlPool = null;

async function initSql() {
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.DB_USER || process.env.MYSQL_USER;
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
  const database = process.env.DB_NAME || process.env.MYSQL_DATABASE;

  if (!user || !database) {
    console.log('📦 Base de Datos: Modo local JSON en ./data (Para activar MySQL en Hostinger define DB_NAME y DB_USER en las variables de entorno)');
    return;
  }

  try {
    sqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000
    });

    // Probar conexión
    await sqlPool.query('SELECT 1');
    console.log(`🐬 MySQL / MariaDB (Hostinger): Conectado con éxito a "${database}" en ${host}:${port}`);

    // Crear tablas automáticamente si no existen
    await sqlPool.query(`
      CREATE TABLE IF NOT EXISTS sellers (
        id VARCHAR(100) PRIMARY KEY,
        google_id VARCHAR(100),
        email VARCHAR(255),
        name VARCHAR(255),
        picture TEXT,
        has_completed_profile TINYINT(1) DEFAULT 0,
        business_id VARCHAR(100),
        created_at VARCHAR(50),
        updated_at VARCHAR(50),
        data_json LONGTEXT,
        INDEX idx_sellers_email (email),
        INDEX idx_sellers_google (google_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await sqlPool.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        address VARCHAR(255),
        rating DECIMAL(3,2) DEFAULT 5.0,
        reviews INT DEFAULT 1,
        phone VARCHAR(50),
        whatsapp VARCHAR(50),
        instagram VARCHAR(100),
        cover_image TEXT,
        logo TEXT,
        is_open TINYINT(1) DEFAULT 1,
        verified TINYINT(1) DEFAULT 1,
        seller_id VARCHAR(100),
        created_at VARCHAR(50),
        data_json LONGTEXT,
        INDEX idx_businesses_seller (seller_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await sqlPool.query(`
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
        reviews INT DEFAULT 1,
        featured TINYINT(1) DEFAULT 0,
        is_available TINYINT(1) DEFAULT 1,
        created_at VARCHAR(50),
        updated_at VARCHAR(50),
        data_json LONGTEXT,
        INDEX idx_products_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await sqlPool.query(`
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
        items_json LONGTEXT,
        INDEX idx_orders_business (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Sincronizar datos: Cargar de MySQL o sembrar si está vacía
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
           ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`,
          [s.id, s.googleId || null, s.email || null, s.name || '', s.picture || '', s.hasCompletedProfile ? 1 : 0, s.businessId || null, s.createdAt || null, s.updatedAt || null, JSON.stringify(s)]
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
           ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`,
          [b.id, b.name || '', b.category || '', b.address || '', b.rating || 5.0, b.reviews || 1, b.phone || '', b.whatsapp || '', b.instagram || '', b.coverImage || '', b.logo || '', b.isOpen ? 1 : 0, b.verified ? 1 : 0, b.sellerId || null, b.createdAt || null, JSON.stringify(b)]
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
           ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`,
          [p.id, p.name || '', p.description || '', p.price || 0, p.originalPrice || null, p.category || '', p.image || '', p.businessId || null, p.rating || 5.0, p.reviews || 1, p.featured ? 1 : 0, p.isAvailable !== false ? 1 : 0, p.createdAt || null, p.updatedAt || null, JSON.stringify(p)]
        );
      }
    }

    const [dbOrders] = await sqlPool.query('SELECT * FROM orders');
    if (dbOrders.length > 0) {
      ordersCache = dbOrders.map(r => {
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
          `INSERT INTO orders (id, customer_name, customer_phone, customer_address, payment_method, delivery_type, total, status, business_id, created_at, updated_at, items_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), items_json = VALUES(items_json)`,
          [o.id, o.customerName || '', o.customerPhone || '', o.customerAddress || '', o.paymentMethod || '', o.deliveryType || '', o.total || 0, o.status || 'pendiente', o.businessId || null, o.createdAt || null, o.updatedAt || null, JSON.stringify(o.items || [])]
        );
      }
    }

    console.log(`📊 Base de datos MySQL sincronizada: ${businessesCache.length} negocios, ${productsCache.length} productos, ${ordersCache.length} órdenes`);

  } catch (err) {
    console.warn('⚠️ No se pudo conectar a MySQL:', err.message, '-> Continuando en modo local JSON.');
    sqlPool = null;
  }
}

// Inicializar conexión
initSql();

const db = {
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
      sqlPool.query(
        `INSERT INTO sellers (id, google_id, email, name, picture, has_completed_profile, business_id, created_at, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           google_id = VALUES(google_id), email = VALUES(email), name = VALUES(name),
           picture = VALUES(picture), has_completed_profile = VALUES(has_completed_profile),
           business_id = VALUES(business_id), updated_at = VALUES(updated_at), data_json = VALUES(data_json)`,
        [saved.id, saved.googleId || null, saved.email || null, saved.name || '', saved.picture || '', saved.hasCompletedProfile ? 1 : 0, saved.businessId || null, saved.createdAt || null, saved.updatedAt || null, JSON.stringify(saved)]
      ).catch(e => console.warn('MySQL save error (seller):', e.message));
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

    if (sqlPool) {
      sqlPool.query(
        `INSERT INTO businesses (id, name, category, address, rating, reviews, phone, whatsapp, instagram, cover_image, logo, is_open, verified, seller_id, created_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), category = VALUES(category), address = VALUES(address),
           rating = VALUES(rating), reviews = VALUES(reviews), phone = VALUES(phone),
           whatsapp = VALUES(whatsapp), instagram = VALUES(instagram), cover_image = VALUES(cover_image),
           logo = VALUES(logo), is_open = VALUES(is_open), verified = VALUES(verified),
           seller_id = VALUES(seller_id), data_json = VALUES(data_json)`,
        [saved.id, saved.name || '', saved.category || '', saved.address || '', saved.rating || 5.0, saved.reviews || 1, saved.phone || '', saved.whatsapp || '', saved.instagram || '', saved.coverImage || '', saved.logo || '', saved.isOpen ? 1 : 0, saved.verified ? 1 : 0, saved.sellerId || null, saved.createdAt || null, JSON.stringify(saved)]
      ).catch(e => console.warn('MySQL save error (business):', e.message));
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
      sqlPool.query(
        `INSERT INTO products (id, name, description, price, original_price, category, image, business_id, rating, reviews, featured, is_available, created_at, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), price = VALUES(price),
           original_price = VALUES(original_price), category = VALUES(category), image = VALUES(image),
           business_id = VALUES(business_id), rating = VALUES(rating), reviews = VALUES(reviews),
           featured = VALUES(featured), is_available = VALUES(is_available), updated_at = VALUES(updated_at),
           data_json = VALUES(data_json)`,
        [newProduct.id, newProduct.name || '', newProduct.description || '', newProduct.price || 0, newProduct.originalPrice || null, newProduct.category || '', newProduct.image || '', newProduct.businessId || null, newProduct.rating || 5.0, newProduct.reviews || 1, newProduct.featured ? 1 : 0, newProduct.isAvailable !== false ? 1 : 0, newProduct.createdAt || null, newProduct.updatedAt || null, JSON.stringify(newProduct)]
      ).catch(e => console.warn('MySQL save error (product):', e.message));
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
        sqlPool.query(
          `INSERT INTO products (id, name, description, price, original_price, category, image, business_id, rating, reviews, featured, is_available, created_at, updated_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name), description = VALUES(description), price = VALUES(price),
             original_price = VALUES(original_price), category = VALUES(category), image = VALUES(image),
             business_id = VALUES(business_id), rating = VALUES(rating), reviews = VALUES(reviews),
             featured = VALUES(featured), is_available = VALUES(is_available), updated_at = VALUES(updated_at),
             data_json = VALUES(data_json)`,
          [updated.id, updated.name || '', updated.description || '', updated.price || 0, updated.originalPrice || null, updated.category || '', updated.image || '', updated.businessId || null, updated.rating || 5.0, updated.reviews || 1, updated.featured ? 1 : 0, updated.isAvailable !== false ? 1 : 0, updated.createdAt || null, updated.updatedAt || null, JSON.stringify(updated)]
        ).catch(e => console.warn('MySQL update error (product):', e.message));
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
        sqlPool.query('DELETE FROM products WHERE id = ?', [id])
          .catch(e => console.warn('MySQL delete error (product):', e.message));
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
      sqlPool.query(
        `INSERT INTO orders (id, customer_name, customer_phone, customer_address, payment_method, delivery_type, total, status, business_id, created_at, updated_at, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), items_json = VALUES(items_json)`,
        [newOrder.id, newOrder.customerName || '', newOrder.customerPhone || '', newOrder.customerAddress || '', newOrder.paymentMethod || '', newOrder.deliveryType || '', newOrder.total || 0, newOrder.status || 'pendiente', newOrder.businessId || null, newOrder.createdAt || null, newOrder.updatedAt || null, JSON.stringify(newOrder.items || [])]
      ).catch(e => console.warn('MySQL save error (order):', e.message));
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
        sqlPool.query('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, order.updatedAt, orderId])
          .catch(e => console.warn('MySQL status error (order):', e.message));
      }
      return order;
    }
    return null;
  }
};

module.exports = db;
