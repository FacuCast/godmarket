/**
 * DULCE MARKET - MARKETPLACE DE DESAYUNOS & MERIENDAS ARTESANALES
 * Catálogo de 7 negocios/pastelerías asociados y gestión local simulada (Mock State & LocalStorage)
 */

// ============================================================================
// 1. LOS 7 NEGOCIOS / PASTELERÍAS ASOCIADAS AL MARKETPLACE
// ============================================================================
const INITIAL_BUSINESSES = [
  {
    id: "dulce-atelier",
    name: "Dulce Atelier",
    tagline: "Pastelería de Autor & Boxes Románticos",
    neighborhood: "Palermo Hollywood",
    rating: 4.9,
    reviews: 184,
    deliveryTime: "35-50 min",
    deliveryFee: 1500,
    freeShippingFrom: 45000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Cadete propio del local con caja térmica",
    distance: "1.1 km",
    isOpen: true,
    schedule: "08:30 - 20:00 hs",
    avatar: "🍰",
    badge: "⭐ Destacado",
    cover: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Humboldt 1950, Palermo",
    verified: true,
    description: "Especialistas en pastelería fina, tortas húmedas, desayunos gourmet sorpresa y packaging de lujo."
  },
  {
    id: "la-petite-croissant",
    name: "La Petite Croissant",
    tagline: "Boulangerie & Croissanterie Francesa",
    neighborhood: "Recoleta",
    rating: 5.0,
    reviews: 215,
    deliveryTime: "30-45 min",
    deliveryFee: 1500,
    freeShippingFrom: 45000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Reparto inmediato en moto del local",
    distance: "1.4 km",
    isOpen: true,
    schedule: "08:00 - 19:30 hs",
    avatar: "🥐",
    badge: "🇫🇷 Tradición Francesa",
    cover: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Av. Alvear 1750, Recoleta",
    verified: true,
    description: "Auténtica manteca francesa, hojaldres crujientes horneados al amanecer, pain au chocolat y café de especialidad."
  },
  {
    id: "cafe-botanica",
    name: "Café & Botánica",
    tagline: "Brunch Saludable, Bowls & Cold Brew",
    neighborhood: "Belgrano R",
    rating: 4.8,
    reviews: 142,
    deliveryTime: "25-40 min",
    deliveryFee: 1400,
    freeShippingFrom: 40000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Reparto ecológico en bici/moto rápida",
    distance: "2.3 km",
    isOpen: true,
    schedule: "09:00 - 20:00 hs",
    avatar: "🥑",
    badge: "🌿 Opciones Saludables",
    cover: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Echeverría 3120, Belgrano",
    verified: true,
    description: "Ingredientes orgánicos, panes de masa madre, tostones con palta, huevos de campo y meriendas llenas de energía."
  },
  {
    id: "antojos-del-sur",
    name: "Antojos del Sur",
    tagline: "Desayunos Criollos & Facturas con DDL",
    neighborhood: "San Telmo",
    rating: 4.9,
    reviews: 268,
    deliveryTime: "30-45 min",
    deliveryFee: 1600,
    freeShippingFrom: 45000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Cadete exclusivo de Antojos del Sur",
    distance: "3.5 km",
    isOpen: true,
    schedule: "07:30 - 19:30 hs",
    avatar: "🧉",
    badge: "👑 Clásico Criollo",
    cover: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Defensa 840, San Telmo",
    verified: true,
    description: "El sabor porteño de siempre: medialunas de manteca bien almibaradas, chipás calientes, alfajores y submarino."
  },
  {
    id: "velvet-bakery",
    name: "Velvet Bakery",
    tagline: "New York Style Cakes, Cookies XL & Waffles",
    neighborhood: "Villa Urquiza",
    rating: 4.9,
    reviews: 176,
    deliveryTime: "35-50 min",
    deliveryFee: 1500,
    freeShippingFrom: 50000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Despacho directo desde Urquiza",
    distance: "2.8 km",
    isOpen: true,
    schedule: "10:00 - 20:30 hs",
    avatar: "🍪",
    badge: "🗽 Estilo New York",
    cover: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Av. Olazábal 4920, Urquiza",
    verified: true,
    description: "Estilo americano moderno: cookies gigantes con centros fundidos, cheesecake New York y torres de waffles dorados."
  },
  {
    id: "maison-matcha",
    name: "Maison Matcha & Co.",
    tagline: "Té de Especialidad, Roll Cakes & Brunch Fusión",
    neighborhood: "Colegiales",
    rating: 4.8,
    reviews: 119,
    deliveryTime: "40-55 min",
    deliveryFee: 1600,
    freeShippingFrom: 50000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Cadetería protegida para pasteles delicados",
    distance: "1.7 km",
    isOpen: true,
    schedule: "09:30 - 19:30 hs",
    avatar: "🍵",
    badge: "✨ Especialidad & Fusión",
    cover: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Conde 1250, Colegiales",
    verified: true,
    description: "Experiencias sutiles con té matcha japonés ceremonial, scones ingleses con mermeladas de autor y roll cakes soufflé."
  },
  {
    id: "dona-clara",
    name: "Doña Clara Pastelería",
    tagline: "Meriendas Caseras de la Abuela & Frolitas",
    neighborhood: "Caballito",
    rating: 5.0,
    reviews: 310,
    deliveryTime: "30-40 min",
    deliveryFee: 1400,
    freeShippingFrom: 40000,
    shippingType: "Envío propio del vendedor",
    shippingNote: "Entrega puerta a puerta por personal del local",
    distance: "2.9 km",
    isOpen: true,
    schedule: "08:30 - 20:00 hs",
    avatar: "👵",
    badge: "❤️ 100% Casero",
    cover: "https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=800&q=80",
    phone: "5491156192616",
    address: "Av. Rivadavia 5430, Caballito",
    verified: true,
    description: "Recetas familiares transmitidas por generaciones: tarta de ricota suave, pastafrolas de membrillo y budines esponjosos."
  }
];

// ============================================================================
// 2. CATÁLOGO INICIAL DE DESAYUNOS Y MERIENDAS DE LOS 7 NEGOCIOS
// ============================================================================
const INITIAL_PRODUCTS = [
  // --------------------------------------------------------------------------
  // NEGOCIO 1: DULCE ATELIER (Palermo)
  // --------------------------------------------------------------------------
  {
    id: "da-desayuno-amour-deluxe",
    businessId: "dulce-atelier",
    businessName: "Dulce Atelier",
    businessNeighborhood: "Palermo",
    businessAvatar: "🍰",
    name: "Box Desayuno Romántico 'Amour Deluxe'",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 24500,
    tag: "⭐ El Más Elegido",
    rating: 5.0,
    reviews: 148,
    description: "Bandeja artesanal con mini tarta de frutos rojos, sándwich de jamón crudo y queso brie en pan brioche, 2 medialunas de manteca, jugo de naranja recién exprimido, alfajor de almendras y taza de cerámica de regalo.",
    image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "da-merienda-degustacion-pastelera",
    businessId: "dulce-atelier",
    businessName: "Dulce Atelier",
    businessNeighborhood: "Palermo",
    businessAvatar: "🍰",
    name: "Merienda Degustación Pastelera & Té",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 19800,
    tag: "🍓 Degustación",
    rating: 4.9,
    reviews: 95,
    description: "Porción generosa de Torta Red Velvet, 3 macarons franceses rellenos, 2 scones tibios de queso gouda, dip de queso crema y mermelada casera de frambuesas con blend de té en hebras premium.",
    image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "da-box-cumple-sorpresa",
    businessId: "dulce-atelier",
    businessName: "Dulce Atelier",
    businessNeighborhood: "Palermo",
    businessAvatar: "🍰",
    name: "Box Desayuno Cumpleaños Sorpresa",
    category: "boxes",
    categoryName: "Boxes de Regalo",
    price: 26900,
    tag: "🎂 Incluye Velita",
    rating: 5.0,
    reviews: 180,
    description: "Mini torta Chocotorta Deluxe con velita de cumpleaños, cookies con chips de chocolate belga, alfajor marplatense gigante, juguito natural, globito festivo y tarjeta con tu dedicatoria escrita a mano.",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    portion: "Box individual de fiesta",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 2: LA PETITE CROISSANT (Recoleta)
  // --------------------------------------------------------------------------
  {
    id: "lpc-desayuno-parisien-classique",
    businessId: "la-petite-croissant",
    businessName: "La Petite Croissant",
    businessNeighborhood: "Recoleta",
    businessAvatar: "🥐",
    name: "Desayuno Parisien Clásico & Croissants",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 18900,
    tag: "🥐 Hojaldre de Manteca",
    rating: 5.0,
    reviews: 210,
    description: "2 Croissants de pura manteca francesa recién horneados, 1 pain au chocolat relleno con chocolate semiamargo, manteca de campo, mermelada artesanal de damasco y café flat white espumoso.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "lpc-merienda-croissant-royale",
    businessId: "la-petite-croissant",
    businessName: "La Petite Croissant",
    businessNeighborhood: "Recoleta",
    businessAvatar: "🥐",
    name: "Merienda Croissant Royale Salmón & Brie",
    category: "brunch",
    categoryName: "Brunch & Salado",
    price: 21500,
    tag: "👑 Gourmet Salado",
    rating: 4.9,
    reviews: 134,
    description: "Croissant gigante relleno con queso brie fundido, palta fresca, salmón ahumado del sur y rúcula tierna, acompañado de un financier de pistacho y jugo de pomelo rosado exprimido.",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    portion: "1 porción brunch completa",
    featured: true
  },
  {
    id: "lpc-box-merienda-sweet-paris",
    businessId: "la-petite-croissant",
    businessName: "La Petite Croissant",
    businessNeighborhood: "Recoleta",
    businessAvatar: "🥐",
    name: "Box Merienda Sweet Paris & Tartelette",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 19400,
    tag: "🇫🇷 100% Francés",
    rating: 4.9,
    reviews: 88,
    description: "Tartelette de masa sablée crujiente con crema diplomata y frambuesas frescas, 2 medialunas hojaldradas almibaradas, 2 chouquettes de azúcar perlado y café con leche de autor.",
    image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 3: CAFÉ & BOTÁNICA (Belgrano R)
  // --------------------------------------------------------------------------
  {
    id: "cb-brunch-energetico-vital",
    businessId: "cafe-botanica",
    businessName: "Café & Botánica",
    businessNeighborhood: "Belgrano R",
    businessAvatar: "🥑",
    name: "Brunch & Desayuno Energético Vital",
    category: "brunch",
    categoryName: "Brunch & Salado",
    price: 22800,
    tag: "🥑 Súper Completo",
    rating: 4.9,
    reviews: 167,
    description: "Tostón de masa madre de centeno con palta pisada al limón, huevo poché y lluvia de semillas tostadas, bowl de yogur natural cremoso con granola horneada y frutas de estación + cold brew infusionado 18hs.",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
    portion: "Brunch abundante (1 a 2 pers.)",
    featured: true
  },
  {
    id: "cb-merienda-waffles-berries",
    businessId: "cafe-botanica",
    businessName: "Café & Botánica",
    businessNeighborhood: "Belgrano R",
    businessAvatar: "🥑",
    name: "Merienda Waffles Belgas & Berries Frescos",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 18500,
    tag: "🍓 Delicioso & Liviano",
    rating: 4.8,
    reviews: 112,
    description: "Dos waffles belgas dorados y crujientes por fuera, coronados con arándanos frescos, frutillas fileteadas, miel de campo pura, crema batida suave y latte con leche vegetal.",
    image: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "cb-desayuno-acai-granola-bowl",
    businessId: "cafe-botanica",
    businessName: "Café & Botánica",
    businessNeighborhood: "Belgrano R",
    businessAvatar: "🥑",
    name: "Desayuno Acai Bowl & Tostada de Campo",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 19200,
    tag: "🌿 Healthy & Fit",
    rating: 4.9,
    reviews: 94,
    description: "Bowl helado de pulpa de açai orgánico con banana, mango, nibs de cacao y granola de frutos secos, acompañado de tostadas de pan de semillas con hummus casero y té verde de jazmín.",
    image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80",
    portion: "1 persona",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 4: ANTOJOS DEL SUR (San Telmo)
  // --------------------------------------------------------------------------
  {
    id: "ads-desayuno-criollo-campestre",
    businessId: "antojos-del-sur",
    businessName: "Antojos del Sur",
    businessNeighborhood: "San Telmo",
    businessAvatar: "🧉",
    name: "Desayuno Criollo Campestre con Facturas",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 16500,
    tag: "🥐 Clásico Porteño",
    rating: 4.9,
    reviews: 245,
    description: "4 Medialunas de manteca hojaldradas y almibaradas rellenas con generoso dulce de leche repostero colonial, 2 vigilantes con pastelera y azúcar negra, más café con leche cremoso en jarrito térmico.",
    image: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "ads-merienda-submarino-alfajores",
    businessId: "antojos-del-sur",
    businessName: "Antojos del Sur",
    businessNeighborhood: "San Telmo",
    businessAvatar: "🧉",
    name: "Merienda Merendero Porteño & Submarino",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 17200,
    tag: "🍫 Puro DDL & Choco",
    rating: 5.0,
    reviews: 198,
    description: "2 Alfajores marplatenses artesanales con 70g de dulce de leche bañados en chocolate semiamargo, porción tibia de pastafrola casera y vaso de leche caliente con tableta de chocolate colonial para derretir.",
    image: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "ads-box-matero-san-telmo",
    businessId: "antojos-del-sur",
    businessName: "Antojos del Sur",
    businessNeighborhood: "San Telmo",
    businessAvatar: "🧉",
    name: "Box Merienda Matera & Chipás Calientes",
    category: "boxes",
    categoryName: "Boxes de Regalo",
    price: 18900,
    tag: "🧉 Especial Mate",
    rating: 4.8,
    reviews: 156,
    description: "6 Chipás caseros de tres quesos recién horneados, 4 tortitas negras azucaradas, cuadraditos de frola de membrillo y paquete de yerba mate selección especial de regalo.",
    image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=800&q=80",
    portion: "Para compartir entre 2 a 4 personas",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 5: VELVET BAKERY (Villa Urquiza)
  // --------------------------------------------------------------------------
  {
    id: "vb-desayuno-sweet-velvet-box",
    businessId: "velvet-bakery",
    businessName: "Velvet Bakery",
    businessNeighborhood: "Villa Urquiza",
    businessAvatar: "🍪",
    name: "Desayuno Sweet Velvet Box & Cookie XL",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 21900,
    tag: "🍪 Centro Fundido",
    rating: 4.9,
    reviews: 140,
    description: "Mini bundt cake Red Velvet con frosting de queso crema Philadelphia, 1 cookie XL recién horneada con centro fundido de Nutella, sándwich tostado de queso gouda y café mocha con cacao.",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "vb-merienda-cheesecake-cookies",
    businessId: "velvet-bakery",
    businessName: "Velvet Bakery",
    businessNeighborhood: "Villa Urquiza",
    businessAvatar: "🍪",
    name: "Merienda Cheesecake New York & Cookies Lovers",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 20400,
    tag: "🗽 Estilo New York",
    rating: 5.0,
    reviews: 165,
    description: "Generosa porción del auténtico cheesecake estilo New York horneado con coulis de frambuesas y moras, 2 cookies crocantes con nueces pecanas y frappé helado de caramelo artesanal.",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "vb-box-pancakes-torre-miel",
    businessId: "velvet-bakery",
    businessName: "Velvet Bakery",
    businessNeighborhood: "Villa Urquiza",
    businessAvatar: "🍪",
    name: "Box Pancakes Torre Dorada con Miel & Frutas",
    category: "boxes",
    categoryName: "Boxes de Regalo",
    price: 22500,
    tag: "🥞 Esponjosos XL",
    rating: 4.9,
    reviews: 118,
    description: "Torre de 5 pancakes súper esponjosos, manteca dulce pomada, syrup de arce puro, porción de frutos rojos frescos, chips de chocolate y dos cafés latte para compartir.",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 o 3 personas",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 6: MAISON MATCHA & CO. (Colegiales)
  // --------------------------------------------------------------------------
  {
    id: "mm-desayuno-matcha-zen-scones",
    businessId: "maison-matcha",
    businessName: "Maison Matcha & Co.",
    businessNeighborhood: "Colegiales",
    businessAvatar: "🍵",
    name: "Desayuno Matcha Zen & Scones Ingleses",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 23400,
    tag: "🍵 Matcha Ceremonial",
    rating: 4.8,
    reviews: 104,
    description: "Iced Matcha Latte con leche de almendras y vainilla, 2 scones ingleses tibios con clotted cream y mermelada casera de higos, tostadas de pan brioche y fruta fresca de estación.",
    image: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "mm-merienda-japonesa-sakura",
    businessId: "maison-matcha",
    businessName: "Maison Matcha & Co.",
    businessNeighborhood: "Colegiales",
    businessAvatar: "🍵",
    name: "Merienda Japonesa Sakura & Roll Cake",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 21000,
    tag: "🌸 Delicadeza & Textura",
    rating: 4.9,
    reviews: 86,
    description: "Roll cake esponjoso soufflé de té verde relleno con crema chantilly de frutillas, 2 dorayakis artesanales y tetera individual de té japonés tostado Genmaicha.",
    image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80",
    portion: "Para 1 o 2 personas",
    featured: true
  },
  {
    id: "mm-brunch-salmon-brioche",
    businessId: "maison-matcha",
    businessName: "Maison Matcha & Co.",
    businessNeighborhood: "Colegiales",
    businessAvatar: "🍵",
    name: "Box Brunch Fusión Salmón & Brioche Tostado",
    category: "brunch",
    categoryName: "Brunch & Salado",
    price: 25500,
    tag: "✨ Fusión Gourmet",
    rating: 4.9,
    reviews: 92,
    description: "Tostón de brioche caramelizado con trucha ahumada patagónica, crema ácida al eneldo, pepinos encurtidos y brotes orgánicos, acompañado de jugo natural prensado en frío de maracuyá y naranja.",
    image: "https://images.unsplash.com/photo-1513442543415-1a63f730a827?auto=format&fit=crop&w=800&q=80",
    portion: "Brunch completo para 1 a 2 pers.",
    featured: true
  },

  // --------------------------------------------------------------------------
  // NEGOCIO 7: DOÑA CLARA PASTELERÍA (Caballito)
  // --------------------------------------------------------------------------
  {
    id: "dc-desayuno-abuela-clara",
    businessId: "dona-clara",
    businessName: "Doña Clara Pastelería",
    businessNeighborhood: "Caballito",
    businessAvatar: "👵",
    name: "Desayuno de la Abuela Clara con Pan Casero",
    category: "desayunos",
    categoryName: "Desayunos Sorpresa",
    price: 17800,
    tag: "❤️ Amor de Abuela",
    rating: 5.0,
    reviews: 290,
    description: "Café con leche espumoso, generosas rebanadas de pan casero de campo tostadas con manteca pomada y dulce de leche repostero, 3 colaciones cordobesas con glaseado real crocante.",
    image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "dc-merienda-ricota-frolita",
    businessId: "dona-clara",
    businessName: "Doña Clara Pastelería",
    businessNeighborhood: "Caballito",
    businessAvatar: "👵",
    name: "Merienda de Barrio: Tarta de Ricota & Fosforitos",
    category: "meriendas",
    categoryName: "Meriendas & Té",
    price: 18200,
    tag: "🥧 Tradición Casera",
    rating: 4.9,
    reviews: 215,
    description: "Abundante porción de tarta de ricota suave y perfumada al limón, 2 fosforitos agridulces de hojaldre casero con jamón cocido y queso, y té clásico servido con masitas secas.",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=800&q=80",
    portion: "Para 2 personas",
    featured: true
  },
  {
    id: "dc-box-familiar-surtido",
    businessId: "dona-clara",
    businessName: "Doña Clara Pastelería",
    businessNeighborhood: "Caballito",
    businessAvatar: "👵",
    name: "Box Merienda Familiar Doña Clara (Para 4 pers.)",
    category: "boxes",
    categoryName: "Boxes de Regalo",
    price: 24900,
    tag: "👨‍👩‍👧‍👦 Súper Rinde",
    rating: 5.0,
    reviews: 178,
    description: "Bandeja familiar con medio budín de limón glaseado, 4 alfajores de maicena con coco, 4 medialunas rellenas, 2 porciones de brownie con nuez y dulce de leche para compartir en familia.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
    portion: "Para 3 a 5 personas",
    featured: true
  }
];

// ============================================================================
// 3. STORAGE & GESTOR DEL MARKETPLACE
// ============================================================================
const STORAGE_KEY_PRODUCTS = 'dulce_marketplace_products_v6';
const STORAGE_KEY_BUSINESSES = 'dulce_marketplace_businesses_v6';

class ProductManager {
  constructor() {
    this.businesses = this.loadBusinesses();
    this.products = this.loadProducts();
  }

  loadBusinesses() {
    const saved = localStorage.getItem(STORAGE_KEY_BUSINESSES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_BUSINESSES.length && parsed[0].cover) {
          return parsed;
        }
      } catch (e) {
        console.error("Error al cargar negocios:", e);
      }
    }
    this.saveBusinesses(INITIAL_BUSINESSES);
    return INITIAL_BUSINESSES;
  }

  saveBusinesses(businesses) {
    this.businesses = businesses;
    localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(businesses));
  }

  getAllBusinesses() {
    return this.businesses;
  }

  getBusinessesFiltered(filter = 'all') {
    if (filter === 'open') {
      return this.businesses.filter(b => b.isOpen !== false);
    }
    if (filter === 'freeShipping') {
      return this.businesses.filter(b => b.freeShippingFrom && b.freeShippingFrom <= 45000);
    }
    if (filter === 'topRated') {
      return this.businesses.filter(b => b.rating >= 4.9);
    }
    if (filter === 'near') {
      return [...this.businesses].sort((a, b) => parseFloat(a.distance || 99) - parseFloat(b.distance || 99));
    }
    return this.businesses;
  }

  getBusinessById(id) {
    return this.businesses.find(b => b.id === id);
  }

  addBusiness(newBusiness) {
    const business = {
      id: 'biz-' + Date.now(),
      rating: 5.0,
      reviews: 1,
      deliveryTime: "30-45 min",
      deliveryFee: 1500,
      avatar: "🏪",
      badge: "✨ Nuevo en el Market",
      phone: "5491156192616",
      ...newBusiness
    };
    this.businesses.push(business);
    this.saveBusinesses(this.businesses);
    return business;
  }

  loadProducts() {
    const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Verificar que los datos tengan la estructura de marketplace con businessId
        if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length && parsed[0].businessId) {
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
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
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

  getByBusiness(businessId) {
    if (businessId === 'todos' || !businessId) return this.products;
    return this.products.filter(p => p.businessId === businessId);
  }

  filter(businessId = 'todos', category = 'todos') {
    return this.products.filter(p => {
      const matchBiz = (businessId === 'todos' || !businessId) ? true : p.businessId === businessId;
      const matchCat = (category === 'todos' || !category) ? true : p.category === category;
      return matchBiz && matchCat;
    });
  }

  search(query, businessId = 'todos', category = 'todos') {
    let list = this.filter(businessId, category);
    if (!query) return list;

    const q = query.toLowerCase().trim();
    return list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      (p.tag && p.tag.toLowerCase().includes(q)) ||
      (p.businessName && p.businessName.toLowerCase().includes(q)) ||
      (p.businessNeighborhood && p.businessNeighborhood.toLowerCase().includes(q))
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
