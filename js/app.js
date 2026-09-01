/**
 * DULCE ATELIER - APLICACIÓN PRINCIPAL (APP COORDINATOR)
 */

class DulceAtelierApp {
  constructor() {
    this.currentCategory = 'todos';
    this.searchQuery = '';
    this.selectedProductForModal = null;
    this.favorites = this.loadFavorites();
    this.deferredPrompt = null;

    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    this.setupPWA();
    this.setupEventListeners();
    this.renderCategories();
    this.renderProducts();
    this.updateCartUI();

    // Suscribirse a cambios en el carrito
    window.cartManager.subscribe(() => this.updateCartUI());
  }

  loadFavorites() {
    try {
      const saved = localStorage.getItem('dulce_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveFavorites() {
    localStorage.setItem('dulce_favorites', JSON.stringify(this.favorites));
  }

  toggleFavorite(productId, event) {
    if (event) event.stopPropagation();
    const index = this.favorites.indexOf(productId);
    if (index > -1) {
      this.favorites.splice(index, 1);
      this.showToast("Eliminado de favoritos");
    } else {
      this.favorites.push(productId);
      this.showToast("❤️ Agregado a favoritos");
    }
    this.saveFavorites();
    this.renderProducts();
  }

  // Configuración de PWA y Service Worker
  setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('ServiceWorker registrado:', reg.scope))
          .catch(err => console.log('Error al registrar ServiceWorker:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBanner = document.getElementById('pwa-install-pill');
      if (installBanner) installBanner.style.display = 'flex';
    });
  }

  installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.showToast("🎉 ¡App instalada con éxito!");
        }
        this.deferredPrompt = null;
        const installBanner = document.getElementById('pwa-install-pill');
        if (installBanner) installBanner.style.display = 'none';
      });
    }
  }

  setupEventListeners() {
    // Buscador
    const searchInput = document.getElementById('main-search-input');
    const searchClear = document.getElementById('search-clear-btn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (searchClear) searchClear.style.display = this.searchQuery ? 'block' : 'none';
        this.renderProducts();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.renderProducts();
      });
    }

    // Modal de Producto: Modificadores de cantidad
    const qtyMinus = document.getElementById('modal-qty-minus');
    const qtyPlus = document.getElementById('modal-qty-plus');
    const qtyVal = document.getElementById('modal-qty-val');

    if (qtyMinus && qtyPlus && qtyVal) {
      qtyMinus.addEventListener('click', () => {
        let current = parseInt(qtyVal.textContent, 10);
        if (current > 1) qtyVal.textContent = current - 1;
      });

      qtyPlus.addEventListener('click', () => {
        let current = parseInt(qtyVal.textContent, 10);
        qtyVal.textContent = current + 1;
      });
    }

    // Modal de Producto: Añadir al carrito
    const btnAddModal = document.getElementById('btn-add-modal-cart');
    if (btnAddModal) {
      btnAddModal.addEventListener('click', () => {
        if (this.selectedProductForModal) {
          const qty = parseInt(document.getElementById('modal-qty-val').textContent, 10);
          const dedication = document.getElementById('modal-dedication')?.value.trim() || '';
          const candle = document.getElementById('modal-candle-checkbox')?.checked || false;
          const note = document.getElementById('modal-note')?.value.trim() || '';

          window.cartManager.addItem(this.selectedProductForModal, qty, { dedication, candle, note });
          this.showToast(`✨ ${qty}x ${this.selectedProductForModal.name} agregado`);
          this.closeModal('product-detail-modal');
        }
      });
    }

    // Switcher de Entrega (Delivery / Retiro)
    document.querySelectorAll('.delivery-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.delivery-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const type = e.currentTarget.dataset.type;
        window.cartManager.setDeliveryType(type);
        this.updateDeliveryUI(type);
      });
    });

    // Checkout: Formulario y opciones de pago
    document.querySelectorAll('.payment-card').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const method = e.currentTarget.dataset.payment;
        document.getElementById('checkout-payment-method').value = method;

        // Mostrar u ocultar datos bancarios / efectivo
        const bankInfo = document.getElementById('bank-transfer-info');
        const cashInfo = document.getElementById('cash-payment-info');
        if (bankInfo) bankInfo.style.display = (method === 'transfer') ? 'block' : 'none';
        if (cashInfo) cashInfo.style.display = (method === 'cash') ? 'block' : 'none';
      });
    });

    // Limpiar errores visuales en tiempo real mientras el usuario escribe
    const checkoutInputs = ['cust-name', 'cust-phone', 'cust-address', 'cust-time', 'cust-cash-amount'];
    checkoutInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => el.classList.remove('is-invalid'));
      }
    });

    // Enviar Checkout a WhatsApp con Validaciones Robustas
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 1. Validar que el carrito no esté vacío
        if (window.cartManager.getItemCount() === 0) {
          this.showToast("⚠️ Tu carrito está vacío. Elige algún producto primero.");
          this.closeModal('checkout-modal');
          return;
        }

        let isValid = true;
        let firstInvalidField = null;

        const nameInput = document.getElementById('cust-name');
        const phoneInput = document.getElementById('cust-phone');
        const addressInput = document.getElementById('cust-address');
        const timeInput = document.getElementById('cust-time');
        const paymentMethod = document.getElementById('checkout-payment-method').value;
        const cashAmountInput = document.getElementById('cust-cash-amount');

        // Validación de Nombre (mínimo 3 caracteres, letras y espacios)
        const nameVal = nameInput.value.trim();
        if (!nameVal || nameVal.length < 3) {
          nameInput.classList.add('is-invalid');
          isValid = false;
          if (!firstInvalidField) firstInvalidField = nameInput;
        } else {
          nameInput.classList.remove('is-invalid');
        }

        // Validación de Teléfono (mínimo 8 dígitos numéricos)
        const phoneVal = phoneInput.value.trim();
        const digitsOnly = phoneVal.replace(/\D/g, '');
        if (!phoneVal || digitsOnly.length < 8) {
          phoneInput.classList.add('is-invalid');
          isValid = false;
          if (!firstInvalidField) firstInvalidField = phoneInput;
        } else {
          phoneInput.classList.remove('is-invalid');
        }

        // Validación de Dirección (Obligatoria solo si es Envío a Domicilio)
        const isDelivery = window.cartManager.deliveryType === 'delivery';
        if (isDelivery) {
          const addressVal = addressInput ? addressInput.value.trim() : '';
          if (!addressVal || addressVal.length < 4) {
            if (addressInput) addressInput.classList.add('is-invalid');
            isValid = false;
            if (!firstInvalidField) firstInvalidField = addressInput;
          } else {
            if (addressInput) addressInput.classList.remove('is-invalid');
          }
        }

        // Validación de Horario / Fecha preferida
        const timeVal = timeInput.value.trim();
        if (!timeVal || timeVal.length < 2) {
          timeInput.classList.add('is-invalid');
          isValid = false;
          if (!firstInvalidField) firstInvalidField = timeInput;
        } else {
          timeInput.classList.remove('is-invalid');
        }

        // Validación de Efectivo (si paga en efectivo con billete mayor)
        if (paymentMethod === 'cash' && cashAmountInput) {
          const cashVal = parseFloat(cashAmountInput.value);
          const totalOrder = window.cartManager.getTotal();
          if (cashVal && cashVal < totalOrder) {
            cashAmountInput.classList.add('is-invalid');
            isValid = false;
            if (!firstInvalidField) firstInvalidField = cashAmountInput;
          } else {
            cashAmountInput.classList.remove('is-invalid');
          }
        }

        // Si hay errores, animar el formulario y hacer foco en el primer error
        if (!isValid) {
          checkoutForm.classList.add('shake');
          setTimeout(() => checkoutForm.classList.remove('shake'), 400);
          this.showToast("⚠️ Por favor revisa los campos en rojo");
          if (firstInvalidField) firstInvalidField.focus();
          return;
        }

        // Si todo es válido, preparar datos y enviar a WhatsApp
        const formData = {
          fullName: nameVal,
          phone: phoneVal,
          address: isDelivery && addressInput ? addressInput.value.trim() : 'Retiro en Tienda',
          apartment: document.getElementById('cust-apt')?.value.trim() || '',
          zone: document.getElementById('cust-zone')?.value.trim() || '',
          deliveryTime: timeVal,
          paymentMethod: paymentMethod,
          cashAmount: cashAmountInput?.value.trim() || '',
          comments: document.getElementById('cust-comments')?.value.trim() || ''
        };

        window.checkoutHandler.sendToWhatsApp(formData, window.cartManager);
        this.closeModal('checkout-modal');
        this.openModal('order-success-modal');
      });
    }
  }

  updateDeliveryUI(type) {
    const addressField = document.getElementById('delivery-address-group');
    if (addressField) {
      addressField.style.display = (type === 'delivery') ? 'block' : 'none';
    }
  }

  renderCategories() {
    const categories = [
      { id: 'todos', name: 'Todo el Menú', icon: '✨' },
      { id: 'tortas', name: 'Tortas & Cakes', icon: '🎂' },
      { id: 'desayunos', name: 'Desayunos & Boxes', icon: '🎁' },
      { id: 'postres', name: 'Postres & Porciones', icon: '🥐' }
    ];

    const container = document.getElementById('categories-slider');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
      <div class="category-item ${this.currentCategory === cat.id ? 'active' : ''}" 
           onclick="window.app.setCategory('${cat.id}')">
        <div class="category-avatar">${cat.icon}</div>
        <span class="category-name">${cat.name}</span>
      </div>
    `).join('');
  }

  setCategory(catId) {
    this.currentCategory = catId;
    this.renderCategories();
    this.renderProducts();
  }

  renderProducts() {
    const container = document.getElementById('products-section-container');
    if (!container) return;

    let products = window.productManager.getAll();

    if (this.searchQuery) {
      products = window.productManager.search(this.searchQuery);
    } else if (this.currentCategory !== 'todos') {
      products = window.productManager.getByCategory(this.currentCategory);
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 10px;">🧁</div>
          <h3>No encontramos productos</h3>
          <p style="font-size: 0.85rem;">Prueba con otra palabra o categoría.</p>
        </div>
      `;
      return;
    }

    // Si estamos en "Todos", agrupar con vista destacada de 4 items por categoría
    if (this.currentCategory === 'todos' && !this.searchQuery) {
      const sections = [
        { id: 'tortas', title: '🎂 Tortas & Pasteles Artesanales', subtitle: '4 favoritos para celebrar' },
        { id: 'desayunos', title: '🎁 Desayunos & Meriendas Sorpresa', subtitle: 'Listos para regalar o compartir' },
        { id: 'postres', title: '🥐 Postres & Porciones Individuales', subtitle: 'El bocado dulce perfecto' }
      ];

      let html = '';
      sections.forEach(sec => {
        const secProducts = products.filter(p => p.category === sec.id).slice(0, 4); // Muestra 4 productos por pantalla
        if (secProducts.length > 0) {
          html += `
            <div class="section-container animate-fade">
              <div class="section-header">
                <div>
                  <h3 class="section-title">${sec.title}</h3>
                  <p class="section-subtitle">${sec.subtitle}</p>
                </div>
                <span class="badge-count">${secProducts.length}</span>
              </div>
              <div class="products-grid">
                ${secProducts.map(p => this.renderProductCard(p)).join('')}
              </div>
            </div>
          `;
        }
      });
      container.innerHTML = html;
    } else {
      // Vista filtrada por categoría o búsqueda
      container.innerHTML = `
        <div class="section-container animate-fade">
          <div class="section-header">
            <div>
              <h3 class="section-title">Resultados</h3>
              <p class="section-subtitle">${products.length} productos disponibles</p>
            </div>
          </div>
          <div class="products-grid">
            ${products.map(p => this.renderProductCard(p)).join('')}
          </div>
        </div>
      `;
    }
  }

  renderProductCard(product) {
    const isFav = this.favorites.includes(product.id);
    return `
      <div class="product-card" onclick="window.app.openProductModal('${product.id}')">
        <div class="product-image-container">
          <img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy" 
               onerror="this.src='https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80'">
          ${product.tag ? `<div class="product-tag">${product.tag}</div>` : ''}
          <button class="favorite-btn ${isFav ? 'active' : ''}" 
                  onclick="window.app.toggleFavorite('${product.id}', event)" 
                  title="Favorito">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
        <div class="product-content">
          <span class="product-category-label">${product.categoryName}</span>
          <h4 class="product-title">${product.name}</h4>
          <p class="product-desc-short">${product.description}</p>
          <div class="product-footer">
            <div class="product-price">
              ${window.cartManager.formatCurrency(product.price)}
            </div>
            <button class="add-to-cart-btn" 
                    onclick="window.app.quickAddToCart('${product.id}', event)" 
                    title="Añadir al carrito">
              +
            </button>
          </div>
        </div>
      </div>
    `;
  }

  openProductModal(productId) {
    const product = window.productManager.getById(productId);
    if (!product) return;

    this.selectedProductForModal = product;
    document.getElementById('modal-product-img').src = product.image;
    document.getElementById('modal-product-title').textContent = product.name;
    document.getElementById('modal-product-price').textContent = window.cartManager.formatCurrency(product.price);
    document.getElementById('modal-product-desc').textContent = product.description;
    document.getElementById('modal-product-portion').textContent = product.portion || 'Porción artesanal';

    // Reset inputs
    document.getElementById('modal-qty-val').textContent = '1';
    const dedication = document.getElementById('modal-dedication');
    if (dedication) dedication.value = '';
    const candle = document.getElementById('modal-candle-checkbox');
    if (candle) candle.checked = false;
    const note = document.getElementById('modal-note');
    if (note) note.value = '';

    // Mostrar sección de velita/dedicatoria especialmente para tortas y desayunos
    const customSection = document.getElementById('modal-customization-options');
    if (customSection) {
      customSection.style.display = (product.category === 'tortas' || product.category === 'desayunos') ? 'block' : 'none';
    }

    this.openModal('product-detail-modal');
  }

  quickAddToCart(productId, event) {
    if (event) event.stopPropagation();
    const product = window.productManager.getById(productId);
    if (product) {
      window.cartManager.addItem(product, 1);
      this.showToast(`🍰 ${product.name} añadido al pedido`);
    }
  }

  updateCartUI() {
    const count = window.cartManager.getItemCount();
    const total = window.cartManager.getTotal();
    const subtotal = window.cartManager.getSubtotal();
    const deliveryFee = window.cartManager.getEffectiveDeliveryFee();

    // Floating pill bar
    const floatingBar = document.getElementById('floating-cart-bar');
    if (floatingBar) {
      if (count > 0) {
        floatingBar.classList.add('visible');
        document.getElementById('cart-floating-count').textContent = count;
        document.getElementById('cart-floating-total').textContent = window.cartManager.formatCurrency(total);
      } else {
        floatingBar.classList.remove('visible');
      }
    }

    // Badge in bottom nav & Desktop Header
    const navBadge = document.getElementById('nav-cart-badge');
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    const headerBadge = document.getElementById('header-cart-badge');
    if (headerBadge) {
      headerBadge.textContent = count;
      headerBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Drawer de Carrito
    this.renderCartDrawerItems();

    // Resúmenes de precio en Drawer y Checkout
    const subtotalEls = document.querySelectorAll('.cart-calc-subtotal');
    subtotalEls.forEach(el => el.textContent = window.cartManager.formatCurrency(subtotal));

    const deliveryEls = document.querySelectorAll('.cart-calc-delivery');
    deliveryEls.forEach(el => {
      el.textContent = deliveryFee === 0 ? '¡Gratis!' : window.cartManager.formatCurrency(deliveryFee);
    });

    const totalEls = document.querySelectorAll('.cart-calc-total');
    totalEls.forEach(el => el.textContent = window.cartManager.formatCurrency(total));
  }

  renderCartDrawerItems() {
    const list = document.getElementById('cart-drawer-list');
    if (!list) return;

    const items = window.cartManager.items;
    if (items.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 30px 10px; color: var(--text-muted);">
          <span style="font-size: 2.5rem;">🛍️</span>
          <p style="margin-top: 8px; font-weight: 600;">Tu carrito está vacío</p>
          <span style="font-size: 0.8rem;">Elige una delicia de nuestro menú</span>
        </div>
      `;
      const checkoutBtn = document.getElementById('btn-to-checkout');
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    const checkoutBtn = document.getElementById('btn-to-checkout');
    if (checkoutBtn) checkoutBtn.disabled = false;

    list.innerHTML = items.map((item, idx) => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.product.image}" alt="${item.product.name}">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.product.name}</div>
          ${item.customization?.dedication ? `<div class="cart-item-custom">✍️ "${item.customization.dedication}"</div>` : ''}
          ${item.customization?.candle ? `<div class="cart-item-custom">🕯️ Con velita</div>` : ''}
          <div class="cart-item-price">${window.cartManager.formatCurrency(item.product.price * item.quantity)}</div>
        </div>
        <div class="quantity-stepper" style="transform: scale(0.85);">
          <button class="stepper-btn" onclick="window.cartManager.updateQuantity(${idx}, ${item.quantity - 1})">-</button>
          <span class="stepper-value">${item.quantity}</span>
          <button class="stepper-btn" onclick="window.cartManager.updateQuantity(${idx}, ${item.quantity + 1})">+</button>
        </div>
      </div>
    `).join('');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🍰</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMsg || "¡Copiado al portapapeles!");
    });
  }
}

// Instancia global
window.app = new DulceAtelierApp();
