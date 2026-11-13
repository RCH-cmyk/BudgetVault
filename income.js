// income.js - income calculator: type your take-home pay (after tax) per week OR per month

const data = loadData();               // everything saved in this browser
const inc = data.income;               // just the income section: { mode, amount, monthly }

// Your rule: weekly x 4 = monthly, then monthly x 12 = yearly
// Change the 4 to 52 / 12 if you want the exact average (about 4.33 weeks in a month)
const WEEKS_PER_MONTH = 4;
const MONTHS_PER_YEAR = 12;

// ---- Fill the box with whatever was saved last time ----
$("amount").value = inc.amount || "";  // "" shows the placeholder instead of 0

// ---- Update the screen for the chosen mode (weekly or monthly) ----
function showMode(mode) {
  inc.mode = mode;                                                 // remember the choice
  $("modeWeekly").classList.toggle("active", mode === "weekly");   // highlight the active button
  $("modeMonthly").classList.toggle("active", mode === "monthly");

  if (mode === "weekly") {
    $("amountLabel").textContent = "Take-home pay per week, after tax (\u00A3)";
    $("amount").placeholder = "e.g. 450";
    $("howItWorks").textContent = "Weekly \u00D7 " + WEEKS_PER_MONTH + " = monthly, then monthly \u00D7 " + MONTHS_PER_YEAR + " = yearly.";
  } else {
    $("amountLabel").textContent = "Take-home pay per month, after tax (\u00A3)";
    $("amount").placeholder = "e.g. 1800";
    $("howItWorks").textContent = "Monthly \u00F7 " + WEEKS_PER_MONTH + " = weekly, and monthly \u00D7 " + MONTHS_PER_YEAR + " = yearly.";
  }
  recalc();                                                        // update the numbers
}

// ---- Called when a toggle button is clicked: keep the same money, just in the other unit ----
function switchMode(mode) {
  if (mode === inc.mode) return;                                   // already in this mode
  const current = toNum($("amount").value);                        // what is typed right now
  const converted = mode === "monthly" ? current * WEEKS_PER_MONTH : current / WEEKS_PER_MONTH;
  $("amount").value = converted ? Math.round(converted * 100) / 100 : ""; // round to pence, blank if 0
  showMode(mode);
}

// ---- The maths ----
function recalc() {
  inc.amount = toNum($("amount").value);                           // negatives, text and Infinity become 0

  // Work out monthly and weekly from whichever one was typed in
  const monthly = inc.mode === "weekly" ? inc.amount * WEEKS_PER_MONTH : inc.amount;
  const weekly = inc.mode === "weekly" ? inc.amount : inc.amount / WEEKS_PER_MONTH;
  const yearly = monthly * MONTHS_PER_YEAR;                        // monthly x 12 = yearly

  inc.monthly = monthly;                                           // the budget + home pages read this one

  // Show the results (textContent is safe, no HTML parsing)
  $("outWeekly").textContent = formatMoney(weekly);
  $("outMonthly").textContent = formatMoney(monthly);
  $("outYearly").textContent = formatMoney(yearly);

  saveData(data);                                                  // remember it for next time
  $("savedMsg").textContent = "Saved on this device \u2713";
}

// ---- Wire up the buttons and the box ----
$("modeWeekly").addEventListener("click", () => switchMode("weekly"));
$("modeMonthly").addEventListener("click", () => switchMode("monthly"));
$("amount").addEventListener("input", recalc);                     // recalc on every keystroke

// ---- Start up with the saved mode ----
showMode(inc.mode);