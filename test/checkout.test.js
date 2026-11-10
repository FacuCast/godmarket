const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const checkoutSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'checkout.js'), 'utf8') +
  '\nwindow.CheckoutHandler = CheckoutHandler;';

let randomSequence = 0;

function createCheckout(businesses) {
  const businessById = new Map(businesses.map(business => [business.id, business]));
  const window = {
    crypto: {
      getRandomValues(bytes) {
        randomSequence += 1;
        bytes.forEach((_, index) => {
          bytes[index] = randomSequence + index;
        });
        return bytes;
      }
    },
    productManager: {
      getBusinessById: id => businessById.get(id)
    }
  };
  const context = {
    window,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => {},
    console
  };
  vm.runInNewContext(checkoutSource, context);
  return new window.CheckoutHandler();
}

function item(businessId, price, quantity = 1) {
  return { product: { businessId, businessName: businessId, price }, quantity };
}

test('builds transfer alias and per-business total for mixed-vendor carts', () => {
  const checkout = createCheckout([
    {
      id: 'one',
      name: 'Comercio Uno',
      transferAlias: 'uno.mp',
      transferAccountHolder: 'Titular Uno',
      deliveryFee: 1000,
      freeShippingFrom: 45000,
      serviceFeeRate: 0.1
    },
    {
      id: 'two',
      name: 'Comercio Dos',
      transferAlias: 'dos.mp',
      deliveryFee: 1500,
      freeShippingFrom: 25000,
      serviceFeeRate: 0
    }
  ]);
  const cart = {
    items: [item('one', 12000), item('two', 30000)],
    deliveryType: 'delivery',
    getServiceFeeRateForItem: productItem =>
      productItem.product.businessId === 'one' ? 0.1 : 0
  };

  const payments = checkout.getTransferPayments(cart);
  assert.equal(payments.length, 2);
  assert.equal(payments[0].transferAlias, 'uno.mp');
  assert.equal(payments[0].total, 14200);
  assert.equal(payments[1].transferAlias, 'dos.mp');
  assert.equal(payments[1].total, 30000);
});

test('generates collision-free order numbers across separate devices and formats WhatsApp phones', () => {
  const checkoutA = createCheckout([]);
  const checkoutB = createCheckout([]);
  const idA = checkoutA.generateOrderNumber();
  const idB = checkoutB.generateOrderNumber();

  assert.match(idA, /^ORD-[A-Za-z0-9_-]{3,20}$/);
  assert.match(idB, /^ORD-[A-Za-z0-9_-]{3,20}$/);
  assert.notEqual(idA, idB);

  const window = {};
  vm.runInNewContext(checkoutSource, {
    window,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => {},
    console
  });
  assert.equal(window.formatWhatsAppPhone('11 5544-3322'), '5491155443322');
  assert.equal(window.formatWhatsAppPhone('5491155443322'), '5491155443322');
  assert.equal(window.formatWhatsAppPhone('01155443322'), '5491155443322');
});
