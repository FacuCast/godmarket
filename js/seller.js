/**
 * GOD MARKET - CONTROLADOR DEL PORTAL DE VENDEDORES & AUTENTICACIÓN GOOGLE
 * Maneja el Selector de Rol, Login con Google, Onboarding y Dashboard del Vendedor
 */

class SellerPortalManager {
  constructor() {
    this.currentSeller = null;
    this.currentBusiness = null;
    this.activeTab = 'products';
    this.googleClientId = '';
    this.gisLoaded = false;

    // Estados de Mapa y Radio Circular de Envíos
    this.onboardMap = null;
    this.onboardMarker = null;
    this.onboardCircle = null;
    this.onboardLat = -34.5885;
    this.onboardLng = -58.4285;
    this.onboardRadius = 5.0;

    this.dashMap = null;
    this.dashMarker = null;
    this.dashCircle = null;
    this.dashLat = -34.5885;
    this.dashLng = -58.4285;
    this.dashRadius = 5.0;

    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  async init() {
    // 1. Cargar configuración desde el backend (/api/config)
    await this.loadConfig();

    // 2. Verificar si hay sesión previa de vendedor guardada
    this.loadSavedSession();

    // 3. Inicializar Google Identity Services si está disponible el Client ID
    this.initGoogleIdentity();

    // 4. Evaluar si se debe mostrar el modal de selección de rol
    this.evaluateRolePresentation();

    // 5. Vincular listeners de formularios y pestañas
    this.setupListeners();
  }

  async loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        this.googleClientId = data.googleClientId || '';
      }
    } catch (err) {
      console.warn('No se pudo conectar al backend para /api/config:', err.message);
    }
  }

  loadSavedSession() {
    try {
      this.token = localStorage.getItem('godmarket_seller_token') || null;
      const savedSeller = localStorage.getItem('godmarket_seller');
      const savedBusiness = localStorage.getItem('godmarket_business');
      if (savedSeller) this.currentSeller = JSON.parse(savedSeller);
      if (savedBusiness) this.currentBusiness = JSON.parse(savedBusiness);
    } catch (e) {
      console.error('Error al cargar sesión de vendedor:', e);
    }
  }

  getAuthHeaders() {
    const token = this.token || localStorage.getItem('godmarket_seller_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.currentSeller?.id) {
      headers['x-seller-id'] = this.currentSeller.id;
    }
    return headers;
  }

  evaluateRolePresentation() {
    // 1. Detectar si la URL indica acceso directo de vendedor (/vendedor, #vendedor o ?role=vendedor)
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    const isSellerUrl = path.includes('/vendedor') ||
                        path.includes('/seller') ||
                        hash.includes('vendedor') ||
                        hash.includes('seller') ||
                        search.includes('vendedor') ||
                        search.includes('role=vendedor');

    if (isSellerUrl) {
      this.chooseRole('vendedor');
      return;
    }

    const savedRole = localStorage.getItem('godmarket_role'); // 'cliente' | 'vendedor'

    if (savedRole === 'vendedor' && this.currentSeller && this.currentBusiness) {
      // Vendedor con sesión activa: mostrar directamente su dashboard
      this.showSellerDashboard();
    } else if (savedRole === 'vendedor' && (!this.currentSeller || !this.currentSeller.hasCompletedProfile)) {
      // Vendedor sin completar: mostrar pantalla de login o onboarding
      if (this.currentSeller) {
        this.showOnboardingScreen();
      } else {
        this.showSellerAuthScreen();
      }
    } else if (!savedRole) {
      // Primera visita sin rol elegido: mostrar selector de bienvenida
      this.openRoleModal();
    } else {
      // Cliente: asegurarse de que la tienda principal esté visible
      this.showCustomerMarketplace();
    }
  }

  openRoleModal() {
    const modal = document.getElementById('role-selector-modal');
    if (modal) modal.classList.add('active');
  }

  closeRoleModal() {
    const modal = document.getElementById('role-selector-modal');
    if (modal) modal.classList.remove('active');
  }

  chooseRole(role) {
    localStorage.setItem('godmarket_role', role);
    this.closeRoleModal();

    if (role === 'cliente') {
      if (window.location.hash.includes('vendedor') || window.location.hash.includes('seller')) {
        try {
          history.replaceState(null, '', window.location.pathname);
        } catch (e) {}
      }
      this.showCustomerMarketplace();
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('🛍️ ¡Bienvenido a GOD MARKET! Disfruta la mejor pastelería gourmet.');
      }
    } else if (role === 'vendedor') {
      if (!window.location.hash.includes('vendedor') && !window.location.pathname.includes('vendedor')) {
        try {
          history.replaceState(null, '', '#vendedor');
        } catch (e) {}
      }
      if (this.currentSeller && this.currentSeller.hasCompletedProfile && this.currentBusiness) {
        this.showSellerDashboard();
      } else if (this.currentSeller && !this.currentSeller.hasCompletedProfile) {
        this.showOnboardingScreen();
      } else {
        this.showSellerAuthScreen();
      }
    }
  }

  showCustomerMarketplace() {
    const appContainer = document.querySelector('.app-container');
    const sellerPortal = document.getElementById('seller-portal-view');
    const authScreen = document.getElementById('seller-auth-screen');
    const onboardingScreen = document.getElementById('seller-onboarding-screen');

    if (appContainer) appContainer.style.display = 'block';
    if (sellerPortal) sellerPortal.classList.remove('active');
    if (authScreen) authScreen.classList.remove('active');
    if (onboardingScreen) onboardingScreen.classList.remove('active');

    if (window.location.hash.includes('vendedor') || window.location.hash.includes('seller')) {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    }
  }

  showSellerAuthScreen() {
    const appContainer = document.querySelector('.app-container');
    const sellerPortal = document.getElementById('seller-portal-view');
    const authScreen = document.getElementById('seller-auth-screen');
    const onboardingScreen = document.getElementById('seller-onboarding-screen');

    if (appContainer) appContainer.style.display = 'none';
    if (sellerPortal) sellerPortal.classList.remove('active');
    if (onboardingScreen) onboardingScreen.classList.remove('active');
    if (authScreen) authScreen.classList.add('active');

    this.renderGoogleSignInButton();
  }

  showOnboardingScreen() {
    const appContainer = document.querySelector('.app-container');
    const sellerPortal = document.getElementById('seller-portal-view');
    const authScreen = document.getElementById('seller-auth-screen');
    const onboardingScreen = document.getElementById('seller-onboarding-screen');

    if (appContainer) appContainer.style.display = 'none';
    if (sellerPortal) sellerPortal.classList.remove('active');
    if (authScreen) authScreen.classList.remove('active');
    if (onboardingScreen) onboardingScreen.classList.add('active');

    // Prellenar datos con lo que trajo Google
    if (this.currentSeller) {
      const welcomeName = document.getElementById('onboarding-welcome-name');
      if (welcomeName) welcomeName.textContent = this.currentSeller.name || 'pastelero/a';
    }

    // Inicializar mapa interactivo de Leaflet y radio circular
    setTimeout(() => this.initOnboardingMap(), 150);
  }

  initOnboardingMap() {
    const mapContainer = document.getElementById('onboard-radius-map');
    if (!mapContainer || !window.L) return;

    if (!this.onboardMap) {
      this.onboardMap = L.map('onboard-radius-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([this.onboardLat, this.onboardLng], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(this.onboardMap);

      const customIcon = L.divIcon({
        className: 'custom-seller-map-pin',
        html: `<div class="custom-seller-pin"><span>🍰</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
      });

      this.onboardMarker = L.marker([this.onboardLat, this.onboardLng], {
        draggable: true,
        icon: customIcon
      }).addTo(this.onboardMap);

      this.onboardCircle = L.circle([this.onboardLat, this.onboardLng], {
        radius: this.onboardRadius * 1000,
        color: '#D4AF37',
        weight: 2,
        fillColor: '#2A9D8F',
        fillOpacity: 0.25
      }).addTo(this.onboardMap);

      this.onboardMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        this.setOnboardingCoords(pos.lat, pos.lng);
      });

      this.onboardMap.on('click', (e) => {
        this.setOnboardingCoords(e.latlng.lat, e.latlng.lng);
      });
    }

    setTimeout(() => {
      if (this.onboardMap) {
        this.onboardMap.invalidateSize();
        this.onboardMap.setView([this.onboardLat, this.onboardLng], 13);
      }
    }, 200);
  }

  setOnboardingCoords(lat, lng) {
    this.onboardLat = parseFloat(lat.toFixed(5));
    this.onboardLng = parseFloat(lng.toFixed(5));

    const latInput = document.getElementById('onboard-lat');
    const lngInput = document.getElementById('onboard-lng');
    if (latInput) latInput.value = this.onboardLat;
    if (lngInput) lngInput.value = this.onboardLng;

    if (this.onboardMarker) this.onboardMarker.setLatLng([this.onboardLat, this.onboardLng]);
    if (this.onboardCircle) this.onboardCircle.setLatLng([this.onboardLat, this.onboardLng]);
  }

  updateOnboardingRadius(km) {
    this.onboardRadius = km;
    const slider = document.getElementById('onboard-radius-slider');
    const valBadge = document.getElementById('onboard-radius-val');
    const radiusInput = document.getElementById('onboard-radius');

    if (slider) slider.value = km;
    if (valBadge) valBadge.textContent = `${km.toFixed(1)} km`;
    if (radiusInput) radiusInput.value = km;

    if (this.onboardCircle) {
      this.onboardCircle.setRadius(km * 1000);
    }

    document.querySelectorAll('.onboarding-field-group .radius-chip').forEach(chip => {
      chip.classList.toggle('active', parseFloat(chip.textContent) === km);
    });
  }

  detectOnboardingLocationGPS() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.setOnboardingCoords(pos.coords.latitude, pos.coords.longitude);
        if (this.onboardMap) {
          this.onboardMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
        }
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('📍 Ubicación fijada con éxito por GPS');
        }
      },
      (err) => {
        console.warn('GPS error:', err);
        alert('No se pudo obtener la ubicación GPS automáticamente. Puedes hacer clic en el mapa para marcar tu local.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  goBackToAuth() {
    this.showSellerAuthScreen();
  }

  cancelOnboardingAndGoBack() {
    localStorage.removeItem('godmarket_seller');
    localStorage.removeItem('godmarket_business');
    localStorage.setItem('godmarket_role', 'cliente');
    this.currentSeller = null;
    this.currentBusiness = null;
    this.showCustomerMarketplace();
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('🛍️ Has vuelto a la tienda como cliente.');
    }
  }

  async showSellerDashboard() {
    const appContainer = document.querySelector('.app-container');
    const sellerPortal = document.getElementById('seller-portal-view');
    const authScreen = document.getElementById('seller-auth-screen');
    const onboardingScreen = document.getElementById('seller-onboarding-screen');

    if (appContainer) appContainer.style.display = 'none';
    if (authScreen) authScreen.classList.remove('active');
    if (onboardingScreen) onboardingScreen.classList.remove('active');
    if (sellerPortal) sellerPortal.classList.add('active');

    // Cargar datos actualizados del negocio y sus productos
    await this.refreshSellerData();
    this.renderDashboardHeader();
    this.renderSellerProducts();
    this.renderSellerOrders();
  }

  // ============================================================================
  // GOOGLE IDENTITY SERVICES (GIS)
  // ============================================================================

  initGoogleIdentity() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      this.gisLoaded = true;
      this.configureGis();
    } else {
      // Reintentar si el script de Google carga con retraso
      const interval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          this.gisLoaded = true;
          this.configureGis();
          clearInterval(interval);
        }
      }, 300);
      setTimeout(() => clearInterval(interval), 6000);
    }
  }

  configureGis() {
    if (!this.gisLoaded || !window.google) return;
    const clientId = this.googleClientId || '';

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      this.renderGoogleSignInButton();
    } catch (e) {
      console.warn('Aviso de Google Identity Services:', e.message);
    }
  }

  renderGoogleSignInButton() {
    const container = document.getElementById('google-signin-btn-container');
    if (!container || !window.google || !this.gisLoaded) return;

    container.innerHTML = '';
    try {
      window.google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 280
      });
    } catch (e) {
      console.warn('No se pudo renderizar el botón nativo de Google GIS:', e.message);
    }
  }

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de autenticación con Google');

      this.processAuthResult(data);
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err);
      alert('Error al autenticar: ' + err.message);
    }
  }

  // Acceso de prueba rápido (Demo / Developer Mode)
  async handleDemoLogin() {
    const demoNames = ['Camila Repostera', 'Julián Maestro Cafetero', 'Sofía Pâtisserie'];
    const randomName = demoNames[Math.floor(Math.random() * demoNames.length)];
    const randomId = 'demo_user_' + Math.floor(1000 + Math.random() * 9000);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDemo: true,
          demoUser: {
            id: randomId,
            email: `pastelero_${randomId}@godmarket.com`,
            name: randomName,
            picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en login demo');

      this.processAuthResult(data);
    } catch (err) {
      console.error('Error en login demo:', err);
      alert('Error en modo demo: ' + err.message);
    }
  }

  processAuthResult(data) {
    this.currentSeller = data.seller;
    this.currentBusiness = data.business;
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('godmarket_seller_token', data.token);
    }
    localStorage.setItem('godmarket_seller', JSON.stringify(data.seller));
    if (data.business) {
      localStorage.setItem('godmarket_business', JSON.stringify(data.business));
    }

    if (data.isNewSeller || !data.seller.hasCompletedProfile) {
      // Primera vez: completar datos del negocio
      this.showOnboardingScreen();
    } else {
      // Ya tiene su perfil creado: ir a su panel
      this.showSellerDashboard();
    }
  }

  // ============================================================================
  // REGISTRO DE NEGOCIO / ONBOARDING
  // ============================================================================

  async handleOnboardingSubmit(e) {
    e.preventDefault();
    if (!this.currentSeller) return;

    const bizName = document.getElementById('onboard-biz-name')?.value.trim();
    const tagline = document.getElementById('onboard-tagline')?.value.trim();
    const neighborhood = document.getElementById('onboard-neighborhood')?.value.trim();
    const address = document.getElementById('onboard-address')?.value.trim();
    const phone = document.getElementById('onboard-phone')?.value.trim();
    const schedule = document.getElementById('onboard-schedule')?.value.trim();
    const deliveryFee = document.getElementById('onboard-delivery-fee')?.value.trim();
    const deliveryTime = document.getElementById('onboard-delivery-time')?.value.trim();
    const description = document.getElementById('onboard-desc')?.value.trim();
    const avatar = document.getElementById('onboard-avatar')?.value || '🍰';

    if (!bizName || !phone) {
      alert('Por favor completa el nombre del negocio y el WhatsApp de ventas.');
      return;
    }

    const lat = this.onboardLat || parseFloat(document.getElementById('onboard-lat')?.value) || -34.5885;
    const lng = this.onboardLng || parseFloat(document.getElementById('onboard-lng')?.value) || -58.4285;
    const deliveryRadiusKm = this.onboardRadius || parseFloat(document.getElementById('onboard-radius')?.value) || 5.0;

    const payload = {
      googleId: this.currentSeller.googleId,
      email: this.currentSeller.email,
      sellerName: this.currentSeller.name,
      picture: this.currentSeller.picture,
      businessName: bizName,
      tagline,
      neighborhood,
      address,
      phone,
      schedule,
      deliveryFee,
      deliveryTime,
      avatar,
      description,
      lat,
      lng,
      deliveryRadiusKm
    };

    const submitBtn = document.getElementById('btn-submit-onboard');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando tu perfil de vendedor...';
    }

    try {
      const res = await fetch('/api/seller/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar negocio');

      this.currentSeller = data.seller;
      this.currentBusiness = data.business;
      if (data.token) {
        this.token = data.token;
        localStorage.setItem('godmarket_seller_token', data.token);
      }
      localStorage.setItem('godmarket_seller', JSON.stringify(data.seller));
      localStorage.setItem('godmarket_business', JSON.stringify(data.business));

      // Actualizar también el catálogo en memoria de la app cliente si existe
      if (window.productManager && typeof window.productManager.addBusiness === 'function') {
        window.productManager.addBusiness(data.business);
      }

      this.showSellerDashboard();
    } catch (err) {
      console.error('Error al registrar negocio:', err);
      alert('Error: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Crear Mi Perfil de Vendedor y Empezar a Vender';
      }
    }
  }

  // ============================================================================
  // DASHBOARD DEL VENDEDOR
  // ============================================================================

  async refreshSellerData() {
    if (!this.currentSeller) return;
    try {
      const res = await fetch(`/api/seller/me?sellerId=${this.currentSeller.id}&googleId=${this.currentSeller.googleId}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.business) this.currentBusiness = data.business;
        if (data.seller) this.currentSeller = data.seller;
        localStorage.setItem('godmarket_seller', JSON.stringify(this.currentSeller));
        localStorage.setItem('godmarket_business', JSON.stringify(this.currentBusiness));
      }
    } catch (e) {
      console.warn('Error refrescando datos del vendedor:', e);
    }
  }

  renderDashboardHeader() {
    if (!this.currentBusiness) return;
    const nameEl = document.getElementById('dash-biz-name');
    const avatarEl = document.getElementById('dash-biz-avatar');
    const zoneEl = document.getElementById('dash-biz-zone');
    const phoneEl = document.getElementById('dash-biz-phone');

    if (nameEl) nameEl.textContent = this.currentBusiness.name;
    if (avatarEl) avatarEl.textContent = this.currentBusiness.avatar || '🍰';
    if (zoneEl) zoneEl.textContent = `📍 ${this.currentBusiness.neighborhood}`;
    if (phoneEl) phoneEl.textContent = `📱 WhatsApp: ${this.currentBusiness.phone}`;
  }

  async renderSellerProducts() {
    const container = document.getElementById('seller-products-list');
    if (!container || !this.currentBusiness) return;

    container.innerHTML = '<div style="color: #9AB0A3; padding: 20px;">Cargando tus productos...</div>';

    try {
      const res = await fetch(`/api/seller/products?businessId=${this.currentBusiness.id}`, {
        headers: this.getAuthHeaders()
      });
      const products = res.ok ? await res.json() : [];

      const countEl = document.getElementById('stat-total-products');
      if (countEl) countEl.textContent = products.length;

      if (products.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); border: 1.5px dashed rgba(212,175,55,0.3); border-radius: 16px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 10px;">🍰</div>
            <h4 style="color: #FFF; font-size: 1.1rem; margin-bottom: 6px;">Aún no has publicado ningún producto</h4>
            <p style="color: #8CA093; font-size: 0.85rem; max-width: 400px; margin: 0 auto 18px auto;">Comienza a subir tus tortas, desayunos sorpresa o meriendas para que los clientes puedan comprarlas.</p>
            <button class="btn-add-prod" onclick="window.sellerPortal.openAddProductModal()">+ Publicar mi primer producto</button>
          </div>
        `;
        return;
      }

      container.innerHTML = products.map(p => `
        <div class="seller-prod-card" id="seller-card-${p.id}">
          <div class="seller-prod-img-box">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
            <span class="seller-prod-category-badge">${p.categoryName || p.category}</span>
          </div>
          <div class="seller-prod-body">
            <h4>${p.name}</h4>
            <p>${p.description || 'Sin descripción'}</p>
            <div class="seller-prod-meta">
              <span class="seller-prod-price">$${Number(p.price).toLocaleString('es-AR')}</span>
              <span class="seller-prod-portion">${p.portion || '1-2 personas'}</span>
            </div>
            <div class="seller-prod-actions">
              <button class="btn-card-edit" onclick="window.sellerPortal.editProductPrompt('${p.id}', ${p.price})">✏️ Cambiar Precio</button>
              <button class="btn-card-delete" onclick="window.sellerPortal.deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      `).join('');

    } catch (err) {
      container.innerHTML = '<div style="color: #F87171;">Error al cargar productos.</div>';
    }
  }

  async renderSellerOrders() {
    const container = document.getElementById('seller-orders-list');
    if (!container || !this.currentBusiness) return;

    try {
      const res = await fetch(`/api/seller/orders?businessId=${this.currentBusiness.id}`, {
        headers: this.getAuthHeaders()
      });
      const orders = res.ok ? await res.json() : [];

      const countEl = document.getElementById('stat-total-orders');
      if (countEl) countEl.textContent = orders.length;

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 36px 20px; text-align: center; color: #8CA093;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📦</div>
            <strong style="color: #FFF; display: block; margin-bottom: 4px;">Aún no tienes pedidos recibidos</strong>
            <span style="font-size: 0.82rem;">Cuando los clientes realicen pedidos a tu local, aparecerán aquí con el botón directo de WhatsApp.</span>
          </div>
        `;
        return;
      }

      container.innerHTML = orders.map(o => `
        <div class="seller-order-card">
          <div class="seller-order-header">
            <div>
              <strong style="color: #FFF; font-size: 0.95rem;">Pedido #${o.id}</strong>
              <div style="font-size: 0.76rem; color: #8CA093;">${new Date(o.createdAt).toLocaleString('es-AR')}</div>
            </div>
            <span class="status-badge status-${o.status || 'pendiente'}">${o.status || 'Pendiente'}</span>
          </div>

          <div style="font-size: 0.85rem; color: #E5EBE7; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px;">
            <strong>Cliente:</strong> ${o.customerName || 'Cliente'} (${o.customerPhone || 'Sin tel'})<br>
            <strong>Entrega:</strong> ${o.deliveryType || 'Envío a domicilio'} — ${o.address || 'Buenos Aires'}<br>
            <strong>Total a cobrar:</strong> <span style="color: #D4AF37; font-weight: 700;">$${Number(o.total || 0).toLocaleString('es-AR')}</span>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
            ${o.customerPhone ? `
              <a href="https://wa.me/${o.customerPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(o.customerName || '')},%20somos%20${encodeURIComponent(this.currentBusiness.name)}%20de%20GOD%20MARKET%20por%20tu%20pedido%20%23${o.id}" target="_blank" class="seller-action-pill" style="background: rgba(37, 211, 102, 0.15); border-color: rgba(37, 211, 102, 0.4); color: #25D366;">
                💬 Escribir por WhatsApp
              </a>
            ` : ''}

            <select onchange="window.sellerPortal.updateOrderStatus('${o.id}', this.value)" style="background: rgba(0,0,0,0.4); color: #FFF; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 6px 10px; font-size: 0.78rem;">
              <option value="pendiente" ${o.status === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
              <option value="en_preparacion" ${o.status === 'en_preparacion' ? 'selected' : ''}>👨‍🍳 En Preparación</option>
              <option value="despachado" ${o.status === 'despachado' ? 'selected' : ''}>🛵 Despachado</option>
              <option value="entregado" ${o.status === 'entregado' ? 'selected' : ''}>✅ Entregado</option>
            </select>
          </div>
        </div>
      `).join('');

    } catch (e) {
      console.warn('Error cargando pedidos:', e);
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      await fetch(`/api/seller/orders/${orderId}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      this.renderSellerOrders();
    } catch (e) {
      alert('Error actualizando estado del pedido');
    }
  }

  openAddProductModal() {
    if (window.adminManager && typeof window.adminManager.populateBusinessSelect === 'function') {
      window.adminManager.populateBusinessSelect();
    }
    // Seleccionar automáticamente el negocio actual en el select
    const sel = document.getElementById('prod-business');
    if (sel && this.currentBusiness) {
      sel.value = this.currentBusiness.id;
    }
    if (window.app && typeof window.app.openModal === 'function') {
      window.app.openModal('admin-product-modal');
    }
  }

  async editProductPrompt(productId, currentPrice) {
    const newPriceStr = prompt(`Ingrese el nuevo precio para el producto (actual: $${currentPrice}):`, currentPrice);
    if (!newPriceStr) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert('Precio inválido');
      return;
    }

    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ price: newPrice })
      });
      if (res.ok) {
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('✅ Precio actualizado correctamente');
        }
        this.renderSellerProducts();
      }
    } catch (e) {
      alert('Error actualizando precio');
    }
  }

  async deleteProduct(productId, name) {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${name}" del catálogo?`)) return;

    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast(`🗑️ "${name}" eliminado`);
        }
        this.renderSellerProducts();
      }
    } catch (e) {
      alert('Error eliminando producto');
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.seller-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.seller-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabName}`);
    });

    if (tabName === 'products') this.renderSellerProducts();
    if (tabName === 'orders') this.renderSellerOrders();
    if (tabName === 'coverage') this.initDashboardCoverageMap();
  }

  // ============================================================================
  // COBERTURA & RADIO DE ENTREGAS EN DASHBOARD
  // ============================================================================

  initDashboardCoverageMap() {
    const mapContainer = document.getElementById('dash-radius-map');
    if (!mapContainer || !window.L || !this.currentBusiness) return;

    this.dashLat = this.currentBusiness.lat !== undefined ? this.currentBusiness.lat : -34.5885;
    this.dashLng = this.currentBusiness.lng !== undefined ? this.currentBusiness.lng : -58.4285;
    this.dashRadius = this.currentBusiness.deliveryRadiusKm !== undefined ? this.currentBusiness.deliveryRadiusKm : 5.0;

    const addrInput = document.getElementById('dash-coverage-address');
    const neighInput = document.getElementById('dash-coverage-neighborhood');
    if (addrInput) addrInput.value = this.currentBusiness.address || '';
    if (neighInput) neighInput.value = this.currentBusiness.neighborhood || '';

    this.updateDashboardRadius(this.dashRadius);

    if (!this.dashMap) {
      this.dashMap = L.map('dash-radius-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([this.dashLat, this.dashLng], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(this.dashMap);

      const avatarEmoji = this.currentBusiness.avatar || '🍰';
      const customIcon = L.divIcon({
        className: 'custom-seller-map-pin',
        html: `<div class="custom-seller-pin"><span>${avatarEmoji}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
      });

      this.dashMarker = L.marker([this.dashLat, this.dashLng], {
        draggable: true,
        icon: customIcon
      }).addTo(this.dashMap);

      this.dashCircle = L.circle([this.dashLat, this.dashLng], {
        radius: this.dashRadius * 1000,
        color: '#D4AF37',
        weight: 2,
        fillColor: '#2A9D8F',
        fillOpacity: 0.25
      }).addTo(this.dashMap);

      this.dashMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        this.setDashboardCoords(pos.lat, pos.lng);
      });

      this.dashMap.on('click', (e) => {
        this.setDashboardCoords(e.latlng.lat, e.latlng.lng);
      });
    } else {
      this.dashMarker.setLatLng([this.dashLat, this.dashLng]);
      this.dashCircle.setLatLng([this.dashLat, this.dashLng]);
      this.dashCircle.setRadius(this.dashRadius * 1000);
      this.dashMap.setView([this.dashLat, this.dashLng], 13);
    }

    setTimeout(() => {
      if (this.dashMap) {
        this.dashMap.invalidateSize();
      }
    }, 200);
  }

  setDashboardCoords(lat, lng) {
    this.dashLat = parseFloat(lat.toFixed(5));
    this.dashLng = parseFloat(lng.toFixed(5));

    if (this.dashMarker) this.dashMarker.setLatLng([this.dashLat, this.dashLng]);
    if (this.dashCircle) this.dashCircle.setLatLng([this.dashLat, this.dashLng]);
  }

  updateDashboardRadius(km) {
    this.dashRadius = km;
    const slider = document.getElementById('dash-radius-slider');
    const valBadge = document.getElementById('dash-radius-val');

    if (slider) slider.value = km;
    if (valBadge) valBadge.textContent = `${km.toFixed(1)} km`;

    if (this.dashCircle) {
      this.dashCircle.setRadius(km * 1000);
    }

    document.querySelectorAll('#tab-pane-coverage .radius-chip').forEach(chip => {
      chip.classList.toggle('active', parseFloat(chip.textContent) === km);
    });
  }

  detectDashboardLocationGPS() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.setDashboardCoords(pos.coords.latitude, pos.coords.longitude);
        if (this.dashMap) {
          this.dashMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
        }
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('📍 Ubicación actualizada por GPS');
        }
      },
      (err) => {
        console.warn('GPS error:', err);
        alert('No se pudo obtener la ubicación GPS automáticamente. Puedes hacer clic en el mapa para marcar tu local.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async saveCoverageSettings() {
    if (!this.currentBusiness) return;

    const address = document.getElementById('dash-coverage-address')?.value.trim() || this.currentBusiness.address;
    const neighborhood = document.getElementById('dash-coverage-neighborhood')?.value.trim() || this.currentBusiness.neighborhood;
    const btn = document.getElementById('btn-save-dash-coverage');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando cobertura...';
    }

    const updates = {
      lat: this.dashLat,
      lng: this.dashLng,
      deliveryRadiusKm: this.dashRadius,
      address,
      neighborhood
    };

    try {
      const res = await fetch('/api/seller/profile', {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          businessId: this.currentBusiness.id,
          updates
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');

      this.currentBusiness = data.business;
      localStorage.setItem('godmarket_business', JSON.stringify(this.currentBusiness));

      // Actualizar en el catálogo en memoria de la app cliente
      if (window.productManager) {
        const existing = window.productManager.businesses.find(b => b.id === this.currentBusiness.id);
        if (existing) {
          Object.assign(existing, this.currentBusiness);
          window.productManager.saveBusinesses(window.productManager.businesses);
        }
      }

      this.renderDashboardHeader();

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(`✅ ¡Cobertura guardada! Radio: ${this.dashRadius} km`);
      }
    } catch (err) {
      console.error('Error guardando cobertura:', err);
      alert('Error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Cobertura de Envíos';
      }
    }
  }

  viewStoreAsCustomer() {
    this.showCustomerMarketplace();
    if (this.currentBusiness && window.app && typeof window.app.filterByBusiness === 'function') {
      window.app.filterByBusiness(this.currentBusiness.id);
      window.app.showToast(`👁️ Viendo cómo los clientes ven tu pastelería "${this.currentBusiness.name}"`);
    }
  }

  logout() {
    if (!confirm('¿Deseas cerrar la sesión de vendedor?')) return;
    localStorage.removeItem('godmarket_seller');
    localStorage.removeItem('godmarket_business');
    localStorage.removeItem('godmarket_seller_token');
    localStorage.setItem('godmarket_role', 'cliente');
    this.token = null;
    this.currentSeller = null;
    this.currentBusiness = null;
    this.showCustomerMarketplace();
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('👋 Sesión cerrada. Has vuelto a la tienda como cliente.');
    }
  }

  setupListeners() {
    const onboardingForm = document.getElementById('seller-onboarding-form');
    if (onboardingForm) {
      onboardingForm.addEventListener('submit', (e) => this.handleOnboardingSubmit(e));
    }

    // Navegación fluida por URL / Hash (#vendedor, /vendedor, popstate)
    window.addEventListener('hashchange', () => this.evaluateRolePresentation());
    window.addEventListener('popstate', () => this.evaluateRolePresentation());
  }
}

// Instancia global
window.sellerPortal = new SellerPortalManager();
