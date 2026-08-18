// Holt taeglich BTC-relevante News aus RSS-Feeds, filtert grob nach Relevanz
// (Makro/Regulierung, On-Chain/Marktstruktur, Projekt-News) und schreibt sie
// nach data/btc-news.json. Laeuft als GitHub Action, kein Backend noetig --
// die Website liest am Ende nur die fertige JSON-Datei.
//
// Bewusst algorithmisch/grob (kein LLM-Urteilsvermoegen wie beim alten
// BTC NEWS AGENT) -- Entscheidung vom 18.08.2026, siehe Projekt-Notiz.

import Parser from "rss-parser";
import { readFile, writeFile } from "node:fs/promises";

const DATA_PATH = new URL("../data/btc-news.json", import.meta.url);
const MAX_DAYS = 30;
const MAX_ITEMS_PER_DAY = 12;

const FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
];

// Explizit NICHT: Kursprognosen von Influencern, Grundrauschen, Clickbait
const EXCLUDE_PATTERNS = [
  /price predict/i,
  /could (hit|reach|surge|explode|skyrocket|soar)/i,
  /\$\d+[kKmM]\s*(target|prediction|by)/i,
  /\bmoon\b/i,
  /\bexplode\b/i,
  /\bskyrocket/i,
  /top \d+ (coins|altcoins|cryptos)/i,
  /best crypto to buy/i,
  /here'?s why/i,
];

// Kategorien nach dem gleichen Relevanz-Prinzip wie der alte BTC NEWS AGENT
const CATEGORIES = [
  { key: "Makro & Regulierung", pattern: /\b(sec|regulat|congress|senate|lawsuit|legal|law|etf|fed\b|federal reserve|interest rate|inflation|cpi|fomc|tax|ban\b)\b/i },
  { key: "On-Chain & Marktstruktur", pattern: /\b(whale|exchange (in|out)?flow|liquidat|wallet|on-chain|hack|exploit|stolen)\b/i },
  { key: "Projekt-News", pattern: /\b(upgrade|fork|halving|mining|hashrate|network|protocol|lightning)\b/i },
];

function isBtcRelevant(text) {
  return /\b(bitcoin|btc)\b/i.test(text);
}

function isExcluded(text) {
  return EXCLUDE_PATTERNS.some((p) => p.test(text));
}

// Keine "Markt"-Restkategorie mehr: was in keine der drei Kategorien faellt
// (reine Kursmeldungen, Live-Ticker, Chart-/TA-Talk), wird komplett verworfen
// statt als Grundrauschen mit reinzurutschen. Entscheidung 18.08.2026 nach
// erster Qualitaets-Probe -- siehe Projekt-Notiz.
function categorize(text) {
  const hit = CATEGORIES.find((c) => c.pattern.test(text));
  return hit ? hit.key : null;
}

async function loadExisting() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function main() {
  const parser = new Parser();
  const existing = await loadExisting();
  const seenLinks = new Set(existing.flatMap((day) => day.items.map((i) => i.link)));

  const allItems = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NoRiskNoStoryBot/1.0)" },
      });
      const xml = await res.text();
      const parsed = await parser.parseString(xml);
      for (const item of parsed.items ?? []) {
        const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
        if (!isBtcRelevant(text) || isExcluded(text)) continue;
        if (!item.link || seenLinks.has(item.link)) continue;
        const category = categorize(text);
        if (!category) continue; // faellt in keine der drei Kategorien -> Grundrauschen, raus
        seenLinks.add(item.link);
        allItems.push({
          title: item.title?.trim() ?? "",
          link: item.link,
          source: feed.name,
          published: item.isoDate ?? item.pubDate ?? null,
          category,
          summary: (item.contentSnippet ?? "").trim().slice(0, 220),
        });
      }
    } catch (err) {
      console.error(`Feed fehlgeschlagen (${feed.name}):`, err.message);
    }
  }

  allItems.sort((a, b) => new Date(b.published) - new Date(a.published));
  const todaysItems = allItems.slice(0, MAX_ITEMS_PER_DAY);

  const todayBerlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

  let updated = existing;
  if (todaysItems.length > 0) {
    updated = [{ date: todayBerlin, items: todaysItems }, ...existing.filter((d) => d.date !== todayBerlin)];
  }
  updated = updated.slice(0, MAX_DAYS);

  await writeFile(DATA_PATH, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  console.log(`${todaysItems.length} neue Items fuer ${todayBerlin}, ${updated.length} Tage gesamt.`);
}

main();
