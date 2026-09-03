/**
 * DULCE ATELIER - CHECKOUT Y CONSTRUCTOR DE PEDIDO DE WHATSAPP
 * Destinatario de WhatsApp: 1156192616 (Código internacional +54 9 11 5619-2616)
 * Sistema de Número de Orden Automático y Envío de Comprobante (Estilo ByronCode / Perlato)
 */

const WHATSAPP_PHONE = "5491156192616";

// Constantes de emojis en formato Unicode seguro (evita caracteres corruptos  en cualquier navegador)
const EMOJIS = {
  cake: '\u{1F382}',         // 🎂
  sparkles: '\u{2728}',     // ✨
  bell: '\u{1F514}',         // 🔔
  bag: '\u{1F6CD}\u{FE0F}',  // 🛍️
  pastry: '\u{1F370}',       // 🍰
  honey: '\u{1F36F}',        // 🍯
  ruler: '\u{1F4CF}',        // 📏
  pen: '\u{270D}\u{FE0F}',   // ✍️
  candle: '\u{1F56F}\u{FE0F}',// 🕯️
  memo: '\u{1F4DD}',         // 📝
  scooter: '\u{1F6F5}',      // 🛵
  pin: '\u{1F4CD}',          // 📍
  map: '\u{1F5FA}\u{FE0F}',  // 🗺️
  store: '\u{1F3EA}',        // 🏪
  clock: '\u{23F0}',         // ⏰
  cash: '\u{1F4B5}',         // 💵
  moneyBag: '\u{1F4B0}',     // 💰
  tag: '\u{1F3F7}\u{FE0F}',  // 🏷️
  user: '\u{1F464}',         // 👤
  pushpin: '\u{1F4CC}',      // 📌
  heart: '\u{1F496}'         // 💖
};

class CheckoutHandler {
  constructor() {
    this.bankDetails = {
      alias: "DULCE.ATELIER.BA",
      cbu: "0000003100012345678901",
      holder: "Dulce Atelier Pastelería Artesanal",
      bank: "Mercado Pago / Banco Galicia"
    };
    this.lastOrder = null;
  }

  generateOrderNumber() {
    let lastNum = parseInt(localStorage.getItem('dulce_last_order_num') || '1040', 10);
    lastNum += 1;
    localStorage.setItem('dulce_last_order_num', lastNum.toString());
    return 'ORD-' + lastNum;
  }

  generateWhatsAppMessage(formData, cart, orderId) {
    const items = cart.items;
    let itemsText = "";

    items.forEach((item) => {
      const subtotal = item.product.price * item.quantity;
      itemsText += `\n${EMOJIS.pastry} *${item.quantity}x ${item.product.name}* (${cart.formatCurrency(subtotal)})`;
      
      if (item.customization && item.customization.flavor) {
        itemsText += `\n   ${EMOJIS.honey} _Relleno/Gusto:_ ${item.customization.flavor}`;
      }
      if (item.customization && item.customization.size) {
        itemsText += `\n   ${EMOJIS.ruler} _Tamaño:_ ${item.customization.size}`;
      }
      if (item.customization && item.customization.dedication) {
        itemsText += `\n   ${EMOJIS.pen} _Dedicatoria:_ "${item.customization.dedication}"`;
      }
      if (item.customization && item.customization.candle) {
        itemsText += `\n   ${EMOJIS.candle} _Velita incluida:_ Sí`;
      }
      if (item.customization && item.customization.note) {
        itemsText += `\n   ${EMOJIS.memo} _Nota:_ ${item.customization.note}`;
      }
    });

    const isDelivery = cart.deliveryType === 'delivery';
    const deliveryText = isDelivery 
      ? `${EMOJIS.scooter} *Envío a Domicilio:* ${cart.formatCurrency(cart.getEffectiveDeliveryFee())}\n${EMOJIS.pin} *Dirección:* ${formData.address}${formData.apartment ? ` (Piso/Depto: ${formData.apartment})` : ''}\n${EMOJIS.map} *Zona/Barrio:* ${formData.zone || 'A coordinar'}`
      : `${EMOJIS.store} *Modalidad:* Retiro en Tienda (Gratis)`;

    const scheduleText = formData.deliveryTime 
      ? `${EMOJIS.clock} *Fecha y Horario:* ${formData.deliveryTime}`
      : `${EMOJIS.clock} *Horario:* Lo antes posible`;

    let paymentMethodName = "Efectivo";
    if (formData.paymentMethod === 'transfer') {
      paymentMethodName = "Transferencia Bancaria (Alias: DULCE.ATELIER.BA)";
    } else if (formData.paymentMethod === 'mercadopago') {
      paymentMethodName = "Mercado Pago (Alias: DULCE.ATELIER.MP)";
    }

    const cashNote = (formData.paymentMethod === 'cash' && formData.cashAmount) 
      ? `\n${EMOJIS.cash} *Paga con:* $${formData.cashAmount}` 
      : '';

    const message = 
`¡Hola Dulce Atelier! ${EMOJIS.cake}${EMOJIS.sparkles}
${EMOJIS.bell} *NUEVO PEDIDO #${orderId}*

━━━━━━━━━━━━━━━━━━━━
${EMOJIS.bag} *RESUMEN DEL PEDIDO:*${itemsText}

${EMOJIS.moneyBag} *Subtotal:* ${cart.formatCurrency(cart.getSubtotal())}
${deliveryText}
${EMOJIS.tag} *TOTAL A PAGAR:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

${EMOJIS.user} *DATOS DEL CLIENTE:*
- *Nombre:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}
${formData.comments ? `\n${EMOJIS.pushpin} *Comentarios adicionales:* ${formData.comments}` : ''}

Por favor confírmenme la recepción del pedido para preparar la entrega. ¡Muchas gracias! ${EMOJIS.heart}`;

    return message;
  }

  generateReceiptProofUrl(orderId, totalFormatted, paymentMethod = 'transfer') {
    const isMP = paymentMethod === 'mercadopago';
    const text = isMP
      ? `¡Hola Dulce Atelier! ${EMOJIS.pastry} Adjunto el comprobante de pago de Mercado Pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`
      : `¡Hola Dulce Atelier! ${EMOJIS.pastry} Adjunto el comprobante de pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  }

  processOrder(formData, cart) {
    const orderId = this.generateOrderNumber();
    const total = cart.getTotal();
    const totalFormatted = cart.formatCurrency(total);
    const subtotalFormatted = cart.formatCurrency(cart.getSubtotal());
    const itemsCopy = JSON.parse(JSON.stringify(cart.items));

    const message = this.generateWhatsAppMessage(formData, cart, orderId);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`;

    // Guardar último pedido para la pantalla de confirmación
    this.lastOrder = {
      orderId,
      total,
      totalFormatted,
      subtotalFormatted,
      items: itemsCopy,
      formData,
      paymentMethod: formData.paymentMethod,
      proofWhatsappUrl: this.generateReceiptProofUrl(orderId, totalFormatted, formData.paymentMethod),
      whatsappUrl,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('dulce_last_order', JSON.stringify(this.lastOrder));

    // Abrir WhatsApp con el pedido inicial
    window.open(whatsappUrl, '_blank');

    // Limpiar carrito
    cart.clearCart();

    return this.lastOrder;
  }
}

// Instancia global
window.checkoutHandler = new CheckoutHandler();
