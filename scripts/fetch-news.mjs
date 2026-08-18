// Holt taeglich Asset-News (BTC, ETH, SOL, HYPE, GOLD) per RSS, filtert grob
// nach Relevanz und schreibt pro Asset eine eigene Datei nach data/news/<key>.json.
// Laeuft als GitHub Action, kein Backend noetig -- die Website liest am Ende
// nur die fertigen JSON-Dateien.
//
// Bewusst algorithmisch/grob (kein LLM-Urteilsvermoegen wie beim alten
// BTC NEWS AGENT) -- Entscheidung vom 18.08.2026, siehe Projekt-Notiz.
// Erweitert auf 5 Assets am 18.08.2026 (vorher nur BTC).

import Parser from "rss-parser";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const DATA_DIR = new URL("../data/news/", import.meta.url);
const MAX_DAYS = 30;
const MAX_ITEMS_PER_DAY = 12;

const CRYPTO_FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
];

const GOLD_FEEDS = [
  { name: "FXStreet", url: "https://www.fxstreet.com/rss/news" },
  { name: "Investing.com", url: "https://www.investing.com/rss/commodities.rss" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news_11.rss" },
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

// Gleiches Relevanz-Prinzip wie beim alten BTC NEWS AGENT (siehe CLAUDE.md):
// Krypto = Makro/Regulierung, On-Chain/Marktstruktur, Projekt-News.
// Gold = Makro & Notenbank-Käufe (eigene, einzelne Kategorie).
const CRYPTO_CATEGORIES = [
  { key: "Makro & Regulierung", pattern: /\b(sec|regulat|congress|senate|lawsuit|legal|law|etf|fed\b|federal reserve|interest rate|inflation|cpi|fomc|tax|ban\b)\b/i },
  { key: "On-Chain & Marktstruktur", pattern: /\b(whale|exchange (in|out)?flow|liquidat|wallet|on-chain|hack|exploit|stolen)\b/i },
  { key: "Projekt-News", pattern: /\b(upgrade|fork|halving|mining|hashrate|network|protocol|lightning)\b/i },
];
const GOLD_CATEGORIES = [
  { key: "Makro & Notenbank-Käufe", pattern: /\b(fed\b|federal reserve|central bank|ecb|interest rate|rate cut|rate hike|inflation|cpi|fomc|safe.?haven|geopolit|war\b|tariff|recession|dollar\b)\b/i },
];

// Volle Namen statt bloßer Ticker (SOL/HYPE) -- vermeidet False Positives
// durch Alltagswoerter ("sold", "hype" als generisches Wort etc.)
const ASSETS = [
  { key: "btc", symbol: "BTC", keyword: /\b(bitcoin|btc)\b/i, feeds: CRYPTO_FEEDS, categories: CRYPTO_CATEGORIES },
  { key: "eth", symbol: "ETH", keyword: /\b(ethereum|\beth\b)\b/i, feeds: CRYPTO_FEEDS, categories: CRYPTO_CATEGORIES },
  { key: "sol", symbol: "SOL", keyword: /\bsolana\b/i, feeds: CRYPTO_FEEDS, categories: CRYPTO_CATEGORIES },
  { key: "hype", symbol: "HYPE", keyword: /\bhyperliquid\b/i, feeds: CRYPTO_FEEDS, categories: CRYPTO_CATEGORIES },
  { key: "gold", symbol: "XAU", keyword: /\b(gold|xau)\b/i, feeds: GOLD_FEEDS, categories: GOLD_CATEGORIES },
];

function isExcluded(text) {
  return EXCLUDE_PATTERNS.some((p) => p.test(text));
}

function categorize(text, categories) {
  const hit = categories.find((c) => c.pattern.test(text));
  return hit ? hit.key : null; // kein Treffer -> Grundrauschen, wird verworfen
}

async function loadExisting(key) {
  try {
    const raw = await readFile(new URL(`${key}.json`, DATA_DIR), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const feedCache = new Map();
async function fetchFeed(parser, feed) {
  if (feedCache.has(feed.url)) return feedCache.get(feed.url);
  const promise = (async () => {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NoRiskNoStoryBot/1.0)" },
      });
      const xml = await res.text();
      const parsed = await parser.parseString(xml);
      return parsed.items ?? [];
    } catch (err) {
      console.error(`Feed fehlgeschlagen (${feed.name}):`, err.message);
      return [];
    }
  })();
  feedCache.set(feed.url, promise);
  return promise;
}

async function processAsset(parser, asset) {
  const existing = await loadExisting(asset.key);
  const seenLinks = new Set(existing.flatMap((day) => day.items.map((i) => i.link)));

  const allItems = [];
  for (const feed of asset.feeds) {
    const items = await fetchFeed(parser, feed);
    for (const item of items) {
      const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
      if (!asset.keyword.test(text) || isExcluded(text)) continue;
      if (!item.link || seenLinks.has(item.link)) continue;
      const category = categorize(text, asset.categories);
      if (!category) continue;
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
  }

  allItems.sort((a, b) => new Date(b.published) - new Date(a.published));
  const todaysItems = allItems.slice(0, MAX_ITEMS_PER_DAY);

  const todayBerlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

  let updated = existing;
  if (todaysItems.length > 0) {
    updated = [{ date: todayBerlin, items: todaysItems }, ...existing.filter((d) => d.date !== todayBerlin)];
  }
  updated = updated.slice(0, MAX_DAYS);

  await writeFile(new URL(`${asset.key}.json`, DATA_DIR), JSON.stringify(updated, null, 2) + "\n", "utf-8");
  console.log(`${asset.symbol}: ${todaysItems.length} neue Items fuer ${todayBerlin}, ${updated.length} Tage gesamt.`);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const parser = new Parser();
  for (const asset of ASSETS) {
    await processAsset(parser, asset);
  }
}

main();
