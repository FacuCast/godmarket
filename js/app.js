/**
 * GOD MARKET - APLICACIÓN PRINCIPAL (APP COORDINATOR)
 */

class GodMarketApp {
  constructor() {
    this.selectedBusiness = 'todos';
    this.currentCategory = 'todos';
    this.currentFilter = 'all';
    try {
      localStorage.removeItem('dulce_user_address');
    } catch(e) {}
    let storedAddr = localStorage.getItem('godmarket_user_address') || '';
    if (storedAddr === 'Palermo Hollywood, CABA' || storedAddr === 'Palermo Hollywood' || storedAddr === 'Palermo') {
      localStorage.removeItem('godmarket_user_address');
      storedAddr = '';
    }
    this.currentAddress = storedAddr;
    this.userCoords = this.loadUserCoords();
    this.onlyInRange = localStorage.getItem('godmarket_only_in_range') === 'true';
    this.searchQuery = '';
    this.selectedProductForModal = null;
    this.favorites = this.loadFavorites();
    this.deferredPrompt = null;
    this.deliveryMap = null;
    this.deliveryMarker = null;
    this.paymentConfig = {};

    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  loadUserCoords() {
    try {
      const saved = localStorage.getItem('godmarket_user_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { lat: -34.5885, lng: -58.4285 }; // Coordenadas de referencia
  }

  saveUserCoords(coords) {
    this.userCoords = coords;
    localStorage.setItem('godmarket_user_coords', JSON.stringify(coords));
  }

  async init() {
    await this.loadPaymentConfig();
    this.setupPWA();
    this.setupEventListeners();
    this.renderLocationBar();
    this.renderStories();
    this.renderFilterChips();
    this.renderStoresCards();
    this.renderBusinessesSlider();
    this.renderBusinessSpotlight();
    this.renderCategories();
    this.renderProducts();
    this.updateCartUI();
    this.updateOrdersBadges();
    this.updateStoreStatusUI();
    this.updateDeliveryUI(window.cartManager.deliveryType);
    this.initVisitCounter();
    const inRangeToggle = document.getElementById('toggle-filter-in-range');
    if (inRangeToggle) inRangeToggle.checked = this.onlyInRange;
    this.refreshIcons();

    // Solicitar ubicación real automáticamente al ingresar
    this.promptRealLocationOnEntry();

    // Actualizar estado del horario de la tienda cada minuto
    setInterval(() => this.updateStoreStatusUI(), 60000);

    // Suscribirse a cambios en el carrito
    window.cartManager.subscribe(() => {
      this.updateCartUI();
      this.updateTransferPaymentOption();
      this.refreshIcons();
    });
  }

  async loadPaymentConfig() {
    try {
      const response = await fetch('/api/config', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Configuración no disponible (${response.status}).`);
      const config = await response.json();
      this.paymentConfig = config.paymentDetails || {};
      if (config.visits) {
        this.renderVisitCounter(config.visits);
      }
    } catch (error) {
      console.warn('No se pudieron cargar los medios de pago configurados:', error.message);
    }

    const details = this.paymentConfig;
    if (window.checkoutHandler) {
      window.checkoutHandler.bankDetails = {
        mercadoPagoAlias: details.mercadoPagoAlias || '',
        mercadoPagoCvu: details.mercadoPagoCvu || '',
        mercadoPagoHolder: details.mercadoPagoAccountHolder || ''
      };
    }
    const mercadoPagoEnabled = Boolean(details.mercadoPagoAlias && details.mercadoPagoCvu && details.mercadoPagoAccountHolder);
    const mercadoPagoCard = document.querySelector('.payment-card[data-payment="mercadopago"]');
    if (mercadoPagoCard) mercadoPagoCard.hidden = !mercadoPagoEnabled;

    const configuredValues = {
      'mp-alias': details.mercadoPagoAlias,
      'mp-cvu': details.mercadoPagoCvu,
      'mp-account-holder': details.mercadoPagoAccountHolder,
      'ticket-mp-alias-code': details.mercadoPagoAlias,
      'ticket-mp-cvu-code': details.mercadoPagoCvu,
      'ticket-mp-account-holder': details.mercadoPagoAccountHolder
    };
    Object.entries(configuredValues).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || '';
    });

    const method = mercadoPagoEnabled ? 'mercadopago' : 'cash';
    const methodInput = document.getElementById('checkout-payment-method');
    if (methodInput) methodInput.value = method;
    document.querySelectorAll('.payment-card').forEach(card => {
      card.classList.toggle('active', card.dataset.payment === method);
    });
    const bankInfo = document.getElementById('bank-transfer-info');
    const mpInfo = document.getElementById('mercadopago-info');
    const cashInfo = document.getElementById('cash-payment-info');
    if (bankInfo) bankInfo.style.display = method === 'transfer' ? 'block' : 'none';
    if (mpInfo) mpInfo.style.display = method === 'mercadopago' ? 'block' : 'none';
    if (cashInfo) cashInfo.style.display = method === 'cash' ? 'block' : 'none';
    this.updateTransferPaymentOption();
  }

  renderVisitCounter(stats = {}) {
    const total = Math.max(0, Number(stats.total) || 0);
    const today = Math.max(0, Number(stats.today) || 0);
    const formattedTotal = total.toLocaleString('es-AR');
    const formattedToday = today.toLocaleString('es-AR');

    const totalEl = document.getElementById('visit-counter-total');
    const todayEl = document.getElementById('visit-counter-today');
    const topTotalEl = document.getElementById('visit-counter-total-top');
    const topTodayEl = document.getElementById('visit-counter-today-top');
    const sideTotalEl = document.getElementById('side-visit-counter-total');
    const sellerVisitsEl = document.getElementById('stat-total-visits');

    if (totalEl) totalEl.textContent = formattedTotal;
    if (todayEl) todayEl.textContent = formattedToday;
    if (topTotalEl) topTotalEl.textContent = formattedTotal;
    if (topTodayEl) topTodayEl.textContent = formattedToday;
    if (sideTotalEl) sideTotalEl.textContent = formattedTotal;
    if (sellerVisitsEl && !sellerVisitsEl.dataset.hasBusinessSpecific) {
      sellerVisitsEl.textContent = formattedTotal;
    }
  }

  async initVisitCounter() {
    try {
      const sessionKey = 'godmarket_visit_recorded';
      const visitorKey = 'godmarket_visitor_seen';
      const alreadyRecorded = sessionStorage.getItem(sessionKey) === '1';

      if (!alreadyRecorded) {
        const isNewVisitor = localStorage.getItem(visitorKey) !== '1';
        const res = await fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isNewVisitor })
        });
        if (res.ok) {
          const data = await res.json();
          sessionStorage.setItem(sessionKey, '1');
          localStorage.setItem(visitorKey, '1');
          this.renderVisitCounter(data);
          return;
        }
      }

      const res = await fetch('/api/visits');
      if (res.ok) {
        const data = await res.json();
        this.renderVisitCounter(data);
      }
    } catch (err) {
      // Silencioso en caso de modo offline
    }
  }

  updateTransferPaymentOption() {
    const checkout = window.checkoutHandler;
    const cart = window.cartManager;
    if (!checkout || !cart) return;

    const payments = checkout.getTransferPayments(cart);
    const transferEnabled = payments.length > 0 && payments.every(payment => Boolean(payment.transferAlias.trim()));
    const transferCard = document.querySelector('.payment-card[data-payment="transfer"]');
    if (transferCard) transferCard.hidden = !transferEnabled;

    const bankInfo = document.getElementById('bank-transfer-info');
    if (bankInfo) bankInfo.innerHTML = `
      <div class="bank-title">${this.icon('bank', 16)} Datos para transferencia</div>
      <p class="bank-subtitle">Transferí el importe indicado al alias del comercio correspondiente:</p>
      ${checkout.renderTransferDetails(payments)}
    `;

    const methodInput = document.getElementById('checkout-payment-method');
    if (methodInput?.value === 'transfer' && !transferEnabled) {
      const fallbackMethod = !document.querySelector('.payment-card[data-payment="mercadopago"]')?.hidden
        ? 'mercadopago'
        : 'cash';
      methodInput.value = fallbackMethod;
      document.querySelectorAll('.payment-card').forEach(card => {
        card.classList.toggle('active', card.dataset.payment === fallbackMethod);
      });
      if (bankInfo) bankInfo.style.display = 'none';
      const mpInfo = document.getElementById('mercadopago-info');
      const cashInfo = document.getElementById('cash-payment-info');
      if (mpInfo) mpInfo.style.display = fallbackMethod === 'mercadopago' ? 'block' : 'none';
      if (cashInfo) cashInfo.style.display = fallbackMethod === 'cash' ? 'block' : 'none';
    }
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

  playSound(name) {
    if (window.gmSound) window.gmSound(name);
  }

  toggleFavorite(productId, event) {
    if (event) event.stopPropagation();
    const index = this.favorites.indexOf(productId);
    if (index > -1) {
      this.favorites.splice(index, 1);
      this.playSound('remove');
      this.showToast("Eliminado de favoritos");
    } else {
      this.favorites.push(productId);
      this.playSound('favorite');
      this.showToast("Agregado a favoritos", 'success');
    }
    this.saveFavorites();
    this.renderProducts();
  }

  // Configuración de PWA y Service Worker
  setupPWA() {
    this.initAppLaunchSplash();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('ServiceWorker registrado:', reg.scope);
            reg.update();
          })
          .catch(err => console.log('Error al registrar ServiceWorker:', err));
      });

      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (!sessionStorage.getItem('godmarket_pwa_dismissed')) {
        const installBanner = document.getElementById('pwa-install-pill');
        if (installBanner) installBanner.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const installBanner = document.getElementById('pwa-install-pill');
      if (installBanner) installBanner.style.display = 'none';
      this.playSound('orderSuccess');
      this.playAppLaunchAnimation({ subtitle: 'App instalada · Bienvenido', duration: 1800 });
      this.showToast("App instalada en tu pantalla de inicio", 'success');
    });

    // En celulares, si no se ha instalado ni cerrado el banner, mostrar sugerencia tras unos segundos
    setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (!isStandalone && !sessionStorage.getItem('godmarket_pwa_dismissed')) {
        const installBanner = document.getElementById('pwa-install-pill');
        if (installBanner) installBanner.style.display = 'flex';
      }
    }, 2800);
  }

  initAppLaunchSplash() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isMobileViewport = window.innerWidth <= 768;
    const alreadyShown = sessionStorage.getItem('godmarket_splash_shown') === '1';

    // Mostrar animación cinematográfica del logo al abrir la app instalada en el celu (o primera apertura móvil de la sesión)
    if (isStandalone || (isMobileViewport && !alreadyShown)) {
      try { sessionStorage.setItem('godmarket_splash_shown', '1'); } catch (e) {}
      this.playAppLaunchAnimation({
        subtitle: isStandalone ? 'Bienvenido a GOD MARKET' : 'Buenos Aires · Café y Pastelería',
        duration: isStandalone ? 1650 : 1400
      });
    }
  }

  playAppLaunchAnimation({ subtitle = 'Buenos Aires · Café y Pastelería', duration = 1550 } = {}) {
    const splash = document.getElementById('gm-app-splash');
    if (!splash) return;

    const subEl = document.getElementById('gm-splash-subtitle');
    if (subEl) subEl.textContent = subtitle;

    clearTimeout(this._splashHideTimer);
    clearTimeout(this._splashCleanTimer);

    splash.classList.remove('is-leaving');
    splash.classList.add('is-visible');
    splash.setAttribute('aria-hidden', 'false');

    // Permitir cerrar tocando la pantalla si el usuario quiere entrar antes
    const dismissNow = () => {
      clearTimeout(this._splashHideTimer);
      splash.classList.add('is-leaving');
      this._splashCleanTimer = setTimeout(() => {
        splash.classList.remove('is-visible', 'is-leaving');
        splash.setAttribute('aria-hidden', 'true');
      }, 460);
    };
    splash.onclick = dismissNow;

    this._splashHideTimer = setTimeout(dismissNow, duration);
  }

  installPWA() {
    this.playSound('tap');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      this.playAppLaunchAnimation({ subtitle: 'Ya estás en la app de GOD MARKET', duration: 1450 });
      return;
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.playSound('orderSuccess');
          this.playAppLaunchAnimation({ subtitle: 'App instalada · Bienvenido', duration: 1800 });
          this.showToast("App instalada con éxito", 'success');
        }
        this.deferredPrompt = null;
        const installBanner = document.getElementById('pwa-install-pill');
        if (installBanner) installBanner.style.display = 'none';
      });
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      this.openModal('ios-install-modal');
      return;
    }

    this.showToast("Para instalar: abrí el menú del navegador y elegí 'Instalar aplicación'.", 'info');
  }

  dismissPWA() {
    const installBanner = document.getElementById('pwa-install-pill');
    if (installBanner) installBanner.style.display = 'none';
    sessionStorage.setItem('godmarket_pwa_dismissed', 'true');
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
          this.playSound('stepDown');
        }
      });

      qtyPlus.addEventListener('click', () => {
        let current = parseInt(qtyVal.textContent, 10);
        qtyVal.textContent = current + 1;
        this.updateModalAddButton(current + 1);
        this.playSound('stepUp');
      });
    }

    // Modal de Producto: Añadir al carrito
    const btnAddModal = document.getElementById('btn-add-modal-cart');
    if (btnAddModal) {
      btnAddModal.addEventListener('click', () => {
        if (this.selectedProductForModal) {
          const qty = parseInt(document.getElementById('modal-qty-val').textContent, 10);
          const customSection = document.getElementById('modal-customization-options');
          const hasCustom = customSection && customSection.style.display !== 'none';
          const dedication = hasCustom ? (document.getElementById('modal-dedication')?.value.trim() || '') : '';
          const candle = hasCustom ? (document.getElementById('modal-candle-checkbox')?.checked || false) : false;
          const note = hasCustom ? (document.getElementById('modal-note')?.value.trim() || '') : '';
          const rawFlavor = hasCustom ? (document.getElementById('modal-selected-flavor')?.value || '') : '';
          const flavor = (rawFlavor && rawFlavor !== 'Clásica de la Casa' && rawFlavor !== 'Clásica') ? rawFlavor : '';

          window.cartManager.addItem(this.selectedProductForModal, qty, { dedication, candle, note, flavor });
          this.playSound('addToCart');
          this.showToast(`${qty}x ${this.selectedProductForModal.name} agregado al pedido`, 'success');
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
        this.playSound('tap');
      });
    });

    // Checkout: Formulario y opciones de pago
    document.querySelectorAll('.payment-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.currentTarget.hidden) return;
        document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.playSound('tap');
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

    const custTimeInput = document.getElementById('cust-time');
    if (custTimeInput) {
      custTimeInput.addEventListener('input', () => {
        document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
      });
    }

    // Botón Continuar / Proceder del Carrito al Checkout (Soporta btn-proceed-checkout y btn-to-checkout)
    ['btn-proceed-checkout', 'btn-to-checkout'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          if (window.cartManager.getItemCount() === 0) {
            this.showToast("Tu carrito está vacío. Elegí un producto primero.", 'warn');
            this.closeModal('cart-drawer-modal');
            return;
          }
          this.closeModal('cart-drawer-modal');
          this.openModal('checkout-modal');
        });
      }
    });

    // Enviar Checkout a WhatsApp con Validaciones Robustas
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Validar que el carrito no esté vacío
        if (window.cartManager.getItemCount() === 0) {
          this.showToast("Tu carrito está vacío. Elegí algún producto primero.", 'warn');
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
        if (!phoneVal || digitsOnly.length < 8 || digitsOnly.length > 20) {
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

          // Validación de Radio de Entrega del Vendedor
          const outOfRange = [];
          window.cartManager.items.forEach(item => {
            const b = window.productManager.getBusinessById(item.product.businessId);
            if (b) {
              const bLat = b.lat !== undefined ? b.lat : -34.5885;
              const bLng = b.lng !== undefined ? b.lng : -58.4285;
              const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
              const maxRadius = b.deliveryRadiusKm || 5.0;
              if (dist > maxRadius) {
                if (!outOfRange.some(o => o.name === b.name)) {
                  outOfRange.push({ name: b.name, dist, maxRadius });
                }
              }
            }
          });

          if (outOfRange.length > 0) {
            const listStr = outOfRange.map(o => `• ${o.name}: estás a ${o.dist} km (su radio máximo de envío es ${o.maxRadius} km)`).join('\n');
            const switchPickup = confirm(`Atención de cobertura:\nTu dirección está fuera del radio de entrega a domicilio para:\n${listStr}\n\n¿Deseás cambiar tu pedido a 'Retiro en local' sin cargo?`);
            if (switchPickup) {
              window.cartManager.setDeliveryType('pickup');
              this.switchDeliveryType('pickup');
            } else {
              this.showToast("Cambiá tu dirección o seleccioná retiro en local", 'warn');
              return;
            }
          }
        }

        // Validación de Horario / Fecha preferida
        const timeVal = timeInput.value.trim();
        if (!timeVal || timeVal.length < 2) {
          timeInput.classList.add('is-invalid');
          isValid = false;
          if (!firstInvalidField) firstInvalidField = timeInput;
        } else if (!this.isStoreOpen() && (timeVal.toLowerCase().includes('ahora') || timeVal.toLowerCase().includes('antes posible'))) {
          timeInput.classList.add('is-invalid');
          isValid = false;
          if (!firstInvalidField) firstInvalidField = timeInput;
          this.showToast("El local está cerrado (08:30 a 20:00 hs). Elegí un horario programado.", 'warn');
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
          this.playSound('error');
          checkoutForm.classList.add('shake');
          setTimeout(() => checkoutForm.classList.remove('shake'), 400);
          this.showToast("Revisá los campos resaltados en rojo", 'warn');
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

        // Guardar automáticamente datos del cliente en su teléfono para futuras compras
        try {
          if (nameVal) localStorage.setItem('godmarket_user_name', nameVal);
          if (phoneVal) localStorage.setItem('godmarket_user_phone', phoneVal);
          if (formData.apartment) localStorage.setItem('godmarket_user_apt', formData.apartment);
          if (formData.zone) localStorage.setItem('godmarket_user_zone', formData.zone);
          if (isDelivery && addressInput && addressInput.value.trim()) {
            localStorage.setItem('godmarket_user_address', addressInput.value.trim());
          }
        } catch (e) {}

        // Procesar orden generando Número de Orden único y enviando a WhatsApp
        const submitButton = checkoutForm.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        try {
          const order = await window.checkoutHandler.processOrder(formData, window.cartManager);
          this.closeModal('checkout-modal');
          this.updateOrdersBadges();
          this.renderOrderTicket(order);
          this.playSound('orderSuccess');
          this.openModal('order-success-modal');
        } catch (error) {
          console.error('No se pudo confirmar el pedido:', error);
          this.playSound('error');
          this.showToast(error.message || 'No se pudo confirmar el pedido. Intenta nuevamente.');
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      });
    }
  }

  updateDeliveryUI(type) {
    const addressField = document.getElementById('delivery-address-group');
    if (addressField) {
      addressField.style.display = (type === 'delivery') ? 'block' : 'none';
    }
  }

  icon(name, size = 16, className = '') {
    return typeof window.gmIcon === 'function' ? window.gmIcon(name, className, size) : '';
  }

  avatarIcon(avatarValue, size = 18) {
    return typeof window.gmAvatarIcon === 'function' ? window.gmAvatarIcon(avatarValue, size) : '';
  }

  cleanText(str) {
    return typeof window.gmCleanText === 'function' ? window.gmCleanText(str) : String(str || '');
  }

  formatDistanceLabel(distanceKm) {
    const num = parseFloat(distanceKm);
    if (!Number.isFinite(num)) return '';
    if (num < 0.25) return 'A pasos tuyo';
    if (num < 1) return `${Math.round(num * 1000)} m`;
    return `${num.toFixed(1).replace(/\.0$/, '')} km`;
  }

  refreshIcons() {
    if (typeof window.gmHydrateIcons === 'function') {
      window.gmHydrateIcons(document);
    }
    if (window.soundEngine && typeof window.soundEngine.syncToggleButtons === 'function') {
      window.soundEngine.syncToggleButtons();
    }
    if (window.lucide && typeof lucide.createIcons === 'function') {
      setTimeout(() => {
        try { lucide.createIcons(); } catch (e) {}
      }, 10);
    }
  }

  renderLocationBar() {
    const displayAddress = this.currentAddress || 'Seleccionar ubicación';
    const ids = [
      'current-delivery-address',
      'desktop-delivery-address',
      'side-menu-address',
      'profile-current-address-label'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = displayAddress;
    });
  }

  promptRealLocationOnEntry() {
    let saved = localStorage.getItem('godmarket_user_address');
    if (saved === 'Palermo Hollywood, CABA' || saved === 'Palermo Hollywood' || saved === 'Palermo') {
      localStorage.removeItem('godmarket_user_address');
      saved = null;
    }

    if (saved) {
      this.currentAddress = saved;
      this.renderLocationBar();
      return;
    }

    if (!navigator.geolocation) {
      this.currentAddress = 'Seleccionar ubicación';
      this.renderLocationBar();
      return;
    }

    // Solicitar permiso de geolocalización real del navegador al ingresar
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        this.saveUserCoords({ lat, lng });

        let resolvedAddress = 'Tu ubicación actual';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'es' }
          });
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const street = addr.road || addr.pedestrian || addr.street || addr.footway || '';
            const number = addr.house_number || '';
            const zone = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.city || addr.town || '';
            if (street && number) {
              resolvedAddress = `${street} ${number}${zone ? `, ${zone}` : ''}`;
            } else if (street) {
              resolvedAddress = `${street}${zone ? `, ${zone}` : ''}`;
            } else if (zone) {
              resolvedAddress = zone;
            } else if (data.display_name) {
              resolvedAddress = data.display_name.split(',')[0];
            }
          }
        } catch (e) {
          console.warn('Error al geocodificar dirección:', e);
        }

        this.currentAddress = resolvedAddress;
        localStorage.setItem('godmarket_user_address', this.currentAddress);
        this.renderLocationBar();
        this.renderStoresCards();
        this.renderBusinessesSlider();
        this.renderProducts();
        this.showToast(`Ubicación detectada: ${this.currentAddress}`, 'success');
      },
      (err) => {
        console.warn('Geolocalización declinada o no disponible:', err);
        this.currentAddress = 'Seleccionar ubicación';
        this.renderLocationBar();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  openAddressModal() {
    this.openModal('address-picker-modal');
  }

  selectNeighborhood(neighborhood, lat = null, lng = null) {
    this.currentAddress = `${neighborhood}`;
    localStorage.setItem('godmarket_user_address', this.currentAddress);

    // Si se pasan coordenadas fijas del barrio, guardarlas; si es dirección manual, geocodificar
    if (lat !== null && lng !== null) {
      this.saveUserCoords({ lat, lng });
    } else if (neighborhood && neighborhood.length >= 3) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(neighborhood + ', Buenos Aires, Argentina')}&limit=1`, {
        headers: { 'Accept-Language': 'es' }
      })
        .then(r => r.ok ? r.json() : [])
        .then(results => {
          if (Array.isArray(results) && results.length > 0) {
            const parsedLat = parseFloat(results[0].lat);
            const parsedLng = parseFloat(results[0].lon);
            if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
              this.saveUserCoords({ lat: parseFloat(parsedLat.toFixed(5)), lng: parseFloat(parsedLng.toFixed(5)) });
              this.renderStoresCards();
              this.renderBusinessesSlider();
              this.renderBusinessSpotlight();
              this.renderProducts();
            }
          }
        })
        .catch(() => {});
    }

    this.renderLocationBar();
    this.closeModal('address-picker-modal');
    this.showToast(`Ubicación actualizada a ${this.currentAddress}`, 'success');

    // Re-renderizar locales y catálogo con las nuevas distancias
    this.renderStoresCards();
    this.renderBusinessesSlider();
    this.renderProducts();

    // Actualizar también campo de dirección en checkout si está vacío
    const addressInput = document.getElementById('cust-address');
    if (addressInput && !addressInput.value) {
      addressInput.value = this.currentAddress;
    }
  }

  detectUserGPS() {
    if (!navigator.geolocation) {
      this.showToast('Tu navegador no soporta geolocalización GPS.', 'warn');
      return;
    }

    this.showToast('Detectando tu ubicación GPS...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        this.saveUserCoords({ lat, lng });

        let resolvedAddress = 'Tu ubicación actual';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'es' }
          });
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const street = addr.road || addr.pedestrian || addr.street || addr.footway || '';
            const number = addr.house_number || '';
            const zone = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.city || addr.town || '';
            if (street && number) {
              resolvedAddress = `${street} ${number}${zone ? `, ${zone}` : ''}`;
            } else if (street) {
              resolvedAddress = `${street}${zone ? `, ${zone}` : ''}`;
            } else if (zone) {
              resolvedAddress = zone;
            } else if (data.display_name) {
              resolvedAddress = data.display_name.split(',')[0];
            }
          }
        } catch (e) {
          console.warn('Error al geocodificar:', e);
        }

        this.currentAddress = resolvedAddress;
        localStorage.setItem('godmarket_user_address', this.currentAddress);

        this.renderLocationBar();
        this.renderStoresCards();
        this.renderBusinessesSlider();
        this.renderProducts();
        this.closeModal('address-picker-modal');
        this.showToast(`Ubicación detectada: ${this.currentAddress}`, 'success');

        const addressInput = document.getElementById('cust-address');
        if (addressInput) {
          addressInput.value = this.currentAddress;
        }
      },
      (err) => {
        this.showToast('No se pudo obtener tu ubicación GPS. Elegí tu barrio en la lista.', 'warn');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  setOnlyInRange(checked) {
    this.onlyInRange = Boolean(checked);
    localStorage.setItem('godmarket_only_in_range', this.onlyInRange ? 'true' : 'false');
    const toggle = document.getElementById('toggle-filter-in-range');
    if (toggle) toggle.checked = this.onlyInRange;
    this.renderStoresCards();
    this.renderProducts();
    if (this.onlyInRange) {
      this.showToast('Mostrando solo locales con envío a tu zona', 'info');
    } else {
      this.showToast('Mostrando todos los locales del marketplace', 'info');
    }
  }

  renderStories() {
    const container = document.getElementById('stories-slider');
    if (!container) return;

    const stories = [
      { id: 'cafeterias', name: 'Cafeterías', icon: 'coffee' },
      { id: 'desayunos', name: 'Desayunos', icon: 'croissant' },
      { id: 'healthy', name: 'Healthy', icon: 'leaf' },
      { id: 'bebidas', name: 'Bebidas', icon: 'drinks' },
      { id: 'pasteleria', name: 'Pastelería', icon: 'patisserie' },
      { id: 'boxes', name: 'Boxes', icon: 'gift' }
    ];

    container.innerHTML = stories.map(s => {
      const isActive = (s.id === 'cafeterias' && this.selectedBusiness === 'todos' && this.currentCategory === 'todos') || (this.currentCategory === s.id);
      return `
        <div class="story-bubble ${isActive ? 'active' : ''}" 
             onclick="window.app.handleCategoryClick('${s.id}')"
             title="${s.name}">
          <div class="story-ring">
            <div class="story-avatar-inner">${this.icon(s.icon, 23)}</div>
          </div>
          <span class="story-label">${s.name}</span>
        </div>
      `;
    }).join('');
  }

  handleCategoryClick(id) {
    this.playSound('tap');
    if (id === 'cafeterias') {
      this.selectedBusiness = 'todos';
      this.currentCategory = 'todos';
      this.renderStories();
      const cafSec = document.getElementById('cafeterias-section') || document.querySelector('.cafeterias-god-section') || document.querySelector('.stores-py-section');
      if (cafSec) cafSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (id === 'healthy') {
      this.selectedBusiness = 'todos';
      this.currentCategory = 'brunch';
      this.renderStories();
      this.renderProducts();
      const prodSec = document.getElementById('products-section-container');
      if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (id === 'bebidas') {
      this.selectedBusiness = 'todos';
      this.currentCategory = 'meriendas';
      this.renderStories();
      this.renderProducts();
      const prodSec = document.getElementById('products-section-container');
      if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (id === 'pasteleria') {
      this.selectedBusiness = 'todos';
      this.currentCategory = 'todos';
      this.renderStories();
      this.renderProducts();
      const prodSec = document.getElementById('products-section-container');
      if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.selectedBusiness = 'todos';
      this.currentCategory = id;
      this.renderStories();
      this.renderProducts();
      const prodSec = document.getElementById('products-section-container');
      if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleSideMenu() {
    const drawer = document.getElementById('side-menu-drawer');
    if (drawer) {
      const opening = !drawer.classList.contains('active');
      drawer.classList.toggle('active');
      if (opening) this.playSound('open');
    }
  }

  openProfileModal() {
    this.openModal('profile-modal');
  }

  openFavorites() {
    if (this.favorites && this.favorites.length > 0) {
      this.currentCategory = 'favoritos';
      this.selectedBusiness = 'todos';
      this.renderCategories();
      this.renderStories();
      this.renderBusinessSpotlight();
      this.renderProducts();
      this.showToast(`Mostrando tus ${this.favorites.length} favoritos`, 'info');
      const prodSec = document.getElementById('products-section-container');
      if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.showToast('Tocá el corazón en cualquier producto para guardarlo en favoritos.', 'info');
    }
  }

  focusSearch() {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  goHome() {
    this.setDesktopNavActive('home');
    this.setBusiness('todos');
    this.setCategory('todos');
    this.searchQuery = '';
    const input = document.getElementById('main-search-input');
    if (input) input.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showAllStores() {
    this.setBusiness('todos');
    const cafSec = document.getElementById('cafeterias-section') || document.querySelector('.cafeterias-god-section');
    if (cafSec) cafSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  filterCafeterias() {
    this.setDesktopNavActive('cafeterias');
    this.showAllStores();
  }

  setDesktopNavActive(navKey) {
    document.querySelectorAll('.desktop-nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.desktopNav === navKey);
    });
  }

  switchDeliveryType(type) {
    window.cartManager.setDeliveryType(type);
    document.querySelectorAll('.side-delivery-btn, .side-delivery-tab, .delivery-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
    });
    this.updateDeliveryUI(type);
    this.playSound('tap');
    this.showToast(type === 'delivery' ? 'Modalidad: Envío a domicilio por vendedor' : 'Modalidad: Retiro en local', 'info');
  }

  renderFilterChips() {
    const container = document.getElementById('filter-chips-slider');
    if (!container) return;

    const filters = [
      { id: 'all', label: 'Todos los locales', icon: 'grid' },
      { id: 'open', label: 'Abiertos ahora', icon: 'clock' },
      { id: 'freeShipping', label: 'Envío bonificado', icon: 'delivery' },
      { id: 'topRated', label: 'Destacados 4.9+', icon: 'star' },
      { id: 'near', label: 'Más cercanos', icon: 'map-pin' }
    ];

    container.innerHTML = filters.map(f => `
      <button type="button" class="filter-chip-py ${this.currentFilter === f.id ? 'active' : ''}" 
              onclick="window.app.setFilter('${f.id}')">
        ${this.icon(f.icon, 14)}
        <span>${f.label}</span>
      </button>
    `).join('');
  }

  setFilter(filterId) {
    this.currentFilter = filterId;
    this.playSound('tap');
    this.renderFilterChips();
    this.renderStoresCards();
    this.renderProducts();
  }

  renderStoresCards() {
    const container = document.getElementById('stores-py-grid');
    if (!container) return;

    const totalAll = window.productManager.getAllBusinesses().length;

    // Si aún no hay comercios registrados en el marketplace
    if (totalAll === 0) {
      container.innerHTML = `
        <div class="marketplace-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 44px 24px; color: var(--cream-muted); background: var(--green-card); border-radius: 20px; border: 1px dashed rgba(200,169,106,0.3); margin: 12px 0;">
          <div class="gm-empty-icon-circle">${this.icon('store', 28)}</div>
          <h3 style="color: var(--cream); font-size: 1.35rem; margin-bottom: 8px;">Marketplace listo para inaugurar</h3>
          <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px auto; line-height: 1.55; color: var(--cream-muted);">
            Sé el primer comercio en formar parte de GOD MARKET. Registrá tu pastelería o cafetería, definí tu radio de entrega en el mapa y empezá a recibir pedidos.
          </p>
          <button class="btn-primary" onclick="window.sellerPortal.chooseRole('vendedor')" style="width: auto; padding: 11px 26px; font-size: 0.9rem; margin: 0 auto;">
            ${this.icon('store', 16)}
            <span>Registrar mi local</span>
          </button>
        </div>
      `;
      return;
    }

    const businesses = window.productManager.getBusinessesFiltered(this.currentFilter, this.userCoords, this.onlyInRange);

    if (businesses.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 36px 20px; color: var(--cream-muted); background: var(--green-card); border-radius: 16px; border: 1px dashed rgba(200,169,106,0.28);">
          <div class="gm-empty-icon-circle">${this.icon('delivery', 26)}</div>
          <h4 style="color: var(--cream); font-size: 1.08rem; margin-bottom: 6px;">No hay cafeterías disponibles en tu radio de entrega</h4>
          <p style="font-size: 0.84rem; max-width: 380px; margin: 0 auto 16px auto; line-height: 1.45;">
            Actualmente ningún local con este filtro llega a tu dirección (${this.escapeHTML(this.currentAddress || 'Buenos Aires')}). Podés desactivar el filtro de cobertura o cambiar tu barrio.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-primary" onclick="window.app.setOnlyInRange(false); window.app.setFilter('all');" style="width: auto; padding: 9px 18px; font-size: 0.82rem;">
              Ver todos los locales
            </button>
            <button class="btn-secondary" onclick="window.app.openAddressModal()" style="width: auto; padding: 9px 18px; font-size: 0.82rem;">
              ${this.icon('map-pin', 14)}
              <span>Cambiar ubicación</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = businesses.map(b => {
      const reachBadge = b.inDeliveryRange
        ? `<div class="cafeteria-reach-overlay in-range">${this.icon('delivery', 12)}<span>En tu zona</span></div>`
        : `<div class="cafeteria-reach-overlay out-range">${this.icon('store', 12)}<span>Solo retiro</span></div>`;
      const isPromo = window.productManager.isBusinessPromoActive
        ? window.productManager.isBusinessPromoActive(b)
        : Boolean(b.isPromoActive);
      const promoBadgeHtml = isPromo
        ? `<div class="cafeteria-promo-float-badge"><span class="promo-dot"></span><span>Precio de local · 0% servicio</span></div>`
        : '';
      const distLabel = this.formatDistanceLabel(b.computedDistanceKm !== null && b.computedDistanceKm !== undefined ? b.computedDistanceKm : parseFloat(b.distance));

      return `
        <div class="cafeteria-god-card" onclick="window.app.setBusiness('${b.id}')" title="Ver menú de ${this.escapeHTML(b.name)}">
          <div class="cafeteria-card-img-wrap" style="position: relative;">
            <img class="cafeteria-card-img" src="${this.escapeHTML(this.safeImageUrl(b.cover, 'assets/images/lumiere_cafe.webp'))}" alt="${this.escapeHTML(b.name)}" loading="lazy">
            ${promoBadgeHtml}
            ${reachBadge}
          </div>
          <div class="cafeteria-card-body">
            <h4 class="cafeteria-card-title">${this.escapeHTML(b.name)}</h4>
            <p class="cafeteria-card-sub">${this.escapeHTML(b.tagline)}</p>
            <div class="cafeteria-card-meta">
              <span class="star-gold">${this.icon('star-filled', 13)} ${b.rating}</span>
              <span>·</span>
              <span>${this.escapeHTML(distLabel || b.neighborhood || 'CABA')}</span>
              <span>·</span>
              <span>Radio ${b.deliveryRadiusKm || 5} km</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderBusinessesSlider() {
    const container = document.getElementById('businesses-slider');
    if (!container) return;

    const businesses = window.productManager.getAllBusinesses();

    if (businesses.length === 0) {
      container.innerHTML = `
        <div class="business-chip active" onclick="window.sellerPortal.chooseRole('vendedor')">
          <div class="business-chip-avatar">${this.icon('store', 16)}</div>
          <div class="business-chip-info">
            <span class="business-chip-name">Publicar mi local</span>
            <span class="business-chip-zone">Sumate a GOD MARKET</span>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="business-chip ${this.selectedBusiness === 'todos' ? 'active' : ''}" 
           onclick="window.app.setBusiness('todos')">
        <div class="business-chip-avatar">${this.icon('grid', 15)}</div>
        <div class="business-chip-info">
          <span class="business-chip-name">Todas (${businesses.length})</span>
          <span class="business-chip-zone">Marketplace</span>
        </div>
      </div>
    `;

    businesses.forEach(b => {
      const isActive = this.selectedBusiness === b.id;
      html += `
        <div class="business-chip ${isActive ? 'active' : ''}" 
             onclick="window.app.setBusiness('${b.id}')">
          <div class="business-chip-avatar">${this.avatarIcon(b.avatar, 16)}</div>
          <div class="business-chip-info">
            <span class="business-chip-name">${this.escapeHTML(b.name)}</span>
            <span class="business-chip-zone">${this.escapeHTML(b.neighborhood || 'Buenos Aires')}</span>
          </div>
          <div class="business-chip-rating gm-inline-label">${this.icon('star-filled', 11)} ${b.rating || 5.0}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterByBusiness(businessId) {
    this.setBusiness(businessId);
  }

  setBusiness(businessId) {
    this.selectedBusiness = businessId;
    if (businessId !== 'todos' && this.currentCategory === 'favoritos') {
      this.currentCategory = 'todos';
    }
    if (businessId && businessId !== 'todos') {
      try {
        const bizSessionKey = `godmarket_biz_visit_${businessId}`;
        if (!sessionStorage.getItem(bizSessionKey)) {
          sessionStorage.setItem(bizSessionKey, '1');
          fetch('/api/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId })
          }).catch(() => {});
        }
      } catch (_) {}
    }
    this.renderBusinessesSlider();
    this.renderBusinessSpotlight();
    this.renderStories();
    this.renderProducts();
    this.refreshIcons();

    // Scroll suave hacia los productos de la tienda
    const spotlight = document.getElementById('store-spotlight-container');
    if (spotlight && businessId !== 'todos') {
      spotlight.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  renderBusinessSpotlight() {
    const container = document.getElementById('store-spotlight-container');
    if (!container) return;

    if (this.selectedBusiness === 'todos') {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    const business = window.productManager.getBusinessById(this.selectedBusiness);
    if (!business) {
      container.style.display = 'none';
      return;
    }

    const cleanBadge = this.cleanText(business.badge) || 'Destacado';
    const bLat = business.lat !== undefined ? business.lat : -34.5885;
    const bLng = business.lng !== undefined ? business.lng : -58.4285;
    const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
    const radius = business.deliveryRadiusKm || 5.0;
    const inRange = dist <= radius;
    const distText = this.formatDistanceLabel(dist);

    container.style.display = 'block';
    container.innerHTML = `
      <div class="store-profile-hero animate-fade">
        <img class="store-profile-cover" src="${this.escapeHTML(this.safeImageUrl(business.cover, 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80'))}" alt="${this.escapeHTML(business.name)}">
        <div class="store-profile-content">
          <div class="store-profile-avatar-wrap">${this.avatarIcon(business.avatar, 24)}</div>
          
          <div class="store-profile-header-actions">
            <a href="https://wa.me/${window.formatWhatsAppPhone ? window.formatWhatsAppPhone(business.phone || business.whatsapp) : (business.phone || '5491156192616')}?text=${encodeURIComponent(`Hola ${business.name}, los contacto desde GOD MARKET por sus propuestas.`)}" 
               target="_blank" class="btn-chat-seller">
              ${this.icon('whatsapp', 15)}
              <span>Hablar con el local</span>
            </a>
            <button class="btn-close-store-view gm-inline-label" onclick="window.app.setBusiness('todos')" title="Ver todas las pastelerías">
              ${this.icon('x', 13)}
              <span>Ver todas</span>
            </button>
          </div>

          <div style="margin-top: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="font-serif gm-inline-label" style="font-size: 1.4rem; margin-bottom: 2px;">
                <span>${this.escapeHTML(business.name)}</span>
                <span style="color: var(--success); display: inline-flex;">${this.icon('verified', 17)}</span>
              </h3>
              <span class="store-spotlight-badge">${this.escapeHTML(cleanBadge)}</span>
            </div>
            <p style="font-size: 0.84rem; color: var(--cream-muted); margin-bottom: 8px; line-height: 1.4;">
              ${this.escapeHTML(business.tagline)}
            </p>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.76rem; color: var(--text-muted); flex-wrap: wrap;">
              <span class="gm-inline-label">${this.icon('map-pin', 13)} ${this.escapeHTML(business.address || business.neighborhood)}</span>
              <span>·</span>
              <span class="gm-inline-label">${this.icon('star-filled', 13)} ${business.rating} (${business.reviews} opiniones)</span>
              <span>·</span>
              <span class="gm-inline-label">${this.icon('clock', 13)} ${this.escapeHTML(business.schedule || '08:30 a 20:00 hs')}</span>
            </div>

            <!-- Badge dinámico de Cobertura -->
            <div style="margin-top: 10px;">
              ${inRange
                ? `<span class="coverage-badge in-range">${this.icon('delivery', 13)} En tu zona (${this.escapeHTML(distText)} · Radio hasta ${radius} km)</span>`
                : `<span class="coverage-badge out-range">${this.icon('store', 13)} Fuera de radio (${this.escapeHTML(distText)} · Máx ${radius} km · Solo retiro)</span>`}
            </div>
          </div>

          <!-- Política de Envío -->
          <div class="store-profile-policy-box">
            ${this.icon('delivery', 18)}
            <div>
              <strong style="color: var(--cream);">Logística a cargo de ${this.escapeHTML(business.name)}:</strong>
              <div>Cadetería propia con caja térmica. Entrega estimada: <strong>${this.escapeHTML(business.deliveryTime)}</strong> (Costo: ${window.cartManager.formatCurrency(business.deliveryFee)}). Envío sin cargo desde ${window.cartManager.formatCurrency(business.freeShippingFrom || 45000)}.</div>
              <div class="gm-inline-label" style="margin-top: 6px; font-size: 0.74rem; font-weight: 600; color: ${inRange ? 'var(--success)' : 'var(--danger)'};">
                ${inRange
                  ? `${this.icon('check-circle', 13)} Tu dirección está dentro del radio de entrega (${this.escapeHTML(distText)} / ${radius} km).`
                  : `${this.icon('alert', 13)} Tu dirección está fuera del radio (${this.escapeHTML(distText)} / ${radius} km). Disponible para retiro en local.`}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderCategories() {
    const categories = [
      { id: 'todos', name: 'Todo el menú', icon: 'grid' },
      { id: 'desayunos', name: 'Desayunos', icon: 'croissant' },
      { id: 'meriendas', name: 'Meriendas y té', icon: 'coffee' },
      { id: 'brunch', name: 'Brunch y salado', icon: 'leaf' },
      { id: 'boxes', name: 'Boxes regalo', icon: 'gift' }
    ];

    const container = document.getElementById('categories-slider');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
      <div class="category-item ${this.currentCategory === cat.id ? 'active' : ''}" 
           onclick="window.app.setCategory('${cat.id}')">
        <div class="category-avatar">${this.icon(cat.icon, 22)}</div>
        <span class="category-name">${cat.name}</span>
      </div>
    `).join('');
  }

  setCategory(catId) {
    this.currentCategory = catId;
    const navKeyByCategory = {
      todos: 'home',
      desayunos: 'desayunos',
      brunch: 'healthy',
      meriendas: 'bebidas',
      boxes: 'boxes'
    };
    this.setDesktopNavActive(navKeyByCategory[catId] || '');
    this.renderCategories();
    this.renderProducts();
  }

  renderProducts() {
    const container = document.getElementById('products-section-container');
    if (!container) return;

    const effectiveCategory = this.currentCategory === 'favoritos' ? 'todos' : this.currentCategory;
    let products = window.productManager.search(this.searchQuery, this.selectedBusiness, effectiveCategory);

    if (this.currentCategory === 'favoritos') {
      products = products.filter(p => this.favorites.includes(p.id));
    }

    const filteredBusinesses = window.productManager.getBusinessesFiltered(this.currentFilter, this.userCoords, this.onlyInRange);
    const allowedBizIds = new Set(filteredBusinesses.map(b => b.id));
    if (this.selectedBusiness === 'todos' && (this.onlyInRange || this.currentFilter !== 'all')) {
      products = products.filter(p => allowedBizIds.has(p.businessId));
    }

    if (products.length === 0) {
      const totalInMarket = window.productManager.getAllProducts().length;
      if (totalInMarket === 0) {
        container.innerHTML = `
          <div class="catalog-empty-state" style="text-align: center; padding: 44px 24px; color: var(--cream-muted); background: var(--green-card); border-radius: 20px; border: 1px dashed rgba(200,169,106,0.3); margin: 20px 0;">
            <div class="gm-empty-icon-circle">${this.icon('patisserie', 28)}</div>
            <h3 style="color: var(--cream); font-size: 1.35rem; margin-bottom: 8px;">Catálogo listo para cargar</h3>
            <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px auto; line-height: 1.55; color: var(--cream-muted);">
              Aún no hay productos publicados en el marketplace. Como comercio o pastelero, podés registrarte y publicar tus creaciones con foto en minutos.
            </p>
            <button class="btn-primary" onclick="window.sellerPortal.chooseRole('vendedor')" style="width: auto; padding: 11px 26px; font-size: 0.9rem; margin: 0 auto;">
              ${this.icon('store', 16)}
              <span>Acceso vendedores / Publicar producto</span>
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div class="gm-empty-icon-circle">${this.icon('search', 24)}</div>
          <h3 style="color: var(--cream); margin-bottom: 6px;">No encontramos resultados</h3>
          <p style="font-size: 0.85rem; color: var(--cream-muted);">Probá buscando otra pastelería, producto o cambiando de categoría.</p>
          <button class="btn-primary" onclick="window.app.setOnlyInRange(false); window.app.setFilter('all'); window.app.setBusiness('todos'); window.app.setCategory('todos');" style="margin: 16px auto 0; max-width: 240px; padding: 10px 18px; font-size: 0.85rem;">
            Ver todo el marketplace
          </button>
        </div>
      `;
      return;
    }

    // Si estamos viendo "todos" sin búsqueda y sin negocio específico seleccionado, agrupar por los negocios filtrados
    if (this.selectedBusiness === 'todos' && this.currentCategory === 'todos' && !this.searchQuery) {
      const businesses = filteredBusinesses;
      let html = '';

      businesses.forEach(b => {
        const bProducts = products.filter(p => p.businessId === b.id);
        if (bProducts.length > 0) {
          html += `
            <div class="section-container animate-fade store-section-block">
              <div class="section-header store-section-header">
                <div class="store-section-title-wrap">
                  <div class="store-section-icon">${this.avatarIcon(b.avatar, 20)}</div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 class="section-title">${this.escapeHTML(b.name)}</h3>
                      <span class="store-mini-badge">${this.escapeHTML(b.neighborhood)}</span>
                    </div>
                    <p class="section-subtitle">
                      <span>${this.escapeHTML(b.tagline)}</span>
                      <span>·</span>
                      <span class="gm-inline-label" style="color: var(--primary);">${this.icon('star-filled', 12)} ${b.rating} (${b.reviews})</span>
                      <span>·</span>
                      <span class="gm-inline-label">${this.icon('clock', 12)} ${this.escapeHTML(b.deliveryTime)}</span>
                    </p>
                  </div>
                </div>
                <button class="btn-view-store" onclick="window.app.setBusiness('${b.id}')">
                  <span>Ver carta</span>
                  ${this.icon('arrow-right', 13)}
                </button>
              </div>
              <div class="products-grid">
                ${bProducts.map(p => this.renderProductCard(p, false)).join('')}
              </div>
            </div>
          `;
        }
      });
      container.innerHTML = html;
    } else {
      // Vista filtrada por negocio, categoría o búsqueda
      let title = "Resultados del marketplace";
      let subtitle = `${products.length} propuestas disponibles`;
      const showStoreMeta = this.selectedBusiness === 'todos';

      if (this.selectedBusiness !== 'todos') {
        const bObj = window.productManager.getBusinessById(this.selectedBusiness);
        if (bObj) {
          title = `Carta de ${this.escapeHTML(bObj.name)}`;
          subtitle = `${products.length} productos en ${this.escapeHTML(bObj.neighborhood)}`;
        }
      } else if (this.currentCategory !== 'todos') {
        const catMap = {
          desayunos: 'Desayunos sorpresa',
          meriendas: 'Meriendas y café de especialidad',
          brunch: 'Brunch y opciones saludables',
          boxes: 'Boxes de cumpleaños y regalo',
          favoritos: 'Tus favoritos guardados'
        };
        title = catMap[this.currentCategory] || 'Categoría';
      }

      container.innerHTML = `
        <div class="section-container animate-fade">
          <div class="section-header">
            <div>
              <h3 class="section-title">${title}</h3>
              <p class="section-subtitle">${subtitle}</p>
            </div>
            <span class="badge-count">${products.length}</span>
          </div>
          <div class="products-grid">
            ${products.map(p => this.renderProductCard(p, showStoreMeta)).join('')}
          </div>
        </div>
      `;
    }
  }

  renderProductCard(product, showStoreMeta = true) {
    const isFav = this.favorites.includes(product.id);
    const b = window.productManager.getBusinessById(product.businessId);
    let reachInfo = '';
    if (b && showStoreMeta) {
      const bLat = b.lat !== undefined ? b.lat : -34.5885;
      const bLng = b.lng !== undefined ? b.lng : -58.4285;
      const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
      const inRange = dist <= (b.deliveryRadiusKm || 5.0);
      reachInfo = inRange
        ? `<span class="product-reach-pill in-range">${this.icon('delivery', 12)} En tu zona</span>`
        : `<span class="product-reach-pill out-range">${this.icon('store', 12)} Retiro</span>`;
    }
    const cleanTag = this.cleanText(product.tag);
    const isPromo = b ? window.productManager.isBusinessPromoActive(b) : Boolean(product.isPromoActive);

    return `
      <div class="product-card" onclick="window.app.openProductModal('${product.id}')">
        <div class="product-image-container">
          <img class="product-image" src="${this.escapeHTML(this.safeImageUrl(product.image, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80'))}" alt="${this.escapeHTML(product.name)}" loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80'">
          ${cleanTag ? `<div class="product-tag">${this.escapeHTML(cleanTag)}</div>` : ''}
          <button class="favorite-btn ${isFav ? 'active' : ''}" 
                  onclick="window.app.toggleFavorite('${product.id}', event)" 
                  aria-label="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}"
                  title="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">
            ${this.icon(isFav ? 'heart-filled' : 'heart', 16)}
          </button>
        </div>
        <div class="product-content">
          ${showStoreMeta ? `
          <div class="product-card-meta-line">
            <div class="product-card-store-inline">
              ${this.avatarIcon(product.businessAvatar, 13)}
              <span>${this.escapeHTML(product.businessName || 'Pastelería')}</span>
            </div>
            ${reachInfo}
          </div>
          ` : ''}
          <h4 class="product-title">${this.escapeHTML(product.name)}</h4>
          <p class="product-desc-short">${this.escapeHTML(product.description)}</p>
          <div class="product-portion-tag">
            ${this.icon('utensils', 12)}
            <span>${this.escapeHTML(product.portion || '1 o 2 personas')}</span>
          </div>
          <div class="product-footer">
            <div>
              <div class="product-price">
                ${window.cartManager.formatCurrency(product.price)}
              </div>
              ${isPromo
                ? `<div class="product-promo-caption">Precio de local · 0% servicio</div>`
                : ''}
            </div>
            <button class="add-to-cart-btn" 
                    onclick="window.app.quickAddToCart('${product.id}', event)" 
                    aria-label="Agregar al carrito"
                    title="Agregar al carrito">
              ${this.icon('plus', 17)}
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
    document.getElementById('modal-product-img').src = this.safeImageUrl(product.image);
    document.getElementById('modal-product-title').textContent = product.name;
    document.getElementById('modal-product-price').textContent = window.cartManager.formatCurrency(product.price);

    const feePillEl = document.getElementById('modal-service-fee-pill');
    if (feePillEl) {
      const bizForPromo = window.productManager.getBusinessById(product.businessId);
      const promoState = bizForPromo
        ? window.productManager.getBusinessPromoState(bizForPromo)
        : null;
      const isPromo = promoState ? promoState.isPromoActive : Boolean(product.isPromoActive);
      const servicePercent = Math.round(promoState
        ? promoState.standardServiceFeeRate * 100
        : Number(product.serviceFeeRate || 0.2) * 100);
      feePillEl.innerHTML = isPromo
        ? `<span class="gm-inline-label" style="background:rgba(104,185,142,0.12);border:1px solid rgba(104,185,142,0.32);color:#9EE0BC;font-size:0.74rem;font-weight:600;padding:4px 11px;border-radius:999px;">${this.icon('award', 13)} Precio habitual de cafetería · Servicio ${servicePercent}% bonificado ($0)</span>`
        : `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(244,239,230,0.05);border:1px solid rgba(244,239,230,0.12);color:var(--cream-muted);font-size:0.73rem;font-weight:500;padding:4px 11px;border-radius:999px;">+ ${servicePercent}% cargo por servicio GOD MARKET en el carrito</span>`;
    }
    document.getElementById('modal-product-desc').textContent = product.description;
    document.getElementById('modal-product-portion').textContent = product.portion || 'Porción artesanal';

    const storeAvatar = document.getElementById('modal-store-avatar');
    const storeName = document.getElementById('modal-store-name');
    const storeZone = document.getElementById('modal-store-zone');
    if (storeAvatar) storeAvatar.innerHTML = this.avatarIcon(product.businessAvatar, 18);
    if (storeName) storeName.textContent = product.businessName || 'Pastelería Asociada';

    const b = window.productManager.getBusinessById(product.businessId);
    if (storeZone) {
      if (b) {
        const bLat = b.lat !== undefined ? b.lat : -34.5885;
        const bLng = b.lng !== undefined ? b.lng : -58.4285;
        const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
        const inRange = dist <= (b.deliveryRadiusKm || 5.0);
        const distLabel = this.formatDistanceLabel(dist);
        storeZone.innerHTML = `${this.escapeHTML(product.businessNeighborhood || 'Buenos Aires')} · <span style="color: ${inRange ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${inRange ? `En tu zona (${this.escapeHTML(distLabel)})` : `Solo retiro (${this.escapeHTML(distLabel)})`}</span>`;
      } else {
        storeZone.textContent = product.businessNeighborhood || 'Buenos Aires';
      }
    }

    // Reset inputs
    document.getElementById('modal-qty-val').textContent = '1';
    const dedication = document.getElementById('modal-dedication');
    if (dedication) dedication.value = '';
    const note = document.getElementById('modal-note');
    if (note) note.value = '';

    // Manejo interactivo de Velita de Cumpleaños
    const candleBadge = document.getElementById('modal-candle-badge');
    const candleCheckbox = document.getElementById('modal-candle-checkbox');
    if (candleBadge) candleBadge.style.display = 'none';

    if (candleCheckbox) {
      candleCheckbox.checked = false;
      candleCheckbox.onchange = () => {
        if (candleBadge) {
          candleBadge.style.display = candleCheckbox.checked ? 'inline-flex' : 'none';
        }
        this.playSound(candleCheckbox.checked ? 'favorite' : 'tap');
        if (candleCheckbox.checked) {
          this.showToast("Velita de cumpleaños incluida sin cargo", 'success');
        }
      };
    }

    // Manejar selección interactiva de gustos / rellenos
    const supportsCustom = product.category === 'tortas' || product.category === 'desayunos' || product.category === 'boxes';
    const flavorChips = document.querySelectorAll('#modal-flavor-chips .flavor-chip');
    const hiddenFlavor = document.getElementById('modal-selected-flavor');
    const flavorBadge = document.getElementById('modal-flavor-badge');
    const flavorBadgeText = document.getElementById('modal-flavor-badge-text');
    if (hiddenFlavor) hiddenFlavor.value = supportsCustom ? 'Clásica de la Casa' : '';
    if (flavorBadge) flavorBadge.style.display = supportsCustom ? 'inline-flex' : 'none';
    if (flavorBadgeText) flavorBadgeText.textContent = 'Clásica';

    flavorChips.forEach((chip, i) => {
      chip.classList.toggle('active', i === 0);
      chip.onclick = () => {
        flavorChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.playSound('tap');
        const flavor = chip.dataset.flavor;
        if (hiddenFlavor) hiddenFlavor.value = flavor;
        if (flavorBadgeText) {
          flavorBadgeText.textContent = (flavor === 'Clásica de la Casa' || flavor === 'Clásica')
            ? 'Clásica'
            : flavor;
        }
        
        this.switchModalCakeImage(flavor, product);
      };
    });

    // Mostrar sección de velita/dedicatoria y gustos especialmente para tortas, desayunos y boxes
    const customSection = document.getElementById('modal-customization-options');
    if (customSection) {
      customSection.style.display = supportsCustom ? 'block' : 'none';
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
      'Clásica de la Casa': (product || this.selectedProductForModal)?.image,
      'Clásica': (product || this.selectedProductForModal)?.image,
      'Dulce de Leche Repostero': 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
      'Dulce de Leche': 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
      'Nutella & Avellanas': 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80',
      'Frutos Rojos & Crema': 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
      'Frutos Rojos': 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
      'Crema Bariloche': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80'
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
      this.playSound('addToCart');
      this.showToast(`${product.name} añadido al pedido`, 'success');
    }
  }

  updateCartItemQty(index, newQty) {
    const currentItem = window.cartManager.items[index];
    if (!currentItem) return;
    if (newQty <= 0) {
      this.playSound('remove');
    } else if (newQty > currentItem.quantity) {
      this.playSound('stepUp');
    } else {
      this.playSound('stepDown');
    }
    window.cartManager.updateQuantity(index, newQty);
  }

  removeCartItem(index) {
    this.playSound('remove');
    window.cartManager.removeItem(index);
  }

  updateCartUI() {
    const count = window.cartManager.getItemCount();
    const total = window.cartManager.getTotal();
    const subtotal = window.cartManager.getSubtotal();
    const serviceFee = window.cartManager.getServiceFee();
    const waivedServiceFee = window.cartManager.getWaivedServiceFee();
    const deliveryFee = window.cartManager.getEffectiveDeliveryFee();
    const serviceFeePercent = Math.round(window.cartManager.getStandardServiceFeeRate() * 100);
    const serviceFeeLabel = document.querySelector('#cart-service-fee-row > span:first-child');
    if (serviceFeeLabel) serviceFeeLabel.textContent = `Servicio GOD MARKET (${serviceFeePercent}%):`;

    // Floating pill bar
    const floatingBar = document.getElementById('floating-cart-bar');
    if (floatingBar) {
      if (count > 0) {
        floatingBar.classList.add('visible');
        floatingBar.style.display = 'flex';
        const floatingCountEl = document.getElementById('cart-floating-count');
        const floatingTotalEl = document.getElementById('cart-floating-total');
        if (floatingCountEl) floatingCountEl.textContent = count;
        if (floatingTotalEl) floatingTotalEl.textContent = window.cartManager.formatCurrency(total);
      } else {
        floatingBar.classList.remove('visible');
        floatingBar.style.display = 'none';
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

    const headerBagBadge = document.getElementById('header-bag-badge');
    if (headerBagBadge) {
      headerBagBadge.textContent = count;
      headerBagBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    // Drawer de Carrito
    this.renderCartDrawerItems();

    // Resúmenes de precio en Drawer y Checkout (Compatible con IDs y Clases)
    const subtotalEls = [
      document.getElementById('cart-drawer-subtotal'),
      ...document.querySelectorAll('.cart-calc-subtotal')
    ].filter(Boolean);
    subtotalEls.forEach(el => el.textContent = window.cartManager.formatCurrency(subtotal));

    const serviceFeeEl = document.getElementById('cart-drawer-service-fee');
    if (serviceFeeEl) {
      if (serviceFee === 0 && waivedServiceFee > 0) {
        serviceFeeEl.innerHTML = `<span style="text-decoration: line-through; opacity: 0.55; margin-right: 6px; font-weight: 400;">${window.cartManager.formatCurrency(waivedServiceFee)}</span><strong style="color: var(--success);">$0 bonificado</strong>`;
      } else if (serviceFee > 0 && waivedServiceFee > 0) {
        serviceFeeEl.innerHTML = `${window.cartManager.formatCurrency(serviceFee)} <small style="color: var(--success);">(-${window.cartManager.formatCurrency(waivedServiceFee)} bonif.)</small>`;
      } else {
        serviceFeeEl.textContent = window.cartManager.formatCurrency(serviceFee);
      }
    }

    const savingsNoteEl = document.getElementById('cart-promo-savings-note');
    if (savingsNoteEl) {
      if (waivedServiceFee > 0) {
        savingsNoteEl.style.display = 'flex';
        savingsNoteEl.innerHTML = `${this.icon('award', 16)}<span><strong>Servicio del ${serviceFeePercent}% bonificado:</strong> ahorrás <strong>${window.cartManager.formatCurrency(waivedServiceFee)}</strong> y pagás el mismo precio habitual del local.</span>`;
      } else {
        savingsNoteEl.style.display = 'none';
      }
    }

    const shippingEls = [
      document.getElementById('cart-drawer-shipping'),
      ...document.querySelectorAll('.cart-calc-delivery')
    ].filter(Boolean);
    shippingEls.forEach(el => {
      el.textContent = deliveryFee === 0 ? 'Sin cargo' : window.cartManager.formatCurrency(deliveryFee);
    });

    const totalEls = [
      document.getElementById('cart-drawer-total'),
      ...document.querySelectorAll('.cart-calc-total')
    ].filter(Boolean);
    totalEls.forEach(el => el.textContent = window.cartManager.formatCurrency(total));

    // Resumen en Modal de Checkout
    const checkoutCountEl = document.getElementById('checkout-summary-items-count');
    if (checkoutCountEl) {
      checkoutCountEl.textContent = `Tu pedido (${count} ${count === 1 ? 'producto' : 'productos'})`;
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
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <div class="gm-empty-icon-circle">${this.icon('bag', 26)}</div>
          <h4 style="font-size: 1.15rem; color: var(--cream); margin-bottom: 6px;">Tu carrito está vacío</h4>
          <p style="font-size: 0.85rem; color: var(--cream-muted); margin-bottom: 20px; line-height: 1.45;">Elegí alguno de nuestros desayunos, tortas o cafés para armar tu pedido.</p>
          <button type="button" class="btn-primary" onclick="window.app.closeModal('cart-drawer-modal'); window.scrollTo({top: 350, behavior: 'smooth'});" style="max-width: 220px; margin: 0 auto; padding: 11px 20px; font-size: 0.88rem;">
            Explorar la carta
          </button>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    list.innerHTML = items.map((item, idx) => `
      <div class="cart-item">
        <img class="cart-item-img" src="${this.escapeHTML(this.safeImageUrl(item.product.image))}" alt="${this.escapeHTML(item.product.name)}">
        <div class="cart-item-info">
          <div class="cart-item-store-tag gm-inline-label">${this.icon('store', 12)} <span>${this.escapeHTML(item.product.businessName || 'Pastelería')}${item.product.businessNeighborhood ? ' · ' + this.escapeHTML(item.product.businessNeighborhood) : ''}</span></div>
          <div class="cart-item-title">${this.escapeHTML(item.product.name)}</div>
          ${item.customization?.flavor ? `<div class="cart-item-custom">Gusto: ${this.escapeHTML(item.customization.flavor)}</div>` : ''}
          ${item.customization?.dedication ? `<div class="cart-item-custom">Dedicatoria: "${this.escapeHTML(item.customization.dedication)}"</div>` : ''}
          ${item.customization?.candle ? `<div class="cart-item-custom">Con velita de cumpleaños</div>` : ''}
          <div class="cart-item-price">${window.cartManager.formatCurrency(item.product.price * item.quantity)}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div class="quantity-stepper" style="transform: scale(0.86); transform-origin: right center;">
            <button class="stepper-btn" onclick="window.app.updateCartItemQty(${idx}, ${item.quantity - 1})" aria-label="Restar">${this.icon('minus', 14)}</button>
            <span class="stepper-value">${item.quantity}</span>
            <button class="stepper-btn" onclick="window.app.updateCartItemQty(${idx}, ${item.quantity + 1})" aria-label="Sumar">${this.icon('plus', 14)}</button>
          </div>
          <button type="button" onclick="window.app.removeCartItem(${idx})" class="gm-inline-label" style="background: none; border: none; font-size: 0.72rem; color: var(--danger); cursor: pointer; padding: 2px 4px;">
            ${this.icon('trash', 13)}
            <span>Quitar</span>
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

    // Totales y cargo de servicio o bonificación.
    const ticketServiceRow = document.getElementById('ticket-service-fee-row');
    if (ticketServiceRow) {
      const oService = Number(order.serviceFee || 0);
      const oWaived = Number(order.waivedServiceFee || 0);
      const serviceFeePercent = Math.round(Number(order.standardServiceFeeRate || 0.2) * 100);
      if (oService === 0 && oWaived > 0) {
        ticketServiceRow.style.display = 'flex';
        ticketServiceRow.innerHTML = `<span>Servicio GOD MARKET (${serviceFeePercent}%):</span><strong style="color: var(--success);"><s style="opacity:0.55;font-weight:400;margin-right:4px;">${order.waivedServiceFeeFormatted || window.cartManager.formatCurrency(oWaived)}</s> $0 bonificado</strong>`;
      } else if (oService > 0) {
        ticketServiceRow.style.display = 'flex';
        ticketServiceRow.innerHTML = `<span>Servicio GOD MARKET (${serviceFeePercent}%):</span><strong style="color: var(--text-main);">${order.serviceFeeFormatted || window.cartManager.formatCurrency(oService)}</strong>`;
      } else {
        ticketServiceRow.style.display = 'none';
      }
    }

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
            ${it.customization?.flavor ? `<div style="font-size: 0.74rem; color: var(--text-muted);">Gusto: ${this.escapeHTML(it.customization.flavor)}</div>` : ''}
            ${it.customization?.dedication ? `<div style="font-size: 0.74rem; color: var(--primary);">Dedicatoria: "${this.escapeHTML(it.customization.dedication)}"</div>` : ''}
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
      if (transferBox) {
        let paymentsToRender = Array.isArray(order.transferPayments) && order.transferPayments.length > 0
          ? order.transferPayments
          : [];
        if (paymentsToRender.length === 0 && Array.isArray(order.items) && window.checkoutHandler) {
          paymentsToRender = window.checkoutHandler.getTransferPayments({
            items: order.items,
            deliveryType: order.deliveryType || 'delivery',
            getServiceFeeRateForItem: (it) => window.cartManager ? window.cartManager.getServiceFeeRateForItem(it) : 0
          });
        }
        transferBox.innerHTML = `
          <div class="ticket-alias-header">${this.icon('bank', 15)} <span>Transferí a cada comercio:</span></div>
          ${window.checkoutHandler.renderTransferDetails(paymentsToRender)}
        `;
      }
      if (mpBox) mpBox.style.display = 'none';
      if (cashBox) cashBox.style.display = 'none';
      if (whatsappProofBtn) {
        whatsappProofBtn.href = order.proofWhatsappUrl;
        whatsappProofBtn.innerHTML = `
          ${this.icon('whatsapp', 18)}
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
          ${this.icon('whatsapp', 18)}
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
          ${this.icon('whatsapp', 18)}
          <span>Consultar estado por WhatsApp</span>
        `;
      }
    }

    const reopenBtn = document.getElementById('ticket-reopen-whatsapp-btn');
    if (reopenBtn && order.whatsappUrl) {
      reopenBtn.href = order.whatsappUrl;
      reopenBtn.style.display = 'flex';
    }

    const webBtn = document.getElementById('ticket-web-whatsapp-btn');
    if (webBtn && order.whatsappWebUrl) {
      webBtn.href = order.whatsappWebUrl;
      webBtn.style.display = 'flex';
    }
  }

  copyOrderMessage() {
    const lastOrder = window.checkoutHandler?.lastOrder;
    if (!lastOrder || !lastOrder.rawMessage) {
      this.showToast("No hay datos del pedido para copiar", 'warn');
      return;
    }

    navigator.clipboard.writeText(lastOrder.rawMessage).then(() => {
      const btn = document.getElementById('btn-copy-full-order');
      if (btn) {
        btn.innerHTML = `${this.icon('check', 15)} <span>Mensaje del pedido copiado</span>`;
        setTimeout(() => {
          btn.innerHTML = `${this.icon('copy', 15)} <span>Copiar mensaje del pedido</span>`;
        }, 2000);
      }
      this.playSound('copy');
      this.showToast('Mensaje completo del pedido copiado', 'success');
    }).catch(() => {
      this.showToast('No se pudo acceder al portapapeles', 'warn');
    });
  }

  copyOrderId() {
    const orderIdEl = document.getElementById('ticket-order-id');
    const text = orderIdEl ? orderIdEl.textContent.trim() : '';
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-order');
      if (btn) {
        btn.innerHTML = `${this.icon('check', 13)} <span>Copiado</span>`;
        setTimeout(() => { btn.innerHTML = `${this.icon('copy', 13)} <span>Copiar</span>`; }, 2000);
      }
      this.playSound('copy');
      this.showToast(`${text} copiado al portapapeles`, 'success');
    });
  }

  copyAlias() {
    const alias = window.checkoutHandler?.getTransferPayments(window.cartManager || { items: [], deliveryType: 'pickup' })
      .find(payment => payment.transferAlias)?.transferAlias;
    if (!alias) return this.showToast('El comercio no configuró su alias.', 'warn');
    if (!navigator.clipboard) return this.showToast('El navegador no permite copiar al portapapeles.', 'warn');
    navigator.clipboard.writeText(alias).then(() => {
      this.playSound('copy');
      this.showToast(`Alias ${alias} copiado`, 'success');
    }).catch(() => this.showToast('No se pudo copiar el alias.', 'warn'));
  }

  copyTransferAlias(button) {
    const alias = button?.dataset.transferAlias || '';
    if (!alias) return this.showToast('El alias de este comercio no está disponible.', 'warn');
    if (!navigator.clipboard) return this.showToast('El navegador no permite copiar al portapapeles.', 'warn');
    navigator.clipboard.writeText(alias).then(() => {
      button.textContent = 'Copiado';
      setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
      this.playSound('copy');
      this.showToast(`Alias ${alias} copiado`, 'success');
    }).catch(() => this.showToast('No se pudo copiar el alias.', 'warn'));
  }

  copyMPAlias() {
    const alias = this.paymentConfig.mercadoPagoAlias;
    if (!alias) return this.showToast('El alias de Mercado Pago no está configurado.', 'warn');
    if (!navigator.clipboard) return this.showToast('El navegador no permite copiar al portapapeles.', 'warn');
    navigator.clipboard.writeText(alias).then(() => {
      const btnTicket = document.getElementById('btn-copy-mp-alias-ticket');
      const btnForm = document.getElementById('btn-copy-mp-alias');
      if (btnTicket) {
        btnTicket.innerHTML = `${this.icon('check', 13)} <span>Copiado</span>`;
        setTimeout(() => { btnTicket.innerHTML = `${this.icon('copy', 13)} <span>Copiar</span>`; }, 2000);
      }
      if (btnForm) {
        btnForm.textContent = 'Copiado';
        setTimeout(() => { btnForm.textContent = 'Copiar'; }, 2000);
      }
      this.playSound('copy');
      this.showToast(`Alias MP ${alias} copiado`, 'success');
    }).catch(() => this.showToast('No se pudo copiar el alias.', 'warn'));
  }

  copyCVU(provider = 'bank') {
    const isMercadoPago = provider === 'mp';
    const cvu = isMercadoPago ? this.paymentConfig.mercadoPagoCvu : '';
    if (!cvu) return this.showToast('El número de cuenta no está configurado.', 'warn');
    if (!navigator.clipboard) return this.showToast('El navegador no permite copiar al portapapeles.', 'warn');
    navigator.clipboard.writeText(cvu).then(() => {
      const buttonIds = isMercadoPago
        ? ['btn-copy-mp-cvu-ticket']
        : ['btn-copy-cvu-ticket'];
      buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (!button) return;
        button.innerHTML = `${this.icon('check', 13)} <span>Copiado</span>`;
        setTimeout(() => { button.innerHTML = `${this.icon('copy', 13)} <span>Copiar</span>`; }, 2000);
      });
      this.playSound('copy');
      this.showToast(`CVU ${cvu} copiado`, 'success');
    }).catch(() => this.showToast('No se pudo copiar el número de cuenta.', 'warn'));
  }

  updateOrdersBadges() {
    const history = window.checkoutHandler?.getOrderHistory() || [];
    const count = history.length;
    
    ['header-orders-badge', 'nav-orders-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (count > 0) {
          el.textContent = count > 99 ? '99+' : count;
          el.style.display = 'inline-block';
        } else {
          el.style.display = 'none';
        }
      }
    });
  }

  openOrdersHistoryModal() {
    this.renderOrdersHistoryList();
    this.openModal('orders-history-modal');
    this.syncOrdersHistoryStatuses();
  }

  async syncOrdersHistoryStatuses() {
    const history = window.checkoutHandler?.getOrderHistory() || [];
    if (!history.length) return;
    let updated = false;

    await Promise.all(history.slice(0, 10).map(async (order) => {
      const targetId = (Array.isArray(order.serverOrderIds) && order.serverOrderIds[0]) || order.orderId;
      const phone = (order.formData && order.formData.phone) || order.customerPhone || '';
      if (!targetId || !phone) return;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(targetId)}/status?phone=${encodeURIComponent(phone)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success) {
          if (data.status && order.status !== data.status) {
            order.status = data.status;
            updated = true;
          }
          if (data.dispute && data.dispute.status && order.disputeStatus !== data.dispute.status) {
            order.disputeStatus = data.dispute.status;
            order.disputeResolutionNote = data.dispute.resolutionNote || '';
            updated = true;
          }
        }
      } catch (e) {}
    }));

    if (updated) {
      try {
        localStorage.setItem('dulce_orders_history', JSON.stringify(history));
      } catch (e) {}
      this.renderOrdersHistoryList();
    }
  }

  getArgentinaTime() {
    const now = new Date();
    const options = { timeZone: 'America/Argentina/Buenos_Aires', hour12: false, hour: 'numeric', minute: 'numeric' };
    const formatter = new Intl.DateTimeFormat('es-AR', options);
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return { hour, minute, totalMinutes: hour * 60 + minute };
  }

  isStoreOpen() {
    const { totalMinutes } = this.getArgentinaTime();
    // Horario de atención: 08:30 (510 min) a 20:00 (1200 min) hora Argentina
    return totalMinutes >= 510 && totalMinutes < 1200;
  }

  updateStoreStatusUI() {
    const dot = document.getElementById('store-status-dot');
    const info = document.getElementById('store-status-info');
    const tag = document.getElementById('store-delivery-tag');
    if (!dot || !info) return;

    const isOpen = this.isStoreOpen();
    const { hour, minute } = this.getArgentinaTime();

    if (isOpen) {
      dot.style.background = 'var(--success)';
      info.innerHTML = '<strong style="color: var(--success);">Abierto ahora</strong> · 08:30 a 20:00 hs';
      if (tag) {
        tag.textContent = 'Envíos en el día';
        tag.style.color = 'var(--primary)';
      }
    } else {
      dot.style.background = 'var(--danger)';
      const isMorning = hour < 8 || (hour === 8 && minute < 30);
      const nextOpen = isMorning ? 'Abre hoy 08:30 hs' : 'Abre mañana 08:30 hs';
      info.innerHTML = `<strong style="color: var(--danger);">Cerrado ahora</strong> · ${nextOpen}`;
      if (tag) {
        tag.textContent = 'Pedidos programados';
        tag.style.color = 'var(--warning)';
      }
    }
  }

  setupCheckoutStoreHours() {
    const isOpen = this.isStoreOpen();
    const banner = document.getElementById('checkout-store-closed-banner');
    const chipNow = document.getElementById('chip-time-now');
    const chipAfternoon = document.getElementById('chip-time-afternoon');
    const chipTomorrow = document.getElementById('chip-time-tomorrow');
    const timeInput = document.getElementById('cust-time');
    const { hour, minute } = this.getArgentinaTime();

    if (banner) banner.style.display = isOpen ? 'none' : 'block';

    if (chipAfternoon) {
      chipAfternoon.dataset.time = 'Hoy por la tarde (16:00 a 19:30 hs)';
      chipAfternoon.innerHTML = `${this.icon('sun', 14)} <span>Hoy por la tarde</span>`;
    }

    if (isOpen) {
      if (chipNow) {
        chipNow.style.display = 'inline-flex';
        chipNow.classList.add('active');
      }
      if (chipAfternoon) chipAfternoon.classList.remove('active');
      if (chipTomorrow) chipTomorrow.classList.remove('active');
      if (timeInput && (!timeInput.value || timeInput.value.includes('Mañana') || timeInput.value.includes('desde 08:30'))) {
        timeInput.value = 'Lo antes posible (Ahora)';
      }
    } else {
      if (chipNow) {
        chipNow.style.display = 'none';
        chipNow.classList.remove('active');
      }

      const isMorning = hour < 8 || (hour === 8 && minute < 30);
      if (isMorning) {
        if (chipAfternoon) {
          chipAfternoon.dataset.time = 'Hoy desde 08:30 hs';
          chipAfternoon.innerHTML = `${this.icon('sun', 14)} <span>Hoy desde 08:30 hs</span>`;
          chipAfternoon.classList.add('active');
        }
        if (chipTomorrow) chipTomorrow.classList.remove('active');
        if (timeInput) timeInput.value = 'Hoy desde 08:30 hs';
      } else {
        if (chipAfternoon) chipAfternoon.classList.remove('active');
        if (chipTomorrow) {
          chipTomorrow.classList.add('active');
        }
        if (timeInput) timeInput.value = 'Mañana por la mañana (09:00 a 12:30 hs)';
      }
    }
  }

  renderOrdersHistoryList() {
    const container = document.getElementById('orders-history-list');
    if (!container) return;

    const history = window.checkoutHandler?.getOrderHistory() || [];

    if (history.length === 0) {
      container.innerHTML = `
        <div class="orders-empty-state">
          <div class="gm-empty-icon-circle">${this.icon('package', 26)}</div>
          <h4 class="font-serif" style="font-size: 1.2rem; margin-bottom: 6px;">No tenés pedidos registrados</h4>
          <p style="font-size: 0.82rem; color: var(--cream-muted); margin-bottom: 16px; line-height: 1.45;">
            Cuando realices un pedido en GOD MARKET, quedará guardado automáticamente en este dispositivo para ver tu historial y comprobantes.
          </p>
          <button type="button" class="btn-primary" onclick="window.app.closeModal('orders-history-modal')" style="width: auto; padding: 9px 20px; margin: 0 auto; font-size: 0.85rem;">
            Explorar el catálogo
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(order => {
      const itemsSummary = (order.items || []).map(it => 
        `<strong>${it.quantity}x</strong> ${this.escapeHTML(it.product?.name || 'Delicia')}${it.customization?.flavor ? ` (${this.escapeHTML(it.customization.flavor)})` : ''}`
      ).join(', ');

      const dateStr = order.dateFormatted || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente');

      const isPickup = order.formData?.address?.includes('Retiro') || order.formData?.address === 'Retiro en Tienda';
      const addressText = isPickup 
        ? `<span class="gm-inline-label">${this.icon('store', 13)} Retiro en tienda</span>`
        : `<span class="gm-inline-label">${this.icon('map-pin', 13)} ${this.escapeHTML(order.formData?.address || 'Envío a domicilio')}${order.formData?.zone ? ` (${this.escapeHTML(order.formData.zone)})` : ''}</span>`;

      const orderStatusLabels = {
        pendiente: { label: 'Pendiente de confirmación', icon: 'clock', color: '#D99B52' },
        en_preparacion: { label: 'En preparación', icon: 'chef', color: '#6FB4D8' },
        despachado: { label: 'En camino / Listo', icon: 'delivery', color: '#B49EE0' },
        entregado: { label: 'Entregado', icon: 'check-circle', color: '#68B98E' },
        en_disputa: { label: 'En revisión de soporte', icon: 'alert', color: '#DF6B63' },
        reembolsado: { label: 'Reembolsado', icon: 'check-circle', color: '#68B98E' },
        disputa_cerrada: { label: 'Caso cerrado', icon: 'lock', color: '#899E93' }
      };
      const statusMeta = orderStatusLabels[order.status || 'pendiente'] || orderStatusLabels.pendiente;

      return `
        <div class="order-history-card">
          <div class="order-history-header">
            <div>
              <div class="order-history-id" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>#${this.escapeHTML(order.orderId)}</span>
                <span class="gm-inline-label" style="font-size: 0.7rem; font-weight: 600; color: ${statusMeta.color}; background: rgba(244,239,230,0.05); padding: 2px 9px; border-radius: 999px; border: 1px solid ${statusMeta.color}44;">${this.icon(statusMeta.icon, 12)} <span>${statusMeta.label}</span></span>
              </div>
              <div class="order-history-date gm-inline-label" style="margin-top: 4px;">${this.icon('calendar', 12)} <span>${dateStr}</span></div>
            </div>
            <button type="button" class="btn-order-delete" onclick="window.app.deleteOrderHistory('${this.escapeHTML(order.orderId)}')" title="Eliminar del historial" aria-label="Eliminar del historial">
              ${this.icon('trash', 14)}
            </button>
          </div>

          <div class="order-history-items-summary">
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; font-weight: 600;">Productos</div>
            <div>${itemsSummary || 'Detalle del pedido'}</div>
            <div style="font-size: 0.74rem; color: var(--cream-muted); margin-top: 6px; border-top: 1px dashed var(--border-light); padding-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${addressText} · <span class="gm-inline-label">${this.icon('clock', 12)} ${this.escapeHTML(order.formData?.deliveryTime || 'Horario coordinado')}</span>
            </div>
          </div>

          <div class="order-history-footer">
            <div>
              <span style="font-size: 0.69rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 600;">Total</span>
              <span class="order-history-total" style="color: var(--primary);">${order.totalFormatted || '$' + (order.total || 0)}</span>
            </div>

            <div class="order-history-actions">
              <button type="button" class="btn-order-action btn-order-ticket" onclick="window.app.viewOrderTicket('${this.escapeHTML(order.orderId)}')">
                ${this.icon('receipt', 14)} <span>Ver ticket</span>
              </button>
              <button type="button" class="btn-order-action btn-order-whatsapp" onclick="window.app.trackOrderWhatsApp('${this.escapeHTML(order.orderId)}')">
                ${this.icon('whatsapp', 14)} <span>WhatsApp</span>
              </button>
            </div>
            <div class="order-dispute-section">
              ${order.disputeStatus ? `
                <div class="dispute-badge dispute-badge-${order.disputeStatus}">
                  ${order.disputeStatus === 'abierta' ? 'Disputa abierta — GOD MARKET está revisando tu caso' : ''}
                  ${order.disputeStatus === 'en_revision' ? 'En revisión por GOD MARKET' : ''}
                  ${order.disputeStatus === 'reembolsada' ? 'Reembolso aprobado por GOD MARKET' : ''}
                  ${order.disputeStatus === 'rechazada' ? 'Disputa cerrada' : ''}
                </div>
              ` : `
                <button type="button" class="btn-dispute" onclick="window.app.openDisputeFlow('${window.app.escapeHTML ? window.app.escapeHTML(order.orderId) : order.orderId}')">
                  ${this.icon('alert', 14)} <span>El local no respondió</span>
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  viewOrderTicket(orderId) {
    const order = window.checkoutHandler?.getOrderById(orderId);
    if (!order) {
      this.showToast("No se encontró la información del pedido", 'warn');
      return;
    }
    this.closeModal('orders-history-modal');
    this.renderOrderTicket(order);
    this.openModal('order-success-modal');
  }

  trackOrderWhatsApp(orderId) {
    const order = window.checkoutHandler?.getOrderById(orderId);
    if (!order) return;

    const name = order.formData?.fullName || '';
    const text = `Hola GOD MARKET, me comunico por mi pedido #${order.orderId}${name ? ` a nombre de ${name}` : ''}. Muchas gracias.`;
    const url = window.checkoutHandler.buildWhatsAppUrl(text);
    window.open(url, '_blank');
  }

  // ────────────────────────────────────────────────────────────
  // SISTEMA DE DISPUTAS Y REEMBOLSOS
  // ────────────────────────────────────────────────────────────

  openDisputeFlow(orderId) {
    const order = window.checkoutHandler?.getOrderById(orderId);
    if (!order) {
      this.showToast('No se encontró el pedido', 'warn');
      return;
    }

    if (order.disputeStatus) {
      const statusMap = {
        abierta: 'Tu disputa ya fue registrada. GOD MARKET está revisando tu caso.',
        en_revision: 'Tu caso está en revisión por GOD MARKET.',
        reembolsada: 'Tu reembolso ya fue aprobado.',
        rechazada: 'Esta disputa ya fue cerrada.'
      };
      this.showToast(statusMap[order.disputeStatus] || 'Ya existe una disputa para este pedido.', 'info');
      return;
    }

    const modal = document.getElementById('dispute-modal');
    if (!modal) {
      this.showToast('Error interno: modal no encontrado', 'error');
      return;
    }
    modal.dataset.orderId = orderId;
    const orderIdEl = document.getElementById('dispute-order-id');
    if (orderIdEl) orderIdEl.textContent = orderId;
    const totalEl = document.getElementById('dispute-order-total');
    if (totalEl) totalEl.textContent = order.totalFormatted || ('$' + (order.total || 0));
    this.openModal('dispute-modal');
  }

  async submitDispute(reason) {
    const modal = document.getElementById('dispute-modal');
    if (!modal) return;
    const orderId = modal.dataset.orderId;
    if (!orderId) return;

    const order = window.checkoutHandler?.getOrderById(orderId);
    if (!order) return;

    const btn = document.getElementById('btn-submit-dispute');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    try {
      const relatedOrderIds = Array.isArray(order.serverOrderIds) && order.serverOrderIds.length
        ? order.serverOrderIds
        : [orderId];
      const res = await fetch('/api/orders/' + encodeURIComponent(relatedOrderIds[0]) + '/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: order.formData?.fullName || order.customerName || '',
          customerPhone: order.formData?.phone || order.customerPhone || '',
          reason: reason || 'no_response',
          relatedOrderIds
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo registrar la disputa.');
      }

      {
        try {
          const history = window.checkoutHandler.getOrderHistory();
          const idx = history.findIndex(o => o.orderId === orderId);
          if (idx >= 0) {
            history[idx].disputeStatus = 'abierta';
            history[idx].disputeId = (data.disputes || [data.dispute]).map(dispute => dispute?.id).filter(Boolean).join(', ');
            localStorage.setItem('dulce_orders_history', JSON.stringify(history));
          }
        } catch (e) {}

        this.closeModal('dispute-modal');
        this.renderOrdersHistoryList();

        const name = order.formData?.fullName || '';
        const waText = 'Hola GOD MARKET, necesito ayuda con mi pedido #' + orderId + (name ? ' a nombre de ' + name : '') + '. El local no respondió mi pedido. ID de caso: ' + (data.dispute?.id || 'N/A') + '. Por favor contáctenme.';
        const waUrl = window.checkoutHandler.buildWhatsAppUrl(waText);
        window.open(waUrl, '_blank');

        this.showToast('Disputa registrada. GOD MARKET te contactará pronto.', 'success');
      }
    } catch (err) {
      console.error('No se pudo registrar la disputa:', err);
      this.showToast(err.message || 'No se pudo registrar la disputa. Intentá nuevamente.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${this.icon('alert', 17)} <span>Reportar problema y contactar a GOD MARKET</span>`;
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // CENTRO LEGAL, PRIVACIDAD Y BOTÓN DE ARREPENTIMIENTO (LEY 24.240)
  // ────────────────────────────────────────────────────────────

  openLegalModal(tabId = 'terminos') {
    this.openModal('legal-modal');
    this.switchLegalTab(tabId);

    // Si se abre la pestaña de arrepentimiento, pre-cargar datos del último pedido
    if (tabId === 'arrepentimiento') {
      try {
        const history = window.checkoutHandler?.getOrderHistory() || [];
        const lastOrder = window.checkoutHandler?.lastOrder || (history.length > 0 ? history[0] : null);
        const orderInput = document.getElementById('revocation-order-id');
        const phoneInput = document.getElementById('revocation-phone');
        if (orderInput && !orderInput.value && lastOrder) {
          orderInput.value = lastOrder.orderId || '';
        }
        if (phoneInput && !phoneInput.value && lastOrder) {
          phoneInput.value = (lastOrder.formData && lastOrder.formData.phone) || lastOrder.customerPhone || '';
        }
      } catch (e) {}
    }
  }

  switchLegalTab(tabId) {
    const validTabs = ['terminos', 'privacidad', 'comercios', 'arrepentimiento'];
    const safeTab = validTabs.includes(tabId) ? tabId : 'terminos';

    document.querySelectorAll('.legal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.legalTab === safeTab);
    });

    document.querySelectorAll('.legal-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `legal-pane-${safeTab}`);
    });

    const bodyEl = document.querySelector('.legal-modal-body');
    if (bodyEl) bodyEl.scrollTop = 0;
  }

  async submitRevocationForm(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const orderIdInput = document.getElementById('revocation-order-id');
    const phoneInput = document.getElementById('revocation-phone');
    const reasonInput = document.getElementById('revocation-reason');
    const notesInput = document.getElementById('revocation-notes');
    const btn = document.getElementById('btn-submit-revocation');

    const orderId = orderIdInput ? orderIdInput.value.trim().toUpperCase() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const reason = reasonInput ? reasonInput.value : 'cancellation_revocation';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!orderId) {
      this.showToast('Por favor ingresá el número de orden (ej: ORD-1045)', 'warn');
      if (orderIdInput) orderIdInput.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Procesando revocación...';
    }

    try {
      const history = window.checkoutHandler?.getOrderHistory() || [];
      const localOrder = history.find(order => order.orderId === orderId);
      const relatedOrderIds = Array.isArray(localOrder?.serverOrderIds) && localOrder.serverOrderIds.length
        ? localOrder.serverOrderIds
        : [orderId];
      const res = await fetch('/api/orders/' + encodeURIComponent(relatedOrderIds[0]) + '/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Cliente Solicitud Arrepentimiento',
          customerPhone: phone,
          reason: 'cancellation_revocation',
          relatedOrderIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo registrar la solicitud de revocación.');
      }

      // Guardar en historial local si existe la orden
      try {
        const idx = history.findIndex(o => o.orderId === orderId);
        if (idx >= 0) {
          history[idx].disputeStatus = 'en_revision';
          history[idx].disputeId = (data.disputes || [data.dispute]).map(dispute => dispute?.id).filter(Boolean).join(', ');
          history[idx].revocationRequested = true;
          localStorage.setItem('dulce_orders_history', JSON.stringify(history));
        }
      } catch (errHistory) {}

      this.closeModal('legal-modal');
      this.renderOrdersHistoryList();

      const waText = `Hola GOD MARKET, solicito Arrepentimiento / Revocación de Compra (Ley 24.240 y Res. 424/2020).\n- Pedido: #${orderId}\n- Teléfono: ${phone || 'No especificado'}\n- Motivo: ${reason}${notes ? `\n- Detalle: "${notes}"` : ''}\nPor favor confirmar la anulación y gestión de reintegro.`;
      const waUrl = window.checkoutHandler.buildWhatsAppUrl(waText);
      window.open(waUrl, '_blank');

      this.showToast('Solicitud registrada. Se abrió WhatsApp para confirmar la anulación.', 'success');
    } catch (err) {
      console.error('No se pudo registrar la revocación:', err);
      this.showToast(err.message || 'No se pudo registrar la solicitud. Intentá nuevamente.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${this.icon('undo', 16)} <span>Enviar solicitud de arrepentimiento y abrir mediación</span>`;
      }
    }
  }

  deleteOrderHistory(orderId) {
    if (confirm(`¿Deseás quitar la orden #${orderId} de este dispositivo?`)) {
      window.checkoutHandler?.deleteOrderFromHistory(orderId);
      this.renderOrdersHistoryList();
      this.updateOrdersBadges();
      this.showToast(`Pedido #${orderId} eliminado del historial`);
    }
  }

  selectQuickTime(btn) {
    document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    this.playSound('tap');
    const timeVal = btn.dataset.time;
    const input = document.getElementById('cust-time');
    if (input) {
      input.value = timeVal;
      input.classList.remove('is-invalid');
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modalId === 'cart-drawer-modal' || modalId === 'product-detail-modal' || modalId === 'checkout-modal') {
        this.playSound('open');
      }
      if (modalId === 'cart-drawer-modal' || modalId === 'checkout-modal') {
        this.updateCartUI();
      }
      if (modalId === 'checkout-modal') {
        this.updateTransferPaymentOption();
        this.setupCheckoutStoreHours();
        // Pre-cargar datos del cliente guardados en el teléfono
        try {
          const nameInput = document.getElementById('cust-name');
          const phoneInput = document.getElementById('cust-phone');
          const addressInput = document.getElementById('cust-address');
          const aptInput = document.getElementById('cust-apt');
          const zoneInput = document.getElementById('cust-zone');

          if (nameInput && !nameInput.value) {
            nameInput.value = localStorage.getItem('godmarket_user_name') || '';
          }
          if (phoneInput && !phoneInput.value) {
            phoneInput.value = localStorage.getItem('godmarket_user_phone') || '';
          }
          if (addressInput && !addressInput.value) {
            addressInput.value = localStorage.getItem('godmarket_user_address') || '';
          }
          if (aptInput && !aptInput.value) {
            aptInput.value = localStorage.getItem('godmarket_user_apt') || '';
          }
          if (zoneInput && !zoneInput.value) {
            zoneInput.value = localStorage.getItem('godmarket_user_zone') || '';
          }
        } catch (e) {}
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
    const entered = prompt('Ingresá el PIN de acceso para negocios (por defecto: 1234):');
    if (entered === savedPin) {
      if (window.adminManager && typeof window.adminManager.populateBusinessSelect === 'function') {
        window.adminManager.populateBusinessSelect();
      }
      this.openModal('admin-product-modal');
    } else if (entered !== null) {
      this.showToast('PIN incorrecto', 'error');
    }
  }

  safeImageUrl(value, fallback = 'assets/images/lumiere_cafe.webp') {
    if (typeof value !== 'string') return fallback;
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) return value;
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol !== 'https:' && url.origin !== window.location.origin) return fallback;
      return url.href;
    } catch {
      return fallback;
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

  showToast(message, tone = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const cleanMessage = this.cleanText(String(message || ''));
    const iconName = tone === 'error' || tone === 'warn' ? 'alert'
      : tone === 'success' ? 'check-circle'
      : 'info';
    const iconColor = tone === 'error' ? 'var(--danger)'
      : tone === 'warn' ? 'var(--warning)'
      : tone === 'success' ? 'var(--success)'
      : 'var(--primary)';

    const toast = document.createElement('div');
    toast.className = `toast ${tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'gold'}`;
    toast.innerHTML = `<span class="toast-icon" style="color:${iconColor};">${this.icon(iconName, 16)}</span><span>${this.escapeHTML(cleanMessage || String(message || ''))}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 2800);
  }

  /* =========================================================================
     MAPA INTERACTIVO Y CAPTURA DE DIRECCIÓN POR MARCADOR (LEAFLET / OSM)
     ========================================================================= */
  toggleMapPicker() {
    const mapContainer = document.getElementById('checkout-map-container');
    const toggleBtn = document.getElementById('btn-toggle-map');
    if (!mapContainer) return;

    const isVisible = mapContainer.style.display === 'block';
    if (isVisible) {
      mapContainer.style.display = 'none';
      if (toggleBtn) toggleBtn.innerHTML = `${this.icon('map', 14)} <span>Marcar en el mapa</span>`;
    } else {
      mapContainer.style.display = 'block';
      if (toggleBtn) toggleBtn.innerHTML = `${this.icon('x', 14)} <span>Ocultar mapa</span>`;

      this.initDeliveryMap();
      setTimeout(() => {
        if (this.deliveryMap) {
          this.deliveryMap.invalidateSize();
        }
      }, 200);

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
      this.showToast('Escribí una calle o localidad para buscar en el mapa.', 'info');
      return;
    }

    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = `Buscando "${searchQuery}" en el mapa...`;

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
        if (statusEl) statusEl.textContent = `No se ubicó "${searchQuery}". Podés mover el marcador manualmente.`;
        this.showToast(`No se encontró "${searchQuery}". Mové el marcador o añadí la localidad.`, 'warn');
      }
    } catch (err) {
      console.error('Error al buscar dirección:', err);
      if (statusEl) statusEl.textContent = 'Mové el marcador manualmente sobre el mapa';
    }
  }

  initDeliveryMap() {
    if (this.deliveryMap) return;
    const mapEl = document.getElementById('delivery-map');
    if (!mapEl || typeof L === 'undefined') return;

    const defaultLat = (this.userCoords && typeof this.userCoords.lat === 'number') ? this.userCoords.lat : -34.6037;
    const defaultLng = (this.userCoords && typeof this.userCoords.lng === 'number') ? this.userCoords.lng : -58.3816;

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
        <svg viewBox="0 0 24 24" width="38" height="38" fill="#C8A96A" stroke="#0E1B16" stroke-width="1.2" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
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

    this.deliveryMarker.on('dragend', () => {
      const pos = this.deliveryMarker.getLatLng();
      this.reverseGeocode(pos.lat, pos.lng);
    });

    this.deliveryMap.on('click', (e) => {
      this.deliveryMarker.setLatLng(e.latlng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  }

  locateUserGPS() {
    if (!navigator.geolocation) {
      this.showToast('Tu navegador no soporta geolocalización.', 'warn');
      return;
    }

    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = 'Conectando con tu ubicación...';

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
        this.showToast('Permiso de ubicación no otorgado. Buscá tu calle escribiéndola arriba.', 'info');
        if (statusEl) statusEl.textContent = 'Permiso denegado. Escribí tu calle o mové el marcador.';
      } else {
        this.showToast('Ubicación GPS no detectada. Escribí tu calle en el buscador del mapa.', 'info');
        if (statusEl) statusEl.textContent = 'Escribí tu calle arriba o arrastrá el marcador.';
      }
    };

    navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: false,
      timeout: 9000,
      maximumAge: 120000
    });
  }

  async reverseGeocode(lat, lng) {
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      this.saveUserCoords({ lat: parseFloat(Number(lat).toFixed(5)), lng: parseFloat(Number(lng).toFixed(5)) });
    }
    const statusEl = document.getElementById('map-address-status');
    if (statusEl) statusEl.textContent = 'Identificando calle y altura...';

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
          statusEl.innerHTML = `<strong>Dirección tomada:</strong> ${this.escapeHTML(fullAddress)} ${zone ? `(${this.escapeHTML(zone)})` : ''}`;
        }
        this.showToast(`Dirección tomada: ${fullAddress}`, 'success');
      } else {
        if (statusEl) statusEl.textContent = 'Ubicación seleccionada en el mapa';
      }
    } catch (err) {
      console.warn('Error en reverse geocoding:', err);
      if (statusEl) statusEl.textContent = 'Coordenadas tomadas (verificá la altura)';
    }
  }

  copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMsg || "¡Copiado al portapapeles!");
    });
  }
}

// Instancia global
window.app = new GodMarketApp();
window.DulceAtelierApp = GodMarketApp;
