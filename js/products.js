/**
 * DULCE ATELIER - CATÁLOGO DE PRODUCTOS
 * Contiene el catálogo completo de delicias artesanales y la sincronización con LocalStorage / Cloudinary
 */

const INITIAL_PRODUCTS = [
  // ==========================================
  // --- 1. TORTAS & PASTELES ARTESANALES ---
  // ==========================================
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
  {
    id: "torta-chocotorta-deluxe",
    name: "Chocotorta Clásica Argentina",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 18900,
    tag: "⭐ Favorita",
    rating: 5.0,
    reviews: 154,
    description: "Capas de galletitas Chocolinas embebidas en café suave con el balance perfecto de dulce de leche repostero colonial y queso crema, decorada con rulos de chocolate y bombones.",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    portion: "10 a 12 porciones",
    featured: true
  },
  {
    id: "torta-havannet-chocolate",
    name: "Tarta Havannet & Ganache Belga",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 16800,
    tag: "🍫 Puro DDL & Choco",
    rating: 4.9,
    reviews: 97,
    description: "Base crocante de masa sablée de cacao amargo, generosa montaña de dulce de leche repostero y baño satinado de ganache de chocolate semiamargo.",
    image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80",
    portion: "8 a 10 porciones",
    featured: true
  },
  {
    id: "torta-rogel-artesanal",
    name: "Torta Rogel Tradicional con Merengue",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 17500,
    tag: "👑 Clásico Criollo",
    rating: 4.8,
    reviews: 83,
    description: "Ocho finísimas y crujientes capas de masa de hojaldre casera intercaladas con puro dulce de leche repostero, coronada con abundante merengue italiano flameado.",
    image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=800&q=80",
    portion: "10 a 12 porciones",
    featured: true
  },
  {
    id: "torta-carrot-cake-supreme",
    name: "Carrot Cake & Frosting de Mascarpone",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 17200,
    tag: "🥕 Especiada & Húmeda",
    rating: 4.9,
    reviews: 104,
    description: "Bizcocho súper húmedo de zanahorias tiernas, nueces tostadas y toque sutil de canela, relleno y cubierto con crema de queso mascarpone y lluvia de nueces pecanas.",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
    portion: "8 a 10 porciones",
    featured: true
  },
  {
    id: "torta-tarta-frutillas",
    name: "Tarta de Frutillas con Pastelera",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 16500,
    tag: "🍓 Frescura Natural",
    rating: 4.9,
    reviews: 115,
    description: "Masa sablée perfumada a la vainilla bourbon, suave crema pastelera casera y abundante corona de frutillas frescas de estación con brillo pastelero.",
    image: "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=800&q=80",
    portion: "8 porciones",
    featured: true
  },
  {
    id: "torta-balcarce-artesanal",
    name: "Torta Balcarce Clásica",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 18200,
    tag: "🌰 Tradición",
    rating: 4.8,
    reviews: 67,
    description: "Pionono esponjoso, merenguitos secos crocantes, dulce de leche, crema chantilly, castañas en almíbar y suave lluvia de coco tostado.",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80",
    portion: "10 a 12 porciones",
    featured: true
  },
  {
    id: "torta-mousse-tres-chocolates",
    name: "Torta Mousse Tres Chocolates",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 19400,
    tag: "🍫 100% Cacao",
    rating: 5.0,
    reviews: 89,
    description: "Tres capas de suave mousse aireada: chocolate negro al 70%, chocolate con leche y chocolate blanco sobre base crocante de cookies de chocolate.",
    image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80",
    portion: "8 a 10 porciones",
    featured: true
  },
  {
    id: "torta-selva-negra-kirsch",
    name: "Torta Selva Negra con Cerezas",
    category: "tortas",
    categoryName: "Tortas Artesanales",
    price: 18700,
    tag: "🍒 Clásico Europeo",
    rating: 4.9,
    reviews: 76,
    description: "Bizcochuelo de chocolate húmedo embebido en almíbar de licor de cerezas, relleno de crema chantilly, compota artesanal de cerezas y rulos de chocolate belga.",
    image: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=800&q=80",
    portion: "10 a 12 porciones",
    featured: true
  },

  // ==========================================
  // --- 2. DESAYUNOS & MERIENDAS COMPLETOS ---
  // ==========================================
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
  {
    id: "desayuno-brunch-gourmet",
    name: "Box Brunch Dulce & Salado",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 25900,
    tag: "🥑 Brunch Completo",
    rating: 5.0,
    reviews: 112,
    description: "Croissants rellenos de jamón crudo y rúcula, mini quiche de queso y espinaca, yogurt parfait con frutos secos, mini carrot cake, tostadas de masa madre y jugo natural.",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "desayuno-box-aniversario",
    name: "Box Romántico 'Aniversario & Amor'",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 27500,
    tag: "❤️ Romántico",
    rating: 5.0,
    reviews: 88,
    description: "Taza personalizada, bento cake especial 'Te Amo', bombones belgas artesanales, mini espumante, sándwiches en pan brioche y mini bouquet de flores secas.",
    image: "https://images.unsplash.com/photo-1516054575922-f0b8eeadec1a?auto=format&fit=crop&w=800&q=80",
    portion: "Box especial para 2",
    featured: true
  },
  {
    id: "desayuno-box-coffee-specialty",
    name: "Box Cafetería de Especialidad en Casa",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 22800,
    tag: "☕ Coffee Lovers",
    rating: 4.9,
    reviews: 95,
    description: "Drip coffee blend de especialidad tostado fresco, cookies estilo NY rellenas, pain au chocolat hojaldrado, scone de queso parmesano y tazón de cerámica artesanal.",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "desayuno-box-kids-festejo",
    name: "Box Merienda Infantil de Festejo",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 20900,
    tag: "🎉 Para Niños",
    rating: 4.8,
    reviews: 63,
    description: "Donas glaseadas de colores, cupcakes temáticos con dulce de leche, alfajorcitos de maicena con granas, chocolatada artesanal y jugo de naranja exprimido.",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 niños",
    featured: true
  },
  {
    id: "desayuno-box-chocolate-lover",
    name: "Box Despertar 'Chocolate Lover'",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 23400,
    tag: "🍫 Full Chocolate",
    rating: 4.9,
    reviews: 78,
    description: "Submarino con barrita de chocolate artesanal, alfajores de brownie con DDL, cookies doble chocolate, muffin con corazón de Nutella y wafle belga con miel.",
    image: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "desayuno-box-matero-criollo",
    name: "Box Merienda Matera Tradicional",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 19800,
    tag: "🧉 100% Argentino",
    rating: 4.9,
    reviews: 130,
    description: "Yerba mate premium orgánica, bizcochitos de grasa caseros, tortitas negras, cañoncitos de hojaldre con dulce de leche, chipá calentito recién horneado y mate artesanal.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    portion: "Para compartir en familia",
    featured: true
  },
  {
    id: "desayuno-box-degustacion-mini",
    name: "Box Degustación de Mini Tartas (x 6)",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 21500,
    tag: "🧁 Mini Variedad",
    rating: 4.8,
    reviews: 92,
    description: "6 mini tartitas individuales: lemon pie, cabsha con chocolate y DDL, toffee de nuez, tarta frutal con pastelera, crumble de manzana y cheesecake de frutos rojos.",
    image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 o 3 personas",
    featured: true
  },
  {
    id: "desayuno-box-picnic-primavera",
    name: "Box Picnic & Tarde al Aire Libre",
    category: "desayunos",
    categoryName: "Desayunos & Meriendas",
    price: 26400,
    tag: "🧺 Para Compartir",
    rating: 4.9,
    reviews: 54,
    description: "Termo de café frío infusionado, sándwiches ciabatta de jamón cocido natural y queso danbo, mini budines cítricos, alfajores de nuez y mantelito para picnic.",
    image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },

  // ==========================================
  // --- 3. POSTRES & PORCIONES INDIVIDUALES ---
  // ==========================================
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
  },
  {
    id: "postre-ny-roll-nutella",
    name: "New York Roll relleno de Nutella",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 5600,
    tag: "🥐 Viral & Crocante",
    rating: 5.0,
    reviews: 145,
    description: "Masa de hojaldre circular súper aireada y crocante, rellena hasta el centro de Nutella cremosa y bañada en chocolate con avellanas tostadas.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    portion: "1 unidad grande",
    featured: true
  },
  {
    id: "postre-tiramisu-italiano",
    name: "Tiramisú Tradicional al Café y Mascarpone",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 6200,
    tag: "🇮🇹 Receta Italiana",
    rating: 4.9,
    reviews: 119,
    description: "Vainillas artesanales embebidas en espresso intenso y licor de café, crema sabayón a base de queso mascarpone y lluvia de cacao amargo.",
    image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80",
    portion: "Copa individual 220g",
    featured: true
  },
  {
    id: "postre-cookies-ny-box",
    name: "Cookies New York Style Rellenas (Caja x 4)",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 7800,
    tag: "🍪 Centro Húmedo",
    rating: 4.9,
    reviews: 160,
    description: "Caja de 4 cookies gigantes estilo Levain Bakery: Red Velvet con chocolate blanco, Chispas clásicas semi-amargas, Doble chocolate fudge y Nuez con dulce de leche.",
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    portion: "4 cookies gigantes (120g c/u)",
    featured: true
  },
  {
    id: "postre-bento-cake-individual",
    name: "Mini Cake Bento de Regalo",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 9200,
    tag: "🎂 Bento Trend",
    rating: 5.0,
    reviews: 104,
    description: "Mini tortita de 10 cm ideal para regalo individual, bizcochuelo húmedo relleno de dulce de leche y merengue, decorada a mano en cajita eco take-away.",
    image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80",
    portion: "1 a 2 porciones",
    featured: true
  },
  {
    id: "postre-eclair-chocolate",
    name: "Éclair de Chocolate Belga & Pastelera",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 4900,
    tag: "🇫🇷 Pâtisserie",
    rating: 4.8,
    reviews: 58,
    description: "Masa choux clásica dorada y crocante, rellena de abundante crema pastelera a la vainilla natural y glaseada con ganache brillante de chocolate al 60%.",
    image: "https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&w=800&q=80",
    portion: "1 unidad grande",
    featured: true
  },
  {
    id: "postre-apple-crumble",
    name: "Crumble de Manzanas Tibio & Canela",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 5400,
    tag: "🍏 Casero",
    rating: 4.9,
    reviews: 72,
    description: "Colchón de manzanas caramelizadas con manteca, azúcar morena y canela, cubierto por una capa extra crocante de crumble de manteca y avena tostada.",
    image: "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=800&q=80",
    portion: "Porción individual generosa",
    featured: true
  },
  {
    id: "postre-medialunas-rellenas-box",
    name: "Medialunas de Manteca con DDL (x 6)",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 6900,
    tag: "🥐 Clásico Porteño",
    rating: 4.9,
    reviews: 185,
    description: "Media docena de medialunas de manteca hojaldradas, almibaradas y rellenas con generoso dulce de leche repostero colonial.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    portion: "Caja de 6 unidades",
    featured: true
  },
  {
    id: "postre-brownie-fudgy-ddl",
    name: "Brownie con Nuez, DDL & Merengue",
    category: "postres",
    categoryName: "Postres & Porciones",
    price: 5100,
    tag: "🍫 Puro Placer",
    rating: 5.0,
    reviews: 140,
    description: "Cuadrado de brownie húmedo y fudgy repleto de nueces mariposa, copo gigante de dulce de leche repostero y merengue italiano flameado.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
    portion: "1 porción cuadrada generosa",
    featured: true
  }
];

// Almacenamiento local para permitir agregar nuevos productos dinámicamente
const STORAGE_KEY = 'dulce_atelier_products_v2';

class ProductManager {
  constructor() {
    this.products = this.loadProducts();
  }

  loadProducts() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Si hay datos guardados y tienen al menos la cantidad de productos actuales, usarlos
        if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
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
