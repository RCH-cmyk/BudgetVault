// storage.js - shared helpers. Every page loads this FIRST.
// Everything is saved in the visitor's own browser (localStorage), never sent to a server.

// The one key all our data is saved under
const STORAGE_KEY = "budgetVault.v1";

// Shortcut: $("id") instead of document.getElementById("id")
const $ = (id) => document.getElementById(id);

// Make a random id (letters + numbers only) for boxes and items
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// What a brand-new visitor starts with
function defaultData() {
  return {
    income: { mode: "hourly", hourly: 0, hours: 0, yearly: 0, taxPct: 0, monthly: 0 },
    cards: []
  };
}

// Turn anything into a safe number that is 0 or more
function toNum(value) {
  const n = Number(value);                      // try to convert to a number
  return Number.isFinite(n) && n > 0 ? n : 0;   // reject NaN, Infinity and negatives
}

// Rebuild saved data field by field so odd or tampered values can't cause trouble
// (ETHICAL-HACKING NOTE: never trust data coming from storage, treat it like user input)
function cleanData(raw) {
  const base = defaultData();                              // start from safe defaults
  if (!raw || typeof raw !== "object") return base;        // nothing usable saved

  const inc = raw.income || {};                            // saved income section
  base.income = {
    mode: inc.mode === "yearly" ? "yearly" : "hourly",     // only two allowed modes
    hourly: toNum(inc.hourly),
    hours: toNum(inc.hours),
    yearly: toNum(inc.yearly),
    taxPct: Math.min(100, toNum(inc.taxPct)),              // tax can't go over 100%
    monthly: toNum(inc.monthly)
  };

  const cards = Array.isArray(raw.cards) ? raw.cards : []; // saved boxes
  base.cards = cards
    .filter((c) => c && typeof c === "object")             // skip junk entries
    .map((c) => ({
      id: newId(),                                         // fresh id each visit (only used in-page)
      name: String(c.name || "").slice(0, 30),             // text only, max 30 characters
      color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : "#5D6D7E", // must look like #RRGGBB
      items: (Array.isArray(c.items) ? c.items : [])
        .filter((i) => i && typeof i === "object")
        .map((i) => ({
          id: newId(),
          name: String(i.name || "").slice(0, 40),
          amount: toNum(i.amount),
          tag: String(i.tag || "").slice(0, 24)
        }))
    }));
  return base;
}

// Read everything saved in this browser (falls back to defaults if blocked/empty)
function loadData() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);        // saved text or null
    return cleanData(text ? JSON.parse(text) : null);      // parse then clean
  } catch (err) {
    return defaultData();                                  // private mode / bad JSON
  }
}

// Save everything (silently ignored if the browser blocks storage)
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    /* storage blocked: the app still works, it just won't remember */
  }
}

// 1234.5 -> "£1,234.50"
function formatMoney(n) {
  return "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Add up every item in one box
function cardTotal(card) {
  return card.items.reduce((sum, item) => sum + toNum(item.amount), 0);
}
