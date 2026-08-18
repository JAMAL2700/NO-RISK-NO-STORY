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

// Echter Candlestick-Chart als SVG: Körper + Docht + eine durchgezogene
// Kurslinie oben drüber, damit es wirklich wie ein Chart aussieht und nicht
// wie einzelne wachsende Balken. Höhen aus überlagerten Wellen (deterministisch,
// kein Math.random, damit der Chart bei jedem Laden gleich aussieht).
const CANDLE_COUNT = 42;
const CANDLE_HEIGHTS = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const wave =
    Math.sin(i * 0.5) * 38 +
    Math.sin(i * 0.19 + 1.3) * 30 +
    Math.cos(i * 0.85) * 16;
  const h = 90 + wave;
  return Math.max(20, Math.round(h));
});

const CHART_VB_W = 1000;
const CHART_VB_H = 400;
const CHART_BASE_Y = 388;
const CHART_SCALE = 1.9;

const chartWicksG = document.getElementById("chart-wicks");
const chartBodiesG = document.getElementById("chart-bodies");
const chartLine = document.getElementById("chart-line");

const svgNS = "http://www.w3.org/2000/svg";
const slotW = CHART_VB_W / CANDLE_COUNT;
const bodyW = slotW * 0.58;

const linePoints = CANDLE_HEIGHTS.map((h, i) => {
  const up = i === 0 ? true : h >= CANDLE_HEIGHTS[i - 1];
  const xCenter = slotW * i + slotW / 2;
  const bodyH = h * CHART_SCALE;
  const topY = CHART_BASE_Y - bodyH;
  const wickTopLen = (6 + (i % 3) * 4) * CHART_SCALE * 0.6;
  const wickBottomLen = (6 + ((i + 1) % 3) * 4) * CHART_SCALE * 0.6;

  const wick = document.createElementNS(svgNS, "line");
  wick.setAttribute("x1", xCenter);
  wick.setAttribute("x2", xCenter);
  wick.setAttribute("y1", topY - wickTopLen);
  wick.setAttribute("y2", CHART_BASE_Y + wickBottomLen);
  chartWicksG.appendChild(wick);

  const body = document.createElementNS(svgNS, "rect");
  body.setAttribute("class", `chart-body ${up ? "up" : "down"}`);
  body.setAttribute("x", xCenter - bodyW / 2);
  body.setAttribute("y", topY);
  body.setAttribute("width", bodyW);
  body.setAttribute("height", bodyH);
  body.setAttribute("rx", Math.min(4, bodyW / 3));
  chartBodiesG.appendChild(body);

  return `${xCenter},${topY}`;
});

chartLine.setAttribute("points", linePoints.join(" "));

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

  // Zitat: löst sich Buchstabe für Buchstabe per Fade auf, deutlich schneller fertig als der Titel.
  // Reines CSS-Transition (siehe .sub-char in style.css) statt Partikel-Spawn pro Buchstabe —
  // keine getBoundingClientRect()-Aufrufe/DOM-Erzeugung mehr während des Scrollens (war der Ruckler).
  const subP = Math.min(p * 4.5, 1);
  const total = subChars.length;
  subChars.forEach((span, i) => {
    const threshold = i / total;
    span.style.opacity = subP > threshold ? "0" : "1";
  });

  // Chart baut sich als Ganzes von unten nach oben auf (Wipe-Reveal statt
  // einzelner wachsender Balken) — deckt oben ab, deckt beim Scrollen auf.
  const revealed = `${(1 - p) * 100}% 0 0 0`;
  chartBg.style.clipPath = `inset(${revealed})`;
  chartBg.style.webkitClipPath = `inset(${revealed})`;
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
  if (tabId === "news") loadNewsTab();
  observeReveals();
}

// ---------- BTC News ----------
// Liest data/btc-news.json, geschrieben von der taeglichen GitHub-Action
// (.github/workflows/btc-news.yml). Kein Live-API-Call im Browser noetig.
let newsLoaded = false;

async function loadNewsTab() {
  if (newsLoaded) return;
  newsLoaded = true;
  const list = document.getElementById("news-list");
  try {
    const res = await fetch("data/btc-news.json", { cache: "no-store" });
    if (!res.ok) throw new Error("News-Datei nicht gefunden");
    const days = await res.json();
    if (!days.length) {
      list.innerHTML = `<p class="hint">Noch keine News eingetroffen — kommt mit dem nächsten täglichen Update.</p>`;
      return;
    }
    list.innerHTML = days
      .map(
        (day) => `
      <h3 class="news-day-heading">${formatNewsDate(day.date)}</h3>
      <div class="card glass reveal news-day">
        ${day.items
          .map(
            (item) => `
          <a class="news-item" href="${item.link}" target="_blank" rel="noopener">
            <span class="news-item-top">
              <span class="news-tag">${item.category}</span>
              <span class="news-source">${item.source}</span>
            </span>
            <span class="news-title">${item.title}</span>
            ${item.summary ? `<span class="news-summary">${item.summary}</span>` : ""}
          </a>`
          )
          .join("")}
      </div>`
      )
      .join("");
    observeReveals();
  } catch (err) {
    list.innerHTML = `<p class="hint">News konnten nicht geladen werden (${err.message}).</p>`;
    newsLoaded = false;
  }
}

function formatNewsDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
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
  checkBackupReminder();
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
function doExport() {
  const trades = loadTrades();
  const data = JSON.stringify(trades, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `trading-journal-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  localStorage.setItem("lastBackupMeta", JSON.stringify({ timestamp: Date.now(), tradeCount: trades.length }));
  localStorage.removeItem("backupSnoozeUntil");
  checkBackupReminder();
}

document.getElementById("export-btn").addEventListener("click", doExport);

// ---------- Backup-Reminder ----------
// Trades liegen NUR in localStorage -- Browserdaten loeschen/Handy wechseln
// heisst alles weg. Erinnert deshalb von selbst ans Backup, statt drauf zu
// hoffen dass man dran denkt. Trigger: 10+ neue Trades seit letztem Backup
// ODER 2+ Wochen seit letztem Backup. "Später" snoozt fuer 3 Tage.
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const backupBanner = document.getElementById("backup-reminder");

function getInstalledAt() {
  let installedAt = Number(localStorage.getItem("installedAt"));
  if (!installedAt) {
    installedAt = Date.now();
    localStorage.setItem("installedAt", String(installedAt));
  }
  return installedAt;
}

function checkBackupReminder() {
  if (!backupBanner) return;
  const trades = loadTrades();
  if (trades.length === 0) {
    backupBanner.classList.add("hidden");
    return;
  }

  const now = Date.now();
  const snoozeUntil = Number(localStorage.getItem("backupSnoozeUntil") || 0);
  if (now < snoozeUntil) {
    backupBanner.classList.add("hidden");
    return;
  }

  const meta = JSON.parse(localStorage.getItem("lastBackupMeta") || "null");
  const tradesSinceBackup = trades.length - (meta ? meta.tradeCount : 0);
  const timeSinceBackup = now - (meta ? meta.timestamp : getInstalledAt());

  if (tradesSinceBackup >= 10 || timeSinceBackup >= TWO_WEEKS_MS) {
    const reason =
      tradesSinceBackup >= 10
        ? `${tradesSinceBackup} neue Trades seit dem letzten Backup`
        : "Dein letztes Backup ist über 2 Wochen her";
    backupBanner.querySelector(".backup-reminder-text").textContent =
      `${reason} — deine Trades liegen nur auf diesem Gerät. Kurz sichern?`;
    backupBanner.classList.remove("hidden");
  } else {
    backupBanner.classList.add("hidden");
  }
}

backupBanner?.querySelector(".backup-reminder-now")?.addEventListener("click", doExport);
backupBanner?.querySelector(".backup-reminder-later")?.addEventListener("click", () => {
  localStorage.setItem("backupSnoozeUntil", String(Date.now() + THREE_DAYS_MS));
  backupBanner.classList.add("hidden");
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
      checkBackupReminder();

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
checkBackupReminder();
observeReveals();
