// subscriptions.js - manual subscription tracker (everything is typed in by hand, no bank connection)
// Saved in this browser only, under its own key, so it never touches your income / budget data.

const SUBS_KEY = "budgetVault.subs.v1";            // where the list is saved in this browser
const CYCLES = ["weekly", "monthly", "yearly"];    // the only billing cycles allowed
const CYCLE_WORD = { weekly: "week", monthly: "month", yearly: "year" }; // for the summary sentence
const MAX_SUBS = 200;                              // stops the list growing without limit
const rowViews = new Map();                        // sub id -> the info line of its row

// ---------- Tiny helper to build page elements safely ----------
// Uses textContent / setAttribute, never innerHTML, so typed text can't run as code (stops XSS)
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);                       // make the element
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "text") node.textContent = val;                   // safe text
    else if (key === "class") node.className = val;               // CSS class
    else node.setAttribute(key, val);                             // anything else is an attribute
  }
  kids.forEach((kid) => node.append(kid));                        // put children inside
  return node;
}

// ---------- Dates (all in the visitor's own time zone) ----------
// "2026-11-20" -> a Date at midnight, or null if it isn't a real date between 1990 and 2100
function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");          // must look like YYYY-MM-DD
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  if (y < 1990 || y > 2100) return null;                          // keeps the maths fast and sensible
  const dt = new Date(y, mo, d);
  // reject things like 2026-02-31 (JavaScript would quietly roll it into March)
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? dt : null;
}

// Today at midnight
function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// How many days are in a month (month can overflow, e.g. 12 means January next year)
function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// The n-th payment after the starting date, e.g. n = 1 is the first repeat
function occurrence(start, cycle, n) {
  const y = start.getFullYear(), m = start.getMonth(), d = start.getDate();
  if (cycle === "weekly") return new Date(y, m, d + 7 * n);       // +7 days each time
  if (cycle === "yearly") return new Date(y + n, m, Math.min(d, daysInMonth(y + n, m))); // 29 Feb -> 28 Feb in normal years
  return new Date(y, m + n, Math.min(d, daysInMonth(y, m + n)));  // monthly: 31 Jan -> 28 Feb -> 31 Mar
}

// The first payment date that is today or later (or null if no date was entered)
function nextPayment(sub) {
  const start = parseDate(sub.date);
  if (!start) return null;
  const t = today();
  let n = 0, dt = start;
  while (dt < t && n < 20000) {                                   // step forward until it is not in the past
    n++;
    dt = occurrence(start, sub.cycle, n);
  }
  return dt;
}

// "Fri 20 Nov 2026"
function fmtDate(dt) {
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// "today" / "tomorrow" / "in 7 days"
function daysText(dt) {
  const days = Math.round((dt - today()) / 86400000);             // whole days (rounding copes with clock changes)
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return "in " + days + " days";
}

// ---------- Money ----------
// What one subscription costs per month (weekly uses 52 weeks / 12 months)
function monthlyCost(sub) {
  if (sub.cycle === "weekly") return sub.price * 52 / 12;
  if (sub.cycle === "yearly") return sub.price / 12;
  return sub.price;
}

// ---------- Loading and saving ----------
// Rebuild saved data field by field so odd or tampered values can't cause trouble
// (ETHICAL-HACKING NOTE: same rule as storage.js: never trust stored data, treat it like user input)
function cleanSubs(raw) {
  const list = raw && Array.isArray(raw.subs) ? raw.subs : [];
  return list
    .filter((s) => s && typeof s === "object")                    // skip junk entries
    .slice(0, MAX_SUBS)                                           // never more than 200
    .map((s) => ({
      id: newId(),                                                // fresh id each visit (only used in-page)
      name: String(s.name || "").slice(0, 40),                    // text only, max 40 characters
      price: toNum(s.price),                                      // 0 or more, never NaN
      cycle: CYCLES.includes(s.cycle) ? s.cycle : "monthly",      // only the three allowed cycles
      category: String(s.category || "").slice(0, 24),
      date: parseDate(s.date) ? String(s.date) : "",              // a real YYYY-MM-DD date or nothing
      active: s.active !== false                                  // anything except false counts as active
    }));
}

function loadSubs() {
  try {
    const text = localStorage.getItem(SUBS_KEY);                  // saved text or null
    return cleanSubs(text ? JSON.parse(text) : null);             // parse then clean
  } catch (err) {
    return [];                                                    // private mode / bad JSON
  }
}

function saveSubs() {
  try {
    localStorage.setItem(SUBS_KEY, JSON.stringify({ subs: subs }));
  } catch (err) {
    /* storage blocked: the page still works, it just won't remember */
  }
}

let subs = loadSubs();                                            // the list, kept in step with the page

// ---------- One subscription row ----------
function buildRow(sub) {
  const root = el("div", { class: "sub-row" });

  // Line 1: name, price, billing cycle
  const name = el("input", { type: "text", class: "s-name", placeholder: "Name (e.g. Netflix)", value: sub.name, maxlength: "40", "aria-label": "Subscription name" });
  const price = el("input", { type: "number", class: "s-price", placeholder: "\u00A30.00", min: "0", step: "0.01", inputmode: "decimal", "aria-label": "Price" });
  if (sub.price) price.value = sub.price;                         // leave empty if 0 so the placeholder shows
  const cycle = el("select", { class: "s-cycle", "aria-label": "How often you pay" },
    el("option", { value: "weekly", text: "per week" }),
    el("option", { value: "monthly", text: "per month" }),
    el("option", { value: "yearly", text: "per year" }));
  cycle.value = sub.cycle;

  // Line 2: category, a payment date, active tick
  const category = el("input", { type: "text", class: "s-cat", placeholder: "Category (optional)", value: sub.category, maxlength: "24", list: "catList", "aria-label": "Category" });
  const date = el("input", { type: "date", class: "s-date", value: sub.date, min: "1990-01-01", max: "2100-12-31", "aria-label": "Last or next payment date" });
  const active = el("input", { type: "checkbox", class: "s-active" });
  active.checked = sub.active;

  // Line 3: summary sentence + delete
  const info = el("span", { class: "sub-info" });
  const remove = el("button", { class: "icon-btn", type: "button", title: "Delete this subscription", text: "\u2715" });

  // Every change updates the data, then everything is recalculated
  name.addEventListener("input", () => { sub.name = name.value; refresh(); });
  price.addEventListener("input", () => { sub.price = toNum(price.value); refresh(); });
  cycle.addEventListener("change", () => { sub.cycle = CYCLES.includes(cycle.value) ? cycle.value : "monthly"; refresh(); });
  category.addEventListener("input", () => { sub.category = category.value; refresh(); });
  ["input", "change"].forEach((evt) => date.addEventListener(evt, () => { sub.date = parseDate(date.value) ? date.value : ""; refresh(); }));
  active.addEventListener("change", () => { sub.active = active.checked; refresh(); });
  remove.addEventListener("click", () => {
    if (!confirm("Delete this subscription?")) return;            // ask first
    subs = subs.filter((s) => s.id !== sub.id);                   // drop it from the data
    rowViews.delete(sub.id);
    root.remove();                                                // and from the page
    refresh();
  });

  rowViews.set(sub.id, { root, info });                           // so refresh() can update this row
  root.append(
    el("div", { class: "line1" }, name, price, cycle),
    el("div", { class: "line2" },
      category,
      el("div", { class: "s-field" }, el("small", { text: "Last or next payment date" }), date),
      el("label", { class: "active-wrap" }, active, el("span", { text: "Active" }))),
    el("div", { class: "line3" }, info, remove));
  return root;
}

// The summary sentence under each row
function infoText(sub) {
  const parts = [formatMoney(sub.price) + "/" + CYCLE_WORD[sub.cycle]];
  if (sub.cycle !== "monthly" && sub.price) parts.push("= " + formatMoney(monthlyCost(sub)) + "/month");
  if (!sub.active) {
    parts.push("paused");
  } else {
    const next = nextPayment(sub);
    parts.push(next ? "next payment " + fmtDate(next) + " (" + daysText(next) + ")" : "no payment date set");
  }
  return parts.join(" \u00B7 ");
}

// ---------- Recalculate everything and redraw ----------
function refresh() {
  // 1) Each row: summary sentence + faded if paused
  subs.forEach((sub) => {
    const view = rowViews.get(sub.id);
    if (!view) return;
    view.info.textContent = infoText(sub);
    view.root.classList.toggle("paused", !sub.active);
  });

  // 2) Totals (paused subscriptions don't count)
  const active = subs.filter((s) => s.active);
  const monthly = active.reduce((total, s) => total + monthlyCost(s), 0);
  $("sumMonthly").textContent = formatMoney(monthly);
  $("sumYearly").textContent = formatMoney(monthly * 12);
  $("sumCount").textContent = active.length + " of " + subs.length;
  $("emptyMsg").hidden = subs.length > 0;

  // 3) Cost per category
  const byCat = new Map();                                        // Map (not a plain object) is safer for user text
  active.forEach((s) => {
    const label = s.category.trim() || "Uncategorised";
    const key = label.toLowerCase();                              // "Music" and "music" group together
    const entry = byCat.get(key) || { label: label, sum: 0 };
    entry.sum += monthlyCost(s);
    byCat.set(key, entry);
  });
  const cats = [...byCat.values()].filter((c) => c.sum > 0).sort((a, b) => b.sum - a.sum);
  $("categories").replaceChildren(...cats.map((c) => el("span", { class: "chip", text: c.label + ": " + formatMoney(c.sum) })));
  $("catPanel").hidden = cats.length === 0;

  // 4) Payments due in the next 30 days, soonest first
  const t = today();
  const limit = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30);
  const due = active
    .map((s) => ({ s: s, next: nextPayment(s) }))
    .filter((x) => x.next && x.next <= limit)
    .sort((a, b) => a.next - b.next);
  $("upcoming").replaceChildren(...due.map((x) => el("li", {},
    el("span", { text: (x.s.name.trim() || "Unnamed") + " \u00B7 " + fmtDate(x.next) }),
    el("span", { class: "muted", text: formatMoney(x.s.price) + " (" + daysText(x.next) + ")" }))));
  $("upcoming").hidden = due.length === 0;
  $("upcomingEmpty").hidden = due.length > 0;

  saveSubs();                                                     // remember everything
}

// ---------- "+ Add subscription" ----------
$("addBtn").addEventListener("click", () => {
  if (subs.length >= MAX_SUBS) { alert("That's the maximum of " + MAX_SUBS + " subscriptions."); return; }
  const sub = { id: newId(), name: "", price: 0, cycle: "monthly", category: "", date: "", active: true };
  subs.push(sub);
  const row = buildRow(sub);
  $("subList").append(row);
  row.querySelector(".s-name").focus();                           // cursor straight into the new row
  refresh();
});

// ---------- Start up: draw saved rows, then totals ----------
subs.forEach((sub) => $("subList").append(buildRow(sub)));
refresh();