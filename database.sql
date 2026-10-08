-- ============================================================================
-- GOD MARKET - Esquema de Base de Datos MySQL / MariaDB para Hostinger
-- ============================================================================
-- Este script se ejecuta automáticamente por el backend al iniciar.
-- También puedes importarlo manualmente en phpMyAdmin desde el panel de Hostinger.
-- ============================================================================

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
  INDEX idx_sellers_google (google_id),
  INDEX idx_sellers_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_businesses_seller (seller_id),
  INDEX idx_businesses_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_products_business (business_id),
  INDEX idx_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_orders_business (business_id),
  INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
