const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const cartSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'cart.js'), 'utf8') +
  '\nwindow.CartManager = CartManager;';

function createCart(businesses) {
  const storage = new Map();
  const businessById = new Map(businesses.map(business => [business.id, business]));
  const productManager = {
    getBusinessById: id => businessById.get(id),
    getBusinessPromoState: businessOrId => {
      const business = typeof businessOrId === 'string'
        ? businessById.get(businessOrId)
        : businessOrId;
      return {
        isPromoActive: Boolean(business && business.isPromoActive),
        serviceFeeRate: business ? business.serviceFeeRate : 0.2,
        standardServiceFeeRate: business ? business.standardServiceFeeRate : 0.2
      };
    }
  };
  const window = { productManager };
  const context = {
    window,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    console
  };
  vm.runInNewContext(cartSource, context);
  return window.cartManager;
}

function item(businessId, price, quantity = 1, extra = {}) {
  return {
    product: { id: `${businessId}-${price}`, businessId, price, ...extra },
    quantity,
    customization: {}
  };
}

test('charges delivery per business instead of waiving it on a combined basket subtotal', () => {
  const cart = createCart([
    { id: 'one', deliveryFee: 1500, freeShippingFrom: 45000, serviceFeeRate: 0.2 },
    { id: 'two', deliveryFee: 2000, freeShippingFrom: 45000, serviceFeeRate: 0.2 }
  ]);
  cart.items = [item('one', 30000), item('two', 30000)];

  assert.equal(cart.getEffectiveDeliveryFee(), 3500);
});

test('applies each business shipping threshold and configured promotion fee', () => {
  const cart = createCart([
    {
      id: 'promo',
      deliveryFee: 1000,
      freeShippingFrom: 30000,
      isPromoActive: true,
      serviceFeeRate: 0,
      standardServiceFeeRate: 0.2
    },
    {
      id: 'standard',
      deliveryFee: 2000,
      freeShippingFrom: 20000,
      isPromoActive: false,
      serviceFeeRate: 0.1,
      standardServiceFeeRate: 0.1
    }
  ]);
  cart.items = [item('promo', 12000), item('standard', 25000)];

  assert.equal(cart.getServiceFee(), 2500);
  assert.equal(cart.getWaivedServiceFee(), 2400);
  assert.equal(cart.getEffectiveDeliveryFee(), 1000);
  assert.equal(cart.getTotal(), 40500);
});

test('pickup does not charge delivery for any business', () => {
  const cart = createCart([
    { id: 'one', deliveryFee: 1500, freeShippingFrom: 45000, serviceFeeRate: 0.2 },
    { id: 'two', deliveryFee: 2000, freeShippingFrom: 45000, serviceFeeRate: 0.2 }
  ]);
  cart.items = [item('one', 1000), item('two', 1000)];
  cart.setDeliveryType('pickup');

  assert.equal(cart.getEffectiveDeliveryFee(), 0);
});
