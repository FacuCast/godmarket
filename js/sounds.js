/**
 * GOD MARKET — Motor de Sonido Táctil Editorial (Web Audio API)
 * Síntesis acústica cálida y orgánica (madera, cerámica y campanas suaves)
 * Sin archivos externos, latencia cero, silenciable en 1 clic.
 */
(function () {
  const STORAGE_KEY = 'godmarket_sound_enabled';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.enabled = this.loadPreference();
      this._lastPlayTime = 0;
      this._lastPriority = 0;

      // Desbloquear AudioContext en la primera interacción del usuario (requisito Safari/Chrome)
      const unlock = () => {
        this.ensureContext();
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
        window.addEventListener('keydown', unlock, { capture: true, passive: true });
      }

      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.syncToggleButtons());
        } else {
          this.syncToggleButtons();
        }
      }
    }

    loadPreference() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === null ? true : saved === 'true';
      } catch (e) {
        return true;
      }
    }

    savePreference() {
      try {
        localStorage.setItem(STORAGE_KEY, String(this.enabled));
      } catch (e) {}
    }

    isEnabled() {
      return this.enabled;
    }

    ensureContext() {
      if (typeof window === 'undefined') return null;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        if (!this.ctx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.82;

          // Filtro pasa-bajos suave maestro para calidez orgánica sin frecuencias estridentes
          this.masterFilter = this.ctx.createBiquadFilter();
          this.masterFilter.type = 'lowpass';
          this.masterFilter.frequency.value = 3400;
          this.masterFilter.Q.value = 0.6;

          this.masterGain.connect(this.masterFilter);
          this.masterFilter.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      } catch (e) {
        return null;
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      this.savePreference();
      this.syncToggleButtons();
      if (this.enabled) {
        this.play('toggleOn');
      }
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(
          this.enabled ? 'Sonidos de interfaz activados' : 'Sonidos silenciados',
          'info'
        );
      }
      return this.enabled;
    }

    syncToggleButtons() {
      if (typeof document === 'undefined') return;
      const iconName = this.enabled ? 'volume-on' : 'volume-off';
      const label = this.enabled ? 'Silenciar sonidos' : 'Activar sonidos';

      document.querySelectorAll('[data-sound-toggle]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(this.enabled));
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        btn.classList.toggle('is-muted', !this.enabled);

        const iconHost = btn.querySelector('[data-sound-icon]');
        if (iconHost) {
          iconHost.setAttribute('data-gm-icon', iconName);
          if (window.gmIcon) {
            const size = parseInt(iconHost.getAttribute('data-gm-size') || '17', 10) || 17;
            iconHost.innerHTML = window.gmIcon(iconName, '', size);
          }
        }
        const textEl = btn.querySelector('[data-sound-label]');
        if (textEl) {
          textEl.textContent = this.enabled ? 'Sonidos: Activados' : 'Sonidos: Silenciados';
        }
      });
    }

    // Generador de nota acústica cálida con envolvente exponencial suave
    tone({
      freq = 520,
      endFreq = null,
      delay = 0,
      duration = 0.14,
      gain = 0.1,
      type = 'sine',
      cutoff = 2400
    }) {
      const ctx = this.ctx;
      if (!ctx || !this.masterGain) return;

      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const amp = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + duration);
      }

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, start);
      filter.Q.value = 0.7;

      // Ataque suave de 4ms para eliminar clicks digitales
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.linearRampToValueAtTime(gain, start + 0.005);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(filter);
      filter.connect(amp);
      amp.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + duration + 0.02);
    }

    play(soundName) {
      if (!this.enabled) return;

      const priorities = {
        tap: 1,
        open: 1,
        stepUp: 2,
        stepDown: 2,
        copy: 2,
        remove: 2,
        favorite: 3,
        addToCart: 3,
        toggleOn: 3,
        error: 3,
        success: 4,
        orderSuccess: 5
      };

      const priority = priorities[soundName] || 1;
      const now = Date.now();
      // Evitar sonidos encimados si dos eventos disparan en < 45ms
      if (now - this._lastPlayTime < 45 && priority <= this._lastPriority) {
        return;
      }

      const ctx = this.ensureContext();
      if (!ctx) return;

      this._lastPlayTime = now;
      this._lastPriority = priority;

      try {
        switch (soundName) {
          case 'tap':
            // Toque sutil de madera/cerámica (filtros, pestañas, chips)
            this.tone({ freq: 440, endFreq: 260, duration: 0.036, gain: 0.055, type: 'sine', cutoff: 1400 });
            break;

          case 'open':
            // Apertura aérea suave (carrito, detalle de producto, menú)
            this.tone({ freq: 240, endFreq: 350, duration: 0.075, gain: 0.05, type: 'sine', cutoff: 1200 });
            break;

          case 'stepUp':
            // Incrementar cantidad (+)
            this.tone({ freq: 523.25, endFreq: 554.37, duration: 0.055, gain: 0.065, type: 'sine', cutoff: 1800 });
            break;

          case 'stepDown':
            // Reducir cantidad (-)
            this.tone({ freq: 415.3, endFreq: 370, duration: 0.055, gain: 0.058, type: 'sine', cutoff: 1500 });
            break;

          case 'addToCart':
            // Dos notas cálidas tipo marimba/taza de porcelana (D5 -> A5)
            this.tone({ freq: 587.33, delay: 0, duration: 0.14, gain: 0.095, type: 'triangle', cutoff: 2100 });
            this.tone({ freq: 880.0, delay: 0.058, duration: 0.22, gain: 0.105, type: 'sine', cutoff: 2600 });
            this.tone({ freq: 1318.5, delay: 0.062, duration: 0.16, gain: 0.028, type: 'sine', cutoff: 2800 });
            break;

          case 'remove':
            // Descenso apagado y discreto al quitar producto o favorito
            this.tone({ freq: 420, delay: 0, duration: 0.075, gain: 0.065, type: 'sine', cutoff: 1300 });
            this.tone({ freq: 310, delay: 0.048, duration: 0.11, gain: 0.055, type: 'sine', cutoff: 1100 });
            break;

          case 'favorite':
            // Destello armónico suave al guardar favorito (F#5 -> B5)
            this.tone({ freq: 739.99, delay: 0, duration: 0.15, gain: 0.075, type: 'sine', cutoff: 2400 });
            this.tone({ freq: 987.77, delay: 0.055, duration: 0.24, gain: 0.085, type: 'sine', cutoff: 2800 });
            break;

          case 'copy':
            // Doble pulso cristalino muy leve al copiar alias/CVU/orden
            this.tone({ freq: 659.25, delay: 0, duration: 0.07, gain: 0.06, type: 'sine', cutoff: 2200 });
            this.tone({ freq: 987.77, delay: 0.042, duration: 0.11, gain: 0.065, type: 'sine', cutoff: 2500 });
            break;

          case 'toggleOn':
            // Confirmación amable al activar sonidos
            this.tone({ freq: 523.25, delay: 0, duration: 0.11, gain: 0.075, type: 'sine', cutoff: 2000 });
            this.tone({ freq: 783.99, delay: 0.055, duration: 0.18, gain: 0.085, type: 'sine', cutoff: 2400 });
            break;

          case 'success':
            // Acorde boutique ascendente para confirmaciones del portal/vendedor
            this.tone({ freq: 523.25, delay: 0, duration: 0.16, gain: 0.08, type: 'triangle', cutoff: 2000 });
            this.tone({ freq: 659.25, delay: 0.06, duration: 0.19, gain: 0.085, type: 'sine', cutoff: 2400 });
            this.tone({ freq: 783.99, delay: 0.12, duration: 0.28, gain: 0.09, type: 'sine', cutoff: 2600 });
            break;

          case 'orderSuccess':
            // Arpegio cálido Maj9 de celebración al confirmar un pedido
            this.tone({ freq: 523.25, delay: 0.0, duration: 0.28, gain: 0.095, type: 'triangle', cutoff: 2100 });
            this.tone({ freq: 659.25, delay: 0.065, duration: 0.30, gain: 0.095, type: 'sine', cutoff: 2400 });
            this.tone({ freq: 783.99, delay: 0.13, duration: 0.34, gain: 0.10, type: 'sine', cutoff: 2600 });
            this.tone({ freq: 987.77, delay: 0.195, duration: 0.42, gain: 0.085, type: 'sine', cutoff: 2800 });
            this.tone({ freq: 1174.66, delay: 0.26, duration: 0.56, gain: 0.075, type: 'sine', cutoff: 3000 });
            break;

          case 'error':
            // Doble golpe grave apagado (informa sin asustar ni sonar a alarma)
            this.tone({ freq: 230, endFreq: 195, delay: 0, duration: 0.10, gain: 0.08, type: 'sine', cutoff: 750 });
            this.tone({ freq: 190, endFreq: 155, delay: 0.095, duration: 0.14, gain: 0.075, type: 'sine', cutoff: 650 });
            break;

          default:
            break;
        }
      } catch (e) {
        // Silencioso en navegadores restringidos
      }
    }
  }

  window.soundEngine = new SoundEngine();
  window.gmSound = (name) => window.soundEngine.play(name);
})();
