/**
 * DULCE ATELIER - CATÁLOGO DE PRODUCTOS
 * Contiene los productos iniciales y la sincronización con LocalStorage / Cloudinary
 */

const INITIAL_PRODUCTS = [
  // --- 1. TORTAS CLÁSICAS & ARTESANALES ---
  {
    id: "torta-red-velvet",
    name: "Torta Red Velvet Supreme",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 18500,
    tag: "⭐ Más Pedido",
    rating: 4.9,
    reviews: 128,
    description: "Bizcochuelo terciopelo rojo húmedo relleno con suave frosting de queso crema Philadelphia y frutos rojos frescos.",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80",
    portion: "8 a 10 porciones",
    featured: true
  },
  {
    id: "torta-marquise-ddl",
    name: "Marquise de Chocolate & DDL",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 19800,
    tag: "🍫 Puro Chocolate",
    rating: 5.0,
    reviews: 94,
    description: "Base húmeda de puro chocolate semiamargo, abundante dulce de leche repostero, crema chantilly y rulos de chocolate.",
    image: "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80",
    portion: "10 a 12 porciones",
    featured: true
  },
  {
    id: "torta-cheesecake-frutos",
    name: "Cheesecake New York & Frutos Rojos",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 17900,
    tag: "🍓 Clásico",
    rating: 4.8,
    reviews: 86,
    description: "El auténtico cheesecake horneado estilo New York sobre crocante base de galletitas y coulis casero de frambuesas y moras.",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
    portion: "8 a 10 porciones",
    featured: true
  },
  {
    id: "torta-lemon-pie",
    name: "Lemon Pie Gourmet con Merengue",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 15400,
    tag: "🍋 Cítrico Fresco",
    rating: 4.9,
    reviews: 110,
    description: "Masa sablée crocante, curd cremoso de limones seleccionados y suave merengue italiano flameado.",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80",
    portion: "8 porciones",
    featured: true
  },

  // --- 2. DESAYUNOS & MERIENDAS COMPLETOS ---
  {
    id: "desayuno-premium-box",
    name: "Box Desayuno 'Despertar Dulce'",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 24500,
    tag: "🎁 Ideal Regalo",
    rating: 5.0,
    reviews: 164,
    description: "Taza artesanal, café en saquitos blend, medialunas rellenas, sándwich de jamón crudo y queso brie, mini cake a elección y jugo de naranja exprimido.",
    image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "desayuno-box-cumple",
    name: "Box Cumpleaños Feliz & Velita",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 26800,
    tag: "🎂 Especial Cumple",
    rating: 4.9,
    reviews: 98,
    description: "Bento cake personalizada, macarons surtidos, cookies con chips de chocolate, croissant relleno, velita mágica y tarjeta dedicatoria.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    portion: "Box completo de festejo",
    featured: true
  },
  {
    id: "merienda-tea-time",
    name: "Afternoon Tea Box Parisino",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 21900,
    tag: "☕ Momento Té",
    rating: 4.8,
    reviews: 52,
    description: "Scones ingleses con mermelada y queso crema, alfajorcitos de maicena caseros, mini roll de canela glaseado y té en hebras premium.",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    portion: "Para compartir",
    featured: true
  },
  {
    id: "desayuno-healthy-fit",
    name: "Desayuno Vitality & Frutas",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 19500,
    tag: "🌱 Saludable & Fresco",
    rating: 4.9,
    reviews: 41,
    description: "Bowl de yogur griego con granola casera y frutos rojos, avocado toast en pan de masa madre, mini budín integral y limonada con menta.",
    image: "https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?auto=format&fit=crop&w=800&q=80",
    portion: "1 persona",
    featured: true
  },

  // --- 3. PORCIONES & POSTRES INDIVIDUALES ---
  {
    id: "postre-croissant-pistacho",
    name: "Croissant Relleno Crema de Pistacho",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 5200,
    tag: "✨ Tendencia",
    rating: 4.9,
    reviews: 87,
    description: "Croissant 100% manteca de hojaldre francés relleno con suave crema pastelera de pistachos y lluvia de praliné.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    portion: "1 unidad grande",
    featured: true
  },
  {
    id: "postre-cinnamon-roll",
    name: "Cinnamon Roll Glaseado Clásico",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 4300,
    tag: "🔥 Tibio & Esponjoso",
    rating: 4.8,
    reviews: 105,
    description: "Roll de canela recién horneado con abundante canela de Ceilán y baño de glaseado cremoso de vainilla.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    portion: "1 porción",
    featured: true
  },
  {
    id: "postre-macarons-box",
    name: "Caja de 6 Macarons Franceses",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 8900,
    tag: "🎨 Variedad",
    rating: 5.0,
    reviews: 73,
    description: "Selección de macarons: Pistacho, Frambuesa, Chocolate Belga, Caramelo Salado, Vainilla de Madagascar y Maracuyá.",
    image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=800&q=80",
    portion: "Caja de 6 unidades",
    featured: true
  },
  {
    id: "postre-alfajores-artesanales",
    name: "Trilogía de Alfajores Premium",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 6400,
    tag: "🇦🇷 Artesanal",
    rating: 4.9,
    reviews: 91,
    description: "3 alfajores artesanales: 1 de masa de nuez con dulce de leche, 1 bañado en chocolate amargo al 70% y 1 blanco con frambuesas.",
    image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
    portion: "3 unidades",
    featured: true
  }
];

// Almacenamiento local para permitir agregar nuevos productos dinámicamente
const STORAGE_KEY = 'dulce_atelier_products_v1';

class ProductManager {
  constructor() {
    this.products = this.loadProducts();
  }

  loadProducts() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error al leer productos del almacenamiento:", e);
      }
    }
    this.saveProducts(INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  }

  saveProducts(products) {
    this.products = products;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }

  getAll() {
    return this.products;
  }

  getById(id) {
    return this.products.find(p => p.id === id);
  }

  getByCategory(category) {
    if (category === 'todos' || !category) return this.products;
    return this.products.filter(p => p.category === category);
  }

  search(query) {
    if (!query) return this.products;
    const q = query.toLowerCase().trim();
    return this.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      (p.tag && p.tag.toLowerCase().includes(q))
    );
  }

  addProduct(newProduct) {
    const product = {
      id: 'prod-' + Date.now(),
      rating: 5.0,
      reviews: 1,
      featured: true,
      ...newProduct
    };
    const updated = [product, ...this.products];
    this.saveProducts(updated);
    return product;
  }

  deleteProduct(id) {
    const updated = this.products.filter(p => p.id !== id);
    this.saveProducts(updated);
    return updated;
  }
}

// Instancia global accesible
window.productManager = new ProductManager();
