/**
 * DULCE ATELIER - CHECKOUT Y CONSTRUCTOR DE PEDIDO DE WHATSAPP
 * Destinatario de WhatsApp: 1156192616 (Código internacional +54 9 11 5619-2616)
 * Sistema de Número de Orden Automático y Envío de Comprobante (Estilo ByronCode / Perlato)
 */

const WHATSAPP_PHONE = "5491156192616";

// Símbolos tipográficos universales 100% compatibles con WhatsApp y navegadores
// Garantizan que no aparezcan signos de interrogación ni rombos  en ninguna vista previa ni dispositivo
const ICONS = {
  star: '✦',
  bullet: '•',
  sub: '▫',
  arrow: '►',
  box: '◆',
  line: '━━━━━━━━━━━━━━━━━━━━'
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
      itemsText += `\n• *${item.quantity}x ${item.product.name}* (${cart.formatCurrency(subtotal)})`;
      
      if (item.customization && item.customization.flavor) {
        itemsText += `\n   ▫ _Relleno/Gusto:_ ${item.customization.flavor}`;
      }
      if (item.customization && item.customization.size) {
        itemsText += `\n   ▫ _Tamaño:_ ${item.customization.size}`;
      }
      if (item.customization && item.customization.dedication) {
        itemsText += `\n   ▫ _Dedicatoria:_ "${item.customization.dedication}"`;
      }
      if (item.customization && item.customization.candle) {
        itemsText += `\n   ▫ _Velita incluida:_ Sí`;
      }
      if (item.customization && item.customization.note) {
        itemsText += `\n   ▫ _Nota:_ ${item.customization.note}`;
      }
    });

    const isDelivery = cart.deliveryType === 'delivery';
    const deliveryText = isDelivery 
      ? `• *Envío a Domicilio:* ${cart.formatCurrency(cart.getEffectiveDeliveryFee())}\n• *Dirección:* ${formData.address}${formData.apartment ? ` (Piso/Depto: ${formData.apartment})` : ''}\n• *Zona/Barrio:* ${formData.zone || 'A coordinar'}`
      : `• *Modalidad:* Retiro en Tienda (Gratis)`;

    const scheduleText = formData.deliveryTime 
      ? `• *Fecha y Horario:* ${formData.deliveryTime}`
      : `• *Horario:* Lo antes posible`;

    let paymentMethodName = "Efectivo";
    if (formData.paymentMethod === 'transfer') {
      paymentMethodName = "Transferencia Bancaria (Alias: DULCE.ATELIER.BA)";
    } else if (formData.paymentMethod === 'mercadopago') {
      paymentMethodName = "Mercado Pago (Alias: DULCE.ATELIER.MP)";
    }

    const cashNote = (formData.paymentMethod === 'cash' && formData.cashAmount) 
      ? `\n• *Paga con:* $${formData.cashAmount}` 
      : '';

    const message = 
`¡Hola Dulce Atelier! ✦
*NUEVO PEDIDO #${orderId}*

━━━━━━━━━━━━━━━━━━━━
◆ *RESUMEN DEL PEDIDO:*${itemsText}

• *Subtotal:* ${cart.formatCurrency(cart.getSubtotal())}
${deliveryText}
• *TOTAL A PAGAR:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

► *DATOS DEL CLIENTE:*
- *Nombre:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}
${formData.comments ? `\n• *Comentarios adicionales:* ${formData.comments}` : ''}

Por favor confírmenme la recepción del pedido para preparar la entrega. ¡Muchas gracias! ✦`;

    return message;
  }

  buildWhatsAppUrl(text, forceWeb = false) {
    const encoded = encodeURIComponent(text);
    if (forceWeb) {
      return `https://web.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encoded}`;
    }
    // api.whatsapp.com es el estándar oficial universal:
    // - En celular: abre la app de WhatsApp directamente
    // - En PC: abre la página de enlace donde el cliente puede hacer clic en 'Continuar al chat'
    //   para abrir WhatsApp de Windows (app de escritorio) o WhatsApp Web SIN quedar forzado al código QR.
    return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encoded}`;
  }

  generateReceiptProofUrl(orderId, totalFormatted, paymentMethod = 'transfer') {
    const isMP = paymentMethod === 'mercadopago';
    const text = isMP
      ? `¡Hola Dulce Atelier! ✦ Adjunto el comprobante de pago de Mercado Pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`
      : `¡Hola Dulce Atelier! ✦ Adjunto el comprobante de pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`;
    return this.buildWhatsAppUrl(text);
  }

  processOrder(formData, cart) {
    const orderId = this.generateOrderNumber();
    const total = cart.getTotal();
    const totalFormatted = cart.formatCurrency(total);
    const subtotalFormatted = cart.formatCurrency(cart.getSubtotal());
    const itemsCopy = JSON.parse(JSON.stringify(cart.items));

    const message = this.generateWhatsAppMessage(formData, cart, orderId);
    const whatsappUrl = this.buildWhatsAppUrl(message);

    // Guardar último pedido para la pantalla de confirmación
    this.lastOrder = {
      orderId,
      total,
      totalFormatted,
      subtotalFormatted,
      items: itemsCopy,
      formData,
      rawMessage: message,
      paymentMethod: formData.paymentMethod,
      proofWhatsappUrl: this.generateReceiptProofUrl(orderId, totalFormatted, formData.paymentMethod),
      whatsappUrl,
      whatsappWebUrl: this.buildWhatsAppUrl(message, true),
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
