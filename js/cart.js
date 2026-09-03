/**
 * DULCE ATELIER - GESTOR DEL CARRITO DE COMPRAS
 */

const CART_STORAGE_KEY = 'dulce_atelier_cart_v1';

class CartManager {
  constructor() {
    this.items = this.loadCart();
    this.listeners = [];
    this.deliveryType = 'delivery'; // 'delivery' | 'pickup'
    this.deliveryFee = 1500; // Costo estimado de envío en ARS
    this.discount = 0;
  }

  loadCart() {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error al cargar carrito:", e);
      }
    }
    return [];
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

  getEffectiveDeliveryFee() {
    if (this.deliveryType === 'pickup' || this.items.length === 0) return 0;
    // Envío gratis si supera $50.000
    if (this.getSubtotal() >= 50000) return 0;
    return this.deliveryFee;
  }

  getTotal() {
    return Math.max(0, this.getSubtotal() + this.getEffectiveDeliveryFee() - this.discount);
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
