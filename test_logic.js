// Test logic verification
const fs = require('fs');

// Mock browser objects
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = val; },
  removeItem(key) { delete this.store[key]; }
};
global.window = global;

// Load modules
eval(fs.readFileSync('./js/products.js', 'utf8'));
eval(fs.readFileSync('./js/cart.js', 'utf8'));
eval(fs.readFileSync('./js/checkout.js', 'utf8'));
eval(fs.readFileSync('./js/cloudinary.js', 'utf8'));

console.log('1. Testing ProductManager...');
const products = window.productManager.getAll();
console.log(`   Total products: ${products.length}`);
const tortas = window.productManager.getByCategory('tortas');
console.log(`   Tortas count: ${tortas.length}`);

console.log('2. Testing CartManager...');
window.cartManager.addItem(tortas[0], 2, { dedication: '¡Feliz Cumple!', candle: true });
console.log(`   Items in cart: ${window.cartManager.getItemCount()}`);
console.log(`   Cart Subtotal: ${window.cartManager.getSubtotal()}`);
console.log(`   Cart Total with delivery: ${window.cartManager.getTotal()}`);

console.log('3. Testing WhatsApp Message Generator...');
const msg = window.checkoutHandler.generateWhatsAppMessage({
  fullName: 'Ana García',
  phone: '11 1234 5678',
  address: 'Av. Corrientes 1500',
  apartment: '2do A',
  zone: 'Tribunales',
  deliveryTime: 'Hoy 18:00 hs',
  paymentMethod: 'transfer',
  comments: 'Tocar timbre 2A'
}, window.cartManager);

console.log('--- GENERATED WHATSAPP MESSAGE ---');
console.log(msg);
console.log('----------------------------------');

if (msg.includes('11 1234 5678') && msg.includes('¡Feliz Cumple!') && msg.includes('DULCE.ATELIER.BA')) {
  console.log('>>> LOGIC VERIFICATION PASSED 100% <<<');
} else {
  console.error('Logic test failed!');
  process.exit(1);
}
