const http = require('http');

const endpoints = [
  '/',
  '/manifest.json',
  '/sw.js',
  '/css/main.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/products.js',
  '/js/cart.js',
  '/js/checkout.js',
  '/js/cloudinary.js',
  '/js/admin.js',
  '/js/app.js',
  '/assets/icons/icon.svg'
];

let completed = 0;
let errors = 0;

endpoints.forEach(ep => {
  http.get('http://localhost:3000' + ep, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`[PASS 200 OK] ${ep} (${data.length} bytes)`);
      } else {
        console.error(`[FAIL ${res.statusCode}] ${ep}`);
        errors++;
      }
      completed++;
      if (completed === endpoints.length) {
        if (errors === 0) {
          console.log('\n>>> TODOS LOS RECURSOS ESTAN ACTIVOS Y CARGADOS CORRECTAMENTE (100% OK) <<<');
        } else {
          console.error(`\nHubo ${errors} errores en la verificación.`);
        }
      }
    });
  }).on('error', err => {
    console.error(`[CONN ERROR] ${ep}: ${err.message}`);
  });
});
