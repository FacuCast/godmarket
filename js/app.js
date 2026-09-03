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
    this.deliveryMap = null;
    this.deliveryMarker = null;

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

    // Modal de Producto: Modificadores de cantidad dinámicos
    const qtyMinus = document.getElementById('modal-qty-minus');
    const qtyPlus = document.getElementById('modal-qty-plus');
    const qtyVal = document.getElementById('modal-qty-val');

    if (qtyMinus && qtyPlus && qtyVal) {
      qtyMinus.addEventListener('click', () => {
        let current = parseInt(qtyVal.textContent, 10);
        if (current > 1) {
          qtyVal.textContent = current - 1;
          this.updateModalAddButton(current - 1);
        }
      });

      qtyPlus.addEventListener('click', () => {
        let current = parseInt(qtyVal.textContent, 10);
        qtyVal.textContent = current + 1;
        this.updateModalAddButton(current + 1);
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
          const flavor = document.getElementById('modal-selected-flavor')?.value || 'Dulce de Leche';

          window.cartManager.addItem(this.selectedProductForModal, qty, { dedication, candle, note, flavor });
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

        // Mostrar u ocultar datos bancarios / mercado pago / efectivo
        const bankInfo = document.getElementById('bank-transfer-info');
        const mpInfo = document.getElementById('mercadopago-info');
        const cashInfo = document.getElementById('cash-payment-info');
        if (bankInfo) bankInfo.style.display = (method === 'transfer') ? 'block' : 'none';
        if (mpInfo) mpInfo.style.display = (method === 'mercadopago') ? 'block' : 'none';
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

    // Botón Continuar del Carrito al Checkout (Paso siguiente)
    const btnProceedCheckout = document.getElementById('btn-proceed-checkout');
    if (btnProceedCheckout) {
      btnProceedCheckout.addEventListener('click', () => {
        if (window.cartManager.getItemCount() === 0) {
          this.showToast("⚠️ Tu carrito está vacío. Elige una delicia primero.");
          this.closeModal('cart-drawer-modal');
          return;
        }
        this.closeModal('cart-drawer-modal');
        this.openModal('checkout-modal');
      });
    }

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

        // Si todo es válido, preparar datos y procesar la orden
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

        // Procesar orden generando Número de Orden único y enviando a WhatsApp
        const order = window.checkoutHandler.processOrder(formData, window.cartManager);
        this.closeModal('checkout-modal');

        // Renderizar el ticket de confirmación estilo ByronCode / Perlato
        this.renderOrderTicket(order);
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
    const note = document.getElementById('modal-note');
    if (note) note.value = '';

    // Manejo interactivo de Velita de Cumpleaños con badge sobre la foto
    const candleBadge = document.getElementById('modal-candle-badge');
    const candleCheckbox = document.getElementById('modal-candle-checkbox');
    if (candleBadge) candleBadge.style.display = 'none';

    if (candleCheckbox) {
      candleCheckbox.checked = false;
      candleCheckbox.onchange = () => {
        if (candleBadge) {
          candleBadge.style.display = candleCheckbox.checked ? 'flex' : 'none';
        }
        if (candleCheckbox.checked) {
          this.showToast("🕯️ ¡Velita de cumpleaños agregada al pastel!");
        }
      };
    }

    // Manejar selección interactiva de gustos / rellenos con cambio de foto en vivo
    const flavorChips = document.querySelectorAll('#modal-flavor-chips .flavor-chip');
    const hiddenFlavor = document.getElementById('modal-selected-flavor');
    const flavorBadgeText = document.getElementById('modal-flavor-badge-text');
    if (hiddenFlavor) hiddenFlavor.value = 'Dulce de Leche';
    if (flavorBadgeText) flavorBadgeText.textContent = '🍯 Dulce de Leche';

    flavorChips.forEach((chip, i) => {
      chip.classList.toggle('active', i === 0);
      chip.onclick = () => {
        flavorChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const flavor = chip.dataset.flavor;
        if (hiddenFlavor) hiddenFlavor.value = flavor;
        if (flavorBadgeText) flavorBadgeText.textContent = '🍯 ' + flavor;
        
        // Cambiar la imagen del pastel según el sabor elegido con animación suave
        this.switchModalCakeImage(flavor, product);
      };
    });

    // Mostrar sección de velita/dedicatoria y gustos especialmente para tortas y desayunos
    const customSection = document.getElementById('modal-customization-options');
    if (customSection) {
      customSection.style.display = (product.category === 'tortas' || product.category === 'desayunos') ? 'block' : 'none';
    }

    // Actualizar texto del botón con precio calculado
    this.updateModalAddButton(1);

    this.openModal('product-detail-modal');
  }

  switchModalCakeImage(flavor, product) {
    const img = document.getElementById('modal-product-img');
    if (!img) return;

    // Catálogo fotográfico gourmet según sabor/relleno
    const FLAVOR_IMAGES = {
      'Dulce de Leche': 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
      'Nutella & Avellanas': 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80',
      'Frutos Rojos': 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
      'Crema Bariloche': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
      'Clásica': (product || this.selectedProductForModal)?.image
    };

    const targetUrl = FLAVOR_IMAGES[flavor] || (product || this.selectedProductForModal)?.image;
    if (!targetUrl || img.src === targetUrl) return;

    // Transición suave de fundido cruzado
    img.style.opacity = '0.3';
    img.style.transform = 'scale(0.97)';
    
    setTimeout(() => {
      img.src = targetUrl;
      img.onload = () => {
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
      };
      setTimeout(() => {
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
      }, 150);
    }, 120);
  }

  updateModalAddButton(qty) {
    const btn = document.getElementById('btn-add-modal-cart');
    if (!btn || !this.selectedProductForModal) return;
    const total = this.selectedProductForModal.price * qty;
    btn.innerHTML = `<span>Agregar al Pedido • ${window.cartManager.formatCurrency(total)}</span>`;
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
    const subtotalEl = document.getElementById('cart-drawer-subtotal');
    if (subtotalEl) subtotalEl.textContent = window.cartManager.formatCurrency(subtotal);

    const shippingEl = document.getElementById('cart-drawer-shipping');
    if (shippingEl) shippingEl.textContent = deliveryFee === 0 ? '¡Gratis!' : window.cartManager.formatCurrency(deliveryFee);

    const totalEl = document.getElementById('cart-drawer-total');
    if (totalEl) totalEl.textContent = window.cartManager.formatCurrency(total);

    // Resumen en Modal de Checkout
    const checkoutCountEl = document.getElementById('checkout-summary-items-count');
    if (checkoutCountEl) {
      checkoutCountEl.textContent = `🛒 Tu Pedido (${count} ${count === 1 ? 'producto' : 'productos'})`;
    }
    const checkoutTotalEl = document.getElementById('checkout-summary-total');
    if (checkoutTotalEl) {
      checkoutTotalEl.textContent = window.cartManager.formatCurrency(total);
    }
  }

  renderCartDrawerItems() {
    const list = document.getElementById('cart-drawer-items') || document.getElementById('cart-drawer-list');
    if (!list) return;

    const items = window.cartManager.items;
    const footer = document.querySelector('.cart-footer');

    if (items.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div style="font-size: 3.2rem; margin-bottom: 12px; animation: popIn 0.3s ease;">🛍️</div>
          <h4 style="font-size: 1.15rem; color: var(--text-main); margin-bottom: 6px;">Tu carrito está vacío</h4>
          <p style="font-size: 0.85rem; margin-bottom: 20px; line-height: 1.4;">Elige alguna de nuestras tortas, desayunos o postres para armar tu pedido.</p>
          <button type="button" class="btn-primary" onclick="window.app.closeModal('cart-drawer-modal'); window.scrollTo({top: 350, behavior: 'smooth'});" style="max-width: 220px; margin: 0 auto; padding: 12px 20px; font-size: 0.9rem;">
            🍰 Explorar la Carta
          </button>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    list.innerHTML = items.map((item, idx) => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.product.image}" alt="${this.escapeHTML(item.product.name)}">
        <div class="cart-item-info">
          <div class="cart-item-title">${this.escapeHTML(item.product.name)}</div>
          ${item.customization?.flavor ? `<div class="cart-item-custom">🍯 ${this.escapeHTML(item.customization.flavor)}</div>` : ''}
          ${item.customization?.dedication ? `<div class="cart-item-custom">✍️ "${this.escapeHTML(item.customization.dedication)}"</div>` : ''}
          ${item.customization?.candle ? `<div class="cart-item-custom">🕯️ Con velita</div>` : ''}
          <div class="cart-item-price">${window.cartManager.formatCurrency(item.product.price * item.quantity)}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div class="quantity-stepper" style="transform: scale(0.85); transform-origin: right center;">
            <button class="stepper-btn" onclick="window.cartManager.updateQuantity(${idx}, ${item.quantity - 1})">-</button>
            <span class="stepper-value">${item.quantity}</span>
            <button class="stepper-btn" onclick="window.cartManager.updateQuantity(${idx}, ${item.quantity + 1})">+</button>
          </div>
          <button type="button" onclick="window.cartManager.removeItem(${idx})" style="background: none; border: none; font-size: 0.72rem; color: var(--danger); cursor: pointer; padding: 2px 4px; display: flex; align-items: center; gap: 2px;">
            🗑️ Eliminar
          </button>
        </div>
      </div>
    `).join('');
  }

  renderOrderTicket(order) {
    if (!order) return;

    // Número de Orden
    const orderIdEl = document.getElementById('ticket-order-id');
    if (orderIdEl) orderIdEl.textContent = '#' + order.orderId;

    // Totales
    const orderTotalEl = document.getElementById('ticket-order-total');
    if (orderTotalEl) orderTotalEl.textContent = order.totalFormatted;

    const transferAmountEl = document.getElementById('ticket-transfer-amount');
    if (transferAmountEl) transferAmountEl.textContent = order.totalFormatted;

    const cashAmountEl = document.getElementById('ticket-cash-amount');
    if (cashAmountEl) cashAmountEl.textContent = order.totalFormatted;

    // Detalle de ítems con sanitización anti-XSS
    const itemsContainer = document.getElementById('ticket-items-list');
    if (itemsContainer && order.items) {
      itemsContainer.innerHTML = order.items.map(it => `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dotted var(--border-light);">
          <div>
            <strong>${it.quantity}x</strong> ${this.escapeHTML(it.product.name)}
            ${it.customization?.flavor ? `<div style="font-size: 0.74rem; color: var(--text-muted);">🍯 ${this.escapeHTML(it.customization.flavor)}</div>` : ''}
            ${it.customization?.dedication ? `<div style="font-size: 0.74rem; color: var(--primary);">✍️ "${this.escapeHTML(it.customization.dedication)}"</div>` : ''}
          </div>
          <strong style="color: var(--text-main); margin-left: 10px;">${(it.product.price * it.quantity).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</strong>
        </div>
      `).join('');
    }

    // Mostrar sección de transferencia, mercado pago o de efectivo
    const transferBox = document.getElementById('ticket-transfer-details');
    const mpBox = document.getElementById('ticket-mp-details');
    const cashBox = document.getElementById('ticket-cash-details');
    const whatsappProofBtn = document.getElementById('ticket-whatsapp-proof-btn');
    const mpAmountEl = document.getElementById('ticket-mp-amount');
    if (mpAmountEl) mpAmountEl.textContent = order.totalFormatted;

    if (order.paymentMethod === 'transfer') {
      if (transferBox) transferBox.style.display = 'block';
      if (mpBox) mpBox.style.display = 'none';
      if (cashBox) cashBox.style.display = 'none';
      if (whatsappProofBtn) {
        whatsappProofBtn.href = order.proofWhatsappUrl;
        whatsappProofBtn.innerHTML = `
          <span style="font-size: 1.3rem;">📲</span>
          <span>Ya transferí, enviar comprobante</span>
        `;
      }
    } else if (order.paymentMethod === 'mercadopago') {
      if (transferBox) transferBox.style.display = 'none';
      if (mpBox) mpBox.style.display = 'block';
      if (cashBox) cashBox.style.display = 'none';
      if (whatsappProofBtn) {
        whatsappProofBtn.href = order.proofWhatsappUrl;
        whatsappProofBtn.innerHTML = `
          <span style="font-size: 1.3rem;">📲</span>
          <span>Ya pagué por Mercado Pago, enviar comprobante</span>
        `;
      }
    } else {
      if (transferBox) transferBox.style.display = 'none';
      if (mpBox) mpBox.style.display = 'none';
      if (cashBox) cashBox.style.display = 'block';
      if (whatsappProofBtn) {
        whatsappProofBtn.href = order.proofWhatsappUrl;
        whatsappProofBtn.innerHTML = `
          <span style="font-size: 1.3rem;">📲</span>
          <span>Consultar estado por WhatsApp</span>
        `;
      }
    }
  }

  copyOrderId() {
    const orderIdEl = document.getElementById('ticket-order-id');
    const text = orderIdEl ? orderIdEl.textContent.trim() : '';
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-order');
      if (btn) {
        btn.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btn.innerHTML = '<span>📋</span> Copiar'; }, 2000);
      }
      this.showToast(`📋 ${text} copiado al portapapeles`);
    });
  }

  copyAlias() {
    const alias = "DULCE.ATELIER.BA";
    navigator.clipboard.writeText(alias).then(() => {
      const btnTicket = document.getElementById('btn-copy-alias-ticket');
      if (btnTicket) {
        btnTicket.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btnTicket.innerHTML = '<span>📋</span> Copiar'; }, 2000);
      }
      this.showToast(`🏦 Alias ${alias} copiado con éxito`);
    });
  }

  copyMPAlias() {
    const alias = "DULCE.ATELIER.MP";
    navigator.clipboard.writeText(alias).then(() => {
      const btnTicket = document.getElementById('btn-copy-mp-alias-ticket');
      const btnForm = document.getElementById('btn-copy-mp-alias');
      if (btnTicket) {
        btnTicket.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btnTicket.innerHTML = '<span>📋</span> Copiar'; }, 2000);
      }
      if (btnForm) {
        btnForm.innerHTML = '✓ Copiado';
        setTimeout(() => { btnForm.innerHTML = 'Copiar'; }, 2000);
      }
      this.showToast(`💳 Alias MP ${alias} copiado con éxito`);
    });
  }

  copyCVU() {
    const cvu = "0000003100012345678901";
    navigator.clipboard.writeText(cvu).then(() => {
      const btnTicket = document.getElementById('btn-copy-cvu-ticket');
      const btnMpTicket = document.getElementById('btn-copy-mp-cvu-ticket');
      if (btnTicket) {
        btnTicket.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btnTicket.innerHTML = '<span>📋</span> Copiar'; }, 2000);
      }
      if (btnMpTicket) {
        btnMpTicket.innerHTML = '<span>✓</span> ¡Copiado!';
        setTimeout(() => { btnMpTicket.innerHTML = '<span>📋</span> Copiar'; }, 2000);
      }
      this.showToast(`🏦 CVU copiado con éxito`);
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modalId === 'cart-drawer-modal' || modalId === 'checkout-modal') {
        this.updateCartUI();
      }
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  openAdminModalWithPin() {
    const savedPin = localStorage.getItem('dulce_admin_pin') || '1234';
    const entered = prompt('🔐 Ingrese el PIN de Administrador (por defecto: 1234):');
    if (entered === savedPin) {
      this.openModal('admin-product-modal');
    } else if (entered !== null) {
      this.showToast('❌ PIN de Administrador incorrecto');
    }
  }

  escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🍰</span> ${this.escapeHTML(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /* =========================================================================
     MAPA INTERACTIVO Y CAPTURA DE DIRECCIÓN POR PIN ROJO (LEAFLET / OSM)
     ========================================================================= */
  toggleMapPicker() {
    const mapContainer = document.getElementById('checkout-map-container');
    const toggleBtn = document.getElementById('btn-toggle-map');
    if (!mapContainer) return;

    const isVisible = mapContainer.style.display === 'block';
    if (isVisible) {
      mapContainer.style.display = 'none';
      if (toggleBtn) toggleBtn.innerHTML = '🗺️ Marcar en el Mapa';
    } else {
      mapContainer.style.display = 'block';
      if (toggleBtn) toggleBtn.innerHTML = '✕ Ocultar Mapa';

      this.initDeliveryMap();
      setTimeout(() => {
        if (this.deliveryMap) {
          this.deliveryMap.invalidateSize();
        }
      }, 200);

      // Si el usuario ya escribió algo en Dirección (ej: "cilento 81"), buscarlo automáticamente
      const currentAddress = document.getElementById('cust-address')?.value.trim();
      const mapSearchInput = document.getElementById('map-search-input');
      if (currentAddress) {
        if (mapSearchInput) mapSearchInput.value = currentAddress;
        setTimeout(() => this.searchAddressOnMap(currentAddress), 350);
      }
    }
  }

  async searchAddressOnMap(query) {
    const input = document.getElementById('map-search-input');
    const addressInput = document.getElementById('cust-address');
    const searchQuery = (query || input?.value || addressInput?.value || '').trim();

    if (!searchQuery) {
      this.showToast('ℹ️ Escribe una calle o localidad para buscar en el mapa.');
      return;
    }

    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = `🔍 Buscando "${searchQuery}" en el mapa...`;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', argentina')}&addressdetails=1&limit=3`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const results = await res.json();

      if (results && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);

        if (this.deliveryMap && this.deliveryMarker) {
          this.deliveryMap.flyTo([lat, lng], 16, { duration: 1.2 });
          this.deliveryMarker.setLatLng([lat, lng]);
          this.reverseGeocode(lat, lng);
        }
      } else {
        if (statusEl) statusEl.textContent = `⚠️ No se ubicó "${searchQuery}". Puedes mover el pin rojo manualmente.`;
        this.showToast(`⚠️ No se encontró "${searchQuery}". Mueve el pin rojo o añade la localidad.`);
      }
    } catch (err) {
      console.error('Error al buscar dirección:', err);
      if (statusEl) statusEl.textContent = '📍 Mueve el pin rojo manualmente sobre el mapa';
    }
  }

  initDeliveryMap() {
    if (this.deliveryMap) return;
    const mapEl = document.getElementById('delivery-map');
    if (!mapEl || typeof L === 'undefined') return;

    // Coordenadas por defecto (Buenos Aires / Centro)
    const defaultLat = -34.6037;
    const defaultLng = -58.3816;

    this.deliveryMap = L.map('delivery-map', {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.deliveryMap);

    const redPinSvg = `
      <div class="map-red-pin-wrapper">
        <svg viewBox="0 0 24 24" width="38" height="38" fill="#D9536F" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;

    const redIcon = L.divIcon({
      className: 'custom-red-pin',
      html: redPinSvg,
      iconSize: [38, 38],
      iconAnchor: [19, 36]
    });

    this.deliveryMarker = L.marker([defaultLat, defaultLng], {
      draggable: true,
      icon: redIcon
    }).addTo(this.deliveryMap);

    // Evento al arrastrar el pin rojo
    this.deliveryMarker.on('dragend', () => {
      const pos = this.deliveryMarker.getLatLng();
      this.reverseGeocode(pos.lat, pos.lng);
    });

    // Evento al tocar en cualquier punto del mapa
    this.deliveryMap.on('click', (e) => {
      this.deliveryMarker.setLatLng(e.latlng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  }

  locateUserGPS() {
    if (!navigator.geolocation) {
      this.showToast('⚠️ Tu navegador no soporta geolocalización.');
      return;
    }

    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = '📡 Conectando con tu ubicación...';

    const onGeoSuccess = (pos) => {
      const { latitude, longitude } = pos.coords;
      if (this.deliveryMap && this.deliveryMarker) {
        this.deliveryMap.flyTo([latitude, longitude], 17, { duration: 1.2 });
        this.deliveryMarker.setLatLng([latitude, longitude]);
        this.reverseGeocode(latitude, longitude);
      }
    };

    const onGeoError = (err) => {
      console.warn('Geolocation error:', err);
      if (err.code === 1) {
        this.showToast('ℹ️ Permiso de ubicación no otorgado. Puedes buscar tu calle escribiéndola arriba.');
        if (statusEl) statusEl.textContent = 'ℹ️ Permiso denegado. Escribe tu calle o mueve el pin rojo.';
      } else {
        this.showToast('ℹ️ Ubicación GPS no detectada. Escribe tu calle en el buscador del mapa.');
        if (statusEl) statusEl.textContent = '📍 Escribe tu calle arriba o arrastra el pin rojo.';
      }
    };

    // Intentar con configuración estándar compatible con PC y celular
    navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: false,
      timeout: 9000,
      maximumAge: 120000
    });
  }

  async reverseGeocode(lat, lng) {
    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = '⏳ Identificando calle y altura...';

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'es' }
      });
      const data = await res.json();

      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.pedestrian || addr.street || addr.footway || '';
        const number = addr.house_number || '';
        const zone = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.city || '';

        let fullAddress = street;
        if (street && number) {
          fullAddress = `${street} ${number}`;
        } else if (!street) {
          fullAddress = data.display_name.split(',')[0];
        }

        const addressInput = document.getElementById('cust-address');
        const zoneInput = document.getElementById('cust-zone');

        if (addressInput && fullAddress) {
          addressInput.value = fullAddress;
          addressInput.classList.remove('is-invalid');
        }
        if (zoneInput && zone) {
          zoneInput.value = zone;
        }

        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>Dirección tomada:</strong> ${fullAddress} ${zone ? `(${zone})` : ''}`;
        }
        this.showToast(`📍 Dirección tomada: ${fullAddress}`);
      } else {
        if (statusEl) statusEl.textContent = '📍 Ubicación seleccionada en el mapa';
      }
    } catch (err) {
      console.warn('Error en reverse geocoding:', err);
      if (statusEl) statusEl.textContent = '📍 Coordenadas tomadas (Verifica la altura)';
    }
  }

  copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMsg || "¡Copiado al portapapeles!");
    });
  }
}

// Instancia global
window.app = new DulceAtelierApp();
