// Trading Journal — lokale App, alles läuft im Browser, Daten in localStorage
const STORAGE_KEY = "trades";

// ---------- Scroll-Hint (Hero -> App) ----------
document.getElementById("scroll-hint").addEventListener("click", () => {
  document.getElementById("app").scrollIntoView({ behavior: "smooth" });
});

// ---------- Treibende Partikel im Hintergrund ----------
const PARTICLE_COLORS = ["#8b5cf6", "#22d3ee", "#f4f5f7"];
const particlesContainer = document.getElementById("particles");

for (let i = 0; i < 26; i++) {
  const p = document.createElement("div");
  p.className = "particle";
  const size = 2 + Math.random() * 4;
  const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
  p.style.left = `${Math.random() * 100}vw`;
  p.style.width = `${size}px`;
  p.style.height = `${size}px`;
  p.style.background = color;
  p.style.boxShadow = `0 0 ${size * 1.6}px ${color}`;
  p.style.setProperty("--drift-x", `${(Math.random() - 0.5) * 120}px`);
  p.style.animationDuration = `${14 + Math.random() * 16}s`;
  p.style.animationDelay = `${-Math.random() * 25}s`;
  particlesContainer.appendChild(p);
}

// ---------- Hero: Chart baut sich auf + Titel splittet beim Scrollen ----------
const heroEl = document.getElementById("hero");
const chartBg = document.getElementById("chart-bg");
const exitLeft = document.getElementById("exit-left");
const exitRight = document.getElementById("exit-right");

// Zitat unter dem Titel: jeder Buchstabe wird sein eigenes <span>, damit er
// beim Scrollen einzeln verschwinden/sich auflösen kann.
const heroSub = document.querySelector(".hero-sub");
const subChars = [...heroSub.textContent.trim()].map((ch) => {
  const span = document.createElement("span");
  span.className = "sub-char";
  // Leerzeichen als geschuetztes Leerzeichen (U+00A0), sonst kollabiert
  // die Breite bei display:inline-block auf 0 und Woerter kleben zusammen.
  span.textContent = ch.trim() === "" ? String.fromCharCode(160) : ch;
  return span;
});
heroSub.innerHTML = "";
subChars.forEach((span) => heroSub.appendChild(span));

// Echte Auf-und-Ab-Bewegung wie ein Preis-Chart: überlagerte Wellen statt reinem Aufwärtstrend,
// deterministisch (kein Math.random) damit der Chart bei jedem Laden gleich aussieht.
const CANDLE_COUNT = 42;
const CANDLE_HEIGHTS = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const wave =
    Math.sin(i * 0.5) * 38 +
    Math.sin(i * 0.19 + 1.3) * 30 +
    Math.cos(i * 0.85) * 16;
  const h = 90 + wave;
  return Math.max(20, Math.round(h));
});
const candleEls = CANDLE_HEIGHTS.map((h, i) => {
  const up = i === 0 ? true : h >= CANDLE_HEIGHTS[i - 1];
  const candle = document.createElement("div");
  candle.className = `candle ${up ? "up" : "down"}`;

  const wickTop = document.createElement("div");
  wickTop.className = "wick";
  wickTop.style.height = `${6 + (i % 3) * 4}px`;

  const body = document.createElement("div");
  body.className = "body";
  body.style.height = `${h}px`;

  const wickBottom = document.createElement("div");
  wickBottom.className = "wick";
  wickBottom.style.height = `${6 + ((i + 1) % 3) * 4}px`;

  candle.append(wickTop, body, wickBottom);
  chartBg.appendChild(candle);
  return candle;
});

// Text-Partikel: Titel & Zitat lösen sich beim Rausscrollen in kleine, farbige
// Punkte auf, die wie die Hintergrund-Partikel nach oben wegfliegen.
let textParticlesTriggered = false;

function spawnTextParticles(el) {
  const rect = el.getBoundingClientRect();
  const count = 16;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "text-particle";
    const size = 3 + Math.random() * 5;
    const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
    dot.style.left = `${rect.left + Math.random() * rect.width}px`;
    dot.style.top = `${rect.top + Math.random() * rect.height}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.background = color;
    dot.style.boxShadow = `0 0 ${size * 3}px ${color}`;
    dot.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
    const duration = 1.1 + Math.random() * 0.9;
    dot.style.animationDuration = `${duration}s`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), duration * 1000 + 100);
  }
}

// Ein einzelner Buchstabe löst sich an genau seiner Position in einen winzigen Punkt auf
function spawnCharParticle(span, i) {
  const rect = span.getBoundingClientRect();
  const dot = document.createElement("div");
  dot.className = "text-particle";
  const size = 2 + Math.random() * 3;
  const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
  dot.style.left = `${rect.left + rect.width / 2}px`;
  dot.style.top = `${rect.top + rect.height / 2}px`;
  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;
  dot.style.background = color;
  dot.style.boxShadow = `0 0 ${size * 3}px ${color}`;
  dot.style.setProperty("--dx", `${(Math.random() - 0.5) * 80}px`);
  const duration = 0.5 + Math.random() * 0.4;
  dot.style.animationDuration = `${duration}s`;
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), duration * 1000 + 100);
}

function updateHeroScroll() {
  // *0.5 = Effekt ist schon nach halber Hero-Höhe komplett durch, damit man's früher sieht
  const heroHeight = heroEl.offsetHeight * 0.5;
  const p = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);

  // Text soll deutlich früher verschwinden als der Chart komplett aufgebaut ist
  const textP = Math.min(p * 2.2, 1);
  // Wandert bis fast an den Bildschirmrand statt nur ein paar hundert Pixel
  const maxShift = Math.min(window.innerWidth * 0.62, 760);
  const shift = textP * maxShift;
  exitLeft.style.transform = `translateX(${-shift}px)`;
  exitLeft.style.opacity = String(Math.max(0, 1 - textP * 1.3));
  exitRight.style.transform = `translateX(${shift}px)`;
  exitRight.style.opacity = String(Math.max(0, 1 - textP * 1.3));

  // Ab hier fast komplett draußen: Text löst sich in Partikel auf (einmal pro Durchlauf)
  if (textP > 0.82 && !textParticlesTriggered) {
    textParticlesTriggered = true;
    spawnTextParticles(exitLeft);
    spawnTextParticles(exitRight);
  }
  if (textP < 0.4) {
    textParticlesTriggered = false;
  }

  // Zitat: löst sich Buchstabe für Buchstabe auf, deutlich schneller fertig als der Titel
  const subP = Math.min(p * 4.5, 1);
  const total = subChars.length;
  subChars.forEach((span, i) => {
    const threshold = i / total;
    const gone = subP > threshold;
    if (gone && span.dataset.dissolved !== "1") {
      span.dataset.dissolved = "1";
      spawnCharParticle(span, i);
      span.style.opacity = "0";
    } else if (!gone && span.dataset.dissolved === "1") {
      span.dataset.dissolved = "0";
      span.style.opacity = "1";
    }
  });

  const n = candleEls.length;
  candleEls.forEach((el, i) => {
    const threshold = i / n;
    const grow = Math.min(Math.max((p - threshold) * n * 0.8, 0), 1);
    el.style.transform = `scaleY(${grow})`;
  });
}

let heroScrollTicking = false;
window.addEventListener(
  "scroll",
  () => {
    if (!heroScrollTicking) {
      requestAnimationFrame(() => {
        updateHeroScroll();
        heroScrollTicking = false;
      });
      heroScrollTicking = true;
    }
  },
  { passive: true }
);
updateHeroScroll();

// ---------- Reveal-on-scroll ----------
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);

function observeReveals() {
  document.querySelectorAll(".reveal:not(.in-view)").forEach((el) => {
    revealObserver.observe(el);
  });
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.toggle("active", section.id === tabId);
  });
  if (tabId === "chart") loadTradingViewWidget();
  observeReveals();
}

// ---------- Live Chart (TradingView) ----------
// Wird erst geladen wenn der Tab wirklich geöffnet wird — vorher ist der Container
// unsichtbar (display:none) und hätte Breite 0, das Widget würde falsch rendern.
let tradingViewLoaded = false;

function loadTradingViewWidget() {
  if (tradingViewLoaded) return;
  tradingViewLoaded = true;

  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/tv.js";
  script.onload = () => {
    new TradingView.widget({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "de_DE",
      toolbar_bg: "#0d0e12",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      container_id: "tradingview_btc",
    });
  };
  document.body.appendChild(script);
}

// ---------- Speicherung ----------
function loadTrades() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

// ---------- Screenshot-Vorschau ----------
const screenshotInput = document.getElementById("screenshot");
const preview = document.getElementById("screenshot-preview");
const fileDropLabel = document.getElementById("file-drop-label");
let screenshotBase64 = "";

screenshotInput.addEventListener("change", () => {
  const file = screenshotInput.files[0];
  if (!file) {
    screenshotBase64 = "";
    preview.classList.remove("show");
    fileDropLabel.textContent = "Screenshot auswählen";
    return;
  }
  fileDropLabel.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    screenshotBase64 = e.target.result;
    preview.src = screenshotBase64;
    preview.classList.add("show");
  };
  reader.readAsDataURL(file);
});

// ---------- Formular: Trade speichern / bearbeiten ----------
const form = document.getElementById("trade-form");
const confirmMsg = document.getElementById("save-confirm");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let editingId = null;

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const tradeData = {
    datum: document.getElementById("datum").value,
    coin: document.getElementById("coin").value.trim().toUpperCase(),
    richtung: document.getElementById("richtung").value,
    einstieg: parseFloat(document.getElementById("einstieg").value),
    ausstieg: parseFloat(document.getElementById("ausstieg").value),
    ergebnis: document.getElementById("ergebnis").value,
    pnl: document.getElementById("pnl").value
      ? parseFloat(document.getElementById("pnl").value)
      : null,
    setup: document.getElementById("setup").value,
    risiko: document.getElementById("risiko").value
      ? parseFloat(document.getElementById("risiko").value)
      : null,
    emotion: document.getElementById("emotion").value,
    notiz: document.getElementById("notiz").value.trim(),
    screenshot: screenshotBase64,
  };

  const trades = loadTrades();

  if (editingId !== null) {
    const idx = trades.findIndex((t) => t.id === editingId);
    if (idx !== -1) trades[idx] = { ...trades[idx], ...tradeData };
    confirmMsg.textContent = "Trade aktualisiert ✓";
  } else {
    trades.push({ id: Date.now(), ...tradeData });
    confirmMsg.textContent = "Trade gespeichert ✓";
  }

  saveTrades(trades);
  exitEditMode();

  form.reset();
  screenshotBase64 = "";
  preview.classList.remove("show");
  fileDropLabel.textContent = "Screenshot auswählen";
  setTimeout(() => (confirmMsg.textContent = ""), 2500);

  renderUebersicht();
  renderAuswertung();
});

function startEditTrade(trade) {
  editingId = trade.id;

  document.getElementById("datum").value = trade.datum;
  document.getElementById("coin").value = trade.coin;
  document.getElementById("richtung").value = trade.richtung;
  document.getElementById("einstieg").value = trade.einstieg;
  document.getElementById("ausstieg").value = trade.ausstieg;
  document.getElementById("ergebnis").value = trade.ergebnis;
  document.getElementById("pnl").value = trade.pnl ?? "";
  document.getElementById("setup").value = trade.setup;
  document.getElementById("risiko").value = trade.risiko ?? "";
  document.getElementById("emotion").value = trade.emotion;
  document.getElementById("notiz").value = trade.notiz || "";

  screenshotBase64 = trade.screenshot || "";
  if (screenshotBase64) {
    preview.src = screenshotBase64;
    preview.classList.add("show");
    fileDropLabel.textContent = "Screenshot bereits vorhanden (ersetzen?)";
  }

  submitBtn.textContent = "Trade aktualisieren";
  cancelEditBtn.style.display = "block";

  closeModal();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode() {
  editingId = null;
  submitBtn.textContent = "Trade speichern";
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", () => {
  exitEditMode();
  form.reset();
  screenshotBase64 = "";
  preview.classList.remove("show");
  fileDropLabel.textContent = "Screenshot auswählen";
});

// ---------- Übersicht (mit Suche & Filter) ----------
const tbody = document.getElementById("trades-tbody");
const keineTradesHint = document.getElementById("keine-trades");
const table = document.getElementById("trades-table");
const searchInput = document.getElementById("search-input");
const filterSetup = document.getElementById("filter-setup");

searchInput.addEventListener("input", renderUebersicht);
filterSetup.addEventListener("change", renderUebersicht);

function renderUebersicht() {
  const search = searchInput.value.trim().toLowerCase();
  const setupFilter = filterSetup.value;

  let trades = loadTrades().sort((a, b) => b.id - a.id);

  if (search) {
    trades = trades.filter(
      (t) =>
        t.coin.toLowerCase().includes(search) ||
        (t.notiz && t.notiz.toLowerCase().includes(search))
    );
  }
  if (setupFilter) {
    trades = trades.filter((t) => t.setup === setupFilter);
  }

  tbody.innerHTML = "";

  if (trades.length === 0) {
    table.style.display = "none";
    keineTradesHint.style.display = "block";
    keineTradesHint.textContent = search || setupFilter
      ? "Keine Trades gefunden."
      : "Noch keine Trades eingetragen.";
    return;
  }
  table.style.display = "table";
  keineTradesHint.style.display = "none";

  trades.forEach((trade, i) => {
    const tr = document.createElement("tr");
    tr.className = "trade-row reveal";
    tr.style.transitionDelay = `${Math.min(i, 8) * 0.05}s`;
    tr.innerHTML = `
      <td>${trade.datum}</td>
      <td>${trade.coin}</td>
      <td>${trade.richtung}</td>
      <td>${trade.setup}</td>
      <td class="result-${trade.ergebnis.toLowerCase()}">${trade.ergebnis}</td>
      <td>${truncate(trade.notiz, 25)}</td>
      <td><button class="delete-btn" data-id="${trade.id}">🗑</button></td>
    `;
    tr.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      openModal(trade);
    });
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTrade(Number(btn.dataset.id));
    });
  });

  observeReveals();
}

function truncate(text, len) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function deleteTrade(id) {
  const trades = loadTrades().filter((t) => t.id !== id);
  saveTrades(trades);
  renderUebersicht();
  renderAuswertung();
}

// ---------- Detail-Modal ----------
const modal = document.getElementById("trade-modal");
const modalBody = document.getElementById("modal-body");
document.getElementById("modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

function openModal(trade) {
  modalBody.innerHTML = `
    <h3>${trade.coin} — ${trade.richtung}</h3>
    <dl>
      <dt>Datum</dt><dd>${trade.datum}</dd>
      <dt>Einstieg / Ausstieg</dt><dd>${trade.einstieg} → ${trade.ausstieg}</dd>
      <dt>Ergebnis</dt><dd class="result-${trade.ergebnis.toLowerCase()}">${trade.ergebnis}${trade.pnl !== null ? ` (${trade.pnl})` : ""}</dd>
      <dt>Setup</dt><dd>${trade.setup}</dd>
      <dt>Risiko</dt><dd>${trade.risiko !== null ? trade.risiko + "%" : "–"}</dd>
      <dt>Emotion</dt><dd>${trade.emotion}</dd>
      <dt>Notiz</dt><dd>${trade.notiz || "–"}</dd>
    </dl>
    ${trade.screenshot ? `<img src="${trade.screenshot}" alt="Chart Screenshot">` : ""}
    <div class="modal-actions">
      <button type="button" class="btn-secondary" id="modal-edit-btn">Bearbeiten</button>
    </div>
  `;
  document.getElementById("modal-edit-btn").addEventListener("click", () => startEditTrade(trade));
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

// ---------- Backup: Export / Import ----------
document.getElementById("export-btn").addEventListener("click", () => {
  const data = JSON.stringify(loadTrades(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `trading-journal-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const importMsg = document.getElementById("import-msg");

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("Kein gültiges Backup-Format.");

      const existing = loadTrades();
      const existingIds = new Set(existing.map((t) => t.id));
      const neu = imported.filter((t) => t && t.id && !existingIds.has(t.id));

      saveTrades([...existing, ...neu]);
      renderUebersicht();
      renderAuswertung();

      importMsg.textContent = `${neu.length} Trade(s) importiert ✓`;
    } catch (err) {
      importMsg.textContent = "Backup konnte nicht gelesen werden.";
    }
    setTimeout(() => (importMsg.textContent = ""), 3000);
    importFile.value = "";
  };
  reader.readAsText(file);
});

// ---------- Auswertung ----------
function renderAuswertung() {
  const trades = loadTrades();
  const statAnzahl = document.getElementById("stat-anzahl");
  const statWinrate = document.getElementById("stat-winrate");
  const statRR = document.getElementById("stat-rr");
  const breakdown = document.getElementById("setup-breakdown");
  const emotionBreakdown = document.getElementById("emotion-breakdown");

  statAnzahl.textContent = trades.length;

  if (trades.length === 0) {
    statWinrate.textContent = "0%";
    statRR.textContent = "–";
    breakdown.innerHTML = '<p class="hint">Noch keine Daten.</p>';
    emotionBreakdown.innerHTML = '<p class="hint">Noch keine Daten.</p>';
    renderEquity(trades);
    return;
  }

  const wins = trades.filter((t) => t.ergebnis === "Win").length;
  const winrate = ((wins / trades.length) * 100).toFixed(1);
  statWinrate.textContent = `${winrate}%`;

  // Ø Risk/Reward: Abstand Einstieg->Ausstieg relativ zum Risiko, grobe Annäherung
  const rrValues = trades
    .filter((t) => t.risiko && t.risiko > 0)
    .map((t) => Math.abs(t.ausstieg - t.einstieg) / t.risiko);
  statRR.textContent =
    rrValues.length > 0
      ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2)
      : "–";

  // Winrate pro Setup
  const setups = {};
  trades.forEach((t) => {
    if (!setups[t.setup]) setups[t.setup] = { total: 0, wins: 0 };
    setups[t.setup].total++;
    if (t.ergebnis === "Win") setups[t.setup].wins++;
  });

  breakdown.innerHTML = Object.entries(setups)
    .map(([name, s], i) => {
      const wr = ((s.wins / s.total) * 100).toFixed(0);
      return `<div class="setup-row reveal" style="transition-delay:${i * 0.05}s"><span>${name}</span><span>${wr}% (${s.total} Trades)</span></div>`;
    })
    .join("");

  // Winrate nach Emotion — zeigt ob undisziplinierte Trades wirklich schlechter laufen
  const emotions = {};
  trades.forEach((t) => {
    if (!emotions[t.emotion]) emotions[t.emotion] = { total: 0, wins: 0 };
    emotions[t.emotion].total++;
    if (t.ergebnis === "Win") emotions[t.emotion].wins++;
  });

  emotionBreakdown.innerHTML = Object.entries(emotions)
    .map(([name, s], i) => {
      const wr = ((s.wins / s.total) * 100).toFixed(0);
      return `<div class="setup-row reveal" style="transition-delay:${i * 0.05}s"><span>${name}</span><span>${wr}% (${s.total} Trades)</span></div>`;
    })
    .join("");

  renderEquity(trades);
  observeReveals();
}

// ---------- Equity-Kurve ----------
// Kumulierter Kontoverlauf über die Zeit. Nutzt PnL wo vorhanden, sonst
// +1/-1/0 pro Win/Loss/Breakeven als grobe Annäherung, damit auch ohne
// eingetragenen PnL-Wert eine sinnvolle Kurve entsteht.
function renderEquity(trades) {
  const svg = document.getElementById("equity-svg");
  const hint = document.getElementById("equity-hint");

  if (!trades || trades.length === 0) {
    svg.innerHTML = "";
    hint.style.display = "block";
    return;
  }
  hint.style.display = "none";

  const sorted = [...trades].sort((a, b) => a.id - b.id);
  let running = 0;
  const values = [0].concat(
    sorted.map((t) => {
      const delta =
        t.pnl !== null && t.pnl !== undefined
          ? t.pnl
          : t.ergebnis === "Win"
          ? 1
          : t.ergebnis === "Loss"
          ? -1
          : 0;
      running += delta;
      return running;
    })
  );

  const w = 600;
  const h = 160;
  const pad = 10;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const linePoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);

  svg.innerHTML = `
    <line class="equity-zero" x1="0" y1="${zeroY.toFixed(1)}" x2="${w}" y2="${zeroY.toFixed(1)}" />
    <polygon class="equity-area" points="${areaPoints}" />
    <polyline class="equity-line" points="${linePoints}" />
  `;
}

// ---------- Init ----------
renderUebersicht();
renderAuswertung();
observeReveals();
