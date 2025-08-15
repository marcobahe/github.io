<!-- Support Booking - Topbar com popup/iframe (auto-resize, sem scroll) -->
(function () {
  const BTN_ID        = "ff-support-topbar-btn";
  const POPUP_ID      = "ff-support-popup";
  const BACKDROP_ID   = "ff-support-popup-backdrop";
  const OLD_FAB_ID    = "ff-support-call-fab";
  const LABEL         = "Agende uma call de Suporte";

  // Embed do calendário (usa o padrão de ID que o script de embed espera)
  const BOOKING_ID        = "zivoYfVcIU3qJwjIezcw";
  const BOOKING_SRC       = `https://link.fullfunnel.app/widget/booking/${BOOKING_ID}`;
  const EMBED_SCRIPT_SRC  = "https://link.fullfunnel.app/js/form_embed.js";

  // Seletores iguais aos do botão "Tutorial"
  const HEADER_SELECTORS = [
    '.header-bar .container-fluid > .header--controls',
    '.header .container-fluid > .header--controls',
    '.hl_header .container-fluid > .hl_header--controls',
    '.main-header .container-fluid > .header-controls',
    '.top-bar .container-fluid > .controls',
    '.navbar .container-fluid > .nav-controls',
    '.header-controls', '.header--controls', '.nav-controls', '.controls'
  ];

  let popup = null, head = null, content = null, iframe = null, moIframe = null;

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

  function removeOldFab() { const old = document.getElementById(OLD_FAB_ID); if (old) old.remove(); }

  function createBtn() {
    const btn = document.createElement("button");
    btn.id = BTN_ID; btn.type = "button";
    btn.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
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

    const mql = window.matchMedia("(max-width: 1024px)");
    const toggleLabel = () => { const s = btn.querySelector(".ff-label"); if (s) s.style.display = mql.matches ? "none" : "inline"; };
    toggleLabel(); mql.addEventListener?.("change", toggleLabel);

    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPopup(); };
    return btn;
  }

  // === dimensionamento ===
  function desiredPopupHeightFromIframe() {
    // tenta ler a altura que o script de embed escreveu no estilo do iframe
    const h1 = parseInt(iframe?.style?.height || "", 10);
    const h2 = parseInt((iframe && getComputedStyle(iframe).height) || "", 10);
    return isFinite(h1) && h1 > 0 ? h1 : (isFinite(h2) && h2 > 0 ? h2 : null);
  }

  function fitPopupToIframe() {
    if (!popup || !head || !iframe) return;

    const headH = Math.round(head.getBoundingClientRect().height || 56);
    const iframeH = desiredPopupHeightFromIframe();

    if (!iframeH) return; // ainda não temos a altura calculada pelo embed

    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const margin = 8; // margem visual externa
    const fullAvailH = vh - margin * 2;

    // altura que gostaríamos (conteúdo natural + cabeçalho)
    const wanted = iframeH + headH;

    // se couber, usa a altura exata; se não couber, vira "tela cheia"
    const fits = wanted <= fullAvailH;

    if (fits) {
      popup.style.borderRadius = "12px";
      popup.style.left = "auto";
      popup.style.right = "20px";
      popup.style.top = "72px";
      popup.style.transform = "none";
      popup.style.width  = Math.min(1200, Math.floor(vw * 0.95)) + "px";
      popup.style.height = wanted + "px";
    } else {
      // modo tela cheia (sem scroll interno)
      popup.style.borderRadius = "0";
      popup.style.left = "0";
      popup.style.top  = "0";
      popup.style.right = "0";
      popup.style.transform = "none";
      popup.style.width  = "100vw";
      popup.style.height = "100vh";
    }

    // content segue a altura visível do popup menos o cabeçalho
    const popH = parseInt(popup.style.height, 10) || fullAvailH;
    const contentH = Math.max(0, popH - headH);
    content.style.height = contentH + "px";
  }

  function watchIframeHeightChanges() {
    if (moIframe) { moIframe.disconnect(); moIframe = null; }
    moIframe = new MutationObserver(() => fitPopupToIframe());
    moIframe.observe(iframe, { attributes: true, attributeFilter: ["style", "height"] });

    // alguns embeds também usam postMessage; tentamos capturar heurísticas de "height"
    window.addEventListener("message", handleEmbedMessage, { passive: true });
  }

  function handleEmbedMessage(ev) {
    // só reage ao domínio do link.fullfunnel.app
    try {
      const originOk = typeof ev.origin === "string" && ev.origin.indexOf("link.fullfunnel.app") !== -1;
      if (!originOk) return;
      const d = ev.data;
      let h = null;

      if (typeof d === "string") {
        const m = d.match(/height["']?\s*:\s*"?(\d{3,5})"?/i) || d.match(/(\d{3,5})px/);
        if (m) h = parseInt(m[1], 10);
      } else if (d && typeof d === "object") {
        h = parseInt(d.height || d.newHeight || d.iframeHeight || "", 10);
      }
      if (isFinite(h) && h > 0) {
        // aplica a altura no próprio iframe (caso o embed não tenha feito)
        iframe.style.height = h + "px";
        fitPopupToIframe();
      }
    } catch {}
  }

  function openPopup() {
    if (popup) return;
    ensureEmbedScript();

    // backdrop
    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.style.cssText = `
      position:fixed !important; inset:0 !important;
      background:rgba(0,0,0,.25) !important; z-index:999998 !important;`;
    backdrop.onclick = closePopup;

    // popup
    popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.style.cssText = `
      position:fixed !important; background:#fff !important;
      overflow:hidden !important; box-shadow:0 25px 50px rgba(0,0,0,.25) !important;
      display:flex !important; flex-direction:column !important; border:1px solid #e2e8f0 !important;
      z-index:999999 !important; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;`;

    // header (baixo para ganhar mais altura útil)
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

    // conteúdo (sem scroll)
    content = document.createElement("div");
    content.style.cssText = `position:relative !important; width:100% !important; flex:0 0 auto !important; overflow:hidden !important; background:#fff !important;`;

    // iframe (sem altura definida; o form_embed.js vai ajustar)
    iframe = document.createElement("iframe");
    const iframeId = `${BOOKING_ID}_${Date.now()}`;
    iframe.id = iframeId;
    iframe.src = BOOKING_SRC;
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = `width:100% !important; border:none !important; overflow:hidden !important; background:#fff !important;`;

    content.appendChild(iframe);

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
    popup.appendChild(head);
    popup.appendChild(content);

    // observar mudanças de altura do iframe e ajustar
    watchIframeHeightChanges();

    // primeira tentativa de ajuste (caso já venha com estilo)
    setTimeout(fitPopupToIframe, 50);
    setTimeout(fitPopupToIframe, 400);
    window.addEventListener("resize", fitPopupToIframe);
    window.addEventListener("orientationchange", fitPopupToIframe, { passive: true });
  }

  function closePopup() {
    window.removeEventListener("resize", fitPopupToIframe);
    window.removeEventListener("orientationchange", fitPopupToIframe);
    window.removeEventListener("message", handleEmbedMessage);
    if (moIframe) { moIframe.disconnect(); moIframe = null; }
    const backdrop = document.getElementById(BACKDROP_ID);
    if (popup && popup.parentNode) popup.remove();
    if (backdrop && backdrop.parentNode) backdrop.remove();
    popup = head = content = iframe = null;
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

  const mo = new MutationObserver(() => { if (!document.getElementById(BTN_ID)) addButton(); });
  mo.observe(document.documentElement, { childList:true, subtree:true });

  removeOldFab();
  const startIv = setInterval(() => { if (addButton()) clearInterval(startIv); }, 100);
  setTimeout(() => clearInterval(startIv), 15000);
})();
