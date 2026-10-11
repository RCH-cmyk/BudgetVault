// income.js - the income calculator page

const data = loadData();               // everything saved in this browser
const inc = data.income;               // just the income section

// ---- Fill the inputs with whatever was saved last time ----
$("hourly").value = inc.hourly || "";  // "" shows the placeholder instead of 0
$("hours").value = inc.hours || "";
$("yearly").value = inc.yearly || "";
$("taxPct").value = inc.taxPct || "";

// ---- Show the right inputs for the chosen mode ----
function setMode(mode) {
  inc.mode = mode;                                          // remember the choice
  $("modeHourly").classList.toggle("active", mode === "hourly");  // highlight the active button
  $("modeYearly").classList.toggle("active", mode === "yearly");
  $("hourlyGroup").hidden = mode !== "hourly";              // show/hide hourly inputs
  $("yearlyGroup").hidden = mode !== "yearly";              // show/hide yearly input
  recalc();                                                 // update the numbers
}

// ---- The maths ----
function recalc() {
  // Read each box and make sure it is a number that is 0 or more
  inc.hourly = toNum($("hourly").value);
  inc.hours = toNum($("hours").value);
  inc.yearly = toNum($("yearly").value);
  inc.taxPct = Math.min(100, toNum($("taxPct").value));

  // Yearly pay: hourly mode = rate x hours x 52 weeks; yearly mode = what was typed in
  const yearlyGross = inc.mode === "hourly" ? inc.hourly * inc.hours * 52 : inc.yearly;

  const monthlyGross = yearlyGross / 12;                    // split the year into 12 months
  const weeklyGross = yearlyGross / 52;                     // split the year into 52 weeks
  inc.monthly = monthlyGross * (1 - inc.taxPct / 100);      // monthly take-home after tax %

  // Show the results (textContent is safe, no HTML parsing)
  $("outYearly").textContent = formatMoney(yearlyGross);
  $("outMonthly").textContent = formatMoney(monthlyGross);
  $("outWeekly").textContent = formatMoney(weeklyGross);
  $("outTakeHome").textContent = formatMoney(inc.monthly);

  saveData(data);                                           // remember it for next time
  $("savedMsg").textContent = "Saved on this device \u2713";
}

// ---- Wire up the buttons and boxes ----
$("modeHourly").addEventListener("click", () => setMode("hourly"));
$("modeYearly").addEventListener("click", () => setMode("yearly"));
["hourly", "hours", "yearly", "taxPct"].forEach((id) => {
  $(id).addEventListener("input", recalc);                  // recalc on every keystroke
});

// ---- Start up with the saved mode ----
setMode(inc.mode);
