<!-- Support Booking - Topbar | cria iFrame só no 1º clique, depois persiste oculto (sem scroll + auto-zoom) -->
(function () {
  // IDs fixos do nosso botão/popup e do "estacionamento" do iFrame
  const BTN_ID        = "ff-support-topbar-btn";
  const POPUP_ID      = "ff-support-popup";
  const BACKDROP_ID   = "ff-support-popup-backdrop";
  const STASH_ID      = "ff-support-iframe-stash";

  const LABEL = "Agende uma call de Suporte";

  // Dados do embed FullFunnel
  const BOOKING_ID       = "zivoYfVcIU3qJwjIezcw";
  const BOOKING_SRC      = `https://link.fullfunnel.app/widget/booking/${BOOKING_ID}`;
  const EMBED_SCRIPT_SRC = "https://link.fullfunnel.app/js/form_embed.js";

  // Layout e limites
  const MIN_SCALE = 0.72;
  const HEAD_FALL = 56;
  const INIT_W    = 1100;
  const INIT_H    = 700;
  const DEFAULT_HEIGHT = 650; // ⭐ NOVO: Altura padrão como fallback
  const MAX_WAIT_TIME = 8000;  // ⭐ NOVO: Timeout para forçar exibição

  // Seletores da topbar
  const HEADER_SELECTORS = [
    '.header-bar .container-fluid > .header--controls',
    '.header .container-fluid > .header--controls',
    '.hl_header .container-fluid > .hl_header--controls',
    '.main-header .container-fluid > .header-controls',
    '.top-bar .container-fluid > .controls',
    '.navbar .container-fluid > .nav-controls',
    '.header-controls', '.header--controls', '.nav-controls', '.controls'
  ];

  // Estado global
  let popup=null, head=null, content=null, spinner=null;
  let iframe=null, naturalH=0, embedReady=false, heightListener=null, moIframe=null;
  let heightDetectionTimeout=null; // ⭐ NOVO: Timer para fallback

  // ---------- utils ----------
  function findHeader() {
    for (const sel of HEADER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function ensureStash() {
    let stash = document.getElementById(STASH_ID);
    if (!stash) {
      stash = document.createElement("div");
      stash.id = STASH_ID;
      stash.style.cssText = "position:absolute; left:-99999px; top:-99999px; width:0; height:0; overflow:hidden;";
      document.body.appendChild(stash);
    }
    return stash;
  }

  function ensureEmbedScript(cb) {
    if (embedReady) { 
      cb && cb(); 
      return; 
    }
    
    // ⭐ MELHORADO: Verifica se script já existe
    const existingScript = document.querySelector(`script[src="${EMBED_SCRIPT_SRC}"]`);
    if (existingScript) {
      embedReady = true;
      cb && cb();
      return;
    }

    const s = document.createElement("script");
    s.src = EMBED_SCRIPT_SRC; 
    s.type = "text/javascript"; 
    s.async = true;
    s.onload = () => { 
      embedReady = true; 
      cb && cb(); 
    };
    s.onerror = () => {
      console.warn("Erro ao carregar script do embed, usando fallback");
      embedReady = true;
      cb && cb();
    };
    document.body.appendChild(s);
  }

  function readNaturalHeight() {
    const s = parseInt(iframe?.style?.height || "", 10);
    if (Number.isFinite(s) && s > 0) return s;
    const g = parseInt((iframe && getComputedStyle(iframe).height) || "", 10);
    return Number.isFinite(g) && g > 0 ? g : 0;
  }

  // ⭐ NOVO: Função para forçar exibição com altura padrão
  function forceDisplay() {
    if (!iframe || !popup) return;
    
    console.log("Forçando exibição do iframe com altura padrão");
    
    if (naturalH <= 0) {
      naturalH = DEFAULT_HEIGHT;
      iframe.style.height = DEFAULT_HEIGHT + "px";
    }
    
    spinner && spinner.remove();
    iframe.style.visibility = "visible";
    fitToHeight(naturalH);
  }

  // ---------- iFrame persistente ----------
  function createPersistentIframe() {
    if (iframe) return iframe;
    
    const stash = ensureStash();
    const frameId = BOOKING_ID + "_" + Date.now();
    
    iframe = document.createElement("iframe");
    iframe.id = frameId;
    iframe.src = BOOKING_SRC;
    iframe.setAttribute("scrolling", "no");
    
    // ⭐ MELHORADO: Largura responsiva desde o início
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const initialWidth = Math.min(1200, Math.floor(vw * 0.9));
    
    iframe.style.cssText = `
      border:none; 
      background:#fff; 
      width:${initialWidth}px; 
      height:${DEFAULT_HEIGHT}px; 
      visibility:hidden;
    `;
    
    stash.appendChild(iframe);

    // ⭐ MELHORADO: Timeout para forçar exibição
    heightDetectionTimeout = setTimeout(forceDisplay, MAX_WAIT_TIME);
    
    attachHeightObservers();
    return iframe;
  }

  function attachHeightObservers() {
    // postMessage do embed (altura)
    if (!heightListener) {
      heightListener = (ev) => {
        try {
          if (!String(ev.origin).includes("link.fullfunnel.app")) return;
          
          const d = ev.data || {};
          let h = null;
          
          if (typeof d === "string") {
            const m = d.match(/height["']?\s*[:=]\s*"?(\d{3,5})"?/i) || d.match(/(\d{3,5})px/);
            if (m) h = parseInt(m[1], 10);
          } else {
            h = parseInt(d.height || d.newHeight || d.iframeHeight || "", 10);
          }
          
          if (Number.isFinite(h) && h > 100) { // ⭐ MELHORADO: Altura mínima mais realista
            console.log("Altura detectada via postMessage:", h);
            
            naturalH = h;
            iframe.style.height = h + "px";
            
            // ⭐ NOVO: Cancela timeout se altura foi detectada
            if (heightDetectionTimeout) {
              clearTimeout(heightDetectionTimeout);
              heightDetectionTimeout = null;
            }
            
            if (popup) {
              spinner && spinner.remove();
              iframe.style.visibility = "visible";
              fitToHeight(naturalH);
            }
          }
        } catch (e) {
          console.warn("Erro no listener de altura:", e);
        }
      };
      window.addEventListener("message", heightListener, { passive: true });
    }

    // MutationObserver como fallback
    if (moIframe) moIframe.disconnect();
    moIframe = new MutationObserver((mutations) => {
      try {
        const h = readNaturalHeight();
        if (h > 100 && h !== naturalH) { // ⭐ MELHORADO: Evita loops desnecessários
          console.log("Altura detectada via MutationObserver:", h);
          
          naturalH = h;
          
          if (heightDetectionTimeout) {
            clearTimeout(heightDetectionTimeout);
            heightDetectionTimeout = null;
          }
          
          if (popup) {
            spinner && spinner.remove();
            iframe.style.visibility = "visible";
            fitToHeight(naturalH);
          }
        }
      } catch (e) {
        console.warn("Erro no MutationObserver:", e);
      }
    });
    moIframe.observe(iframe, { 
      attributes: true, 
      attributeFilter: ["style", "height"] 
    });
  }

  // ---------- ajuste de tamanho (sem scroll + zoom) ----------
  function fitToHeight(h) {
    if (!popup || !iframe || h <= 0) return;
    
    try {
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      const headH = Math.round(head?.getBoundingClientRect().height || HEAD_FALL);

      // ⭐ MELHORADO: Largura mais responsiva
      let popupW = Math.min(1200, Math.floor(vw * 0.95));
      
      // ⭐ MELHORADO: Condições de posicionamento mais claras
      const isSmallScreen = vw < 1200 || vh < 820;
      
      if (isSmallScreen) {
        popup.style.left = "50%"; 
        popup.style.top = "50%";
        popup.style.right = "auto"; 
        popup.style.transform = "translate(-50%, -50%)";
      } else {
        popup.style.left = "auto"; 
        popup.style.right = "20px";
        popup.style.top = "72px"; 
        popup.style.transform = "none";
      }
      
      popup.style.width = popupW + "px";

      // ⭐ MELHORADO: Cálculo de altura mais seguro
      const maxContentH = Math.max(300, Math.floor(vh * 0.92) - headH);
      
      let scale = Math.min(1, maxContentH / h);
      scale = Math.max(scale, MIN_SCALE); // ⭐ Garante escala mínima
      
      const finalContentH = Math.round(h * scale);
      popup.style.height = (finalContentH + headH) + "px";

      // ⭐ MELHORADO: Aplicação de escala mais robusta
      iframe.style.transformOrigin = "top left";
      
      if (scale < 0.999) {
        iframe.style.transform = `scale(${scale})`;
        iframe.style.width = Math.round(popupW / scale) + "px";
        iframe.style.height = h + "px";
      } else {
        iframe.style.transform = "none";
        iframe.style.width = "100%";
        iframe.style.height = h + "px";
      }
      
      console.log(`Iframe ajustado: ${popupW}x${finalContentH}, escala: ${scale.toFixed(3)}`);
      
    } catch (e) {
      console.warn("Erro no fitToHeight:", e);
      // ⭐ NOVO: Fallback em caso de erro
      iframe.style.width = "100%";
      iframe.style.height = h + "px";
      iframe.style.transform = "none";
    }
  }

  // ---------- popup ----------
  function openPopup() {
    if (popup) return; // ⭐ MELHORADO: Evita abertura dupla
    
    ensureEmbedScript(() => {
      createPersistentIframe();
      buildPopup();

      // Move o iframe do stash para o popup
      content.appendChild(iframe);

      // ⭐ MELHORADO: Verifica altura e força exibição se necessário
      if (naturalH <= 0) naturalH = readNaturalHeight();
      
      if (naturalH > 100) {
        console.log("Usando altura já detectada:", naturalH);
        
        if (heightDetectionTimeout) {
          clearTimeout(heightDetectionTimeout);
          heightDetectionTimeout = null;
        }
        
        spinner && spinner.remove();
        iframe.style.visibility = "visible";
        fitToHeight(naturalH);
      } else {
        console.log("Aguardando detecção de altura...");
        iframe.style.visibility = "hidden";
        
        // ⭐ NOVO: Timeout específico para este popup
        if (!heightDetectionTimeout) {
          heightDetectionTimeout = setTimeout(forceDisplay, MAX_WAIT_TIME);
        }
      }
    });
  }

  function buildPopup() {
    if (popup) return;

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,.25); z-index:999998;`;
    backdrop.onclick = closePopup;

    popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.style.cssText = `
      position:fixed; background:#fff; border-radius:12px; overflow:hidden;
      box-shadow:0 25px 50px rgba(0,0,0,.25); display:flex; flex-direction:column;
      border:1px solid #e2e8f0; z-index:999999; 
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;`;

    head = document.createElement("div");
    head.style.cssText = `
      background:linear-gradient(135deg,#4F46E5,#7C3AED); color:#fff; padding:10px 14px;
      display:flex; justify-content:space-between; align-items:center; 
      font-weight:600; font-size:13px; flex-shrink:0;`;
    head.innerHTML = `<span>Agendar Suporte</span>`;
    
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = `
      background:rgba(255,255,255,.2); border:none; color:#fff; font-size:18px; 
      cursor:pointer; padding:2px 8px; border-radius:4px; min-width:auto;`;
    closeBtn.onclick = closePopup;
    head.appendChild(closeBtn);

    content = document.createElement("div");
    content.style.cssText = `
      position:relative; width:100%; flex:0 0 auto; overflow:hidden; 
      background:#fff; min-height:300px;`; // ⭐ NOVO: Altura mínima

    spinner = document.createElement("div");
    spinner.style.cssText = `
      position:absolute; inset:0; display:flex; align-items:center; 
      justify-content:center; font-size:13px; color:#64748b; 
      background:#fff; z-index:1;`; // ⭐ NOVO: z-index para ficar sobre iframe
    spinner.textContent = "Carregando calendário…";
    content.appendChild(spinner);

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
    popup.appendChild(head);
    popup.appendChild(content);

    // Tamanho inicial
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    popup.style.width = Math.min(INIT_W, Math.floor(vw * 0.90)) + "px";
    popup.style.height = Math.min(INIT_H, Math.floor(vh * 0.80)) + "px";
    popup.style.left = "50%"; 
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";

    // Listeners de redimensionamento
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize, { passive: true });
  }

  function closePopup() {
    if (!popup) return;
    
    // ⭐ MELHORADO: Limpa timeouts
    if (heightDetectionTimeout) {
      clearTimeout(heightDetectionTimeout);
      heightDetectionTimeout = null;
    }
    
    // Devolve iframe ao stash
    const stash = ensureStash();
    if (iframe && stash) {
      stash.appendChild(iframe);
      iframe.style.visibility = "hidden";
      iframe.style.transform = "none";
    }
    
    spinner && spinner.remove();

    const bd = document.getElementById(BACKDROP_ID);
    if (bd && bd.parentNode) bd.remove();
    popup.remove();
    popup = head = content = spinner = null;

    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  }

  function onResize() {
    if (!popup || !iframe) return;
    
    // ⭐ MELHORADO: Debounce do resize
    clearTimeout(onResize.timeout);
    onResize.timeout = setTimeout(() => {
      const h = naturalH || readNaturalHeight();
      if (h > 0) fitToHeight(h);
    }, 150);
  }

  // ---------- botão na topbar ----------
  function createBtn() {
    const btn = document.createElement("button");
    btn.id = BTN_ID; 
    btn.type = "button";
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
      background:#2563eb; color:#fff; border:none; padding:10px 14px; 
      border-radius:6px; cursor:pointer; font-weight:600; font-size:14px; 
      margin-left:12px; transition:all .2s; 
      box-shadow:0 2px 8px rgba(37,99,235,.25);
      display:inline-flex; align-items:center;`;
    
    btn.onmouseenter = () => btn.style.background = '#1d4ed8';
    btn.onmouseleave = () => btn.style.background = '#2563eb';
    
    const mql = window.matchMedia("(max-width:1024px)");
    const toggle = () => { 
      const s = btn.querySelector(".ff-label"); 
      if (s) s.style.display = mql.matches ? "none" : "inline"; 
    };
    toggle(); 
    mql.addEventListener?.("change", toggle);
    
    btn.onclick = (e) => { 
      e.preventDefault(); 
      e.stopPropagation(); 
      openPopup(); 
    };
    
    return btn;
  }

  // ⭐ NOVA função para verificar se está em subconta
  function isInSubAccount() {
    const url = location.href;
    const pathname = location.pathname;
    
    console.log("🔍 Verificando URL:", url);
    console.log("🔍 Pathname:", pathname);
    
    // Verifica se está numa subconta - pode ser /location/ ou /locations/
    const isSubAccount = pathname.includes('/location') && !pathname.includes('/agency');
    
    console.log("🎯 É subconta?", isSubAccount);
    return isSubAccount;
  }

  function addButton() {
    // ⭐ VERIFICAÇÃO mais específica para subconta
    if (!isInSubAccount()) {
      console.log("❌ Não está em subconta - botão não será adicionado");
      return false;
    }
    
    console.log("✅ Está em subconta - adicionando botão");
    
    const header = findHeader();
    if (!header) return false;
    if (document.getElementById(BTN_ID)) return true;
    
    const btn = createBtn();
    const tutorialBtn = Array.from(header.querySelectorAll("button, a"))
      .find(el => (el.textContent || "").trim().toLowerCase().startsWith("tutorial"));
    
    if (tutorialBtn && tutorialBtn.parentElement) {
      tutorialBtn.insertAdjacentElement("afterend", btn);
    } else {
      header.insertBefore(btn, header.firstChild);
    }
    
    return true;
  }

  function removeBtn() { 
    const b = document.getElementById(BTN_ID); 
    if (b) b.remove(); 
  }

  // ---------- SPA watchers ----------
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log("🔄 Mudança de URL detectada:", location.href);
      
      if (popup) closePopup();
      
      // ⭐ MELHORADO: Remove o botão se não estiver mais em uma subconta
      if (!isInSubAccount()) {
        console.log("🗑️ Removendo botão - não está mais em subconta");
        removeBtn();
      } else {
        console.log("🔄 Recarregando botão - ainda em subconta");
        removeBtn(); 
        addButton();
      }
    }
  }, 500);

  const mo = new MutationObserver(() => { 
    // ⭐ MELHORADO: Só tenta adicionar o botão se estiver em subconta
    if (isInSubAccount() && !document.getElementById(BTN_ID)) {
      console.log("🔧 MutationObserver: tentando adicionar botão");
      addButton();
    } else if (!isInSubAccount() && document.getElementById(BTN_ID)) {
      console.log("🔧 MutationObserver: removendo botão - não está em subconta");
      removeBtn();
    }
  });
  mo.observe(document.documentElement, { 
    childList: true, 
    subtree: true 
  });

  // ⭐ MELHORADO: Inicialização mais robusta - só se estiver em subconta
  if (isInSubAccount()) {
    console.log("🚀 Iniciando em subconta - adicionando botão");
    const startIv = setInterval(() => { 
      if (addButton()) {
        clearInterval(startIv);
        console.log("✅ Botão de suporte adicionado com sucesso na subconta");
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(startIv);
      console.log("⏰ Timeout de inicialização do botão atingido");
    }, 15000);
  } else {
    console.log("🏢 Não está em subconta - botão não será adicionado");
  }
})();
