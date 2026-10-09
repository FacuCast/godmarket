/**
 * DULCE ATELIER - APLICACIÓN PRINCIPAL (APP COORDINATOR)
 */

class DulceAtelierApp {
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

  init() {
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
    this.refreshIcons();

    // Solicitar ubicación real automáticamente al ingresar
    this.promptRealLocationOnEntry();

    // Actualizar estado del horario de la tienda cada minuto
    setInterval(() => this.updateStoreStatusUI(), 60000);

    // Suscribirse a cambios en el carrito
    window.cartManager.subscribe(() => {
      this.updateCartUI();
      this.refreshIcons();
    });
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
          .then(reg => {
            console.log('ServiceWorker registrado:', reg.scope);
            reg.update();
          })
          .catch(err => console.log('Error al registrar ServiceWorker:', err));
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
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
      this.showToast("🎉 ¡App instalada con éxito en tu pantalla de inicio!", 'gold');
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

  installPWA() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      this.showToast("✅ Ya estás navegando desde la App de GOD MARKET", 'gold');
      return;
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.showToast("🎉 ¡App instalada con éxito!", 'gold');
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

    this.showToast("📲 Para instalar: abre el menú (⋮) de tu navegador y selecciona 'Instalar aplicación' o 'Agregar a inicio'.", 'gold');
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
            this.showToast("⚠️ Tu carrito está vacío. Elige una delicia primero.");
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
            const switchPickup = confirm(`⚠️ Atención de Cobertura:\nTu dirección está fuera del radio de entrega a domicilio para:\n${listStr}\n\n¿Deseas cambiar tu pedido a 'Retiro en Local' para coordinar el retiro sin cargo?`);
            if (switchPickup) {
              window.cartManager.setDeliveryType('pickup');
              this.switchDeliveryType('pickup');
            } else {
              this.showToast("⚠️ Por favor cambia tu dirección o selecciona Retiro en Local");
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
          this.showToast("🌙 El local está cerrado (08:30 a 20:00 hs). Por favor elige un horario programado.");
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
        const order = window.checkoutHandler.processOrder(formData, window.cartManager);
        this.closeModal('checkout-modal');
        this.updateOrdersBadges();

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

  refreshIcons() {
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
        this.showToast(`📍 Ubicación detectada: ${this.currentAddress}`, 'gold');
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

    // Si se pasan coordenadas fijas del barrio, guardarlas
    if (lat !== null && lng !== null) {
      this.saveUserCoords({ lat, lng });
    }

    this.renderLocationBar();
    this.closeModal('address-picker-modal');
    this.showToast(`📍 Ubicación actualizada a ${this.currentAddress}`, 'gold');

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
      this.showToast('⚠️ Tu navegador no soporta geolocalización GPS.');
      return;
    }

    this.showToast('📡 Detectando tu ubicación GPS...', 'gold');
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
        this.showToast(`✅ Ubicación detectada: ${this.currentAddress}`, 'gold');

        const addressInput = document.getElementById('cust-address');
        if (addressInput) {
          addressInput.value = this.currentAddress;
        }
      },
      (err) => {
        this.showToast('⚠️ No se pudo obtener tu ubicación GPS. Selecciona tu barrio en la lista.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  setOnlyInRange(checked) {
    this.onlyInRange = checked;
    localStorage.setItem('godmarket_only_in_range', checked ? 'true' : 'false');
    this.renderStoresCards();
    this.renderProducts();
    if (checked) {
      this.showToast('🛵 Mostrando solo locales con envío a tu zona');
    } else {
      this.showToast('✨ Mostrando todos los locales del marketplace');
    }
  }

  renderStories() {
    const container = document.getElementById('stories-slider');
    if (!container) return;

    const stories = [
      {
        id: 'cafeterias',
        name: 'Cafeterías',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`
      },
      {
        id: 'desayunos',
        name: 'Desayunos',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
      },
      {
        id: 'healthy',
        name: 'Healthy',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`
      },
      {
        id: 'bebidas',
        name: 'Bebidas',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m19 8-1.5 12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 8"/><path d="M4 8h16"/><path d="m14 2-2 6"/><line x1="8" y1="13" x2="8.01" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      },
      {
        id: 'pasteleria',
        name: 'Pastelería',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="m20 21-16-1v-4l16-3v8Z"/><path d="M4 16c2 1 4-1 6 0s4-1 6 0 4-1 4-1"/></svg>`
      },
      {
        id: 'boxes',
        name: 'Boxes',
        svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z"/></svg>`
      }
    ];

    container.innerHTML = stories.map(s => {
      const isActive = (s.id === 'cafeterias' && this.selectedBusiness === 'todos' && this.currentCategory === 'todos') || (this.currentCategory === s.id);
      return `
        <div class="story-bubble ${isActive ? 'active' : ''}" 
             onclick="window.app.handleCategoryClick('${s.id}')"
             title="${s.name}">
          <div class="story-ring">
            <div class="story-avatar-inner">${s.svg}</div>
          </div>
          <span class="story-label">${s.name}</span>
        </div>
      `;
    }).join('');
  }

  handleCategoryClick(id) {
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
      drawer.classList.toggle('active');
    }
  }

  openProfileModal() {
    this.openModal('profile-modal');
  }

  openFavorites() {
    if (this.favorites && this.favorites.length > 0) {
      this.currentCategory = 'favoritos';
      this.selectedBusiness = 'todos';
      this.renderProducts();
      this.showToast(`Mostrando tus ${this.favorites.length} favoritos ❤️`, 'gold');
    } else {
      this.showToast('¡Toca el corazón en cualquier delicia para guardarla en Favoritos! 🔖', 'gold');
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
    document.querySelectorAll('.side-delivery-tab, .delivery-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
    });
    this.showToast(type === 'delivery' ? '🛵 Modo: Envío a domicilio por vendedor' : '🏪 Modo: Retiro en local', 'gold');
  }

  renderFilterChips() {
    const container = document.getElementById('filter-chips-slider');
    if (!container) return;

    const filters = [
      { id: 'all', label: 'Todos los Locales', icon: '✨' },
      { id: 'open', label: '⚡ Abiertos Ahora', icon: '' },
      { id: 'freeShipping', label: '🛵 Envío Gratis por vendedor', icon: '' },
      { id: 'topRated', label: '⭐ Calificación 4.9+', icon: '' },
      { id: 'near', label: '📍 Más Cercanos', icon: '' }
    ];

    container.innerHTML = filters.map(f => `
      <button type="button" class="filter-chip-py ${this.currentFilter === f.id ? 'active' : ''}" 
              onclick="window.app.setFilter('${f.id}')">
        <span>${f.label}</span>
      </button>
    `).join('');
  }

  setFilter(filterId) {
    this.currentFilter = filterId;
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
        <div class="marketplace-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; color: #CBD8D1; background: rgba(0,0,0,0.3); border-radius: 20px; border: 1.5px dashed rgba(212,175,55,0.3); margin: 12px 0;">
          <div style="font-size: 3.2rem; margin-bottom: 12px;">🏪</div>
          <h3 style="color: #FFF; font-size: 1.3rem; font-family: 'Cinzel', serif; margin-bottom: 8px;">Marketplace Listo para Inaugurar</h3>
          <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px auto; line-height: 1.5; color: #A3B8AC;">
            ¡Sé el primer comercio en formar parte de GOD MARKET! Registra tu pastelería o cafetería, define tu radio circular de entrega en el mapa y comienza a recibir pedidos.
          </p>
          <button class="btn-primary" onclick="window.sellerPortal.chooseRole('vendedor')" style="width: auto; padding: 12px 28px; font-size: 0.92rem; font-weight: 700; margin: 0 auto; box-shadow: 0 4px 15px rgba(212,175,55,0.25); cursor: pointer;">
            🚀 Registrar Mi Local & Vender
          </button>
        </div>
      `;
      return;
    }

    const businesses = window.productManager.getBusinessesFiltered(this.currentFilter, this.userCoords, this.onlyInRange);

    // Si hay locales pero ninguno llega con delivery a la ubicación actual del cliente
    if (businesses.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 20px; color: var(--cream-muted); background: rgba(0,0,0,0.25); border-radius: 16px; border: 1px dashed rgba(212,175,55,0.25);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🛵</div>
          <h4 style="color: #FFF; font-size: 1.05rem; margin-bottom: 6px;">No hay cafeterías disponibles en tu radio de entrega</h4>
          <p style="font-size: 0.82rem; max-width: 360px; margin: 0 auto 14px auto; line-height: 1.4;">
            Actualmente ningún local con este filtro llega a tu dirección (${this.escapeHTML(this.currentAddress)}). Puedes desactivar el filtro de cobertura o cambiar tu barrio.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button class="btn-primary" onclick="window.app.setOnlyInRange(false); window.app.setFilter('all');" style="width: auto; padding: 8px 18px; font-size: 0.82rem;">
              Ver todos los locales (Modo Retiro)
            </button>
            <button class="btn-secondary" onclick="window.app.openAddressModal()" style="width: auto; padding: 8px 18px; font-size: 0.82rem; background: rgba(255,255,255,0.1); color: #FFF; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer;">
              📍 Cambiar mi ubicación
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = businesses.map(b => {
      const reachBadge = b.inDeliveryRange
        ? `<span class="coverage-badge in-range">🛵 En tu zona</span>`
        : `<span class="coverage-badge out-range">⚠️ Fuera de radio</span>`;

      return `
        <div class="cafeteria-god-card" onclick="window.app.setBusiness('${b.id}')" title="Ver menú de ${this.escapeHTML(b.name)}">
          <div class="cafeteria-card-img-wrap">
            <img class="cafeteria-card-img" src="${this.escapeHTML(this.safeImageUrl(b.cover, 'assets/images/lumiere_cafe.jpg'))}" alt="${this.escapeHTML(b.name)}" loading="lazy">
          </div>
          <div class="cafeteria-card-body">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
              <h4 class="cafeteria-card-title">${this.escapeHTML(b.name)}</h4>
              ${reachBadge}
            </div>
            <p class="cafeteria-card-sub">${this.escapeHTML(b.tagline)}</p>
            <div class="cafeteria-card-meta">
              <span class="star-gold">★ ${b.rating}</span>
              <span>·</span>
              <span title="Distancia estimada">${b.distance}</span>
              <span>·</span>
              <span style="font-size: 0.72rem; color: #8CA093;" title="Radio de entrega a domicilio">Radio: ${b.deliveryRadiusKm || 5} km</span>
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
          <div class="business-chip-avatar">🏪</div>
          <div class="business-chip-info">
            <span class="business-chip-name">Publicar Mi Local</span>
            <span class="business-chip-zone">Únete a GOD MARKET</span>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="business-chip ${this.selectedBusiness === 'todos' ? 'active' : ''}" 
           onclick="window.app.setBusiness('todos')">
        <div class="business-chip-avatar">✨</div>
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
          <div class="business-chip-avatar">${this.escapeHTML(b.avatar || '🍰')}</div>
          <div class="business-chip-info">
            <span class="business-chip-name">${this.escapeHTML(b.name)}</span>
            <span class="business-chip-zone">📍 ${this.escapeHTML(b.neighborhood || 'Buenos Aires')}</span>
          </div>
          <div class="business-chip-rating">⭐ ${b.rating || 5.0}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  setBusiness(businessId) {
    this.selectedBusiness = businessId;
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

    container.style.display = 'block';
    container.innerHTML = `
      <div class="store-profile-hero animate-fade">
        <img class="store-profile-cover" src="${this.escapeHTML(this.safeImageUrl(business.cover, 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80'))}" alt="${this.escapeHTML(business.name)}">
        <div class="store-profile-content">
          <div class="store-profile-avatar-wrap">${this.escapeHTML(business.avatar || '🍰')}</div>
          
          <div class="store-profile-header-actions">
            <a href="https://wa.me/${business.phone || '5491156192616'}?text=${encodeURIComponent(`¡Hola ${business.name}! Los contacto desde GOD MARKET por sus propuestas.`)}" 
               target="_blank" class="btn-chat-seller">
              <span>💬</span>
              <span>Hablar con el Vendedor</span>
            </a>
            <button class="btn-close-store-view" onclick="window.app.setBusiness('todos')" title="Ver todas las pastelerías">
              ✕ Ver todas
            </button>
          </div>

          <div style="margin-top: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="font-serif" style="font-size: 1.35rem; margin-bottom: 2px;">
                ${this.escapeHTML(business.name)}
                <span style="color: #009EE3; font-size: 0.95rem;">✔</span>
              </h3>
              <span class="store-spotlight-badge">${this.escapeHTML(business.badge || '⭐ Destacado')}</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.35;">
              ${this.escapeHTML(business.tagline)}
            </p>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.74rem; color: var(--text-muted); flex-wrap: wrap;">
              <span>📍 ${this.escapeHTML(business.address || business.neighborhood)}</span>
              <span>•</span>
              <span>⭐ ${business.rating} (${business.reviews} opiniones)</span>
              <span>•</span>
              <span>🕒 ${this.escapeHTML(business.schedule || '08:30 a 20:00 hs')}</span>
            </div>

            <!-- Badge dinámico de Cobertura según la ubicación del cliente -->
            <div style="margin-top: 8px;">
              ${(() => {
                const bLat = business.lat !== undefined ? business.lat : -34.5885;
                const bLng = business.lng !== undefined ? business.lng : -58.4285;
                const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
                const radius = business.deliveryRadiusKm || 5.0;
                const inRange = dist <= radius;
                return inRange
                  ? `<span class="coverage-badge in-range">🛵 En tu zona (${dist} km de tu ubicación • Radio hasta ${radius} km)</span>`
                  : `<span class="coverage-badge out-range">⚠️ Fuera de radio (${dist} km de tu ubicación • Radio máx: ${radius} km — Solo Retiro)</span>`;
              })()}
            </div>
          </div>

          <!-- Política de Envío a cargo del vendedor destacada -->
          <div class="store-profile-policy-box">
            <span style="font-size: 1.2rem;">🛵</span>
            <div>
              <strong>Logística a cargo de ${this.escapeHTML(business.name)}:</strong>
              <div>Cadetería propia con caja térmica especial para pastelería y desayunos. Entrega estimada: <strong>${business.deliveryTime}</strong> (Costo: ${window.cartManager.formatCurrency(business.deliveryFee)}). ¡Envío gratis a partir de ${window.cartManager.formatCurrency(business.freeShippingFrom || 45000)}!</div>
              ${(() => {
                const bLat = business.lat !== undefined ? business.lat : -34.5885;
                const bLng = business.lng !== undefined ? business.lng : -58.4285;
                const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
                const radius = business.deliveryRadiusKm || 5.0;
                const inRange = dist <= radius;
                return `<div style="margin-top: 5px; font-size: 0.73rem; font-weight: 600; color: ${inRange ? '#38D9A9' : '#F87171'};">
                  ${inRange ? `✅ Tu dirección está dentro del radio de entrega (${dist} km / ${radius} km máx).` : `⚠️ Tu dirección está fuera del radio de entrega (${dist} km / ${radius} km máx). Tu pedido será preparado para retiro en local.`}
                </div>`;
              })()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderCategories() {
    const categories = [
      { id: 'todos', name: 'Todo el Menú', icon: '✨' },
      { id: 'desayunos', name: 'Desayunos Sorpresa', icon: '☀️' },
      { id: 'meriendas', name: 'Meriendas & Té', icon: '☕' },
      { id: 'brunch', name: 'Brunch & Salado', icon: '🥐' },
      { id: 'boxes', name: 'Boxes Regalo', icon: '🎁' }
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

    let products = window.productManager.search(this.searchQuery, this.selectedBusiness, this.currentCategory);

    if (products.length === 0) {
      const totalInMarket = window.productManager.getAllProducts().length;
      if (totalInMarket === 0) {
        container.innerHTML = `
          <div class="catalog-empty-state" style="text-align: center; padding: 48px 24px; color: #CBD8D1; background: rgba(0,0,0,0.3); border-radius: 20px; border: 1.5px dashed rgba(212,175,55,0.3); margin: 20px 0;">
            <div style="font-size: 3.2rem; margin-bottom: 12px;">🥐</div>
            <h3 style="color: #FFF; font-size: 1.3rem; font-family: 'Cinzel', serif; margin-bottom: 8px;">Catálogo Listo para Cargar</h3>
            <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px auto; line-height: 1.5; color: #A3B8AC;">
              Aún no hay productos publicados en el marketplace. Como comercio o pastelero, puedes registrarte y publicar tus creaciones gourmet con foto en minutos.
            </p>
            <button class="btn-primary" onclick="window.sellerPortal.chooseRole('vendedor')" style="width: auto; padding: 12px 28px; font-size: 0.92rem; font-weight: 700; margin: 0 auto; box-shadow: 0 4px 15px rgba(212,175,55,0.25); cursor: pointer;">
              ✨ Acceso Vendedores / Publicar Producto
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 10px;">🥐</div>
          <h3>No encontramos desayunos ni meriendas</h3>
          <p style="font-size: 0.85rem;">Prueba buscando otra pastelería, producto o cambiando de categoría.</p>
          <button class="btn-primary" onclick="window.app.setBusiness('todos'); window.app.setCategory('todos');" style="margin: 16px auto 0; max-width: 240px; padding: 10px 18px; font-size: 0.85rem;">
            Ver todo el Marketplace
          </button>
        </div>
      `;
      return;
    }

    // Si estamos viendo "todos" sin búsqueda y sin negocio específico seleccionado, agrupar por los 7 negocios
    if (this.selectedBusiness === 'todos' && this.currentCategory === 'todos' && !this.searchQuery) {
      const businesses = window.productManager.getAllBusinesses();
      let html = '';

      businesses.forEach(b => {
        const bProducts = products.filter(p => p.businessId === b.id);
        if (bProducts.length > 0) {
          html += `
            <div class="section-container animate-fade store-section-block">
              <div class="section-header store-section-header">
                <div class="store-section-title-wrap">
                  <div class="store-section-icon">${this.escapeHTML(b.avatar || '🍰')}</div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <h3 class="section-title">${this.escapeHTML(b.name)}</h3>
                      <span class="store-mini-badge">${this.escapeHTML(b.neighborhood)}</span>
                    </div>
                    <p class="section-subtitle">${this.escapeHTML(b.tagline)} • ⭐ ${b.rating} (${b.reviews}) • 🛵 ${b.deliveryTime}</p>
                  </div>
                </div>
                <button class="btn-view-store" onclick="window.app.setBusiness('${b.id}')">
                  Ver Carta →
                </button>
              </div>
              <div class="products-grid">
                ${bProducts.map(p => this.renderProductCard(p)).join('')}
              </div>
            </div>
          `;
        }
      });
      container.innerHTML = html;
    } else {
      // Vista filtrada por negocio, categoría o búsqueda
      let title = "Resultados del Marketplace";
      let subtitle = `${products.length} delicias disponibles`;

      if (this.selectedBusiness !== 'todos') {
        const bObj = window.productManager.getBusinessById(this.selectedBusiness);
        if (bObj) {
          title = `${bObj.avatar} Carta de ${bObj.name}`;
          subtitle = `${products.length} productos en ${bObj.neighborhood}`;
        }
      } else if (this.currentCategory !== 'todos') {
        const catMap = {
          desayunos: '☀️ Desayunos Sorpresa',
          meriendas: '☕ Meriendas & Té de la Tarde',
          brunch: '🥐 Brunch & Opciones Saladas',
          boxes: '🎁 Boxes de Cumpleaños & Regalo'
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
            ${products.map(p => this.renderProductCard(p)).join('')}
          </div>
        </div>
      `;
    }
  }

  renderProductCard(product) {
    const isFav = this.favorites.includes(product.id);
    const b = window.productManager.getBusinessById(product.businessId);
    let reachInfo = '';
    if (b) {
      const bLat = b.lat !== undefined ? b.lat : -34.5885;
      const bLng = b.lng !== undefined ? b.lng : -58.4285;
      const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
      const inRange = dist <= (b.deliveryRadiusKm || 5.0);
      reachInfo = inRange
        ? `<span style="font-size: 0.68rem; color: #38D9A9; font-weight: 700; background: rgba(56,217,169,0.12); padding: 2px 6px; border-radius: 4px;">🛵 En tu zona (${dist} km)</span>`
        : `<span style="font-size: 0.68rem; color: #F87171; font-weight: 700; background: rgba(248,113,113,0.12); padding: 2px 6px; border-radius: 4px;">🏪 Retiro (${dist} km)</span>`;
    }

    return `
      <div class="product-card" onclick="window.app.openProductModal('${product.id}')">
        <div class="product-image-container">
          <img class="product-image" src="${this.escapeHTML(this.safeImageUrl(product.image, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80'))}" alt="${this.escapeHTML(product.name)}" loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80'">
          ${product.tag ? `<div class="product-tag">${this.escapeHTML(product.tag)}</div>` : ''}
          <button class="favorite-btn ${isFav ? 'active' : ''}" 
                  onclick="window.app.toggleFavorite('${product.id}', event)" 
                  title="Favorito">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
        <div class="product-content">
          <div class="product-store-badge" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="store-badge-avatar">${this.escapeHTML(product.businessAvatar || '🏪')}</span>
              <span class="store-badge-name">${this.escapeHTML(product.businessName || 'Pastelería')}</span>
              <span class="store-badge-zone">• ${this.escapeHTML(product.businessNeighborhood || '')}</span>
            </div>
            ${reachInfo}
          </div>
          <h4 class="product-title">${this.escapeHTML(product.name)}</h4>
          <p class="product-desc-short">${this.escapeHTML(product.description)}</p>
          <div class="product-portion-tag">📏 ${this.escapeHTML(product.portion || '1 o 2 pers.')}</div>
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
    document.getElementById('modal-product-img').src = this.safeImageUrl(product.image);
    document.getElementById('modal-product-title').textContent = product.name;
    document.getElementById('modal-product-price').textContent = window.cartManager.formatCurrency(product.price);
    document.getElementById('modal-product-desc').textContent = product.description;
    document.getElementById('modal-product-portion').textContent = product.portion || 'Porción artesanal';

    const storeAvatar = document.getElementById('modal-store-avatar');
    const storeName = document.getElementById('modal-store-name');
    const storeZone = document.getElementById('modal-store-zone');
    if (storeAvatar) storeAvatar.textContent = product.businessAvatar || '🏪';
    if (storeName) storeName.textContent = product.businessName || 'Pastelería Asociada';

    const b = window.productManager.getBusinessById(product.businessId);
    if (storeZone) {
      if (b) {
        const bLat = b.lat !== undefined ? b.lat : -34.5885;
        const bLng = b.lng !== undefined ? b.lng : -58.4285;
        const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lng, bLat, bLng);
        const inRange = dist <= (b.deliveryRadiusKm || 5.0);
        storeZone.innerHTML = `• 📍 ${product.businessNeighborhood || ''} <span style="margin-left: 6px; color: ${inRange ? '#38D9A9' : '#F87171'}; font-weight: 700;">(${inRange ? `🛵 En tu zona a ${dist} km` : `🏪 Solo retiro • ${dist} km`})</span>`;
      } else {
        storeZone.textContent = product.businessNeighborhood ? `• 📍 ${product.businessNeighborhood}` : '';
      }
    }

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
      'Dulce de Leche': 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
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

    const shippingEls = [
      document.getElementById('cart-drawer-shipping'),
      ...document.querySelectorAll('.cart-calc-delivery')
    ].filter(Boolean);
    shippingEls.forEach(el => {
      el.textContent = deliveryFee === 0 ? '¡Gratis!' : window.cartManager.formatCurrency(deliveryFee);
    });

    const totalEls = [
      document.getElementById('cart-drawer-total'),
      ...document.querySelectorAll('.cart-calc-total')
    ].filter(Boolean);
    totalEls.forEach(el => el.textContent = window.cartManager.formatCurrency(total));

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
        <img class="cart-item-img" src="${this.escapeHTML(this.safeImageUrl(item.product.image))}" alt="${this.escapeHTML(item.product.name)}">
        <div class="cart-item-info">
          <div class="cart-item-store-tag">🏪 ${this.escapeHTML(item.product.businessName || 'Pastelería')}${item.product.businessNeighborhood ? ' • ' + this.escapeHTML(item.product.businessNeighborhood) : ''}</div>
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
      this.showToast("⚠️ No hay datos del pedido para copiar");
      return;
    }

    navigator.clipboard.writeText(lastOrder.rawMessage).then(() => {
      const btn = document.getElementById('btn-copy-full-order');
      if (btn) {
        btn.innerHTML = '<span>✓</span> ¡Mensaje del Pedido Copiado!';
        setTimeout(() => {
          btn.innerHTML = '<span>📋</span> <span>Copiar Mensaje del Pedido</span>';
        }, 2000);
      }
      this.showToast('📋 Mensaje completo del pedido copiado con éxito');
    }).catch(() => {
      this.showToast('⚠️ No se pudo acceder al portapapeles');
    });
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
    const alias = "GODMARKET.BA";
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
    const alias = "GODMARKET.MP";
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
      this.showToast(`💳 CVU ${cvu} copiado con éxito`);
    });
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
      dot.style.background = '#2A9D8F';
      dot.style.animation = 'pulseGlow 2s infinite';
      info.innerHTML = '<strong style="color: #2A9D8F;">Abierto Ahora</strong> • 08:30 a 20:00 hs';
      if (tag) {
        tag.textContent = '🛵 Envíos en el día';
        tag.style.color = 'var(--primary)';
      }
    } else {
      dot.style.background = '#E63946';
      dot.style.animation = 'none';
      const isMorning = hour < 8 || (hour === 8 && minute < 30);
      const nextOpen = isMorning ? 'Abre hoy 08:30 hs' : 'Abre mañana 08:30 hs';
      info.innerHTML = `<strong style="color: #E63946;">Cerrado Ahora</strong> • ${nextOpen}`;
      if (tag) {
        tag.textContent = '🌙 Pedidos programados';
        tag.style.color = '#E65100';
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

    if (isOpen) {
      if (chipNow) {
        chipNow.style.display = 'inline-flex';
        chipNow.classList.add('active');
      }
      if (chipTomorrow) chipTomorrow.classList.remove('active');
      if (timeInput && (!timeInput.value || timeInput.value.includes('Mañana') || timeInput.value.includes('desde 08:30'))) {
        timeInput.value = 'Lo antes posible (Ahora)';
      }
    } else {
      // Local cerrado en horario argentino
      if (chipNow) {
        chipNow.style.display = 'none';
        chipNow.classList.remove('active');
      }

      const isMorning = hour < 8 || (hour === 8 && minute < 30);
      if (isMorning) {
        if (chipAfternoon) {
          chipAfternoon.dataset.time = 'Hoy desde 08:30 hs';
          chipAfternoon.innerHTML = '☀️ Hoy desde 08:30 hs';
          chipAfternoon.classList.add('active');
        }
        if (timeInput) timeInput.value = 'Hoy desde 08:30 hs';
      } else {
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
          <div class="orders-empty-icon">🧁</div>
          <h4 class="font-serif" style="font-size: 1.15rem; margin-bottom: 6px;">No tienes pedidos registrados</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
            Cuando realices un pedido en GOD MARKET, quedará guardado automáticamente en tu celular para ver tu historial y comprobantes.
          </p>
          <button type="button" class="btn-primary" onclick="window.app.closeModal('orders-history-modal')" style="width: auto; padding: 8px 20px; margin: 0 auto; font-size: 0.85rem;">
            Ver Menú y Elegir Delicias
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
        ? '🏪 Retiro en Tienda'
        : `📍 ${this.escapeHTML(order.formData?.address || 'Envío a Domicilio')}${order.formData?.zone ? ` (${this.escapeHTML(order.formData.zone)})` : ''}`;

      return `
        <div class="order-history-card">
          <div class="order-history-header">
            <div>
              <div class="order-history-id">
                <span>#${this.escapeHTML(order.orderId)}</span>
              </div>
              <div class="order-history-date">📅 ${dateStr}</div>
            </div>
            <button type="button" class="btn-order-delete" onclick="window.app.deleteOrderHistory('${this.escapeHTML(order.orderId)}')" title="Eliminar del historial">
              🗑️
            </button>
          </div>

          <div class="order-history-items-summary">
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; font-weight: 700;">Productos:</div>
            <div>${itemsSummary || 'Detalle del pedido'}</div>
            <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 6px; border-top: 1px dashed var(--border-light); padding-top: 4px;">
              ${addressText} • 🕒 ${this.escapeHTML(order.formData?.deliveryTime || 'Horario coordinado')}
            </div>
          </div>

          <div class="order-history-footer">
            <div>
              <span style="font-size: 0.7rem; color: var(--text-muted); display: block; text-transform: uppercase; font-weight: 700;">Total:</span>
              <span class="order-history-total" style="color: var(--primary);">${order.totalFormatted || '$' + (order.total || 0)}</span>
            </div>

            <div class="order-history-actions">
              <button type="button" class="btn-order-action btn-order-ticket" onclick="window.app.viewOrderTicket('${this.escapeHTML(order.orderId)}')">
                <span>🧾</span> Ver Ticket
              </button>
              <button type="button" class="btn-order-action btn-order-whatsapp" onclick="window.app.trackOrderWhatsApp('${this.escapeHTML(order.orderId)}')">
                <span>💬</span> WhatsApp
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  viewOrderTicket(orderId) {
    const order = window.checkoutHandler?.getOrderById(orderId);
    if (!order) {
      this.showToast("⚠️ No se encontró la información del pedido");
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
    const text = `¡Hola GOD MARKET! ✦ Me comunico por mi pedido #${order.orderId}${name ? ` a nombre de ${name}` : ''}. ¡Muchas gracias!`;
    const url = window.checkoutHandler.buildWhatsAppUrl(text);
    window.open(url, '_blank');
  }

  deleteOrderHistory(orderId) {
    if (confirm(`¿Deseas quitar la orden #${orderId} de tu celular?`)) {
      window.checkoutHandler?.deleteOrderFromHistory(orderId);
      this.renderOrdersHistoryList();
      this.updateOrdersBadges();
      this.showToast(`🗑️ Pedido #${orderId} eliminado del historial`);
    }
  }

  selectQuickTime(btn) {
    document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
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
      if (modalId === 'cart-drawer-modal' || modalId === 'checkout-modal') {
        this.updateCartUI();
      }
      if (modalId === 'checkout-modal') {
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
    const entered = prompt('🔐 Ingrese el PIN de Acceso para Negocios (por defecto: 1234):');
    if (entered === savedPin) {
      if (window.adminManager && typeof window.adminManager.populateBusinessSelect === 'function') {
        window.adminManager.populateBusinessSelect();
      }
      this.openModal('admin-product-modal');
    } else if (entered !== null) {
      this.showToast('❌ PIN incorrecto');
    }
  }

  safeImageUrl(value, fallback = 'assets/images/lumiere_cafe.jpg') {
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
