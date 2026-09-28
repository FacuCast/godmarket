/**
 * DULCE MARKET - PORTAL DE PUBLICACIÓN PARA NEGOCIOS Y PASTELERÍAS
 * Permite que los negocios publiquen nuevos desayunos, meriendas o boxes en el Marketplace
 */

class AdminManager {
  constructor() {
    this.selectedImageFile = null;
    this.selectedPresetImage = "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80";
    this.initListeners();
  }

  initListeners() {
    const form = document.getElementById('add-product-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleProductSubmit(e));
    }

    // Selector de Negocio
    const businessSelect = document.getElementById('prod-business');
    const newBusinessFields = document.getElementById('new-business-fields');
    if (businessSelect && newBusinessFields) {
      businessSelect.addEventListener('change', (e) => {
        newBusinessFields.style.display = (e.target.value === 'new_business') ? 'grid' : 'none';
      });
    }

    // Presets de imágenes de desayunos/meriendas
    document.querySelectorAll('.preset-img-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-img-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const imgUrl = chip.dataset.img;
        this.selectedPresetImage = imgUrl;
        this.selectedImageFile = null;

        const previewImg = document.getElementById('upload-preview-img');
        const uploadBox = document.getElementById('cloudinary-upload-box');
        if (previewImg && uploadBox) {
          previewImg.src = imgUrl;
          previewImg.style.display = 'block';
          uploadBox.querySelector('.upload-prompt')?.classList.add('hidden');
        }
      });
    });

    // Input de archivo de imagen
    const fileInput = document.getElementById('product-image-input');
    const uploadBox = document.getElementById('cloudinary-upload-box');
    const previewImg = document.getElementById('upload-preview-img');

    if (uploadBox && fileInput) {
      uploadBox.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.selectedImageFile = file;
          this.selectedPresetImage = null;
          document.querySelectorAll('.preset-img-chip').forEach(c => c.classList.remove('active'));

          const reader = new FileReader();
          reader.onload = (event) => {
            if (previewImg) {
              previewImg.src = event.target.result;
              previewImg.style.display = 'block';
            }
            uploadBox.querySelector('.upload-prompt')?.classList.add('hidden');
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Formulario de credenciales de Cloudinary
    const cloudinaryForm = document.getElementById('cloudinary-config-form');
    if (cloudinaryForm) {
      cloudinaryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cloudName = document.getElementById('cfg-cloud-name').value;
        const uploadPreset = document.getElementById('cfg-upload-preset').value;
        window.cloudinaryService.saveConfig(cloudName, uploadPreset);
        window.app.showToast("☁️ Configuración de Cloudinary guardada");
        window.app.closeModal('cloudinary-modal');
      });
    }
  }

  populateBusinessSelect() {
    const select = document.getElementById('prod-business');
    if (!select) return;

    const businesses = window.productManager.getAllBusinesses();
    let options = businesses.map(b => `
      <option value="${b.id}">${b.avatar} ${b.name} (${b.neighborhood})</option>
    `).join('');

    options += `<option value="new_business">➕ Registrar un nuevo negocio...</option>`;
    select.innerHTML = options;
  }

  async handleProductSubmit(e) {
    e.preventDefault();

    const businessSelect = document.getElementById('prod-business');
    const nameInput = document.getElementById('prod-name');
    const priceInput = document.getElementById('prod-price');
    const descInput = document.getElementById('prod-desc');

    const businessVal = businessSelect ? businessSelect.value : 'dulce-atelier';
    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    const description = descInput ? descInput.value.trim() : '';

    if (!name || name.length < 3) {
      window.app.showToast("⚠️ El título del desayuno o merienda debe tener al menos 3 caracteres.");
      if (nameInput) nameInput.focus();
      return;
    }

    if (isNaN(price) || price <= 0) {
      window.app.showToast("⚠️ Ingresa un precio válido en pesos argentinos.");
      if (priceInput) priceInput.focus();
      return;
    }

    if (!description || description.length < 5) {
      window.app.showToast("⚠️ La descripción debe tener al menos 5 caracteres.");
      if (descInput) descInput.focus();
      return;
    }

    // Determinar negocio
    let targetBusinessId = businessVal;
    let targetBusinessName = "Dulce Atelier";
    let targetBusinessNeighborhood = "Palermo";
    let targetBusinessAvatar = "🏪";

    if (businessVal === 'new_business') {
      const newNameInput = document.getElementById('new-biz-name');
      const newZoneInput = document.getElementById('new-biz-neighborhood');
      const newName = newNameInput ? newNameInput.value.trim() : '';
      const newZone = newZoneInput ? newZoneInput.value.trim() : 'CABA';

      if (!newName || newName.length < 2) {
        window.app.showToast("⚠️ Ingresa el nombre de la nueva pastelería.");
        if (newNameInput) newNameInput.focus();
        return;
      }

      const created = window.productManager.addBusiness({
        name: newName,
        neighborhood: newZone,
        tagline: "Pastelería & Cafetería Artesanal",
        avatar: "🏪",
        badge: "✨ Nuevo en el Market"
      });

      targetBusinessId = created.id;
      targetBusinessName = created.name;
      targetBusinessNeighborhood = created.neighborhood;
      targetBusinessAvatar = created.avatar;
    } else {
      const bObj = window.productManager.getBusinessById(businessVal);
      if (bObj) {
        targetBusinessId = bObj.id;
        targetBusinessName = bObj.name;
        targetBusinessNeighborhood = bObj.neighborhood;
        targetBusinessAvatar = bObj.avatar;
      }
    }

    const submitBtn = document.getElementById('btn-save-product');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>⏳ Publicando en el Marketplace...</span>';
    submitBtn.disabled = true;

    try {
      let imageUrl = this.selectedPresetImage || "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80";
      
      if (this.selectedImageFile) {
        imageUrl = await window.cloudinaryService.uploadImage(this.selectedImageFile);
      }

      const category = document.getElementById('prod-category').value;
      const tag = document.getElementById('prod-tag').value.trim() || '✨ Nuevo en Market';
      const portion = document.getElementById('prod-portion').value.trim() || 'Para 1 o 2 personas';

      const categoryNames = {
        desayunos: 'Desayunos Sorpresa',
        meriendas: 'Meriendas & Té',
        brunch: 'Brunch & Salado',
        boxes: 'Boxes de Regalo'
      };

      const newProduct = {
        name,
        businessId: targetBusinessId,
        businessName: targetBusinessName,
        businessNeighborhood: targetBusinessNeighborhood,
        businessAvatar: targetBusinessAvatar,
        category,
        categoryName: categoryNames[category] || 'Desayuno Artesanal',
        price,
        tag,
        portion,
        description,
        image: imageUrl
      };

      window.productManager.addProduct(newProduct);
      window.app.showToast(`✅ "${name}" publicado por ${targetBusinessName}`);
      window.app.renderBusinessesSlider();
      window.app.renderProducts();
      window.app.closeModal('admin-product-modal');

      // Limpiar formulario
      document.getElementById('add-product-form').reset();
      this.selectedImageFile = null;
      this.selectedPresetImage = "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80";
      const previewImg = document.getElementById('upload-preview-img');
      if (previewImg) previewImg.style.display = 'none';
      document.querySelector('.upload-prompt')?.classList.remove('hidden');

    } catch (error) {
      console.error("Error al guardar producto:", error);
      window.app.showToast("❌ Ocurrió un error al guardar el producto");
    } finally {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  }

  openCloudinarySettings() {
    const cfg = window.cloudinaryService.config;
    const nameInput = document.getElementById('cfg-cloud-name');
    const presetInput = document.getElementById('cfg-upload-preset');
    if (nameInput) nameInput.value = cfg.cloudName || '';
    if (presetInput) presetInput.value = cfg.uploadPreset || '';
    window.app.openModal('cloudinary-modal');
  }
}

// Instancia global
window.adminManager = new AdminManager();
