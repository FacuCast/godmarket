const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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

// Conexión MongoDB Atlas (Persistencia en la nube para producción)
let mongoDb = null;

async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('📦 Almacenamiento: Modo local JSON en ./data (Configura MONGODB_URI en .env para base de datos en la nube)');
    return;
  }

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    mongoDb = client.db();
    console.log('🍃 MongoDB Atlas: Conectado con éxito a la base de datos en la nube');

    // Cargar colecciones desde MongoDB
    const [sellers, businesses, products, orders] = await Promise.all([
      mongoDb.collection('sellers').find({}).toArray(),
      mongoDb.collection('businesses').find({}).toArray(),
      mongoDb.collection('products').find({}).toArray(),
      mongoDb.collection('orders').find({}).toArray()
    ]);

    if (sellers.length > 0) {
      sellersCache = sellers.map(({ _id, ...s }) => s);
      writeJsonFile('sellers.json', sellersCache);
    } else if (sellersCache.length > 0) {
      await mongoDb.collection('sellers').insertMany(sellersCache);
    }

    if (businesses.length > 0) {
      businessesCache = businesses.map(({ _id, ...b }) => b);
      writeJsonFile('businesses.json', businessesCache);
    } else if (businessesCache.length > 0) {
      await mongoDb.collection('businesses').insertMany(businessesCache);
    }

    if (products.length > 0) {
      productsCache = products.map(({ _id, ...p }) => p);
      writeJsonFile('products.json', productsCache);
    } else if (productsCache.length > 0) {
      await mongoDb.collection('products').insertMany(productsCache);
    }

    if (orders.length > 0) {
      ordersCache = orders.map(({ _id, ...o }) => o);
      writeJsonFile('orders.json', ordersCache);
    } else if (ordersCache.length > 0) {
      await mongoDb.collection('orders').insertMany(ordersCache);
    }

    console.log(`📊 Datos cargados desde MongoDB Atlas: ${businessesCache.length} negocios, ${productsCache.length} productos`);

  } catch (err) {
    console.warn('⚠️ No se pudo conectar a MongoDB Atlas:', err.message, '-> Continuando en modo local JSON.');
    mongoDb = null;
  }
}

// Inicializar conexión asíncrona
initMongo();

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

    if (mongoDb) {
      mongoDb.collection('sellers').replaceOne({ id: saved.id }, saved, { upsert: true }).catch(e => console.warn('Mongo save error (seller):', e.message));
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

    if (mongoDb) {
      mongoDb.collection('businesses').replaceOne({ id: saved.id }, saved, { upsert: true }).catch(e => console.warn('Mongo save error (business):', e.message));
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

    if (mongoDb) {
      mongoDb.collection('products').replaceOne({ id: newProduct.id }, newProduct, { upsert: true }).catch(e => console.warn('Mongo save error (product):', e.message));
    }
    return newProduct;
  },
  updateProduct(id, updates) {
    const index = productsCache.findIndex(p => p.id === id);
    if (index >= 0) {
      productsCache[index] = { ...productsCache[index], ...updates, updatedAt: new Date().toISOString() };
      writeJsonFile('products.json', productsCache);

      if (mongoDb) {
        mongoDb.collection('products').replaceOne({ id }, productsCache[index], { upsert: true }).catch(e => console.warn('Mongo update error (product):', e.message));
      }
      return productsCache[index];
    }
    return null;
  },
  deleteProduct(id) {
    const initialLen = productsCache.length;
    productsCache = productsCache.filter(p => p.id !== id);
    if (productsCache.length !== initialLen) {
      writeJsonFile('products.json', productsCache);

      if (mongoDb) {
        mongoDb.collection('products').deleteOne({ id }).catch(e => console.warn('Mongo delete error (product):', e.message));
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

    if (mongoDb) {
      mongoDb.collection('orders').replaceOne({ id: newOrder.id }, newOrder, { upsert: true }).catch(e => console.warn('Mongo save error (order):', e.message));
    }
    return newOrder;
  },
  updateOrderStatus(orderId, status) {
    const order = ordersCache.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      writeJsonFile('orders.json', ordersCache);

      if (mongoDb) {
        mongoDb.collection('orders').replaceOne({ id: orderId }, order, { upsert: true }).catch(e => console.warn('Mongo status error (order):', e.message));
      }
      return order;
    }
    return null;
  }
};

module.exports = db;
