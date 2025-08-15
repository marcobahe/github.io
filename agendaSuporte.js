<!-- Support Booking - Topbar com popup/iframe (calibração + auto-zoom, sem scroll) -->
(function () {
  const BTN_ID        = "ff-support-topbar-btn";
  const POPUP_ID      = "ff-support-popup";
  const BACKDROP_ID   = "ff-support-popup-backdrop";
  const OLD_FAB_ID    = "ff-support-call-fab";
  const LABEL         = "Agende uma call de Suporte";

  const BOOKING_ID       = "zivoYfVcIU3qJwjIezcw";
  const BOOKING_SRC      = `https://link.fullfunnel.app/widget/booking/${BOOKING_ID}`;
  const EMBED_SCRIPT_SRC = "https://link.fullfunnel.app/js/form_embed.js";

  // Calibração e zoom
  const MIN_SCALE = 0.70;        // zoom mínimo (70%)
  const MAX_TRIES = 60;          // ~9s de espera (60 * 150ms)
  const TRY_EVERY = 150;         // intervalo do retry (ms)
  const MIN_OK_H  = 500;         // altura mínima aceitável do calendário (heurística)

  const HEADER_SELECTORS = [
    '.header-bar .container-fluid > .header--controls',
    '.header .container-fluid > .header--controls',
    '.hl_header .container-fluid > .hl_header--controls',
    '.main-header .container-fluid > .header-controls',
    '.top-bar .container-fluid > .controls',
    '.navbar .container-fluid > .nav-controls',
    '.header-controls', '.header--controls', '.nav-controls', '.controls'
  ];

  let popup=null, head=null, content=null, iframe=null, spinner=null, moIframe=null, retryIv=null;

  // ---------- utils ----------
  function ensureEmbedScript() {
    if (!document.querySelector(`script[src*="${EMBED_SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = EMBED_SCRIPT_SRC; s.type = "text/javascript"; s.async = true;
      document.body.appendChild(s);
    }
  }
  function findHeader() {
    for (const sel of HEADER_SELECTORS) { const el = document.querySelector(sel); if (el) return el; }
    return null;
  }
  function removeOldFab(){ const el = document.getElementById(OLD_FAB_ID); if (el) el.remove(); }

  // ---------- botão ----------
  function createBtn() {
    const btn = document.createElement("button");
    btn.id = BTN_ID; btn.type = "button";
    btn.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="ff-label">${LABEL}</span>
      </span>`;
    btn.setAttribute("aria-label", LABEL);
    btn.style.cssText = `
      background:#2563eb !important;color:#fff !important;border:none !important;
      padding:10px 14px !important;border-radius:6px !important;cursor:pointer !important;
      font-weight:600 !important;font-size:14px !important;margin-left:12px !important;
      transition:all .2s ease !important;box-shadow:0 2px 8px rgba(37,99,235,.25) !important;
      display:inline-flex !important;align-items:center !important;`;
    btn.onmouseenter = () => btn.style.background = '#1d4ed8';
    btn.onmouseleave = () => btn.style.background = '#2563eb';

    const mql = window.matchMedia("(max-width:1024px)");
    const toggle = () => { const s = btn.querySelector(".ff-label"); if (s) s.style.display = mql.matches ? "none" : "inline"; };
    toggle(); mql.addEventListener?.("change", toggle);

    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPopup(); };
    return btn;
  }

  // ---------- dimensionamento ----------
  function readNaturalH() {
    const s = parseInt(iframe?.style?.height || "", 10);
    if (Number.isFinite(s) && s > 0) return s;
    const g = parseInt((iframe && getComputedStyle(iframe).height) || "", 10);
    return Number.isFinite(g) && g > 0 ? g : null;
  }

  function fitPopupTo(naturalH) {
    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const headH = Math.round(head.getBoundingClientRect().height || 56);

    // base de largura
    let popupW = Math.min(1200, Math.floor(vw * 0.95));
    // posicionamento
    if (vw < 1200 || vh < 820) { // telas menores: centralizado
      popup.style.left = "50%"; popup.style.top = "50%";
      popup.style.right = "auto"; popup.style.transform = "translate(-50%, -50%)";
    } else { // grandes: canto superior direito
      popup.style.left = "auto"; popup.style.right = "20px";
      popup.style.top = "72px"; popup.style.transform = "none";
    }
    popup.style.width = popupW + "px";

    // altura máxima disponível (conteúdo)
    const maxContentH = Math.floor(vh * 0.92) - headH;

    // escala para caber (sem passar do mínimo)
    let scale = Math.min(1, maxContentH / naturalH);
    if (scale < MIN_SCALE) scale = MIN_SCALE;

    // altura final visível
    const finalContentH = Math.round(naturalH * scale);
    popup.style.height = (finalContentH + headH) + "px";
    content.style.height = finalContentH + "px";

    // aplica zoom no iframe e garante largura correta
    iframe.style.transformOrigin = "top left";
    if (scale < 0.999) {
      iframe.style.transform = `scale(${scale})`;
      iframe.style.width = (popupW / scale) + "px";
      iframe.style.height = naturalH + "px";
    } else {
      iframe.style.transform = "none";
      iframe.style.width = "100%";
      iframe.style.height = naturalH + "px";
    }
  }

  // espera ativa pela altura correta do embed
  function startCalibration() {
    // Esconde o iframe até ficar ok (evita “corte” visual)
    iframe.style.visibility = "hidden";

    let tries = 0;
    if (retryIv) clearInterval(retryIv);
    retryIv = setInterval(() => {
      tries++;
      const h = readNaturalH();

      if (Number.isFinite(h) && h >= MIN_OK_H) {
        fitPopupTo(h);
        iframe.style.visibility = "visible";
        spinner && spinner.remove();
        clearInterval(retryIv);
        retryIv = null;
      } else if (tries >= MAX_TRIES) {
        // fallback: usa 85vh como base para não travar (ainda sem scroll)
        const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const approx = Math.floor(vh * 0.85);
        iframe.style.height = approx + "px";
        fitPopupTo(approx);
        iframe.style.visibility = "visible";
        spinner && spinner.remove();
        clearInterval(retryIv);
        retryIv = null;
      }
    }, TRY_EVERY);
  }

  // Mensagens de auto-resize do embed (quando existirem)
  function onEmbedMessage(ev) {
    try {
      if (!String(ev.origin).includes("link.fullfunnel.app")) return;
      const d = ev.data || {};
      const h = parseInt(d.height || d.newHeight || d.iframeHeight || "", 10);
      if (Number.isFinite(h) && h > 0) {
        iframe.style.height = h + "px";
        // aplica imediatamente (mesmo durante a calibração)
        fitPopupTo(h);
        iframe.style.visibility = "visible";
        spinner && spinner.remove();
      }
    } catch {}
  }

  // ---------- popup ----------
  function openPopup() {
    if (popup) return;
    ensureEmbedScript();

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.style.cssText = `position:fixed !important; inset:0 !important; background:rgba(0,0,0,.25) !important; z-index:999998 !important;`;
    backdrop.onclick = closePopup;

    popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.style.cssText = `
      position:fixed !important; background:#fff !important; border-radius:12px !important;
      overflow:hidden !important; box-shadow:0 25px 50px rgba(0,0,0,.25) !important;
      display:flex !important; flex-direction:column !important; border:1px solid #e2e8f0 !important;
      z-index:999999 !important; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;`;

    head = document.createElement("div");
    head.style.cssText = `
      background:linear-gradient(135deg,#4F46E5,#7C3AED) !important; color:#fff !important;
      padding:10px 14px !important; display:flex !important; justify-content:space-between !important; align-items:center !important;
      font-weight:600 !important; font-size:13px !important; user-select:none !important;`;
    head.innerHTML = `<span>Agendar Suporte</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = `background:rgba(255,255,255,.2) !important; border:none !important; color:#fff !important; font-size:18px !important; cursor:pointer !important; padding:2px 8px !important; border-radius:4px !important;`;
    closeBtn.onclick = closePopup;
    head.appendChild(closeBtn);

    content = document.createElement("div");
    content.style.cssText = `position:relative !important; width:100% !important; flex:0 0 auto !important; overflow:hidden !important; background:#fff !important;`;

    // Spinner (só enquanto calibramos)
    spinner = document.createElement("div");
    spinner.style.cssText = `position:absolute !important; inset:0 !important; display:flex !important; align-items:center !important; justify-content:center !important; font-size:13px !important; color:#64748b !important;`;
    spinner.textContent = "Carregando calendário…";

    iframe = document.createElement("iframe");
    iframe.id = BOOKING_ID + "_" + Date.now(); // id único a cada abertura
    iframe.src = BOOKING_SRC;
    iframe.setAttribute("scrolling", "no"); // sem scroll interno
    iframe.style.cssText = `border:none !important; background:#fff !important; display:block !important; width:100% !important; height:1px !important;`;

    content.appendChild(spinner);
    content.appendChild(iframe);

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
    popup.appendChild(head);
    popup.appendChild(content);

    // Observa alterações de altura no style do iframe
    if (moIframe) { moIframe.disconnect(); moIframe = null; }
    moIframe = new MutationObserver(() => {
      const h = readNaturalH();
      if (Number.isFinite(h) && h >= MIN_OK_H) {
        fitPopupTo(h);
        iframe.style.visibility = "visible";
        spinner && spinner.remove();
      }
    });
    moIframe.observe(iframe, { attributes: true, attributeFilter: ["style", "height"] });

    // Também reage a postMessage do embed
    window.addEventListener("message", onEmbedMessage, { passive: true });

    // Quando o iframe terminar o primeiro load, inicia calibração com retries
    iframe.addEventListener("load", startCalibration, { once: true });

    // Aplica um posicionamento inicial bonito até a calibração concluir
    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    popup.style.width  = Math.min(1100, Math.floor(vw * 0.90)) + "px";
    popup.style.height = Math.min(700,  Math.floor(vh * 0.80)) + "px";
    popup.style.left = "50%"; popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
  }

  function closePopup() {
    if (retryIv) { clearInterval(retryIv); retryIv = null; }
    window.removeEventListener("message", onEmbedMessage);
    if (moIframe) { moIframe.disconnect(); moIframe = null; }
    const backdrop = document.getElementById(BACKDROP_ID);
    if (popup && popup.parentNode) popup.remove();
    if (backdrop && backdrop.parentNode) backdrop.remove();
    popup = head = content = iframe = spinner = null;
  }

  // ---------- injeta na topbar ----------
  function addButton() {
    const header = findHeader();
    if (!header) return false;
    if (document.getElementById(BTN_ID)) return true;

    const btn = createBtn();
    const tutorialBtn = Array.from(header.querySelectorAll("button, a"))
      .find(el => (el.textContent || "").trim().toLowerCase().startsWith("tutorial"));
    if (tutorialBtn && tutorialBtn.parentElement) tutorialBtn.insertAdjacentElement("afterend", btn);
    else header.insertBefore(btn, header.firstChild);
    return true;
  }
  function removeBtn(){ const b = document.getElementById(BTN_ID); if (b) b.remove(); }

  // SPA watchers
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closePopup(); removeBtn(); addButton();
    }
  }, 500);
  const mo = new MutationObserver(() => { if (!document.getElementById(BTN_ID)) addButton(); });
  mo.observe(document.documentElement, { childList:true, subtree:true });

  removeOldFab();
  const startIv = setInterval(() => { if (addButton()) clearInterval(startIv); }, 100);
  setTimeout(() => clearInterval(startIv), 15000);
})();
