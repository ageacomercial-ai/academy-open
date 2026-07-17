/* ═══════════════════════════════════════════════════════════
   ACADEMY — PWA.JS
   Service Worker · Install Banner · Offline · Notificações
   Depende de: state.js, navigation.js
═══════════════════════════════════════════════════════════ */

let _pwaInstallPrompt = null;
let _pwaRegistration  = null;
let _pwaOffline       = false;

/* Trava de segurança — impede chamadas à API antes do splash */


/* ════════════════════════════════════════════════════════════
   1. SERVICE WORKER
════════════════════════════════════════════════════════════ */
function pwaRegistarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(reg => {
      _pwaRegistration = reg;
      /* Detectar update disponível */
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) {
            _mostrarUpdateBanner();
          }
        });
      });
      console.log('[PWA] SW registado:', reg.scope);
    })
    .catch(e => console.warn('[PWA] SW falhou:', e));

  /* Detectar mensagens do SW */
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATE_READY') _mostrarUpdateBanner();
  });
}

function _mostrarUpdateBanner() {
  const b = document.getElementById('pwa-update-banner');
  if (b) { b.style.display = 'flex'; setTimeout(() => b.classList.add('visivel'), 100); }
}

function pwaAplicarUpdate() {
  _pwaRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/* ════════════════════════════════════════════════════════════
   2. INSTALL PROMPT (Add to Home Screen)
════════════════════════════════════════════════════════════ */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaInstallPrompt = e;
  /* Só mostrar se não foi dispensado nesta sessão */
  if (!sessionStorage.getItem('pwa-install-dismissed')) {
    setTimeout(() => {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('visivel');
    }, 6000);
  }
});

window.addEventListener('appinstalled', () => {
  _pwaInstallPrompt = null;
  pwaFecharBanner();
  console.log('[PWA] App instalada');
});

async function pwaInstalar() {
  if (!_pwaInstallPrompt) {
    /* iOS: mostrar instruções manuais */
    _mostrarInstalacaoiOS();
    return;
  }
  _pwaInstallPrompt.prompt();
  const { outcome } = await _pwaInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    _pwaInstallPrompt = null;
    pwaFecharBanner();
    mostrarToast('✓ ACADEMY instalado!');
  }
}

function pwaFecharBanner() {
  sessionStorage.setItem('pwa-install-dismissed', '1');
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('visivel');
}

function _mostrarInstalacaoiOS() {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.8);backdrop-filter:blur(14px);display:flex;align-items:flex-end;justify-content:center;padding:20px';
  div.innerHTML = `
    <div style="background:var(--z2);border:1px solid var(--e1);border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center">
      <div style="font-size:28px;margin-bottom:12px">📱</div>
      <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Instalar no iPhone / iPad</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:20px">
        1. Toca em <strong style="color:var(--t1)">⬆️ Partilhar</strong> na barra do Safari<br/>
        2. Selecciona <strong style="color:var(--t1)">"Adicionar ao Ecrã Inicial"</strong><br/>
        3. Toca em <strong style="color:var(--b)">Adicionar</strong>
      </div>
      <button onclick="this.closest('div[style]').remove()" class="btn B w">OK, percebi</button>
    </div>`;
  document.body.appendChild(div);
}

/* ════════════════════════════════════════════════════════════
   3. ONLINE / OFFLINE
════════════════════════════════════════════════════════════ */
function pwaAtualizarEstadoRede() {
  const offline = !navigator.onLine;
  const el = document.getElementById('pwa-offline');
  if (!el) return;
  if (offline && !_pwaOffline) {
    el.classList.add('visivel');
    _pwaOffline = true;
    mostrarToast('⚡ Sem ligação — modo offline activo');
  } else if (!offline && _pwaOffline) {
    el.classList.remove('visivel');
    _pwaOffline = false;
    mostrarToast('✓ Ligação restabelecida');
  }
}

window.addEventListener('online',  pwaAtualizarEstadoRede);
window.addEventListener('offline', pwaAtualizarEstadoRede);

/* ════════════════════════════════════════════════════════════
   4. NOTIFICAÇÕES
════════════════════════════════════════════════════════════ */
async function pwaPedirPermissaoNotificacoes() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

async function pwaNotificar(titulo, corpo, opcoes = {}) {
  if (!(await pwaPedirPermissaoNotificacoes())) return;
  if (_pwaRegistration?.showNotification) {
    return _pwaRegistration.showNotification(titulo, {
      body: corpo, vibrate: [100, 50, 100],
      tag: opcoes.tag || 'academy', data: opcoes.data || {}, ...opcoes,
    });
  }
  return new Notification(titulo, { body: corpo, ...opcoes });
}

function pwaNotificarConclusaoCapitulo(numCaps) {
  pwaNotificar(
    '🎓 Trabalho concluído!',
    `${numCaps} capítulos gerados com sucesso. O teu documento está pronto.`,
    { tag: 'conclusao', data: { url: '/' } }
  );
}

/* ════════════════════════════════════════════════════════════
   5. SPLASH + STARTUP
════════════════════════════════════════════════════════════ */
function pwaOcultarSplash() {
  const splash = document.getElementById('pwa-splash');
  if (!splash) return;
  /* Splash cinematográfico ~3.2s total */
  setTimeout(() => {
    splash.classList.add('oculto');
    prontoParaConexao = true;
  }, 3100);
}

function pwaHandleStartupAction() {
  const params = new URLSearchParams(window.location.search);
  const acao   = params.get('acao');
  if (acao === 'criar') {
    setTimeout(() => { if (typeof irPara === 'function') irPara('tipo'); }, 500);
  }
}

/* ════════════════════════════════════════════════════════════
   6. INICIALIZAÇÃO
════════════════════════════════════════════════════════════ */
function pwaInit() {
  pwaRegistarSW();
  pwaAtualizarEstadoRede();
  if (document.readyState === 'complete') pwaOcultarSplash();
  else window.addEventListener('load', pwaOcultarSplash);
  pwaHandleStartupAction();
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) pwaFecharBanner();
  console.log('[PWA] Init · standalone:', isStandalone);
}
