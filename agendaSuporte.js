<!-- Support Booking - Topbar com popup/iframe (responsivo) -->
(function () {
  const BTN_ID        = "ff-support-topbar-btn";
  const POPUP_ID      = "ff-support-popup";
  const BACKDROP_ID   = "ff-support-popup-backdrop";
  const OLD_FAB_ID    = "ff-support-call-fab";
  const LABEL         = "Agende uma call de Suporte";

  // Embed do calendário
  const BOOKING_SRC        = "https://link.fullfunnel.app/widget/booking/zivoYfVcIU3qJwjIezcw";
  const IFRAME_ID_PREFIX   = "zivoYfVcIU3qJwjIezcw_"; // ajuda o script de embed a auto-ajustar
  const EMBED_SCRIPT_SRC   = "https://link.fullfunnel.app/js/form_embed.js";

  // Seletores (iguais ao widget de Tutorial)
  const HEADER_SELECTORS = [
    '.header-bar .container-fluid > .header--controls',
    '.header .container-fluid > .header--controls',
    '.hl_header .container-fluid > .hl_header--controls',
    '.main-header .container-fluid > .header-controls',
    '.top-bar .container-fluid > .controls',
    '.navbar .container-fluid > .nav-controls',
    '.header-controls', '.header--controls', '.nav-controls', '.controls'
  ];

  let popup = null;

  function ensureEmbedScript() {
    if (!document.querySelector(`script[src*="${EMBED_SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = EMBED_SCRIPT_SRC;
      s.type = "text/javascript";
      s.async = true;
      document.body.appendChild(s);
    }
  }

  function findHeader() {
    for (const sel of HEADER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function removeOldFab() {
    const old = document.getElementById(OLD_FAB_ID);
    if (old) old.remove();
  }

  function createBtn() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             style="display:inline-block">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="ff-label">${LABEL}</span>
      </span>
    `;
    btn.setAttribute("aria-label", LABEL);
    btn.style.cssText = `
      background:#2563eb !important; color:#fff !important; border:none !important;
      padding:10px 14px !important; border-radius:6px !important; cursor:pointer !important;
      font-weight:600 !important; font-size:14px !important; margin-left:12px !important;
      transition:all .2s ease !important; box-shadow:0 2px 8px rgba(37,99,235,.25) !important;
      display:inline-flex !important; align-items:center !important;
    `;
    btn.onmouseenter = () => btn.style.background = '#1d4ed8';
    btn.onmouseleave = () => btn.style.background = '#2563eb';

    // mobile: só ícone
    const mql = window.matchMedia("(max-width: 1024px)");
    const toggleLabel = () => {
      const s = btn.querySelector(".ff-label");
      if (s) s.style.display = mql.matches ? "none" : "inline";
    };
    toggleLabel(); mql.addEventListener?.("change", toggleLabel);

    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPopup(); };
    return btn;
  }

  function setPopupSize() {
    if (!popup) return;
    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // Critério de “tela pequena” (ex.: notebooks 13" ou altura limitada)
    const small = (vw < 1200 || vh < 820);

    let w, h;
    if (small) {
      // Usa praticamente a tela toda para não cortar botões
      w = Math.min(Math.floor(vw * 0.98), 1400);
      h = Math.min(Math.floor(vh * 0.97), 900);
      popup.style.left = "50%";
      popup.style.top = "50%";
      popup.style.transform = "translate(-50%, -50%)";
      popup.style.right = "auto";
    } else {
      // Grandes: horizontal confortável
      w = Math.min(1200, Math.floor(vw * 0.95));
      h = Math.min(840,  Math.floor(vh * 0.92));
      if (w < h * 1.35) w = Math.min(Math.floor(h * 1.4), Math.floor(vw * 0.97));
      popup.style.transform = "none";
      popup.style.left = "auto";
      popup.style.right = "20px";
      popup.style.top = "72px";
    }

    popup.style.width  = w + "px";
    popup.style.height = h + "px";
  }

  function openPopup() {
    if (popup) return;
    ensureEmbedScript();

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.style.cssText = `
      position:fixed !important; inset:0 !important;
      background:rgba(0,0,0,.25) !important; z-index:999998 !important;
    `;
    backdrop.onclick = closePopup;

    // Popup
    popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.style.cssText = `
      position:fixed !important; background:#fff !important; border-radius:12px !important;
      overflow:hidden !important; box-shadow:0 25px 50px rgba(0,0,0,.25) !important;
      display:flex !important; flex-direction:column !important; border:1px solid #e2e8f0 !important;
      z-index:999999 !important; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;
    `;

    // Header
    const head = document.createElement("div");
    head.style.cssText = `
      background:linear-gradient(135deg,#4F46E5,#7C3AED) !important; color:#fff !important;
      padding:12px 16px !important; display:flex !important; justify-content:space-between !important; align-items:center !important;
      font-weight:600 !important; font-size:14px !important; user-select:none !important; cursor:move !important;
    `;
    head.innerHTML = `<span>Agendar Suporte</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = `
      background:rgba(255,255,255,.2) !important; border:none !important; color:#fff !important;
      font-size:18px !important; cursor:pointer !important; padding:4px 8px !important; border-radius:4px !important;
    `;
    closeBtn.onclick = closePopup;
    head.appendChild(closeBtn);

    // Conteúdo (scroll habilitado)
    const content = document.createElement("div");
    content.style.cssText = `
      position:relative !important; width:100% !important; flex:1 !important;
      overflow:auto !important; background:#fff !important;
    `;

    // Iframe do calendário (permitir rolagem)
    const iframe = document.createElement("iframe");
    const iframeId = IFRAME_ID_PREFIX + Date.now();
    iframe.id = iframeId;
    iframe.src = BOOKING_SRC;
    iframe.setAttribute("scrolling", "auto"); // <- permitir scroll interno se necessário
    iframe.style.cssText = `
      position:absolute !important; inset:0 !important;
      width:100% !important; height:100% !important; border:none !important; background:#fff !important;
    `;

    const spinner = document.createElement("div");
    spinner.style.cssText = `
      position:absolute !important; inset:0 !important; display:flex !important; align-items:center !important; justify-content:center !important;
      font-size:13px !important; color:#64748b !important;
    `;
    spinner.textContent = "Carregando calendário…";
    iframe.onload = () => spinner.remove();

    content.appendChild(spinner);
    content.appendChild(iframe);

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
    popup.appendChild(head);
    popup.appendChild(content);

    // Drag
    let dragging=false, start={x:0,y:0};
    head.onmousedown = (e) => {
      dragging = true;
      const r = popup.getBoundingClientRect();
      start = { x: e.clientX - r.left, y: e.clientY - r.top };
      // remover centralização enquanto arrasta
      popup.style.transform = "none";
      document.onmousemove = (ev) => {
        if (!dragging) return;
        popup.style.left  = Math.max(0, Math.min(window.innerWidth  - popup.offsetWidth,  ev.clientX - start.x)) + "px";
        popup.style.top   = Math.max(0, Math.min(window.innerHeight - popup.offsetHeight, ev.clientY - start.y)) + "px";
        popup.style.right = "auto";
      };
      document.onmouseup = () => { dragging=false; document.onmousemove=null; document.onmouseup=null; };
      e.preventDefault();
    };

    setPopupSize();
    window.addEventListener("resize", setPopupSize);
    window.addEventListener("orientationchange", setPopupSize, { passive: true });
  }

  function closePopup() {
    window.removeEventListener("resize", setPopupSize);
    window.removeEventListener("orientationchange", setPopupSize);
    const backdrop = document.getElementById(BACKDROP_ID);
    if (popup && popup.parentNode) popup.remove();
    if (backdrop && backdrop.parentNode) backdrop.remove();
    popup = null;
  }

  function addButton() {
    const header = findHeader();
    if (!header) return false;
    if (document.getElementById(BTN_ID)) return true;

    const btn = createBtn();

    // posiciona ao lado do "Tutorial"
    const tutorialBtn = Array.from(header.querySelectorAll("button, a"))
      .find(el => (el.textContent || "").trim().toLowerCase().startsWith("tutorial"));
    if (tutorialBtn && tutorialBtn.parentElement) tutorialBtn.insertAdjacentElement("afterend", btn);
    else header.insertBefore(btn, header.firstChild);

    return true;
  }

  function removeBtn() { const b = document.getElementById(BTN_ID); if (b) b.remove(); }

  // SPA: fecha popup e revalida botão ao trocar de rota
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closePopup();
      removeBtn();
      addButton();
    }
  }, 500);

  // Observa re-renderizações
  const mo = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) addButton();
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });

  // Init
  removeOldFab();
  const startIv = setInterval(() => { if (addButton()) clearInterval(startIv); }, 100);
  setTimeout(() => clearInterval(startIv), 15000);
})();
