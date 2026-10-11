// budget.js - swipeable boxes + live pie chart

// ---------- Setup ----------
const data = loadData();                        // everything saved in this browser
const PRESETS = ["Housing", "Bills", "Food", "Transport", "Entertainment", "Subscriptions", "Insurance"];
const PALETTE = ["#3498DB", "#9B59B6", "#F39C12", "#E84393", "#F1C40F", "#5D6D7E", "#5C6BC0", "#A0522D"];
const LEFT_OVER_COLOUR = "#16A085";             // the "money left" slice is always teal
const cardViews = new Map();                    // card id -> the elements that show its total
let chart = null;                               // the Chart.js pie (created on first use)

// ---------- Tiny helper to build page elements safely ----------
// Uses textContent / setAttribute, never innerHTML, so typed text can't run as code (stops XSS)
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);                       // make the element
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "text") node.textContent = val;                   // safe text
    else if (key === "class") node.className = val;               // CSS class
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), val); // onclick -> "click"
    else node.setAttribute(key, val);                             // anything else is an attribute
  }
  kids.forEach((kid) => node.append(kid));                        // put children inside
  return node;
}

// ---------- One row inside a box: name, amount, remove, tag ----------
function buildItemRow(card, item) {
  const row = el("div", { class: "item-row" });
  const name = el("input", { class: "i-name", type: "text", placeholder: "Item (e.g. Netflix)", value: item.name, maxlength: "40", "aria-label": "Item name" });
  const amount = el("input", { class: "i-amount", type: "number", placeholder: "£0.00", min: "0", step: "0.01", inputmode: "decimal", "aria-label": "Amount per month" });
  if (item.amount) amount.value = item.amount;                    // leave empty if 0 so placeholder shows
  const tag = el("input", { class: "i-tag", type: "text", placeholder: "Tag (optional) e.g. Entertainment", value: item.tag, maxlength: "24", "aria-label": "Tag" });
  const remove = el("button", { class: "icon-btn", type: "button", title: "Remove item", text: "\u2715" });

  name.addEventListener("input", () => { item.name = name.value; refresh(); });           // save name
  amount.addEventListener("input", () => { item.amount = toNum(amount.value); refresh(); }); // save amount (0 or more)
  tag.addEventListener("input", () => { item.tag = tag.value.trim(); refresh(); });       // save tag
  remove.addEventListener("click", () => {
    card.items = card.items.filter((i) => i.id !== item.id);      // drop it from the data
    row.remove();                                                 // and from the page
    refresh();                                                    // update totals + pie
  });

  row.append(name, amount, remove, tag);                          // put the pieces in the row
  return row;
}

// ---------- One whole box ----------
function buildCard(card) {
  const root = el("section", { class: "bv-card" });
  root.style.setProperty("--accent", card.color);                 // the coloured top edge

  // Header: editable name, colour picker, delete button
  const nameInput = el("input", { class: "card-name", type: "text", value: card.name, maxlength: "30", "aria-label": "Box name" });
  const colourInput = el("input", { class: "colour-pick", type: "color", value: card.color, "aria-label": "Box colour" });
  const del = el("button", { class: "icon-btn", type: "button", title: "Delete this box", text: "\u2715" });

  nameInput.addEventListener("input", () => { card.name = nameInput.value; refresh(); });
  colourInput.addEventListener("input", () => {
    card.color = colourInput.value;                               // browser only gives #RRGGBB
    root.style.setProperty("--accent", card.color);
    refresh();                                                    // pie slice takes the new colour
  });
  del.addEventListener("click", () => {
    if (!confirm("Delete this box and everything in it?")) return; // ask first
    data.cards = data.cards.filter((c) => c.id !== card.id);      // remove from data
    cardViews.delete(card.id);
    root.remove();                                                // remove from page
    renderAddCard();                                              // its preset button comes back
    refresh();
  });

  // Items list + "add item" button
  const list = el("div", { class: "items" });
  card.items.forEach((item) => list.append(buildItemRow(card, item)));
  const addItem = el("button", { class: "btn-secondary", type: "button", text: "+ Add item" });
  addItem.addEventListener("click", () => {
    const item = { id: newId(), name: "", amount: 0, tag: "" };   // a blank new item
    card.items.push(item);
    const row = buildItemRow(card, item);
    list.append(row);
    row.querySelector(".i-name").focus();                         // cursor straight into the new row
  });

  // Footer: total + per-tag totals
  const totalEl = el("strong", { text: "£0.00" });
  const tagsEl = el("div", {});
  const footer = el("div", { class: "card-footer" }, el("span", { text: "Box total" }), totalEl);
  cardViews.set(card.id, { totalEl, tagsEl });                    // remember so refresh() can update them

  root.append(el("div", { class: "card-head" }, nameInput, colourInput, del), list, addItem, footer, tagsEl);
  return root;
}

// ---------- The dashed "+ Add a box" card ----------
function buildAddCard() {
  const root = el("section", { class: "bv-card add-card" });
  root.append(el("h3", { text: "+ Add a box" }), el("p", { class: "muted", text: "Pick one, or name your own. Every box is optional." }));

  // Preset buttons (hide any that already exist)
  const used = new Set(data.cards.map((c) => c.name.toLowerCase()));
  const presets = el("div", { class: "preset-list" });
  PRESETS.filter((p) => !used.has(p.toLowerCase())).forEach((p) => {
    presets.append(el("button", { class: "btn-secondary", type: "button", text: "+ " + p, onclick: () => addCard(p) }));
  });

  // Custom name box
  const custom = el("input", { type: "text", placeholder: "Or type your own name", maxlength: "30", "aria-label": "Custom box name" });
  const addBtn = el("button", { class: "btn", type: "button", text: "Add", onclick: () => { addCard(custom.value); custom.value = ""; } });
  custom.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); }); // Enter key works too

  root.append(presets, el("div", { class: "custom-row" }, custom, addBtn));
  return root;
}

// Swap the add-card for a fresh one (keeps the preset list up to date)
function renderAddCard() {
  const old = document.querySelector(".add-card");
  const fresh = buildAddCard();
  if (old) old.replaceWith(fresh); else $("carousel").append(fresh);
}

// ---------- Add a new box ----------
function addCard(rawName) {
  const name = String(rawName).trim().slice(0, 30);               // tidy the name
  if (!name) return;                                              // ignore empty names
  const card = {
    id: newId(),
    name: name,
    color: PALETTE[data.cards.length % PALETTE.length],           // next colour in the set
    items: [{ id: newId(), name: "", amount: 0, tag: "" }]        // start with one blank row
  };
  data.cards.push(card);
  const node = buildCard(card);
  $("carousel").insertBefore(node, document.querySelector(".add-card")); // goes just before the + card
  renderAddCard();                                                // refresh the preset buttons
  node.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }); // swipe to it
  refresh();
}

// ---------- Recalculate everything and redraw ----------
function refresh() {
  // 1) Each box: its total and its per-tag totals
  data.cards.forEach((card) => {
    const view = cardViews.get(card.id);
    if (!view) return;
    view.totalEl.textContent = formatMoney(cardTotal(card));
    const byTag = new Map();                                      // Map (not a plain object) is safer for user text
    card.items.forEach((i) => {
      if (!i.tag || !i.amount) return;                            // only tagged items with an amount
      const key = i.tag.toLowerCase();                            // "Netflix" and "netflix" group together
      const entry = byTag.get(key) || { label: i.tag, sum: 0 };
      entry.sum += i.amount;
      byTag.set(key, entry);
    });
    view.tagsEl.replaceChildren(
      ...[...byTag.values()].map((t) => el("span", { class: "chip", text: t.label + ": " + formatMoney(t.sum) }))
    );
  });

  // 2) The summary tiles at the top
  const spent = data.cards.reduce((sum, c) => sum + cardTotal(c), 0);
  const income = data.income.monthly;
  const left = income - spent;
  $("sumIncome").textContent = formatMoney(income);
  $("sumSpent").textContent = formatMoney(spent);
  $("leftLabel").textContent = left < 0 ? "Over budget by" : "Left over";
  $("sumLeft").textContent = formatMoney(Math.abs(left));
  $("sumLeft").className = "value " + (left < 0 ? "bad" : "good"); // coral if overspending
  $("incomeHint").hidden = income > 0;                            // nudge to the Income page if empty

  // 3) The pie: one slice per box with money in it, plus a teal "Left over" slice
  const slices = data.cards
    .filter((c) => cardTotal(c) > 0)
    .map((c) => ({ label: c.name || "Untitled", value: cardTotal(c), color: c.color }));
  // Only add "Left over" once something is spent, so a brand-new budget shows the hint instead of a lone teal circle
  if (slices.length > 0 && left > 0) slices.push({ label: "Left over", value: left, color: LEFT_OVER_COLOUR });
  updateChart(slices);

  saveData(data);                                                 // remember everything
}

// ---------- Draw / update the pie ----------
function updateChart(slices) {
  const empty = slices.length === 0;
  $("chartBox").hidden = empty;                                   // hide the canvas when there's nothing to show
  $("chartEmpty").hidden = !empty;
  if (empty) return;

  if (typeof Chart === "undefined") {                             // CDN blocked / offline
    $("chartBox").hidden = true;
    $("chartEmpty").hidden = false;
    $("chartEmpty").textContent = "The chart couldn't load. Check your internet connection and refresh.";
    return;
  }

  if (!chart) {                                                   // first time: create the pie
    chart = new Chart($("pie"), {
      type: "pie",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: "#fff", borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,                               // fills the 340px-high box
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + formatMoney(ctx.parsed) } }
        }
      }
    });
  }
  chart.data.labels = slices.map((s) => s.label);                 // slice names
  chart.data.datasets[0].data = slices.map((s) => s.value);       // slice sizes
  chart.data.datasets[0].backgroundColor = slices.map((s) => s.color); // slice colours
  chart.update();                                                 // redraw
}

// ---------- Arrow buttons: slide one box left/right ----------
function slide(direction) {
  const box = $("carousel");
  const first = box.querySelector(".bv-card");
  const step = first ? first.offsetWidth + 16 : 300;              // one card width + the gap
  box.scrollBy({ left: direction * step, behavior: "smooth" });
}
$("prevBtn").addEventListener("click", () => slide(-1));
$("nextBtn").addEventListener("click", () => slide(1));

// ---------- Start up: draw saved boxes, then the + card, then totals ----------
data.cards.forEach((card) => $("carousel").append(buildCard(card)));
$("carousel").append(buildAddCard());
refresh();
