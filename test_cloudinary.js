const crypto = require('crypto');

async function testUpload() {
  const cloudName = 'dz6apjevd';
  const apiKey = '327352685728933';
  const apiSecret = 'qSBrq-Xwz6wgWhT5M54ddx-6wBo';

  // 1x1 transparent PNG sample
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = 'pasteleria_productos';
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', sampleBase64);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('folder', folder);
  formData.append('signature', signature);

  console.log('Testing Cloudinary upload to cloud:', cloudName);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      console.error('❌ Error de Cloudinary:', data.error);
    } else {
      console.log('✅ ¡Subida a Cloudinary 100% EXITOSA!');
      console.log('   URL de la imagen:', data.secure_url);
    }
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  }
}

testUpload();
