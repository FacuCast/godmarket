# 👑 GOD MARKET - Marketplace de Cafeterías de Especialidad & Desayunos Sorpresa

Aplicación web **Mobile-First & PWA** (estilo PedidosYa / Delivery Gourmet) optimizada para celulares y computadoras, con catálogo dinámico, carrito de compras, registro de pedidos, confirmación por **WhatsApp (1156192616)** y subida de imágenes a **Cloudinary**.

---

## 🌟 Características Principales

- 📱 **Diseño Mobile-First Estilo PedidosYa:**
  - Selector de entrega (Envío a domicilio / Retiro en tienda).
  - Buscador predictivo en tiempo real y selector de historias/categorías.
  - Carrusel y banners de ofertas especiales.
  - **4 productos destacados por sección** (Tortas, Desayunos & Meriendas, Postres).
- 🛍️ **Carrito & Flujo de Compra:**
  - Barra flotante interactiva de carrito en pantalla.
  - Modificador de cantidades, velitas de cumpleaños, dedicatorias personalizadas y notas especiales.
- 📲 **Confirmación Automática a WhatsApp:**
  - Genera el detalle del pedido con emojis, desglose de precios, dirección, horario y método de pago, enviándolo directamente a **`1156192616`** (`+54 9 11 5619-2616`).
- ☁️ **Soporte de Cloudinary:**
  - Panel para agregar o editar productos subiendo fotos directo a la nube.
  - Modal de configuración para ingresar tus credenciales (`Cloud Name` y `Upload Preset`).
- ⚡ **PWA (Progressive Web App):**
  - Totalmente instalable como app en dispositivos móviles (Android / iOS) con `manifest.json` y `sw.js`.
---

## 🚀 Cómo Ejecutar Localmente

Instala las dependencias y configura las variables locales de `.env.example` en `.env`:

```bash
npm ci
npm start
```

Luego abre en tu navegador:
👉 **`http://localhost:3000/`**

---

## ✅ Requisitos para producción

Antes de publicar el sitio:

1. Crea un proyecto Supabase y ejecuta [database.sql](./database.sql) una vez en **SQL Editor**. Si Supabase muestra el aviso de RLS, ejecuta habilitando RLS; el script no crea políticas para acceso público. En el hosting configura `DATABASE_URL` con la cadena PostgreSQL privada del **Session Pooler** de Supabase (no uses una clave `anon`/`service_role` de la API como contraseña ni la expongas al navegador). Si editas la URL a mano, codifica los caracteres reservados de la contraseña.
2. Define `JWT_SECRET` y `ADMIN_TOKEN` con valores aleatorios distintos de al menos 32 caracteres. Si se rota `JWT_SECRET`, se cierran las sesiones activas de vendedores.
3. Completa `GOOGLE_CLIENT_ID` y agrega el dominio de producción en Google Identity Services.
4. Completa `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`.
5. Define `APP_ORIGINS` únicamente con los dominios HTTPS reales, separados por comas.
6. Cada comercio debe cargar su alias de transferencia desde el portal vendedor; en carritos con varios comercios se muestra el alias y el importe correspondiente a cada uno. Si se ofrece Mercado Pago como medio global, configura `MERCADOPAGO_ALIAS`, `MERCADOPAGO_CVU` y `MERCADOPAGO_ACCOUNT_HOLDER`. Efectivo sigue disponible.
7. Usa `NODE_ENV=production` y deja `ENABLE_DEMO_LOGIN=false`.

En producción, el servidor no inicia si `DATABASE_URL` no está configurado o PostgreSQL no es accesible. PostgreSQL/Supabase es la persistencia de producción; el almacenamiento JSON en `./data` solo se permite en desarrollo. Las tablas tienen RLS habilitado sin políticas de acceso para `anon`/`authenticated`: solo el backend debe acceder mediante la conexión privada. La aplicación mantiene una caché en memoria y debe ejecutarse como una única instancia Node.js; no escales horizontalmente sin migrar las lecturas a almacenamiento compartido.

## ☁️ Cómo Conectar Cloudinary

1. Abre la tienda web.
2. Toca el icono de nube **☁️** en la barra superior derecha.
3. Ingresa tu **Cloud Name** y tu **Upload Preset (Unsigned)**.
4. ¡Listo! Al tocar el botón **➕**, podrás subir fotos de nuevos pasteles y se guardarán automáticamente en tu cuenta de Cloudinary.

---

## 🌐 Despliegue en un hosting Node.js

El backend requiere un proceso Node.js persistente (`npm start`); no es un despliegue estático ni serverless. Configura el directorio del proyecto, `server.js`, el puerto asignado por el panel y las variables de entorno anteriores. Ejecuta [database.sql](./database.sql) en Supabase antes de iniciar el backend. Este esquema no migra automáticamente datos que existan previamente en una base MySQL.
