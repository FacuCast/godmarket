/**
 * GOD MARKET - CHECKOUT Y CONSTRUCTOR DE PEDIDO DE WHATSAPP
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
      mercadoPagoAlias: '',
      mercadoPagoCvu: '',
      mercadoPagoHolder: ''
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

  getTransferPayments(cart) {
    const businesses = new Map();
    cart.items.forEach(item => {
      const businessId = item.product.businessId;
      const business = window.productManager?.getBusinessById(businessId);
      const current = businesses.get(businessId) || {
        businessId,
        businessName: business?.name || item.product.businessName || 'Comercio',
        transferAlias: typeof business?.transferAlias === 'string' ? business.transferAlias.trim() : '',
        transferAccountHolder: typeof business?.transferAccountHolder === 'string' ? business.transferAccountHolder.trim() : '',
        subtotal: 0,
        serviceFeeRate: cart.getServiceFeeRateForItem(item),
        deliveryFee: Number.isFinite(Number(business?.deliveryFee)) ? Math.max(0, Number(business.deliveryFee)) : 1500,
        freeShippingFrom: Number.isFinite(Number(business?.freeShippingFrom)) ? Math.max(0, Number(business.freeShippingFrom)) : 45000
      };
      current.subtotal += Number(item.product.price) * Number(item.quantity);
      businesses.set(businessId, current);
    });

    return Array.from(businesses.values()).map(business => {
      const serviceFee = Math.round(business.subtotal * business.serviceFeeRate);
      const deliveryFee = cart.deliveryType === 'delivery' && business.subtotal < business.freeShippingFrom
        ? business.deliveryFee
        : 0;
      return {
        ...business,
        total: business.subtotal + serviceFee + deliveryFee
      };
    });
  }

  renderTransferDetails(payments) {
    const formatCurrency = amount => Number(amount).toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    });
    const escape = value => window.app ? window.app.escapeHTML(String(value || '')) : String(value || '');
    if (!payments.length || payments.some(payment => !payment.transferAlias)) {
      return '<p class="bank-subtitle">La transferencia estará disponible cuando todos los comercios del pedido configuren su alias.</p>';
    }

    return payments.map(payment => `
      <div class="bank-row" style="align-items: flex-start; margin-top: 12px;">
        <div style="flex: 1;">
          <strong>${escape(payment.businessName)}</strong>
          <div class="bank-label" style="margin-top: 6px;">ALIAS</div>
          <strong class="bank-code">${escape(payment.transferAlias)}</strong>
          ${payment.transferAccountHolder ? `<div class="bank-value">Titular: ${escape(payment.transferAccountHolder)}</div>` : ''}
          <div class="bank-value">Transferir: <strong>${formatCurrency(payment.total)}</strong></div>
        </div>
        <button type="button" class="copy-btn" data-transfer-alias="${escape(payment.transferAlias)}" onclick="window.app.copyTransferAlias(this)">Copiar</button>
      </div>
    `).join('');
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
    const serviceFeePercent = Math.round(cart.getStandardServiceFeeRate() * 100);

    const isDelivery = cart.deliveryType === 'delivery';
    const deliveryText = isDelivery 
      ? `• *Envío a Domicilio (A cargo del Vendedor):* ${cart.formatCurrency(cart.getEffectiveDeliveryFee())}\n• *Dirección:* ${formData.address}${formData.apartment ? ` (Piso/Depto: ${formData.apartment})` : ''}\n• *Zona/Barrio:* ${formData.zone || 'A coordinar'}\n• *Nota de Despacho:* Envío gestionado directamente por el cadete del local`
      : `• *Modalidad:* Retiro en Tienda del Vendedor (Sin cargo)`;

    const scheduleText = formData.deliveryTime 
      ? `• *Fecha y Horario:* ${formData.deliveryTime}`
      : `• *Horario:* Lo antes posible`;

    let paymentMethodName = "Efectivo";
    if (formData.paymentMethod === 'transfer') {
      paymentMethodName = 'Transferencia bancaria a cada comercio';
    } else if (formData.paymentMethod === 'mercadopago') {
      paymentMethodName = `Mercado Pago${this.bankDetails.mercadoPagoAlias ? ` (Alias: ${this.bankDetails.mercadoPagoAlias})` : ''}`;
    }

    const cashNote = (formData.paymentMethod === 'cash' && formData.cashAmount) 
      ? `\n• *Paga con:* $${formData.cashAmount}` 
      : '';
    const transferNote = formData.paymentMethod === 'transfer'
      ? `\n${this.getTransferPayments(cart).map(payment =>
        `• *Transferencia a ${payment.businessName}:* Alias ${payment.transferAlias || 'a confirmar'} · ${cart.formatCurrency(payment.total)}`
      ).join('\n')}`
      : '';

    const message = 
`¡Hola GOD MARKET! ✦
*NUEVO PEDIDO MARKETPLACE #${orderId}*
🛵 *LOGÍSTICA: ENVÍO A CARGO DEL VENDEDOR*

🏪 *LOCALES / VENDEDORES:* ${businessesListStr}

━━━━━━━━━━━━━━━━━━━━
◆ *RESUMEN DE PRODUCTOS:*${itemsText}

• *Subtotal (Precio de local):* ${cart.formatCurrency(cart.getSubtotal())}
${cart.getServiceFee() === 0 && cart.getWaivedServiceFee() > 0
  ? `• *Servicio GOD MARKET (${serviceFeePercent}%):* $0 (¡100% BONIFICADO · Ahorraste ${cart.formatCurrency(cart.getWaivedServiceFee())}!)`
  : `• *Servicio GOD MARKET (${serviceFeePercent}%):* ${cart.formatCurrency(cart.getServiceFee())}`}
${deliveryText}
• *TOTAL A PAGAR:* ${cart.formatCurrency(cart.getTotal())}
━━━━━━━━━━━━━━━━━━━━

► *DATOS PARA LA ENTREGA:*
- *Cliente:* ${formData.fullName}
- *Teléfono:* ${formData.phone}
${scheduleText}
- *Forma de Pago:* ${paymentMethodName}${cashNote}${transferNote}
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
      ? `¡Hola GOD MARKET! ✦ Adjunto el comprobante de pago de Mercado Pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`
      : `¡Hola GOD MARKET! ✦ Adjunto el comprobante de pago de mi pedido #${orderId} por un total de ${totalFormatted}. ¡Muchas gracias!`;
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

  async persistOrder(order) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: order.orderId,
        customerName: order.formData.fullName,
        customerPhone: order.formData.phone,
        deliveryType: order.deliveryType,
        paymentMethod: order.paymentMethod,
        address: order.formData.address,
        apartment: order.formData.apartment,
        zone: order.formData.zone,
        deliveryTime: order.formData.deliveryTime,
        comments: order.formData.comments,
        cashAmount: order.formData.cashAmount,
        items: order.items
      })
    });

    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.orders) || result.orders.length === 0) {
      throw new Error(result.error || 'No se pudo registrar el pedido. Intenta nuevamente.');
    }
    return result.orders;
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

  async processOrder(formData, cart) {
    const orderId = this.generateOrderNumber();
    const whatsappWindow = window.open('about:blank', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    const subtotal = cart.getSubtotal();
    const serviceFee = cart.getServiceFee();
    const waivedServiceFee = cart.getWaivedServiceFee();
    const total = cart.getTotal();
    const totalFormatted = cart.formatCurrency(total);
    const subtotalFormatted = cart.formatCurrency(subtotal);
    const serviceFeeFormatted = cart.formatCurrency(serviceFee);
    const waivedServiceFeeFormatted = cart.formatCurrency(waivedServiceFee);
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
      subtotal,
      serviceFee,
      standardServiceFeeRate: cart.getStandardServiceFeeRate(),
      waivedServiceFee,
      total,
      totalFormatted,
      subtotalFormatted,
      serviceFeeFormatted,
      waivedServiceFeeFormatted,
      deliveryType: cart.deliveryType,
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

    try {
      const persistedOrders = await this.persistOrder(this.lastOrder);
      this.lastOrder.serverOrderIds = persistedOrders.map(order => order.id);
      if (formData.paymentMethod === 'transfer') {
        this.lastOrder.transferPayments = persistedOrders.map(order => ({
          businessId: order.businessId,
          businessName: order.items?.[0]?.product?.businessName || 'Comercio',
          transferAlias: order.transferAlias || '',
          transferAccountHolder: order.transferAccountHolder || '',
          total: Number(order.total) || 0
        }));
      }
    } catch (error) {
      if (whatsappWindow) whatsappWindow.close();
      throw error;
    }

    try {
      localStorage.setItem('dulce_last_order', JSON.stringify(this.lastOrder));
    } catch (error) {
      console.warn('No se pudo guardar el último pedido en este dispositivo:', error);
    }
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

    // Navegar la pestaña abierta durante el gesto del usuario tras confirmar el pedido en el servidor.
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;

    // Limpiar carrito
    cart.clearCart();

    return this.lastOrder;
  }
}

// Instancia global
window.checkoutHandler = new CheckoutHandler();
