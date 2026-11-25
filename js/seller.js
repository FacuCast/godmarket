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
    this.promoProgram = null;
    this.promoTickerInterval = null;
    this._lastRenderedPromoState = null;

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
        this.promoProgram = data.promoProgram || null;
        const demoButton = document.querySelector('.demo-login-btn');
        if (demoButton) demoButton.hidden = !data.demoLoginEnabled;
        this.updateFoundingPromoCallouts();
      }
    } catch (err) {
      console.warn('No se pudo conectar al backend para /api/config:', err.message);
    }
  }

  getStandardServiceFeePercent() {
    const configuredRate = Number(this.promoProgram && this.promoProgram.standardServiceFeeRate);
    return Math.round((Number.isFinite(configuredRate) ? configuredRate : 0.2) * 100);
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
    return headers;
  }

  escapeJSAttribute(value) {
    const encoded = JSON.stringify(String(value))
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return window.app.escapeHTML(encoded);
  }

  icon(name, size = 15, className = '') {
    return window.gmIcon ? window.gmIcon(name, className, size) : '';
  }

  avatarIcon(val, size = 20) {
    return window.gmAvatarIcon ? window.gmAvatarIcon(val, size) : '';
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
    } else {
      // Entrada directa a la vidriera sin modal bloqueante; los vendedores acceden desde el header o el hero.
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(this.onboardMap);

      const customIcon = L.divIcon({
        className: 'custom-seller-map-pin',
        html: `<div class="custom-seller-pin">${this.icon('store', 18)}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
      });

      this.onboardMarker = L.marker([this.onboardLat, this.onboardLng], {
        draggable: true,
        icon: customIcon
      }).addTo(this.onboardMap);

      this.onboardCircle = L.circle([this.onboardLat, this.onboardLng], {
        radius: this.onboardRadius * 1000,
        color: '#C8A96A',
        weight: 2,
        fillColor: '#4E9F77',
        fillOpacity: 0.22
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
          window.app.showToast('Ubicación fijada con éxito por GPS');
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
      window.app.showToast('Volviste a la tienda como cliente.');
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
    const sessionValid = await this.refreshSellerData();
    if (!sessionValid) return;
    this.renderDashboardHeader();
    this.renderPromoCountdownBanner(true);
    this.startPromoCountdownTicker();
    this.renderSellerProducts();
    this.renderSellerOrders();
  }

  // ============================================================================
  // GOOGLE IDENTITY SERVICES (GIS)
  // ============================================================================

  initGoogleIdentity() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      this.gisLoaded = true;
      const authScreen = document.getElementById('seller-auth-screen');
      if (authScreen && authScreen.classList.contains('active')) {
        this.renderGoogleSignInButton();
      }
    } else {
      // Reintentar si el script de Google carga con retraso
      const interval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          this.gisLoaded = true;
          const authScreen = document.getElementById('seller-auth-screen');
          if (authScreen && authScreen.classList.contains('active')) {
            this.renderGoogleSignInButton();
          }
          clearInterval(interval);
        }
      }, 300);
      setTimeout(() => clearInterval(interval), 6000);
    }
  }

  configureGis() {
    if (!this.gisLoaded || !window.google) return false;
    const clientId = (this.googleClientId || '').trim();
    if (!clientId) return false;
    if (this._gisInitialized) return true;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true
      });
      this._gisInitialized = true;
      return true;
    } catch (e) {
      console.warn('Aviso de Google Identity Services:', e.message);
      return false;
    }
  }

  renderGoogleSignInButton() {
    const container = document.getElementById('google-signin-btn-container');
    if (!container || !window.google || !this.gisLoaded || !(this.googleClientId || '').trim()) return;
    if (!this.configureGis()) return;

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
    const transferAlias = document.getElementById('onboard-transfer-alias')?.value.trim() || '';
    const transferAccountHolder = document.getElementById('onboard-transfer-holder')?.value.trim() || '';
    const avatar = document.getElementById('onboard-avatar')?.value || 'patisserie';

    const phoneDigits = phone ? phone.replace(/\D/g, '') : '';
    if (!bizName || phoneDigits.length < 8 || phoneDigits.length > 20) {
      alert('Completa el nombre del negocio y un WhatsApp de ventas válido (8 a 20 dígitos).');
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
      transferAlias,
      transferAccountHolder,
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
        headers: this.getAuthHeaders(),
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

      window.gmSound?.('success');
      this.showSellerDashboard();
    } catch (err) {
      console.error('Error al registrar negocio:', err);
      alert('Error: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear mi perfil de vendedor y empezar a vender';
      }
    }
  }

  // ============================================================================
  // DASHBOARD DEL VENDEDOR
  // ============================================================================

  async refreshSellerData() {
    if (!this.currentSeller) return false;
    try {
      const res = await fetch('/api/seller/me', {
        headers: this.getAuthHeaders()
      });
      if (res.status === 401 || res.status === 403) {
        this.clearSavedSession();
        this.showSellerAuthScreen();
        window.app?.showToast('Tu sesión de vendedor venció. Inicia sesión nuevamente.');
        return false;
      }
      if (!res.ok) throw new Error(`No se pudieron actualizar los datos (${res.status}).`);
      const data = await res.json();
      if (!data.seller || !data.business) {
        this.clearSavedSession();
        this.showSellerAuthScreen();
        return false;
      }
      this.currentBusiness = data.business;
      this.currentSeller = data.seller;
      localStorage.setItem('godmarket_seller', JSON.stringify(this.currentSeller));
      localStorage.setItem('godmarket_business', JSON.stringify(this.currentBusiness));
      return true;
    } catch (error) {
      console.warn('Error refrescando datos del vendedor:', error);
      window.app?.showToast('No se pudieron actualizar los datos del portal. Comprueba tu conexión.');
      return Boolean(this.currentSeller && this.currentBusiness);
    }
  }

  clearSavedSession() {
    localStorage.removeItem('godmarket_seller');
    localStorage.removeItem('godmarket_business');
    localStorage.removeItem('godmarket_seller_token');
    this.token = null;
    this.currentSeller = null;
    this.currentBusiness = null;
  }

  renderDashboardHeader() {
    if (!this.currentBusiness) return;
    const nameEl = document.getElementById('dash-biz-name');
    const avatarEl = document.getElementById('dash-biz-avatar');
    const zoneEl = document.getElementById('dash-biz-zone');
    const phoneEl = document.getElementById('dash-biz-phone');

    if (nameEl) nameEl.textContent = this.currentBusiness.name;
    if (avatarEl) avatarEl.innerHTML = this.avatarIcon(this.currentBusiness.avatar, 24);
    if (zoneEl) zoneEl.innerHTML = `${this.icon('map-pin', 14)} ${window.app.escapeHTML(this.currentBusiness.neighborhood || 'Buenos Aires')}`;
    if (phoneEl) phoneEl.innerHTML = `${this.icon('whatsapp', 14)} WhatsApp: ${window.app.escapeHTML(this.currentBusiness.phone || 'Sin configurar')}`;

    this.loadSellerVisitStats();
  }

  async loadSellerVisitStats() {
    if (!this.currentBusiness) return;
    const visitsEl = document.getElementById('stat-total-visits');
    if (!visitsEl) return;
    try {
      const res = await fetch(`/api/visits?businessId=${encodeURIComponent(this.currentBusiness.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      const total = Math.max(0, Number(data.total) || 0);
      const bizViews = Math.max(0, Number(data.businessVisits) || 0);
      visitsEl.textContent = total.toLocaleString('es-AR');
      visitsEl.title = `Visitas totales en la web: ${total.toLocaleString('es-AR')} · Hoy: ${(data.today || 0).toLocaleString('es-AR')} · Vistas de tu tienda: ${bizViews.toLocaleString('es-AR')}`;
    } catch (_) {}
  }

  async renderSellerProducts() {
    const container = document.getElementById('seller-products-list');
    if (!container || !this.currentBusiness) return;

    container.innerHTML = '<div style="color: #9AB0A3; padding: 20px;">Cargando tus productos...</div>';

    try {
      const res = await fetch(`/api/seller/products?businessId=${this.currentBusiness.id}`, {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error(`No se pudieron cargar los productos (${res.status}).`);
      const products = await res.json();

      const countEl = document.getElementById('stat-total-products');
      if (countEl) countEl.textContent = products.length;

      if (products.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); border: 1px dashed rgba(200,169,106,0.28); border-radius: 16px; padding: 40px 20px; text-align: center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:rgba(200,169,106,0.12);color:var(--primary);margin-bottom:12px;">${this.icon('cake', 24)}</div>
            <h4 style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 6px;">Aún no publicaste ningún producto</h4>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 400px; margin: 0 auto 18px auto;">Subí tus tortas, desayunos o meriendas con foto para que los clientes puedan pedirlas.</p>
            <button class="btn-add-prod" onclick="window.sellerPortal.openAddProductModal()">${this.icon('plus', 15)} Publicar mi primer producto</button>
          </div>
        `;
        return;
      }

      container.innerHTML = products.map(p => `
        <div class="seller-prod-card" id="seller-card-${window.app.escapeHTML(String(p.id))}">
          <div class="seller-prod-img-box">
            <img src="${window.app.escapeHTML(window.app.safeImageUrl(p.image))}" alt="${window.app.escapeHTML(p.name)}" loading="lazy">
            <span class="seller-prod-category-badge">${window.app.escapeHTML(p.categoryName || p.category)}</span>
          </div>
          <div class="seller-prod-body">
            <h4>${window.app.escapeHTML(p.name)}</h4>
            <p>${window.app.escapeHTML(p.description || 'Sin descripción')}</p>
            <div class="seller-prod-meta">
              <span class="seller-prod-price">$${Number(p.price).toLocaleString('es-AR')}</span>
              <span class="seller-prod-portion">${window.app.escapeHTML(p.portion || '1-2 personas')}</span>
            </div>
            <div class="seller-prod-actions">
              <button class="btn-card-edit" onclick="window.sellerPortal.editProductPrompt(${this.escapeJSAttribute(p.id)}, ${Number(p.price)})">${this.icon('edit', 14)} Cambiar precio</button>
              <button class="btn-card-delete" onclick="window.sellerPortal.deleteProduct(${this.escapeJSAttribute(p.id)}, ${this.escapeJSAttribute(p.name)})">${this.icon('trash', 14)} Eliminar</button>
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
      if (!res.ok) throw new Error(`No se pudieron cargar los pedidos (${res.status}).`);
      const orders = await res.json();

      const countEl = document.getElementById('stat-total-orders');
      if (countEl) countEl.textContent = orders.length;

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 14px; padding: 36px 20px; text-align: center; color: var(--text-muted);">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:rgba(200,169,106,0.1);color:var(--primary);margin-bottom:10px;">${this.icon('package', 22)}</div>
            <strong style="color: var(--text-main); display: block; margin-bottom: 4px;">Aún no tenés pedidos recibidos</strong>
            <span style="font-size: 0.84rem;">Cuando los clientes realicen pedidos a tu local, aparecerán acá con acceso directo a WhatsApp.</span>
          </div>
        `;
        return;
      }

      container.innerHTML = orders.map(o => {
        const servicePercent = this.getStandardServiceFeePercent();
        const safeOrderId = /^[A-Za-z0-9_-]{1,80}$/.test(String(o.id)) ? String(o.id) : '';
        const validOrderStatuses = ['pendiente', 'en_preparacion', 'despachado', 'entregado', 'en_disputa', 'reembolsado', 'disputa_cerrada'];
        const status = validOrderStatuses.includes(o.status)
          ? o.status
          : 'pendiente';
        const customerWaPhone = window.formatWhatsAppPhone
          ? window.formatWhatsAppPhone(o.customerPhone, '')
          : String(o.customerPhone || '').replace(/\D/g, '');
        const itemsMarkup = (Array.isArray(o.items) ? o.items : []).map(item => `
          <div style="margin-top: 5px;">
            <strong>${Number(item.quantity) || 0}x ${window.app.escapeHTML(item.product?.name || 'Producto')}</strong>
            ${item.customization?.flavor ? ` · Gusto: ${window.app.escapeHTML(item.customization.flavor)}` : ''}
            ${item.customization?.dedication ? ` · Dedicatoria: ${window.app.escapeHTML(item.customization.dedication)}` : ''}
            ${item.customization?.note ? ` · Nota: ${window.app.escapeHTML(item.customization.note)}` : ''}
            ${item.customization?.candle ? ' · Velita incluida' : ''}
          </div>
        `).join('');
        return `
        <div class="seller-order-card">
          <div class="seller-order-header">
            <div>
              <strong style="color: #FFF; font-size: 0.95rem;">Pedido #${window.app.escapeHTML(String(o.id))}</strong>
              <div style="font-size: 0.76rem; color: #8CA093;">${window.app.escapeHTML(new Date(o.createdAt).toLocaleString('es-AR'))}</div>
            </div>
            <span class="status-badge status-${status}">${window.app.escapeHTML(status)}</span>
          </div>

          <div style="font-size: 0.85rem; color: #E5EBE7; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px;">
            <strong>Cliente:</strong> ${window.app.escapeHTML(o.customerName || 'Cliente')} (${window.app.escapeHTML(o.customerPhone || 'Sin tel')})<br>
            <strong>Entrega:</strong> ${window.app.escapeHTML(o.deliveryType || 'delivery')} — ${window.app.escapeHTML(o.customerAddress || o.address || 'Buenos Aires')}<br>
            ${o.deliveryTime ? `<strong>Horario solicitado:</strong> ${window.app.escapeHTML(o.deliveryTime)}<br>` : ''}
            ${o.comments ? `<strong>Indicaciones:</strong> ${window.app.escapeHTML(o.comments)}<br>` : ''}
            <strong>Productos:</strong>${itemsMarkup || ' Sin detalle'}<br>
            <strong>Total abonado por comprador:</strong> <span style="color: var(--primary); font-weight: 700;">$${Number(o.total || 0).toLocaleString('es-AR')}</span>
            ${o.isPromoOrder || (Number(o.serviceFee || 0) === 0 && Number(o.waivedServiceFee || 0) > 0)
              ? `<div style="margin-top: 4px; font-size: 0.78rem; color: var(--success); font-weight: 600;">Mes bonificado activo: 0% cargo de servicio (recibís el 100% de tu precio habitual · ahorro comprador: $${Number(o.waivedServiceFee || 0).toLocaleString('es-AR')})</div>`
              : (Number(o.serviceFee || 0) > 0
                ? `<div style="margin-top: 4px; font-size: 0.78rem; color: var(--text-muted);">Neto de tu local (100% precio habitual + envío): <strong style="color:var(--text-main);">$${Number(o.merchantPayout || (Number(o.total || 0) - Number(o.serviceFee || 0))).toLocaleString('es-AR')}</strong> · Servicio GOD MARKET (${servicePercent}%): $${Number(o.serviceFee).toLocaleString('es-AR')}</div>`
                : '')}
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
            ${customerWaPhone ? `
              <a href="https://wa.me/${customerWaPhone}?text=Hola%20${encodeURIComponent(o.customerName || '')},%20somos%20${encodeURIComponent(this.currentBusiness.name)}%20de%20GOD%20MARKET%20por%20tu%20pedido%20%23${encodeURIComponent(safeOrderId)}" target="_blank" rel="noopener noreferrer" class="seller-action-pill" style="background: rgba(104, 185, 142, 0.14); border-color: rgba(104, 185, 142, 0.34); color: var(--success);">
                ${this.icon('whatsapp', 14)} Escribir por WhatsApp
              </a>
            ` : ''}

            ${safeOrderId ? `
              <select onchange="window.sellerPortal.updateOrderStatus(${this.escapeJSAttribute(safeOrderId)}, this.value)" style="background: rgba(0,0,0,0.35); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; font-size: 0.8rem;">
                <option value="pendiente" ${status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="en_preparacion" ${status === 'en_preparacion' ? 'selected' : ''}>En preparación</option>
                <option value="despachado" ${status === 'despachado' ? 'selected' : ''}>Despachado</option>
                <option value="entregado" ${status === 'entregado' ? 'selected' : ''}>Entregado</option>
                ${status === 'en_disputa' ? '<option value="en_disputa" selected>En disputa</option>' : ''}
                ${status === 'reembolsado' ? '<option value="reembolsado" selected>Reembolsado</option>' : ''}
                ${status === 'disputa_cerrada' ? '<option value="disputa_cerrada" selected>Disputa cerrada</option>' : ''}
              </select>
            ` : '<span>Pedido sin identificador válido</span>'}
          </div>
        </div>
      `;
      }).join('');

    } catch (e) {
      container.innerHTML = '<div style="color: #F87171;">No se pudieron cargar los pedidos. Comprueba tu conexión e inténtalo nuevamente.</div>';
      console.warn('Error cargando pedidos:', e);
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el estado del pedido.');
      window.gmSound?.('success');
      this.renderSellerOrders();
    } catch (error) {
      alert(error.message || 'Error actualizando estado del pedido');
      this.renderSellerOrders();
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
    const priceHint = document.getElementById('prod-price-promo-hint');
    if (priceHint && this.currentBusiness) {
      const servicePercent = this.getStandardServiceFeePercent();
      const pState = window.productManager && typeof window.productManager.getBusinessPromoState === 'function'
        ? window.productManager.getBusinessPromoState(this.currentBusiness)
        : { isPromoActive: Boolean(this.currentBusiness.isPromoActive), promoState: this.currentBusiness.promoState };
      if (pState.isPromoActive) {
        priceHint.style.color = 'var(--success)';
        priceHint.innerHTML = pState.promoState === 'pending_first_product'
          ? '<strong>Este primer producto activará tus 30 días bonificados.</strong> Cargá el mismo precio habitual de tu cafetería: tus clientes comprarán con 0% de cargo de servicio.'
          : `<strong>Mes Lanzamiento activo (0% servicio):</strong> cargá el mismo precio habitual de tu cafetería. El comprador paga exactamente este precio sin el ${servicePercent}% adicional.`;
      } else {
        priceHint.style.color = 'var(--text-muted)';
        priceHint.innerHTML = `Cargá el precio habitual de tu cafetería (recibís el 100% de este valor). El ${servicePercent}% de servicio de GOD MARKET se adiciona al comprador en el carrito.`;
      }
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
        if (window.productManager) {
          window.productManager.updateProduct?.(productId, { price: newPrice });
          window.productManager.syncWithBackend?.();
        }
        if (window.app && typeof window.app.showToast === 'function') {
          window.gmSound?.('success');
          window.app.showToast('Precio actualizado correctamente');
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
        if (window.productManager) {
          window.productManager.deleteProduct?.(productId);
          window.productManager.syncWithBackend?.();
        }
        if (window.app && typeof window.app.showToast === 'function') {
          window.gmSound?.('remove');
          window.app.showToast(`"${name}" eliminado del catálogo`);
        }
        this.renderSellerProducts();
      }
    } catch (e) {
      alert('Error eliminando producto');
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    window.gmSound?.('tap');
    document.querySelectorAll('.seller-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.seller-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabName}`);
    });

    if (tabName === 'products') this.renderSellerProducts();
    if (tabName === 'orders') this.renderSellerOrders();
    if (tabName === 'coverage') this.initDashboardCoverageMap();
    if (tabName === 'promo') this.loadPromoAdmin();
    if (tabName === 'disputes') this.loadDisputes();
  }

  // ============================================================================
  // COBERTURA & RADIO DE ENTREGAS EN DASHBOARD
  // ============================================================================

  initDashboardCoverageMap() {
    const mapContainer = document.getElementById('dash-radius-map');
    if (!mapContainer || !this.currentBusiness) return;

    this.dashLat = this.currentBusiness.lat !== undefined ? this.currentBusiness.lat : -34.5885;
    this.dashLng = this.currentBusiness.lng !== undefined ? this.currentBusiness.lng : -58.4285;
    this.dashRadius = this.currentBusiness.deliveryRadiusKm !== undefined ? this.currentBusiness.deliveryRadiusKm : 5.0;

    const addrInput = document.getElementById('dash-coverage-address');
    const neighInput = document.getElementById('dash-coverage-neighborhood');
    if (addrInput) addrInput.value = this.currentBusiness.address || '';
    if (neighInput) neighInput.value = this.currentBusiness.neighborhood || '';
    const transferAliasInput = document.getElementById('dash-transfer-alias');
    const transferHolderInput = document.getElementById('dash-transfer-holder');
    if (transferAliasInput) transferAliasInput.value = this.currentBusiness.transferAlias || '';
    if (transferHolderInput) transferHolderInput.value = this.currentBusiness.transferAccountHolder || '';
    const phoneInput = document.getElementById('dash-coverage-phone');
    const deliveryFeeInput = document.getElementById('dash-coverage-delivery-fee');
    const scheduleInput = document.getElementById('dash-coverage-schedule');
    if (phoneInput) phoneInput.value = this.currentBusiness.phone || '';
    if (deliveryFeeInput) deliveryFeeInput.value = this.currentBusiness.deliveryFee !== undefined ? this.currentBusiness.deliveryFee : 1500;
    if (scheduleInput) scheduleInput.value = this.currentBusiness.schedule || '08:30 a 20:00 hs';

    this.updateDashboardRadius(this.dashRadius);
    if (!window.L) return;

    if (!this.dashMap) {
      this.dashMap = L.map('dash-radius-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([this.dashLat, this.dashLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(this.dashMap);

      const customIcon = L.divIcon({
        className: 'custom-seller-map-pin',
        html: `<div class="custom-seller-pin">${this.avatarIcon(this.currentBusiness.avatar, 18)}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
      });

      this.dashMarker = L.marker([this.dashLat, this.dashLng], {
        draggable: true,
        icon: customIcon
      }).addTo(this.dashMap);

      this.dashCircle = L.circle([this.dashLat, this.dashLng], {
        radius: this.dashRadius * 1000,
        color: '#C8A96A',
        weight: 2,
        fillColor: '#4E9F77',
        fillOpacity: 0.22
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
          window.app.showToast('Ubicación actualizada por GPS');
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
    const transferAlias = document.getElementById('dash-transfer-alias')?.value.trim() || '';
    const transferAccountHolder = document.getElementById('dash-transfer-holder')?.value.trim() || '';
    const phoneVal = document.getElementById('dash-coverage-phone')?.value.trim() || this.currentBusiness.phone || '';
    const feeRaw = document.getElementById('dash-coverage-delivery-fee')?.value;
    const deliveryFee = feeRaw !== undefined && feeRaw !== '' && Number.isFinite(Number(feeRaw))
      ? Math.max(0, Number(feeRaw))
      : (this.currentBusiness.deliveryFee !== undefined ? this.currentBusiness.deliveryFee : 1500);
    const schedule = document.getElementById('dash-coverage-schedule')?.value.trim() || this.currentBusiness.schedule || '08:30 a 20:00 hs';
    const btn = document.getElementById('btn-save-dash-coverage');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando datos...';
    }

    const updates = {
      lat: this.dashLat,
      lng: this.dashLng,
      deliveryRadiusKm: this.dashRadius,
      address,
      neighborhood,
      transferAlias,
      transferAccountHolder,
      phone: phoneVal,
      deliveryFee,
      schedule
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
        window.productManager.syncWithBackend?.();
      }

      this.renderDashboardHeader();

      if (window.app && typeof window.app.showToast === 'function') {
        window.gmSound?.('success');
        window.app.showToast(`Cobertura guardada · Radio de envío: ${this.dashRadius} km`);
      }
    } catch (err) {
      console.error('Error guardando cobertura:', err);
      alert('Error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar cobertura y pagos';
      }
    }
  }

  viewStoreAsCustomer() {
    this.showCustomerMarketplace();
    if (this.currentBusiness && window.app) {
      if (typeof window.app.setBusiness === 'function') {
        window.app.setBusiness(this.currentBusiness.id);
      } else if (typeof window.app.filterByBusiness === 'function') {
        window.app.filterByBusiness(this.currentBusiness.id);
      }
      window.app.showToast(`Viendo tu vidriera "${this.currentBusiness.name}" como cliente`);
    }
  }

  logout() {
    if (!confirm('¿Deseas cerrar la sesión de vendedor?')) return;
    this.clearSavedSession();
    localStorage.setItem('godmarket_role', 'cliente');
    this.showCustomerMarketplace();
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Sesión cerrada. Volviste a la tienda como cliente.');
    }
  }


  // ────────────────────────────────────────────────────────────
  // PROGRAMA COMERCIOS FUNDADORES: MINUTERO 30 DÍAS & PANEL ADMIN
  // ────────────────────────────────────────────────────────────

  updateFoundingPromoCallouts() {
    const authBanner = document.getElementById('promo-slots-auth-banner');
    const onboardBanner = document.getElementById('promo-slots-onboard-banner');
    const p = this.promoProgram;

    if (!p || !p.enabled || p.remainingSlots <= 0) {
      if (authBanner) authBanner.style.display = 'none';
      if (onboardBanner) onboardBanner.style.display = 'none';
      return;
    }

    const days = Number(p.promoDurationDays) || 30;
    const slotsLabel = `BENEFICIO COMERCIO FUNDADOR · QUEDAN ${p.remainingSlots} DE ${p.maxPromoBusinesses} CUPOS`;

    if (authBanner) {
      authBanner.style.display = 'block';
      const badge = authBanner.querySelector('.founding-promo-badge');
      if (badge) badge.textContent = slotsLabel;
    }
    if (onboardBanner) {
      onboardBanner.style.display = 'block';
      const badge = onboardBanner.querySelector('.founding-promo-badge');
      if (badge) badge.textContent = `${slotsLabel} (${days} DÍAS 0% SERVICIO)`;
    }
  }

  getLiveCurrentBusinessPromoState() {
    if (!this.currentBusiness) return null;
    if (window.productManager && typeof window.productManager.getBusinessPromoState === 'function') {
      return window.productManager.getBusinessPromoState(this.currentBusiness);
    }
    const expMs = this.currentBusiness.promoExpiresAt ? new Date(this.currentBusiness.promoExpiresAt).getTime() : 0;
    const msRemaining = expMs ? Math.max(0, expMs - Date.now()) : 0;
    return {
      promoEligible: Boolean(this.currentBusiness.promoEligible),
      promoState: !this.currentBusiness.promoEligible
        ? 'standard'
        : (!this.currentBusiness.promoStartedAt ? 'pending_first_product' : (msRemaining > 0 ? 'active' : 'expired')),
      isPromoActive: Boolean(this.currentBusiness.promoEligible && (!this.currentBusiness.promoStartedAt || msRemaining > 0)),
      promoDurationDays: Number(this.currentBusiness.promoDurationDays) || 30,
      promoStartedAt: this.currentBusiness.promoStartedAt || null,
      promoExpiresAt: this.currentBusiness.promoExpiresAt || null,
      promoMsRemaining: msRemaining
    };
  }

  formatDurationParts(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  }

  startPromoCountdownTicker() {
    if (this.promoTickerInterval) {
      clearInterval(this.promoTickerInterval);
    }
    this.promoTickerInterval = setInterval(() => {
      const portal = document.getElementById('seller-portal-view');
      if (!portal || !portal.classList.contains('active')) return;
      this.renderPromoCountdownBanner(false);
    }, 1000);
  }

  renderPromoCountdownBanner(forceFullRender = false) {
    const banner = document.getElementById('seller-promo-timer-banner');
    if (!banner || !this.currentBusiness) return;

    const state = this.getLiveCurrentBusinessPromoState();
    if (!state) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'block';
    const durationDays = Number(state.promoDurationDays) || 30;
    const totalMs = durationDays * 24 * 60 * 60 * 1000;

    // Si ya está renderizado en modo 'active' y no pedimos full render, solo actualizamos los números del minutero sin parpadeo
    if (!forceFullRender && state.promoState === 'active' && this._lastRenderedPromoState === 'active') {
      const parts = this.formatDurationParts(state.promoMsRemaining);
      const dEl = document.getElementById('promo-cd-days');
      const hEl = document.getElementById('promo-cd-hours');
      const mEl = document.getElementById('promo-cd-mins');
      const sEl = document.getElementById('promo-cd-secs');
      const barEl = document.getElementById('promo-cd-progress-fill');
      if (dEl && hEl && mEl && sEl) {
        dEl.textContent = parts.days;
        hEl.textContent = parts.hours;
        mEl.textContent = parts.minutes;
        sEl.textContent = parts.seconds;
        if (barEl) {
          const pct = Math.max(2, Math.min(100, (state.promoMsRemaining / totalMs) * 100));
          barEl.style.width = pct.toFixed(1) + '%';
        }
        return;
      }
    }

    this._lastRenderedPromoState = state.promoState;

    if (state.promoState === 'pending_first_product') {
      const slotInfo = this.currentBusiness.promoSlotNumber ? ` · Comercio Fundador #${this.currentBusiness.promoSlotNumber}` : '';
      const servicePercent = this.getStandardServiceFeePercent();
      banner.className = 'seller-promo-timer-banner state-pending';
      banner.innerHTML = `
        <div class="promo-timer-top">
          <div>
            <span class="promo-timer-pill pending">${this.icon('award', 13)} MES BONIFICADO LISTO PARA ACTIVAR${slotInfo}</span>
            <h4 class="promo-timer-heading">${durationDays} días completos con 0% Cargo de Servicio (${servicePercent}% bonificado para tus clientes)</h4>
            <p class="promo-timer-desc">
              <strong>No perdés ni un solo día por registrarte antes:</strong> tu reloj de ${durationDays} días queda en pausa y <strong>comienza recién cuando subís tu primer producto con foto</strong>. Publicá tus productos al mismo precio habitual de tu local.
            </p>
          </div>
          <div class="promo-countdown-boxes paused" title="El reloj comenzará cuando publiques tu 1° producto">
            <div class="cd-box"><span>${String(durationDays).padStart(2, '0')}</span><small>DÍAS</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span>00</span><small>HS</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span>00</span><small>MIN</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span>00</span><small>SEG</small></div>
          </div>
        </div>
        <div class="promo-timer-actions">
          <button type="button" class="btn-activate-promo-upload" onclick="window.sellerPortal.openAddProductModal()">
            ${this.icon('upload', 15)} Subir mi 1° producto con foto y activar los ${durationDays} días
          </button>
        </div>
      `;
      return;
    }

    if (state.promoState === 'active') {
      const parts = this.formatDurationParts(state.promoMsRemaining);
      const servicePercent = this.getStandardServiceFeePercent();
      const pct = Math.max(2, Math.min(100, (state.promoMsRemaining / totalMs) * 100));
      const expStr = state.promoExpiresAt
        ? new Date(state.promoExpiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        : '';
      const slotInfo = this.currentBusiness.promoSlotNumber ? ` · Comercio Fundador #${this.currentBusiness.promoSlotNumber}` : '';

      banner.className = 'seller-promo-timer-banner state-active';
      banner.innerHTML = `
        <div class="promo-timer-top">
          <div>
            <span class="promo-timer-pill active">${this.icon('clock', 13)} MES LANZAMIENTO EN CURSO · 0% SERVICIO${slotInfo}</span>
            <h4 class="promo-timer-heading">Tus clientes compran al mismo precio habitual de tu local</h4>
            <p class="promo-timer-desc">
              El cargo por servicio del <strong>${servicePercent}% de GOD MARKET está 100% bonificado ($0)</strong> para tus compradores${expStr ? ` hasta el <strong>${window.app.escapeHTML(expStr)}</strong>` : ''}. Aprovechá para difundir tu tienda y sumar ventas sin recargos.
            </p>
          </div>
          <div class="promo-countdown-boxes live">
            <div class="cd-box"><span id="promo-cd-days">${parts.days}</span><small>DÍAS</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span id="promo-cd-hours">${parts.hours}</span><small>HS</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span id="promo-cd-mins">${parts.minutes}</span><small>MIN</small></div>
            <div class="cd-sep">:</div>
            <div class="cd-box"><span id="promo-cd-secs">${parts.seconds}</span><small>SEG</small></div>
          </div>
        </div>
        <div class="promo-progress-track">
          <div id="promo-cd-progress-fill" class="promo-progress-fill" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
      `;
      return;
    }

    // Estado estándar o promoción finalizada luego de los 30 días
    const servicePercent = this.getStandardServiceFeePercent();
    banner.className = 'seller-promo-timer-banner state-standard';
    banner.innerHTML = `
      <div class="promo-timer-top">
        <div>
          <span class="promo-timer-pill standard">MODALIDAD ESTÁNDAR GOD MARKET ACTIVA</span>
          <h4 class="promo-timer-heading">${state.promoState === 'expired' ? 'Período promocional de 30 días completado' : 'Precios habituales de local protegidos'}</h4>
          <p class="promo-timer-desc">
            Seguís cobrando el <strong>100% del precio habitual</strong> publicado en tus productos. El cargo de servicio del <strong>${servicePercent}% de GOD MARKET</strong> es abonado directamente por el comprador al finalizar su pedido.
          </p>
        </div>
      </div>
    `;
  }

  async loadPromoAdmin() {
    const container = document.getElementById('promo-admin-container');
    if (!container) return;

    let adminToken = this.getAdminToken();
    if (!adminToken) {
      const token = prompt('Ingresá el token de administrador de GOD MARKET para gestionar los cupos y los 30 días:');
      if (!token) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Ingresá tu token de administrador haciendo clic en "Actualizar panel".</div>';
        return;
      }
      localStorage.setItem('godmarket_admin_token', token);
      adminToken = token;
    }

    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Cargando panel de cafeterías fundadoras...</div>';

    try {
      const res = await fetch('/api/admin/promo', {
        headers: { 'x-admin-token': adminToken }
      });

      if (res.status === 403) {
        localStorage.removeItem('godmarket_admin_token');
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger);">Token de administrador incorrecto. Presioná "Actualizar panel" para reintentar.</div>';
        return;
      }

      const data = await res.json();
      this.renderPromoAdminPanel(data);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger);">Error de conexión al cargar el panel de promociones.</div>';
    }
  }

  renderPromoAdminPanel(data) {
    const container = document.getElementById('promo-admin-container');
    if (!container || !data) return;

    const settings = data.settings || { enabled: true, maxPromoBusinesses: 5, promoDurationDays: 30 };
    const configuredRate = Number(settings.standardServiceFeeRate);
    const servicePercent = Math.round((Number.isFinite(configuredRate) ? configuredRate : 0.2) * 100);
    const businesses = Array.isArray(data.businesses) ? data.businesses : [];
    const totalProducts = businesses.reduce((sum, b) => sum + (b.productsCount || 0), 0);
    const totalOrders = businesses.reduce((sum, b) => sum + (b.ordersCount || 0), 0);

    const bizCardsHtml = businesses.length === 0
      ? `<div style="text-align:center;padding:32px;background:var(--bg-surface);border-radius:16px;border:1px dashed var(--border-color);color:var(--text-muted);">Aún no hay cafeterías registradas. Las primeras <strong>${settings.maxPromoBusinesses}</strong> cafeterías recibirán automáticamente sus <strong>${settings.promoDurationDays} días sin el ${servicePercent}% de servicio</strong> al registrarse y subir su primera foto.</div>`
      : businesses.map(b => {
          let badgeHtml = `<span class="dispute-status-badge" style="background:rgba(255,255,255,0.06);color:var(--text-muted);">Estándar (${servicePercent}% al comprador)</span>`;
          let timerDetail = `El comprador abona el ${servicePercent}% de servicio GOD MARKET.`;

          if (b.promoState === 'pending_first_product') {
            badgeHtml = '<span class="dispute-status-badge" style="background:rgba(217,155,82,0.14);color:var(--warning);border:1px solid rgba(217,155,82,0.3);">Esperando 1° foto (' + (b.promoDurationDays || 30) + 'd listos)</span>';
            timerDetail = 'Registrado como fundador. Los 30 días arrancarán cuando suba su primer producto.';
          } else if (b.promoState === 'active') {
            const parts = this.formatDurationParts(b.promoMsRemaining || 0);
            badgeHtml = '<span class="dispute-status-badge" style="background:rgba(104,185,142,0.14);color:var(--success);border:1px solid rgba(104,185,142,0.3);">0% servicio · Quedan ' + parts.days + 'd ' + parts.hours + 'h ' + parts.minutes + 'm</span>';
            const expDate = b.promoExpiresAt ? new Date(b.promoExpiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            timerDetail = `Vence el ${expDate} · Luego pasa automáticamente al ${servicePercent}% de servicio.`;
          } else if (b.promoState === 'expired') {
            badgeHtml = `<span class="dispute-status-badge" style="background:rgba(223,107,99,0.12);color:var(--danger);border:1px solid rgba(223,107,99,0.28);">30 días finalizados (${servicePercent}% activo)</span>`;
            timerDetail = `Completó su primer mes bonificado. Ahora opera con el ${servicePercent}% estándar.`;
          }

          return `
            <div class="dispute-card">
              <div class="dispute-card-header">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:rgba(200,169,106,0.1);color:var(--primary);">${this.avatarIcon(b.avatar, 18)}</span>
                  <div>
                    <strong style="color:var(--text-main);font-size:0.95rem;">${window.app.escapeHTML(b.name)}</strong>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${window.app.escapeHTML(b.neighborhood || 'CABA')} · ${b.productsCount || 0} productos · ${b.ordersCount || 0} pedidos</div>
                  </div>
                </div>
                ${badgeHtml}
              </div>
              <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">
                ${timerDetail}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="dispute-refund-btn" style="padding:7px 12px;border-radius:9px;font-size:0.78rem;font-weight:600;cursor:pointer;"
                  onclick="window.sellerPortal.updateBusinessPromoAdmin(${this.escapeJSAttribute(b.id)}, 'start_30d')">
                  Activar / reiniciar 30 días
                </button>
                <button type="button" class="dispute-mark-btn" style="padding:7px 12px;border-radius:9px;font-size:0.78rem;font-weight:600;cursor:pointer;"
                  onclick="window.sellerPortal.updateBusinessPromoAdmin(${this.escapeJSAttribute(b.id)}, 'pending_first_product')">
                  Esperar 1° producto (30d intactos)
                </button>
                <button type="button" class="dispute-filter-btn" style="padding:7px 12px;border-radius:9px;font-size:0.78rem;font-weight:600;cursor:pointer;"
                  onclick="window.sellerPortal.updateBusinessPromoAdmin(${this.escapeJSAttribute(b.id)}, 'extend_15d')">
                  + Sumar 15 días
                </button>
                <button type="button" class="dispute-reject-btn" style="padding:7px 12px;border-radius:9px;font-size:0.78rem;font-weight:600;cursor:pointer;"
                  onclick="window.sellerPortal.updateBusinessPromoAdmin(${this.escapeJSAttribute(b.id)}, 'end_promo')">
                  Pasar a ${servicePercent}% estándar
                </button>
              </div>
            </div>
          `;
        }).join('');

    container.innerHTML = `
      <!-- Métricas de Tracción para Venta Comercial a Otras Cafeterías -->
      <div class="promo-admin-metrics-grid">
        <div class="promo-metric-card">
          <span class="promo-metric-val">${businesses.length}</span>
          <span class="promo-metric-lbl">Cafeterías activas</span>
        </div>
        <div class="promo-metric-card">
          <span class="promo-metric-val" style="color:var(--success);">${data.usedSlots} / ${settings.maxPromoBusinesses}</span>
          <span class="promo-metric-lbl">Cupos fundadores usados</span>
        </div>
        <div class="promo-metric-card">
          <span class="promo-metric-val">${totalProducts}</span>
          <span class="promo-metric-lbl">Productos en carta</span>
        </div>
        <div class="promo-metric-card">
          <span class="promo-metric-val" style="color:var(--primary);">${totalOrders}</span>
          <span class="promo-metric-lbl">Pedidos generados</span>
        </div>
      </div>

      <!-- Configuración de Cupos (3 o 5 Cafeterías Fundadoras) -->
      <div class="dispute-card" style="margin-bottom: 18px; border-color: rgba(200,169,106,0.28);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div>
            <h4 style="color:var(--text-main);font-size:1rem;margin-bottom:2px;">Cupos de cafeterías con 1er mes sin el ${servicePercent}% de servicio</h4>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Elegí cuántas cafeterías entran automáticamente con 30 días al 0% (quedan <strong>${data.remainingSlots}</strong> cupos libres).</p>
          </div>
          <label style="display:inline-flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text-main);cursor:pointer;font-weight:600;">
            <input type="checkbox" id="admin-promo-enabled" ${settings.enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);" onchange="window.sellerPortal.savePromoSettingsAdmin()">
            Asignación automática activa
          </label>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button type="button" class="dispute-filter-btn ${settings.maxPromoBusinesses === 3 ? 'active' : ''}" onclick="window.sellerPortal.setPromoMaxQuick(3)">3 cafeterías</button>
          <button type="button" class="dispute-filter-btn ${settings.maxPromoBusinesses === 5 ? 'active' : ''}" onclick="window.sellerPortal.setPromoMaxQuick(5)">5 cafeterías</button>
          <button type="button" class="dispute-filter-btn ${settings.maxPromoBusinesses === 10 ? 'active' : ''}" onclick="window.sellerPortal.setPromoMaxQuick(10)">10 cafeterías</button>
          <div style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;">
            <span style="font-size:0.78rem;color:var(--text-muted);">Cupos:</span>
            <input type="number" id="admin-promo-max-input" value="${settings.maxPromoBusinesses}" min="0" max="500" style="width:68px;background:var(--bg-elevated);border:1px solid var(--border-color);color:var(--text-main);border-radius:8px;padding:6px 8px;font-size:0.84rem;">
            <span style="font-size:0.78rem;color:var(--text-muted);">Días:</span>
            <input type="number" id="admin-promo-days-input" value="${settings.promoDurationDays || 30}" min="1" max="365" style="width:68px;background:var(--bg-elevated);border:1px solid var(--border-color);color:var(--text-main);border-radius:8px;padding:6px 8px;font-size:0.84rem;">
            <button type="button" class="btn-add-prod" style="padding:7px 14px;font-size:0.8rem;" onclick="window.sellerPortal.savePromoSettingsAdmin()">Guardar</button>
          </div>
        </div>
      </div>

      <h4 style="color:var(--text-main);font-size:0.95rem;margin-bottom:10px;">Estado del minutero de 30 días por cafetería</h4>
      <div>${bizCardsHtml}</div>
    `;
  }

  async setPromoMaxQuick(maxCount) {
    const input = document.getElementById('admin-promo-max-input');
    if (input) input.value = maxCount;
    await this.savePromoSettingsAdmin();
  }

  async savePromoSettingsAdmin() {
    const enabled = document.getElementById('admin-promo-enabled')?.checked ?? true;
    const maxPromoBusinesses = parseInt(document.getElementById('admin-promo-max-input')?.value || '5', 10);
    const promoDurationDays = parseInt(document.getElementById('admin-promo-days-input')?.value || '30', 10);

    try {
      const res = await fetch('/api/admin/promo/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': this.getAdminToken()
        },
        body: JSON.stringify({ enabled, maxPromoBusinesses, promoDurationDays })
      });
      if (res.ok) {
        if (window.app) window.app.showToast(`Cupos actualizados: ${maxPromoBusinesses} cafeterías (${promoDurationDays} días a 0%)`);
        await this.loadConfig();
        await this.loadPromoAdmin();
      }
    } catch (e) {
      if (window.app) window.app.showToast('Error guardando configuración de cupos', 'error');
    }
  }

  async updateBusinessPromoAdmin(businessId, action) {
    try {
      const res = await fetch('/api/admin/promo/business/' + encodeURIComponent(businessId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': this.getAdminToken()
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (this.currentBusiness && this.currentBusiness.id === businessId) {
          this.currentBusiness = data.business;
          localStorage.setItem('godmarket_business', JSON.stringify(data.business));
          this.renderPromoCountdownBanner(true);
        }
        if (window.productManager) {
          window.productManager.syncWithBackend();
        }
        if (window.app) window.app.showToast('Estado promocional de la cafetería actualizado');
        await this.loadPromoAdmin();
      } else {
        if (window.app) window.app.showToast(data.error || 'No se pudo actualizar', 'error');
      }
    } catch (e) {
      if (window.app) window.app.showToast('Error de conexión', 'error');
    }
  }

  // ────────────────────────────────────────────────────────────
  // CENTRO DE AYUDA — PANEL DE DISPUTAS (SOLO ADMIN/FAKU)
  // ────────────────────────────────────────────────────────────

  getAdminToken() {
    return localStorage.getItem('godmarket_admin_token') || '';
  }

  async loadDisputes() {
    const disputesList = document.getElementById('disputes-list');
    if (!disputesList) return;

    const adminToken = this.getAdminToken();
    if (!adminToken) {
      // Pedir token de admin
      const token = prompt('Ingresá el token de administrador de GOD MARKET:');
      if (!token) return;
      localStorage.setItem('godmarket_admin_token', token);
    }

    disputesList.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Cargando disputas...</div>';

    try {
      const res = await fetch('/api/admin/disputes', {
        headers: {
          'x-admin-token': localStorage.getItem('godmarket_admin_token') || ''
        }
      });

      if (res.status === 403) {
        localStorage.removeItem('godmarket_admin_token');
        disputesList.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger);">Token incorrecto. Intentá de nuevo.</div>';
        return;
      }

      const disputes = await res.json();
      this._allDisputes = disputes;
      this.renderDisputesList(disputes);

      // Actualizar badge en la pestaña
      const openCount = disputes.filter(d => d.status === 'abierta' || d.status === 'en_revision').length;
      const badge = document.getElementById('disputes-badge');
      if (badge) {
        badge.style.display = openCount > 0 ? 'inline-flex' : 'none';
        badge.textContent = openCount > 9 ? '9+' : String(openCount);
      }
    } catch (err) {
      disputesList.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger);">Error al cargar. Verificá la conexión.</div>';
    }
  }

  filterDisputes(filter, btn) {
    document.querySelectorAll('.dispute-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const all = this._allDisputes || [];
    const filtered = filter === 'all' ? all : all.filter(d => d.status === filter);
    this.renderDisputesList(filtered);
  }

  renderDisputesList(disputes) {
    const disputesList = document.getElementById('disputes-list');
    if (!disputesList) return;

    if (!disputes || disputes.length === 0) {
      disputesList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.9rem;">No hay disputas en este estado.</div>';
      return;
    }

    const statusLabel = {
      abierta: { label: 'Abierta', color: '#DF6B63' },
      en_revision: { label: 'En revisión', color: '#D99B52' },
      reembolsada: { label: 'Reembolsada', color: '#68B98E' },
      rechazada: { label: 'Rechazada', color: '#8FA398' }
    };

    const reasonLabel = {
      no_response: 'Local no respondió',
      wrong_order: 'Pedido incorrecto',
      quality_issue: 'Problema de calidad',
      cancellation_revocation: 'Arrepentimiento de compra (Ley 24.240)',
      arrepentimiento: 'Arrepentimiento de compra (Ley 24.240)',
      other: 'Otro motivo'
    };

    const esc = (val) => window.app && typeof window.app.escapeHTML === 'function'
      ? window.app.escapeHTML(String(val || ''))
      : String(val || '');

    disputesList.innerHTML = disputes.map(d => {
      const st = statusLabel[d.status] || { label: esc(d.status), color: '#8FA398' };
      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'N/A';
      const canResolve = d.status === 'abierta' || d.status === 'en_revision';

      return `
        <div class="dispute-card" id="dispute-${esc(d.id)}">
          <div class="dispute-card-header">
            <div>
              <span class="dispute-id">${esc(d.id)}</span>
              <span class="dispute-order-ref">Pedido #${esc(d.orderId)}</span>
            </div>
            <span class="dispute-status-badge" style="background: ${st.color}20; color: ${st.color}; border: 1px solid ${st.color}40;">${st.label}</span>
          </div>

          <div class="dispute-card-body">
            <div class="dispute-info-row">
              <span class="dispute-info-label">Comprador:</span>
              <span>${esc(d.customerName || 'N/A')}${d.customerPhone ? ' · +' + esc(d.customerPhone) : ''}</span>
            </div>
            <div class="dispute-info-row">
              <span class="dispute-info-label">Total:</span>
              <span style="color: var(--primary); font-weight: 700;">$${Number(d.total || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="dispute-info-row">
              <span class="dispute-info-label">Motivo:</span>
              <span>${esc(reasonLabel[d.reason] || d.reason)}</span>
            </div>
            <div class="dispute-info-row">
              <span class="dispute-info-label">Fecha:</span>
              <span>${esc(dateStr)}</span>
            </div>
            ${d.resolutionNote ? `<div class="dispute-info-row"><span class="dispute-info-label">Nota:</span><span>${esc(d.resolutionNote)}</span></div>` : ''}
          </div>

          ${canResolve ? `
          <div class="dispute-card-actions">
            <button class="dispute-contact-btn" onclick="window.sellerPortal.contactDisputeCustomer(${this.escapeJSAttribute(d.customerPhone || '')}, ${this.escapeJSAttribute(d.orderId || '')})">
              ${this.icon('whatsapp', 14)} Contactar por WA
            </button>
            <button class="dispute-mark-btn" onclick="window.sellerPortal.openResolveDispute(${this.escapeJSAttribute(d.id || '')}, 'en_revision')">
              Marcar en revisión
            </button>
            <button class="dispute-refund-btn" onclick="window.sellerPortal.openResolveDispute(${this.escapeJSAttribute(d.id || '')}, 'reembolso')">
              Aprobar reembolso
            </button>
            <button class="dispute-reject-btn" onclick="window.sellerPortal.openResolveDispute(${this.escapeJSAttribute(d.id || '')}, 'rechazo')">
              Rechazar
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  contactDisputeCustomer(phone, orderId) {
    if (!phone) {
      window.app.showToast('No hay número de WhatsApp para este comprador', 'warning');
      return;
    }
    const normalizedPhone = window.formatWhatsAppPhone
      ? window.formatWhatsAppPhone(phone, '')
      : ('549' + String(phone).replace(/\D/g, '').replace(/^549?/, ''));
    const text = 'Hola! Te contactamos desde GOD MARKET respecto a tu disputa por el pedido #' + orderId + '. Estamos revisando tu caso. En breve te informamos la resolucion. Gracias por tu paciencia!';
    const url = 'https://api.whatsapp.com/send?phone=' + normalizedPhone + '&text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }

  async openResolveDispute(disputeId, resolution) {
    let note = '';

    if (resolution === 'reembolso') {
      note = prompt('Aprobar reembolso — ingresá una nota (opcional, ej: "Reembolso aprobado, el local no confirmó"):') || '';
    } else if (resolution === 'rechazo') {
      note = prompt('Rechazar disputa — ingresá el motivo del rechazo:') || '';
      if (!note) {
        window.app.showToast('Debes ingresar un motivo para rechazar la disputa', 'warning');
        return;
      }
    } else if (resolution === 'en_revision') {
      note = 'En revisión por GOD MARKET';
    }

    const confirmMsg = resolution === 'reembolso'
      ? '¿Confirmas que se aprueba el REEMBOLSO para esta disputa?'
      : resolution === 'rechazo'
        ? '¿Confirmas que se RECHAZA esta disputa?'
        : '¿Marcar como "en revisión"?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/disputes/' + encodeURIComponent(disputeId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('godmarket_admin_token') || ''
        },
        body: JSON.stringify({ resolution, resolutionNote: note })
      });

      const data = await res.json();
      if (data.success) {
        const labels = {
          reembolso: 'Reembolso aprobado',
          rechazo: 'Disputa rechazada',
          en_revision: 'Marcada en revisión'
        };
        window.app.showToast(labels[resolution] || 'Disputa actualizada');
        this.loadDisputes(); // Recargar
      } else {
        window.app.showToast(data.error || 'Error al resolver la disputa', 'error');
      }
    } catch (err) {
      window.app.showToast('Error de conexión al resolver la disputa', 'error');
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
