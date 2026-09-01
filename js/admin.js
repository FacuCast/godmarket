/**
 * DULCE ATELIER - PANEL DE ADMINISTRACIÓN DE PRODUCTOS Y CLOUDINARY
 */

class AdminManager {
  constructor() {
    this.selectedImageFile = null;
    this.initListeners();
  }

  initListeners() {
    // Configuración de formulario de producto
    const form = document.getElementById('add-product-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleProductSubmit(e));
    }

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

  async handleProductSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('prod-name');
    const priceInput = document.getElementById('prod-price');
    const descInput = document.getElementById('prod-desc');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    const description = descInput ? descInput.value.trim() : '';

    if (!name || name.length < 3) {
      window.app.showToast("⚠️ El nombre del pastel debe tener al menos 3 caracteres.");
      if (nameInput) nameInput.focus();
      return;
    }

    if (isNaN(price) || price <= 0) {
      window.app.showToast("⚠️ Ingresa un precio válido mayor a 0.");
      if (priceInput) priceInput.focus();
      return;
    }

    if (!description || description.length < 5) {
      window.app.showToast("⚠️ La descripción debe tener al menos 5 caracteres.");
      if (descInput) descInput.focus();
      return;
    }

    const submitBtn = document.getElementById('btn-save-product');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>⏳ Guardando y subiendo foto...</span>';
    submitBtn.disabled = true;

    try {
      let imageUrl = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80"; // Default cake
      
      if (this.selectedImageFile) {
        imageUrl = await window.cloudinaryService.uploadImage(this.selectedImageFile);
      }

      const category = document.getElementById('prod-category').value;
      const tag = document.getElementById('prod-tag').value.trim() || '✨ Nuevo';
      const portion = document.getElementById('prod-portion').value.trim() || '1 porción';

      const categoryNames = {
        tortas: 'Tortas Artesanales',
        desayunos: 'Desayunos & Meriendas',
        postres: 'Postres & Porciones'
      };

      const newProduct = {
        name,
        category,
        categoryName: categoryNames[category] || 'Pastelería',
        price,
        tag,
        portion,
        description,
        image: imageUrl
      };

      window.productManager.addProduct(newProduct);
      window.app.showToast(`✅ "${name}" agregado al menú`);
      window.app.renderProducts();
      window.app.closeModal('admin-product-modal');

      // Limpiar formulario
      document.getElementById('add-product-form').reset();
      this.selectedImageFile = null;
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
