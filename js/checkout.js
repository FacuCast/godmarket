/**
 * DULCE ATELIER - CHECKOUT Y CONSTRUCTOR DE PEDIDO DE WHATSAPP
 * Destinatario de WhatsApp: 1156192616 (Código internacional +54 9 11 5619-2616)
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
  }

  generateWhatsAppMessage(formData, cart) {
    const items = cart.items;
    let itemsText = "";

    items.forEach((item, index) => {
      const subtotal = item.product.price * item.quantity;
      itemsText += `\n🍰 *${item.quantity}x ${item.product.name}* (${cart.formatCurrency(subtotal)})`;
      
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
      ? `⏰ *Fecha y Horario de entrega:* ${formData.deliveryTime}`
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
Quiero confirmar mi pedido a través de la tienda web:

━━━━━━━━━━━━━━━━━━━━
🛍️ *RESUMEN DEL PEDIDO:*${itemsText}

💰 *Subtotal:* ${cart.formatCurrency(cart.getSubtotal())}
${deliveryText}
🏷️ *TOTAL:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

👤 *DATOS DEL CLIENTE:*
- *Nombre:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}
${formData.comments ? `\n📌 *Comentarios adicionales:* ${formData.comments}` : ''}

Por favor confírmenme la recepción del pedido para realizar el pago. ¡Muchas gracias! 💖`;

    return message;
  }

  sendToWhatsApp(formData, cart) {
    const message = this.generateWhatsAppMessage(formData, cart);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`;
    
    // Abrir WhatsApp en nueva pestaña o app nativa
    window.open(whatsappUrl, '_blank');
    
    // Limpiar carrito después de enviar y registrar orden
    cart.clearCart();
  }
}

// Instancia global
window.checkoutHandler = new CheckoutHandler();
