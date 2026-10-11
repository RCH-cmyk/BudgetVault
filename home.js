// home.js - fills in the summary tiles on the Home page

const data = loadData();                                   // read what's saved in this browser

// Add up every box to get total monthly spending
const spent = data.cards.reduce((sum, card) => sum + cardTotal(card), 0);
const income = data.income.monthly;                        // monthly take-home from the Income page
const left = income - spent;                               // what's left (can be negative)

$("sumIncome").textContent = formatMoney(income);          // textContent = safe, no HTML parsing
$("sumSpent").textContent = formatMoney(spent);
$("sumLeft").textContent = formatMoney(left);

// Teal if you have money left, coral if you're overspending
$("sumLeft").className = "value " + (left < 0 ? "bad" : "good");

// "Clear all" button: ask first, then wipe our saved data and refresh the page
$("resetBtn").addEventListener("click", () => {
  if (confirm("Delete everything saved on this device? This can't be undone.")) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    location.reload();                                     // reload so the tiles reset to £0.00
  }
});
