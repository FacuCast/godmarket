# 🍰 Dulce Atelier - Pastelería, Desayunos & Meriendas

Aplicación web **Mobile-First & PWA** (estilo PedidosYa / Delivery Gourmet) optimizada para celulares y computadoras, con catálogo dinámico, carrito de compras, confirmación y envío de pedidos directo a **WhatsApp (1156192616)**, subida de imágenes a la nube con **Cloudinary** y lista para desplegar en **Vercel**.

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
- 🚀 **Listo para Vercel:**
  - Contiene `vercel.json` con rutas limpias y encabezados de seguridad.

---

## 🚀 Cómo Ejecutar Localmente

No requiere instalaciones complejas. Puedes probarlo ejecutando:

```bash
node server.js
```

Luego abre en tu navegador:
👉 **`http://localhost:3000/`**

---

## ☁️ Cómo Conectar Cloudinary

1. Abre la tienda web.
2. Toca el icono de nube **☁️** en la barra superior derecha.
3. Ingresa tu **Cloud Name** y tu **Upload Preset (Unsigned)**.
4. ¡Listo! Al tocar el botón **➕**, podrás subir fotos de nuevos pasteles y se guardarán automáticamente en tu cuenta de Cloudinary.

---

## 🌐 Cómo Subir a Vercel

1. Sube este proyecto a tu repositorio de **GitHub**.
2. Ve a [vercel.com](https://vercel.com/) y haz clic en **"Add New Project"**.
3. Selecciona tu repositorio `Pasteleria`.
4. Deja la configuración por defecto (Vercel detectará el archivo `vercel.json` e `index.html`).
5. Haz clic en **Deploy** y tu pastelería estará online en pocos segundos.
