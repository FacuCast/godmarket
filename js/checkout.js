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

    // Migrar dulce_last_order existente a historial si aún no se ha guardado
    try {
      const savedLast = localStorage.getItem('dulce_last_order');
      if (savedLast) {
        this.lastOrder = JSON.parse(savedLast);
        const history = this.getOrderHistory();
        if (history.length === 0 && this.lastOrder && this.lastOrder.orderId) {
          this.saveOrderToHistory(this.lastOrder);
        }
      }
    } catch (e) {}
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
    const businessesSet = new Set();

    items.forEach((item) => {
      const bizName = item.product.businessName || 'Pastelería Asociada';
      const bizZone = item.product.businessNeighborhood ? ` (${item.product.businessNeighborhood})` : '';
      businessesSet.add(`${bizName}${bizZone}`);

      const subtotal = item.product.price * item.quantity;
      itemsText += `\n• *${item.quantity}x ${item.product.name}* (${cart.formatCurrency(subtotal)})`;
      itemsText += `\n   🏪 _Negocio:_ ${bizName}${bizZone}`;
      
      if (item.customization && item.customization.flavor) {
        itemsText += `\n   ▫ _Gusto/Relleno:_ ${item.customization.flavor}`;
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

    const businessesListStr = Array.from(businessesSet).join(', ');

    const isDelivery = cart.deliveryType === 'delivery';
    const deliveryText = isDelivery 
      ? `• *Envío a Domicilio (A cargo del Vendedor):* ${cart.formatCurrency(cart.getEffectiveDeliveryFee())}\n• *Dirección:* ${formData.address}${formData.apartment ? ` (Piso/Depto: ${formData.apartment})` : ''}\n• *Zona/Barrio:* ${formData.zone || 'A coordinar'}\n• *Nota de Despacho:* Envío gestionado directamente por el cadete del local`
      : `• *Modalidad:* Retiro en Tienda del Vendedor (Sin cargo)`;

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
`¡Hola Dulce Market! ✦
*NUEVO PEDIDO MARKETPLACE #${orderId}*
🛵 *LOGÍSTICA: ENVÍO A CARGO DEL VENDEDOR*

🏪 *LOCALES / VENDEDORES:* ${businessesListStr}

━━━━━━━━━━━━━━━━━━━━
◆ *RESUMEN DE PRODUCTOS:*${itemsText}

• *Subtotal:* ${cart.formatCurrency(cart.getSubtotal())}
${deliveryText}
• *TOTAL A PAGAR:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

► *DATOS PARA LA ENTREGA:*
- *Cliente:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}
${formData.comments ? `\n• *Comentarios / Indicaciones:* ${formData.comments}` : ''}

Por favor confírmenme el pedido para que el vendedor comience la preparación y coordine su cadete. ¡Muchas gracias! ✦`;

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

  getOrderHistory() {
    try {
      const history = localStorage.getItem('dulce_orders_history');
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.error("Error al leer historial de pedidos:", e);
      return [];
    }
  }

  saveOrderToHistory(order) {
    try {
      const history = this.getOrderHistory();
      const existingIdx = history.findIndex(o => o.orderId === order.orderId);
      if (existingIdx > -1) {
        history[existingIdx] = order;
      } else {
        history.unshift(order);
      }
      const trimmed = history.slice(0, 25);
      localStorage.setItem('dulce_orders_history', JSON.stringify(trimmed));
    } catch (e) {
      console.error("Error al guardar pedido en historial:", e);
    }
  }

  getOrderById(orderId) {
    const history = this.getOrderHistory();
    return history.find(o => o.orderId === orderId) || (this.lastOrder && this.lastOrder.orderId === orderId ? this.lastOrder : null);
  }

  deleteOrderFromHistory(orderId) {
    try {
      const history = this.getOrderHistory().filter(o => o.orderId !== orderId);
      localStorage.setItem('dulce_orders_history', JSON.stringify(history));
      return history;
    } catch (e) {
      console.error("Error al eliminar pedido del historial:", e);
      return [];
    }
  }

  processOrder(formData, cart) {
    const orderId = this.generateOrderNumber();
    const total = cart.getTotal();
    const totalFormatted = cart.formatCurrency(total);
    const subtotalFormatted = cart.formatCurrency(cart.getSubtotal());
    const itemsCopy = JSON.parse(JSON.stringify(cart.items));

    const message = this.generateWhatsAppMessage(formData, cart, orderId);
    const whatsappUrl = this.buildWhatsAppUrl(message);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Guardar último pedido para la pantalla de confirmación y persistencia
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
      createdAt: now.toISOString(),
      dateFormatted
    };

    localStorage.setItem('dulce_last_order', JSON.stringify(this.lastOrder));
    this.saveOrderToHistory(this.lastOrder);

    // Celebración con confetti si está disponible la librería
    if (typeof confetti === 'function') {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (err) {}
    }

    // Abrir WhatsApp con el pedido inicial
    window.open(whatsappUrl, '_blank');

    // Limpiar carrito
    cart.clearCart();

    return this.lastOrder;
  }
}

// Instancia global
window.checkoutHandler = new CheckoutHandler();
