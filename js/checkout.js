/**
 * DULCE ATELIER - CHECKOUT Y CONSTRUCTOR DE PEDIDO DE WHATSAPP
 * Destinatario de WhatsApp: 1156192616 (Código internacional +54 9 11 5619-2616)
 * Sistema de Número de Orden Automático y Envío de Comprobante (Estilo ByronCode / Perlato)
 */

const WHATSAPP_PHONE = "5491156192616";

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
      itemsText += `\n🍰 *${item.quantity}x ${item.product.name}* (${cart.formatCurrency(subtotal)})`;
      
      if (item.customization && item.customization.flavor) {
        itemsText += `\n   🍯 _Relleno/Gusto:_ ${item.customization.flavor}`;
      }
      if (item.customization && item.customization.size) {
        itemsText += `\n   📏 _Tamaño:_ ${item.customization.size}`;
      }
      if (item.customization && item.customization.dedication) {
        itemsText += `\n   ✍️ _Dedicatoria:_ "${item.customization.dedication}"`;
      }
      if (item.customization && item.customization.candle) {
        itemsText += `\n   🕯️ _Velita incluida:_ Sí`;
      }
      if (item.customization && item.customization.note) {
        itemsText += `\n   📝 _Nota:_ ${item.customization.note}`;
      }
    });

    const isDelivery = cart.deliveryType === 'delivery';
    const deliveryText = isDelivery 
      ? `🛵 *Envío a Domicilio:* ${cart.formatCurrency(cart.getEffectiveDeliveryFee())}\n📍 *Dirección:* ${formData.address}${formData.apartment ? ` (Piso/Depto: ${formData.apartment})` : ''}\n🗺️ *Zona/Barrio:* ${formData.zone || 'A coordinar'}`
      : `🏪 *Modalidad:* Retiro en Tienda (Gratis)`;

    const scheduleText = formData.deliveryTime 
      ? `⏰ *Fecha y Horario:* ${formData.deliveryTime}`
      : `⏰ *Horario:* Lo antes posible`;

    let paymentMethodName = "Efectivo";
    if (formData.paymentMethod === 'transfer') {
      paymentMethodName = "Transferencia Bancaria (Alias: DULCE.ATELIER.BA)";
    } else if (formData.paymentMethod === 'mercadopago') {
      paymentMethodName = "Mercado Pago";
    }

    const cashNote = (formData.paymentMethod === 'cash' && formData.cashAmount) 
      ? `\n💵 *Paga con:* $${formData.cashAmount}` 
      : '';

    const message = 
`¡Hola Dulce Atelier! 🎂✨
🔔 *NUEVO PEDIDO #${orderId}*

━━━━━━━━━━━━━━━━━━━━
🛍️ *RESUMEN DEL PEDIDO:*${itemsText}

💰 *Subtotal:* ${cart.formatCurrency(cart.getSubtotal())}
${deliveryText}
🏷️ *TOTAL A PAGAR:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

👤 *DATOS DEL CLIENTE:*
- *Nombre:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}
${formData.comments ? `\n📌 *Comentarios adicionales:* ${formData.comments}` : ''}

Por favor confírmenme la recepción del pedido para preparar la entrega. ¡Muchas gracias! 💖`;

    return message;
  }

  generateReceiptProofUrl(orderId, totalFormatted) {
    const text = `¡Hola Dulce Atelier! 🍰 Adjunto el comprobante de pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`;
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
      proofWhatsappUrl: this.generateReceiptProofUrl(orderId, totalFormatted),
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
