/**
 * GOD MARKET - GESTOR DEL CARRITO DE COMPRAS
 */

const CART_STORAGE_KEY = 'godmarket_cart_v2';

class CartManager {
  constructor() {
    this.items = this.loadCart();
    this.listeners = [];
    this.deliveryType = 'delivery'; // 'delivery' | 'pickup'
    this.deliveryFee = 1500; // Costo estimado de envío en ARS
    this.standardServiceFeeRate = 0.20; // Servicio habitual de GOD MARKET (20%)
    this.discount = 0;
  }

  loadCart() {
    // Limpiar almacenamiento legacy o mocks de pruebas anteriores
    try {
      localStorage.removeItem('dulce_atelier_cart_v1');
      localStorage.removeItem('godmarket_cart_v1');
    } catch (e) {}

    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filtrar items mock previos para garantizar carrito limpio al usuario
          parsed = parsed.filter(item => 
            item && 
            item.product && 
            item.product.id !== 'lc-toston-palta-huevo' && 
            item.product.id !== 'mock-item'
          );
          return parsed;
        }
      } catch (e) {
        console.error("Error al cargar carrito:", e);
      }
    }
    return []; // Iniciar siempre vacío sin productos precargados
  }

  saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this));
  }

  addItem(product, quantity = 1, customization = {}) {
    const existingIndex = this.items.findIndex(item => 
      item.product.id === product.id && 
      JSON.stringify(item.customization) === JSON.stringify(customization)
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        product,
        quantity,
        customization,
        addedAt: new Date().toISOString()
      });
    }

    this.saveCart();
  }

  updateQuantity(index, newQty) {
    if (index >= 0 && index < this.items.length) {
      if (newQty <= 0) {
        this.items.splice(index, 1);
      } else {
        this.items[index].quantity = newQty;
      }
      this.saveCart();
    }
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.saveCart();
    }
  }

  clearCart() {
    this.items = [];
    this.saveCart();
  }

  syncWithCatalog(products) {
    if (!Array.isArray(products) || this.items.length === 0) return;
    const catalogMap = new Map(products.map(p => [p.id, p]));
    let changed = false;
    const nextItems = [];
    for (const item of this.items) {
      if (!item || !item.product) {
        changed = true;
        continue;
      }
      const fresh = catalogMap.get(item.product.id);
      if (!fresh || fresh.isAvailable === false) {
        changed = true;
        continue;
      }
      if (
        item.product.price !== fresh.price ||
        item.product.name !== fresh.name ||
        item.product.image !== fresh.image ||
        item.product.businessName !== fresh.businessName ||
        item.product.isPromoActive !== fresh.isPromoActive ||
        item.product.serviceFeeRate !== fresh.serviceFeeRate
      ) {
        item.product = { ...item.product, ...fresh };
        changed = true;
      }
      nextItems.push(item);
    }
    if (changed) {
      this.items = nextItems;
      this.saveCart();
    }
  }

  setDeliveryType(type) {
    this.deliveryType = type;
    this.notify();
  }

  getItemCount() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }

  isItemPromoActive(item) {
    if (!item || !item.product) return false;
    if (window.productManager && typeof window.productManager.getBusinessPromoState === 'function') {
      const biz = window.productManager.getBusinessById(item.product.businessId);
      if (biz) {
        return window.productManager.getBusinessPromoState(biz).isPromoActive;
      }
    }
    return item.product.isPromoActive === true;
  }

  getServiceFeeRateForItem(item) {
    if (item && item.product && window.productManager) {
      const business = window.productManager.getBusinessById(item.product.businessId);
      if (business) {
        return window.productManager.getBusinessPromoState(business).serviceFeeRate;
      }
    }
    if (item && item.product && Number.isFinite(Number(item.product.serviceFeeRate))) {
      return Number(item.product.serviceFeeRate);
    }
    return this.isItemPromoActive(item) ? 0 : this.standardServiceFeeRate;
  }

  getStandardServiceFeeRate() {
    const item = this.items.find(cartItem => cartItem && cartItem.product);
    if (item && window.productManager) {
      const business = window.productManager.getBusinessById(item.product.businessId);
      if (business) {
        return window.productManager.getBusinessPromoState(business).standardServiceFeeRate;
      }
    }
    return this.standardServiceFeeRate;
  }

  getServiceFee() {
    const businessTotals = new Map();
    this.items.forEach(item => {
      const businessId = item.product.businessId || '__unknown__';
      const current = businessTotals.get(businessId) || { subtotal: 0, rate: this.getServiceFeeRateForItem(item) };
      current.subtotal += (Number(item.product.price) || 0) * (Number(item.quantity) || 0);
      businessTotals.set(businessId, current);
    });
    return Array.from(businessTotals.values())
      .reduce((sum, business) => sum + Math.round(business.subtotal * business.rate), 0);
  }

  getWaivedServiceFee() {
    const businessTotals = new Map();
    this.items.forEach(item => {
      const businessId = item.product.businessId || '__unknown__';
      const state = window.productManager
        ? window.productManager.getBusinessPromoState(item.product.businessId)
        : null;
      if (!(state && state.isPromoActive) && !this.isItemPromoActive(item)) return;
      const rate = state
        ? state.standardServiceFeeRate
        : this.standardServiceFeeRate;
      const current = businessTotals.get(businessId) || { subtotal: 0, rate };
      current.subtotal += (Number(item.product.price) || 0) * (Number(item.quantity) || 0);
      businessTotals.set(businessId, current);
    });
    return Array.from(businessTotals.values())
      .reduce((sum, business) => sum + Math.round(business.subtotal * business.rate), 0);
  }

  getVendorsInCart() {
    const map = new Map();
    this.items.forEach(item => {
      const bId = item.product.businessId || 'atelier-cafe-palermo';
      if (!map.has(bId)) {
        map.set(bId, {
          id: bId,
          name: item.product.businessName || 'Pastelería Asociada',
          avatar: item.product.businessAvatar || '🏪',
          neighborhood: item.product.businessNeighborhood || '',
          count: 0,
          subtotal: 0
        });
      }
      const v = map.get(bId);
      v.count += item.quantity;
      v.subtotal += (item.product.price * item.quantity);
    });
    return Array.from(map.values());
  }

  isMultiVendor() {
    return this.getVendorsInCart().length > 1;
  }

  getEffectiveDeliveryFee() {
    if (this.deliveryType === 'pickup' || this.items.length === 0) return 0;
    const businessTotals = new Map();
    this.items.forEach(item => {
      const businessId = item.product.businessId || '__unknown__';
      businessTotals.set(
        businessId,
        (businessTotals.get(businessId) || 0) + (Number(item.product.price) || 0) * (Number(item.quantity) || 0)
      );
    });
    let deliveryTotal = 0;
    businessTotals.forEach((subtotal, businessId) => {
      const business = window.productManager && window.productManager.getBusinessById(businessId);
      const deliveryFee = business && Number.isFinite(Number(business.deliveryFee))
        ? Math.max(0, Number(business.deliveryFee))
        : this.deliveryFee;
      const freeShippingFrom = business && Number.isFinite(Number(business.freeShippingFrom))
        ? Math.max(0, Number(business.freeShippingFrom))
        : 45000;
      if (subtotal < freeShippingFrom) deliveryTotal += deliveryFee;
    });
    return deliveryTotal;
  }

  getFreeShippingRemaining() {
    const businessTotals = new Map();
    this.items.forEach(item => {
      const businessId = item.product.businessId || '__unknown__';
      businessTotals.set(
        businessId,
        (businessTotals.get(businessId) || 0) + (Number(item.product.price) || 0) * (Number(item.quantity) || 0)
      );
    });
    let remaining = 0;
    businessTotals.forEach((subtotal, businessId) => {
      const business = window.productManager && window.productManager.getBusinessById(businessId);
      const freeShippingFrom = business && Number.isFinite(Number(business.freeShippingFrom))
        ? Math.max(0, Number(business.freeShippingFrom))
        : 45000;
      remaining += Math.max(0, freeShippingFrom - subtotal);
    });
    return remaining;
  }

  getTotal() {
    return Math.max(0, this.getSubtotal() + this.getServiceFee() + this.getEffectiveDeliveryFee() - this.discount);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount).replace(/\u00a0/g, ' ');
  }
}

// Instancia global del carrito
window.cartManager = new CartManager();
