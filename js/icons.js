/**
 * GOD MARKET — Sistema de Iconografía Editorial Propia (SVG Vectorial Unificado)
 * Trazo consistente 1.65px, grilla 24x24, sin emojis de sistema.
 */
(function () {
  const ICON_PATHS = {
    // Emblema minimalista de marca para header y menú (legible desde 24px)
    'brand-mark':
      '<circle cx="12" cy="12" r="10" stroke-width="1.35"/>' +
      '<circle cx="12" cy="12" r="7.2" stroke-width="0.9" opacity="0.55"/>' +
      '<path d="M12 6.6 L13.1 10.6 L17.1 12 L13.1 13.4 L12 17.4 L10.9 13.4 L6.9 12 L10.9 10.6 Z" fill="currentColor" stroke="none"/>',

    // Categorías y especialidad gastronómica
    'coffee':
      '<path d="M17 8h1.5a3 3 0 1 1 0 6H17"/>' +
      '<path d="M4 8h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/>' +
      '<path d="M3 21h15"/>' +
      '<path d="M8 4.5c0-1 .8-1.5.8-2.5"/>' +
      '<path d="M12 4.5c0-1 .8-1.5.8-2.5"/>',

    'croissant':
      '<path d="M4.6 13.11 5.79 10.1a1.8 1.8 0 0 1 1.66-1.1h.05c1.1 0 2 .9 2 2v4.5"/>' +
      '<path d="M19.4 13.11 18.21 10.1a1.8 1.8 0 0 0-1.66-1.1h-.05c-1.1 0-2 .9-2 2v4.5"/>' +
      '<path d="M9.5 10.5c0-1.93 1.12-3.5 2.5-3.5s2.5 1.57 2.5 3.5V16c0 1.1-.9 2-2 2h-1a2 2 0 0 1-2-2v-5.5Z"/>' +
      '<path d="M4.6 13.11A2.75 2.75 0 0 0 2 15.8c0 1.22.98 2.2 2.2 2.2h2.3c1.66 0 3-1.34 3-3"/>' +
      '<path d="M19.4 13.11A2.75 2.75 0 0 1 22 15.8c0 1.22-.98 2.2-2.2 2.2h-2.3c-1.66 0-3-1.34-3-3"/>',

    'patisserie':
      '<path d="M12 4a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 4Z"/>' +
      '<path d="M4 16a8 8 0 0 1 16 0"/>' +
      '<path d="M2.5 16h19"/>' +
      '<path d="M12 16v4"/>' +
      '<path d="M8 20h8"/>',

    'leaf':
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/>' +
      '<path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',

    'drinks':
      '<path d="m18 8-1.3 11.2a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8L6 8"/>' +
      '<path d="M4.5 8h15"/>' +
      '<path d="M7.5 8 9 4.5h6L16.5 8"/>' +
      '<path d="m14.5 2-1.2 4.5"/>',

    'gift':
      '<rect x="3" y="8" width="18" height="4" rx="1"/>' +
      '<path d="M12 8v13"/>' +
      '<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>' +
      '<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',

    'cookie':
      '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>' +
      '<circle cx="8.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="14.5" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="10.5" cy="15.5" r="0.8" fill="currentColor" stroke="none"/>',

    // Comercio, compras y logística
    'bag':
      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>' +
      '<path d="M3 6h18"/>' +
      '<path d="M16 10a4 4 0 0 1-8 0"/>',

    'store':
      '<path d="m3 7 1.4-3.5A1.5 1.5 0 0 1 5.8 2.5h12.4a1.5 1.5 0 0 1 1.4 1L21 7"/>' +
      '<path d="M3 7v1.5a2.5 2.5 0 0 0 5 0V7"/>' +
      '<path d="M8 7v1.5a2.5 2.5 0 0 0 4 2 2.5 2.5 0 0 0 4-2V7"/>' +
      '<path d="M16 7v1.5a2.5 2.5 0 0 0 5 0V7"/>' +
      '<path d="M5 11v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V11"/>' +
      '<path d="M10 21.5v-6h4v6"/>',

    'delivery':
      '<circle cx="6.5" cy="17.5" r="2.5"/>' +
      '<circle cx="17.5" cy="17.5" r="2.5"/>' +
      '<path d="M9 17.5h6"/>' +
      '<path d="M4 17.5H3v-5a2 2 0 0 1 2-2h6l2.5 4h4.5a2 2 0 0 1 2 2v1"/>' +
      '<path d="M13 7h3l2 4"/>' +
      '<path d="M5 7h4"/>',

    'package':
      '<path d="M16.5 9.4 7.55 4.24"/>' +
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>' +
      '<polyline points="3.29 7 12 12 20.71 7"/>' +
      '<line x1="12" y1="22" x2="12" y2="12"/>',

    // Ubicación y mapas
    'map-pin':
      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
      '<circle cx="12" cy="10" r="3"/>',

    'map':
      '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>' +
      '<line x1="9" y1="3" x2="9" y2="18"/>' +
      '<line x1="15" y1="6" x2="15" y2="21"/>',

    'gps':
      '<circle cx="12" cy="12" r="7"/>' +
      '<circle cx="12" cy="12" r="2.2"/>' +
      '<line x1="12" y1="2" x2="12" y2="5"/>' +
      '<line x1="12" y1="19" x2="12" y2="22"/>' +
      '<line x1="2" y1="12" x2="5" y2="12"/>' +
      '<line x1="19" y1="12" x2="22" y2="12"/>',

    // Navegación y acciones
    'home':
      '<path d="m3 10 9-7 9 7v10a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V10Z"/>' +
      '<path d="M9 21.5v-7h6v7"/>',

    'search':
      '<circle cx="11" cy="11" r="7.5"/>' +
      '<path d="m20.5 20.5-4.1-4.1"/>',

    'arrow-right':
      '<path d="M5 12h14"/>' +
      '<path d="m13 6 6 6-6 6"/>',

    'arrow-left':
      '<path d="M19 12H5"/>' +
      '<path d="m11 18-6-6 6-6"/>',

    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',

    'check-circle':
      '<circle cx="12" cy="12" r="9.5"/>' +
      '<path d="m8.5 12.2 2.4 2.4 4.8-5.1"/>',

    'verified':
      '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16" stroke="currentColor"/>' +
      '<path d="m8.8 12.2 2.2 2.2 4.4-4.6"/>',

    'alert':
      '<path d="m12 3.5 9.5 16.5a1 1 0 0 1-.87 1.5H3.37a1 1 0 0 1-.87-1.5L12 3.5Z"/>' +
      '<path d="M12 9.5v4.5"/>' +
      '<circle cx="12" cy="17.3" r="0.8" fill="currentColor" stroke="none"/>',

    'info':
      '<circle cx="12" cy="12" r="9.5"/>' +
      '<path d="M12 16v-4"/>' +
      '<circle cx="12" cy="8.2" r="0.8" fill="currentColor" stroke="none"/>',

    'clock':
      '<circle cx="12" cy="12" r="9.5"/>' +
      '<polyline points="12 7 12 12 15.5 14"/>',

    'calendar':
      '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/>' +
      '<path d="M16 2.5v4"/>' +
      '<path d="M8 2.5v4"/>' +
      '<path d="M3 10h18"/>',

    'sun':
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2.5v2"/><path d="M12 19.5v2"/>' +
      '<path d="m5.2 5.2 1.4 1.4"/><path d="m17.4 17.4 1.4 1.4"/>' +
      '<path d="M2.5 12h2"/><path d="M19.5 12h2"/>' +
      '<path d="m5.2 18.8 1.4-1.4"/><path d="m17.4 6.6 1.4-1.4"/>',

    'moon':
      '<path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7Z"/>',

    'star':
      '<polygon points="12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5 12 2.6"/>',

    'star-filled':
      '<polygon points="12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5 12 2.6" fill="currentColor" stroke="none"/>',

    'heart':
      '<path d="M19.5 12.6 12 20l-7.5-7.4a5.1 5.1 0 0 1 7.2-7.2l.3.3.3-.3a5.1 5.1 0 0 1 7.2 7.2Z"/>',

    'heart-filled':
      '<path d="M19.5 12.6 12 20l-7.5-7.4a5.1 5.1 0 0 1 7.2-7.2l.3.3.3-.3a5.1 5.1 0 0 1 7.2 7.2Z" fill="currentColor" stroke="currentColor"/>',

    'bookmark':
      '<path d="m19 21-7-4.5L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/>',

    'user':
      '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="12" cy="7.5" r="4"/>',

    'users':
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7.5" r="3.5"/>' +
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 4.13a3.5 3.5 0 0 1 0 6.74"/>',

    'receipt':
      '<path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5 5 3Z"/>' +
      '<path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h3.5"/>',

    'copy':
      '<rect x="9" y="9" width="12" height="12" rx="2"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',

    'trash':
      '<path d="M3 6h18"/>' +
      '<path d="M8 6V4a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4v2"/>' +
      '<path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6"/><path d="M14 11v6"/>',

    'edit':
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/>',

    'save':
      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>' +
      '<polyline points="17 21 17 13 7 13 7 21"/>' +
      '<polyline points="7 3 7 8 15 8"/>',

    'refresh':
      '<path d="M21 12a9 9 0 0 0-15.4-6.4L3 8"/>' +
      '<path d="M3 3v5h5"/>' +
      '<path d="M3 12a9 9 0 0 0 15.4 6.4L21 16"/>' +
      '<path d="M16 16h5v5"/>',

    'eye':
      '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="2.8"/>',

    'log-out':
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
      '<polyline points="16 17 21 12 16 7"/>' +
      '<line x1="21" y1="12" x2="9" y2="12"/>',

    'smartphone':
      '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/>' +
      '<line x1="11" y1="18" x2="13" y2="18"/>',

    'download':
      '<path d="M12 3v12"/>' +
      '<path d="m7 10 5 5 5-5"/>' +
      '<path d="M4 19h16"/>',

    'upload':
      '<path d="M12 15V3"/>' +
      '<path d="m7 8 5-5 5 5"/>' +
      '<path d="M4 19h16"/>',

    'share':
      '<path d="M12 15V3"/>' +
      '<path d="m8 7 4-4 4 4"/>' +
      '<path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>',

    'camera':
      '<path d="M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 7H19a2 2 0 0 1 2 2v9Z"/>' +
      '<circle cx="12" cy="13" r="3.2"/>',

    'cloud':
      '<path d="M17.5 19H9a5 5 0 0 1-.8-9.93A6 6 0 0 1 19.7 10a4.5 4.5 0 0 1-2.2 9Z"/>',

    'sliders':
      '<line x1="4" y1="7" x2="20" y2="7"/>' +
      '<circle cx="9" cy="7" r="2" fill="currentColor"/>' +
      '<line x1="4" y1="12" x2="20" y2="12"/>' +
      '<circle cx="16" cy="12" r="2" fill="currentColor"/>' +
      '<line x1="4" y1="17" x2="20" y2="17"/>' +
      '<circle cx="11" cy="17" r="2" fill="currentColor"/>',

    'shield':
      '<path d="M12 2.5 4.5 5.5v6c0 5 3.3 8.8 7.5 10 4.2-1.2 7.5-5 7.5-10v-6L12 2.5Z"/>' +
      '<path d="m9.2 12.2 2 2 3.8-4"/>',

    'scale':
      '<path d="M12 3v18"/>' +
      '<path d="M8 21h8"/>' +
      '<path d="M4 7h16"/>' +
      '<path d="m6 7-2.5 6a3 3 0 0 0 5 0L6 7Z"/>' +
      '<path d="m18 7-2.5 6a3 3 0 0 0 5 0L18 7Z"/>',

    'file-text':
      '<path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L14 2.5Z"/>' +
      '<polyline points="14 2.5 14 8.5 20 8.5"/>' +
      '<line x1="8" y1="13" x2="16" y2="13"/>' +
      '<line x1="8" y1="17" x2="13" y2="17"/>',

    'lock':
      '<rect x="4" y="11" width="16" height="10" rx="2"/>' +
      '<path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',

    'undo':
      '<path d="M9 14 4 9l5-5"/>' +
      '<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',

    'message':
      '<path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 20.5l1.5-5.2A8.5 8.5 0 1 1 21 11.5Z"/>',

    'whatsapp':
      '<path d="M20.5 11.8a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.3-4.4a8.5 8.5 0 1 1 15.7-4.3Z"/>' +
      '<path d="M9.3 9.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .6l-.5.6c-.1.2-.2.3-.1.5.4.8 1.2 1.6 2 2 .2.1.4.1.5-.1l.6-.6c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5v.5c0 .4-.3.9-.8 1.1-.6.2-1.4.3-2.6-.1-1.6-.6-3.4-2.1-4.3-3.7-.7-1.1-.9-2-.6-2.9.1-.3.3-.5.5-.6Z" stroke-width="1.35"/>',

    'bank':
      '<path d="M3 10h18"/>' +
      '<path d="M5 10v8"/><path d="M9.5 10v8"/><path d="M14.5 10v8"/><path d="M19 10v8"/>' +
      '<path d="M3 20h18"/>' +
      '<path d="m12 3 9 5H3l9-5Z"/>',

    'card':
      '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/>' +
      '<line x1="2.5" y1="10" x2="21.5" y2="10"/>' +
      '<line x1="6.5" y1="15" x2="10.5" y2="15"/>',

    'cash':
      '<rect x="2.5" y="6" width="19" height="12" rx="2"/>' +
      '<circle cx="12" cy="12" r="2.6"/>' +
      '<path d="M6 10v4"/><path d="M18 10v4"/>',

    'candle':
      '<path d="M12 3c1.3 1.4 1.8 2.6 1.2 3.8a1.4 1.4 0 0 1-2.4 0C10.2 5.6 10.7 4.4 12 3Z"/>' +
      '<rect x="9.5" y="10" width="5" height="11" rx="1"/>' +
      '<line x1="7" y1="21" x2="17" y2="21"/>',

    'utensils':
      '<path d="M7 3v7a2.5 2.5 0 0 0 5 0V3"/>' +
      '<path d="M9.5 3v18"/>' +
      '<path d="M17 3v18"/>' +
      '<path d="M17 3a3.5 3.5 0 0 1 3 3.5V12h-3"/>',

    'award':
      '<circle cx="12" cy="8.5" r="5.5"/>' +
      '<path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>',

    'grid':
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>' +
      '<rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>' +
      '<rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>' +
      '<rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',

    'pen':
      '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',

    'tag':
      '<path d="M12.5 3H5a2 2 0 0 0-2 2v7.5l8.8 8.8a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8L12.5 3Z"/>' +
      '<circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>',

    'laptop':
      '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8"/>' +
      '<path d="M2 19h20"/>',

    'chef':
      '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 9.18 0A4 4 0 0 1 18 13.87V20H6v-6.13Z"/>' +
      '<line x1="6" y1="17" x2="18" y2="17"/>',

    'volume-on':
      '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19 11 5"/>' +
      '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>' +
      '<path d="M18.8 5.8a9 9 0 0 1 0 12.4"/>',

    'volume-off':
      '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19 11 5"/>' +
      '<line x1="22" y1="9" x2="16" y2="15"/>' +
      '<line x1="16" y1="9" x2="22" y2="15"/>'
  };

  function gmIcon(name, className = '', size = 18) {
    const body = ICON_PATHS[name] || ICON_PATHS['store'];
    const cls = className ? `gm-icon ${className}` : 'gm-icon';
    return `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function gmAvatarIcon(avatarValue, size = 18) {
    const val = String(avatarValue || '').trim().toLowerCase();
    const map = {
      '☕': 'coffee',
      'coffee': 'coffee',
      'cafeteria': 'coffee',
      '🥐': 'croissant',
      'croissant': 'croissant',
      'boulangerie': 'croissant',
      '🍰': 'patisserie',
      '🧁': 'patisserie',
      '🎂': 'patisserie',
      'patisserie': 'patisserie',
      'pasteleria': 'patisserie',
      '🥑': 'leaf',
      'healthy': 'leaf',
      'brunch': 'leaf',
      '🎁': 'gift',
      'boxes': 'gift',
      'gift': 'gift',
      '🍪': 'cookie',
      'cookies': 'cookie',
      '🏪': 'store',
      'store': 'store'
    };
    const iconName = map[val] || 'store';
    return gmIcon(iconName, 'gm-avatar-svg', size);
  }

  function gmCleanText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s·•-]+/, '')
      .trim();
  }

  function gmHydrateIcons(root) {
    const scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-gm-icon]').forEach((el) => {
      const name = el.getAttribute('data-gm-icon');
      const size = parseInt(el.getAttribute('data-gm-size') || '18', 10) || 18;
      const cls = el.getAttribute('data-gm-class') || '';
      el.innerHTML = gmIcon(name, cls, size);
      el.classList.add('gm-icon-host');
    });
  }

  window.gmIcon = gmIcon;
  window.gmAvatarIcon = gmAvatarIcon;
  window.gmCleanText = gmCleanText;
  window.gmHydrateIcons = gmHydrateIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => gmHydrateIcons(document));
  } else {
    gmHydrateIcons(document);
  }
})();
