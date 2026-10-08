/**
 * GOD MARKET - GESTOR DE PRODUCTOS Y NEGOCIOS DEL MARKETPLACE
 * Sincronización en tiempo real con el Backend y Base de Datos (MongoDB Atlas / JSON)
 * Cálculo geométrico de distancias esféricas (Fórmula de Haversine) y cobertura de envíos
 */

const INITIAL_BUSINESSES = [];
const INITIAL_PRODUCTS = [];

// Claves de almacenamiento local de producción
const STORAGE_KEY_PRODUCTS = 'godmarket_products_v2026_prod';
const STORAGE_KEY_BUSINESSES = 'godmarket_businesses_v2026_prod';

/**
 * Calcula la distancia ortodrómica en kilómetros entre dos coordenadas GPS (Haversine)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999;
  const R = 6371; // Radio medio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}
window.calculateDistanceKm = calculateDistanceKm;

class ProductManager {
  constructor() {
    this.businesses = this.loadBusinesses();
    this.products = this.loadProducts();
    this.syncWithBackend();
  }

  async syncWithBackend() {
    try {
      const [bizRes, prodRes] = await Promise.all([
        fetch('/api/businesses'),
        fetch('/api/products')
      ]);

      if (bizRes.ok) {
        const backendBiz = await bizRes.json();
        if (Array.isArray(backendBiz)) {
          this.businesses = backendBiz;
          this.saveBusinesses(this.businesses);
        }
      }

      if (prodRes.ok) {
        const backendProd = await prodRes.json();
        if (Array.isArray(backendProd)) {
          this.products = backendProd;
          this.saveProducts(this.products);
        }
      }

      if (window.app) {
        window.app.renderBusinessesSlider?.();
        window.app.renderStoresCards?.();
        window.app.renderProducts?.();
      }
    } catch (e) {
      console.warn('Sincronización con backend:', e.message);
    }
  }

  loadBusinesses() {
    const saved = localStorage.getItem(STORAGE_KEY_BUSINESSES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  }

  saveBusinesses(businesses) {
    this.businesses = businesses;
    localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(businesses));
  }

  getAllBusinesses() {
    return this.businesses;
  }

  getBusinessesFiltered(filter = 'all', userCoords = null, onlyInRange = false) {
    let list = this.businesses.map(b => {
      const bLat = b.lat !== undefined ? b.lat : -34.5885;
      const bLng = b.lng !== undefined ? b.lng : -58.4285;
      const radius = b.deliveryRadiusKm !== undefined ? b.deliveryRadiusKm : 5.0;

      let computedDist = null;
      let inDeliveryRange = true;

      if (userCoords && userCoords.lat !== undefined && userCoords.lng !== undefined) {
        computedDist = calculateDistanceKm(userCoords.lat, userCoords.lng, bLat, bLng);
        inDeliveryRange = computedDist <= radius;
      }

      return {
        ...b,
        lat: bLat,
        lng: bLng,
        deliveryRadiusKm: radius,
        computedDistanceKm: computedDist,
        inDeliveryRange: inDeliveryRange,
        distance: computedDist !== null ? `${computedDist} km` : (b.distance || '1.5 km')
      };
    });

    if (onlyInRange && userCoords) {
      list = list.filter(b => b.inDeliveryRange);
    }

    if (filter === 'open') {
      return list.filter(b => b.isOpen !== false);
    }
    if (filter === 'freeShipping') {
      return list.filter(b => b.freeShippingFrom && b.freeShippingFrom <= 45000);
    }
    if (filter === 'topRated') {
      return list.filter(b => b.rating >= 4.9);
    }
    if (filter === 'near') {
      return [...list].sort((a, b) => parseFloat(a.computedDistanceKm || a.distance || 99) - parseFloat(b.computedDistanceKm || b.distance || 99));
    }
    return list;
  }

  getBusinessById(id) {
    return this.businesses.find(b => b.id === id);
  }

  addBusiness(newBusiness) {
    const business = {
      id: 'biz-' + Date.now(),
      rating: 5.0,
      reviews: 1,
      deliveryTime: "30-45 min",
      deliveryFee: 1500,
      lat: newBusiness.lat || -34.5885,
      lng: newBusiness.lng || -58.4285,
      deliveryRadiusKm: newBusiness.deliveryRadiusKm || 5.0,
      avatar: "🏪",
      badge: "✨ Nuevo en el Market",
      phone: "5491156192616",
      ...newBusiness
    };
    this.businesses.unshift(business);
    this.saveBusinesses(this.businesses);
    return business;
  }

  loadProducts() {
    const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  }

  saveProducts(products) {
    this.products = products;
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
  }

  getAll() {
    return this.products;
  }

  getAllProducts() {
    return this.products;
  }

  getById(id) {
    return this.products.find(p => p.id === id);
  }

  getByCategory(category) {
    if (category === 'todos' || !category) return this.products;
    return this.products.filter(p => p.category === category);
  }

  getByBusiness(businessId) {
    if (businessId === 'todos' || !businessId) return this.products;
    return this.products.filter(p => p.businessId === businessId);
  }

  filter(businessId = 'todos', category = 'todos') {
    return this.products.filter(p => {
      const matchBiz = (businessId === 'todos' || !businessId) ? true : p.businessId === businessId;
      const matchCat = (category === 'todos' || !category) ? true : p.category === category;
      return matchBiz && matchCat;
    });
  }

  search(query, businessId = 'todos', category = 'todos') {
    let list = this.filter(businessId, category);
    if (!query) return list;

    const q = query.toLowerCase().trim();
    return list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.tag && p.tag.toLowerCase().includes(q)) ||
      (p.businessName && p.businessName.toLowerCase().includes(q)) ||
      (p.businessNeighborhood && p.businessNeighborhood.toLowerCase().includes(q))
    );
  }

  addProduct(newProduct) {
    const product = {
      id: 'prod-' + Date.now(),
      rating: 5.0,
      reviews: 1,
      featured: true,
      ...newProduct
    };
    const updated = [product, ...this.products];
    this.saveProducts(updated);
    return product;
  }

  deleteProduct(id) {
    const updated = this.products.filter(p => p.id !== id);
    this.saveProducts(updated);
    return updated;
  }
}

// Instancia global accesible
window.productManager = new ProductManager();
