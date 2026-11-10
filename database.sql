-- GOD MARKET - Esquema PostgreSQL para Supabase
-- Ejecutar una vez en Supabase Dashboard > SQL Editor.
-- El backend Node usa DATABASE_URL y no expone la clave de base al navegador.

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
);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers (email);
CREATE INDEX IF NOT EXISTS idx_sellers_google ON sellers (google_id);
CREATE INDEX IF NOT EXISTS idx_sellers_business ON sellers (business_id);

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
);
CREATE INDEX IF NOT EXISTS idx_businesses_seller ON businesses (seller_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses (category);

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
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products (business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

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
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_json TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders (business_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE TABLE IF NOT EXISTS disputes (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL UNIQUE,
  business_id VARCHAR(100),
  status VARCHAR(50),
  data_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_disputes_business ON disputes (business_id);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  data_json TEXT NOT NULL
);

-- El acceso al proyecto se realiza desde el backend privado.
-- Sin políticas, RLS deniega el acceso de las claves anon/authenticated.
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE sellers, businesses, products, orders, disputes, app_settings FROM anon, authenticated;
