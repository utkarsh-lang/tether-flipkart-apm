// Tether prototype: all data is illustrative.
const inr = n => "₹" + n.toLocaleString("en-IN");

const state = {
  screen: "connect",
  setupDone: false,
  charter: { food: 6000, groceries: 14000, subs: 1500, shopping: 8000, noRenew: true, healthy: true, note: "Prefer healthier groceries. Never pay extra for faster delivery on home supplies." },
  wheel: { health: true, family: true, finance: false, travel: false, limit: 5000 },
  reviewed: 15,
  reversed: 1,
  receiptId: null,
  filter: "all",
};

const spent = { food: 9200, groceries: 13100, subs: 1950, shopping: 5400 };

const receipts = [
  { id: "r1", title: "HEPA filter, 2-pack", cat: "Home supplies", amount: 1890, when: "Tue, 9:42 am", flag: "Paid placement", tone: "amber", status: "open",
    why: "Your agent picked this seller for one-day delivery. Your charter says not to pay extra for speed on home supplies.",
    options: [
      { n: "PureAir Direct", p: 1890, r: 4.2, note: "Chosen. Paid to rank first in agent results.", k: "chosen" },
      { n: "ClearBreath Store", p: 1470, r: 4.6, note: "Same filter, two-day delivery. Best match for your charter.", k: "best" },
      { n: "HomeKart", p: 1650, r: 4.4, note: "Same filter, two-day delivery." },
    ], saving: 420 },
  { id: "r2", title: "StreamMax Premium renewal", cat: "Subscriptions", amount: 649, when: "Wed, 12:01 am", flag: "Breaks your charter", tone: "red", status: "open",
    why: "Renewed automatically. Your charter says no auto-renewals without asking. You last watched 41 days ago.",
    options: [
      { n: "Renew Premium", p: 649, note: "Chosen by your agent.", k: "chosen" },
      { n: "Downgrade to Basic", p: 199, note: "Covers what you watched this year.", k: "best" },
      { n: "Cancel", p: 0, note: "No use in 41 days." },
    ], saving: 649 },
  { id: "r3", title: "Weekly groceries", cat: "Groceries", amount: 2340, when: "Sat, 8:10 am", flag: "Matches charter", tone: "ok", status: "ok",
    why: "Lowest basket price among 4 stores for your usual list. Two items swapped for lower-sugar versions, as your charter asks.",
    options: [
      { n: "BasketBay", p: 2340, r: 4.5, note: "Chosen. Cheapest full basket.", k: "chosen" },
      { n: "FreshCart Prime", p: 2610, r: 4.3, note: "Usual seller, ₹270 more this week." },
    ], saving: 0 },
  { id: "r4", title: "Electricity bill, October", cat: "Bills", amount: 3120, when: "Mon, 6:00 pm", flag: "Matches charter", tone: "ok", status: "ok",
    why: "Paid on the due date. Usage is 4% lower than September.", options: [{ n: "BESCOM", p: 3120, note: "Only provider.", k: "chosen" }], saving: 0 },
  { id: "r5", title: "Thyroid medicine refill", cat: "Health", amount: 860, when: "Thu, 7:30 pm", flag: "Asked you first", tone: "ok", status: "ok",
    why: "Health is a keep-the-wheel area, so your agent asked before ordering. You approved it.", options: [{ n: "MedPlus", p: 860, r: 4.7, note: "Same brand as your prescription.", k: "chosen" }], saving: 0 },
  { id: "r6", title: "Cab to airport", cat: "Travel", amount: 640, when: "Fri, 5:15 am", flag: "Matches charter", tone: "ok", status: "ok",
    why: "Cheapest ride that met your 5:45 am arrival time.", options: [{ n: "Namma Ride", p: 640, r: 4.4, note: "Chosen.", k: "chosen" }], saving: 0 },
];

const steps = [
  ["connect", "Connect your agent", "Tether can read, never act"],
  ["setup", "Write your charter", "Goals in your own words"],
  ["digest", "Read the weekly digest", "142 decisions, 3 need a look"],
  ["receipt:r1", "Open a decision receipt", "What your agent passed up"],
  ["alert", "Check a drift alert", "Patterns one receipt misses"],
  ["wheel", "Choose what needs your OK", "And switch agents anytime"],
];

const $screen = document.getElementById("screen");
const $tabs = document.getElementById("tabs");
const $toast = document.getElementById("toast");

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove("show"), 2400);
}

function go(target) {
  if (target.startsWith("receipt:")) { state.receiptId = target.split(":")[1]; target = "receipt"; }
  if (["digest", "receipts", "charter", "wheel", "alert", "receipt"].includes(target)) state.setupDone = true;
  state.screen = target;
  render();
  $screen.scrollTop = 0;
  $screen.focus({ preventScroll: true });
}

const openItems = () => receipts.filter(r => r.status === "open");

/* Screens */
const screens = {
  connect: () => `
    <h2>Keep your agent working for you</h2>
    <p class="muted">Tether reads what your agent does and checks it against what you want. It has no deals with any seller or agent maker.</p>
    <div class="panel">
      <h3 style="margin-top:0">Connect Aria, your agent</h3>
      <ul class="scope">
        <li class="yes">Read Aria's action log: purchases, bills, bookings, renewals</li>
        <li class="yes">Compare prices and ratings with the open market</li>
        <li class="no">Buy, cancel or message anyone for you</li>
        <li class="no">Share your data with sellers or advertisers</li>
      </ul>
    </div>
    <p class="small muted">You can disconnect anytime. Your data stays encrypted on your device.</p>
    <button class="btn" data-go="setup">Connect Aria</button>`,

  setup: () => `
    <h2>What do you want your agent to do?</h2>
    <p class="muted">Tether checks Aria against these goals, not against what Aria guesses about you.</p>
    <div class="panel">${charterFields()}</div>
    <button class="btn" data-act="save-setup">Save charter</button>`,

  digest: () => {
    const open = openItems();
    const matched = 142 - open.length - (state.alertDone ? 0 : 1);
    const flagged = 142 - matched;
    const regret = Math.round((state.reversed / state.reviewed) * 100);
    return `
    <h2>Your week with Aria</h2>
    <div class="tally">
      <div class="big num">${matched}<span>/142</span></div>
      <p>decisions matched your charter. ${flagged ? `${flagged} need a look, about ${inr(open.reduce((a, r) => a + r.saving, 0) + (state.alertDone ? 0 : 1180))} at stake.` : "Nothing needs a look this week."}</p>
      <div class="meter" aria-hidden="true"><i style="width:${(matched / 142) * 100}%"></i><i style="width:${(flagged / 142) * 100}%"></i></div>
    </div>
    <h3>Needs a look</h3>
    ${!state.alertDone ? `<button class="item amber" data-go="alert"><span class="dot"></span><span><span class="t">One seller wins almost every grocery order</span><span class="s">Drift alert · prices up 11% in 6 weeks</span></span><span class="amt num">${inr(1180)}</span></button>` : ""}
    ${open.map(itemRow).join("") || (state.alertDone ? `<div class="panel small muted">You're all caught up. Tether will flag anything new.</div>` : "")}
    <h3>Spending against your charter</h3>
    <div class="panel">${bars()}</div>
    <div class="panel small"><b>Regret rate: ${regret}%</b><br><span class="muted">You reversed ${state.reversed} of ${state.reviewed} decisions you reviewed this month. Lower means Aria is choosing as you would.</span></div>`;
  },

  receipts: () => {
    const list = state.filter === "flagged" ? receipts.filter(r => r.tone !== "ok") : receipts;
    return `
    <h2>Decision receipts</h2>
    <p class="muted">Every purchase, bill and renewal Aria made this week, with what it passed up.</p>
    <div class="row-btns" style="margin-bottom:12px">
      <button class="btn ${state.filter === "all" ? "" : "ghost"}" data-act="filter" data-v="all" style="margin:0">All (${receipts.length})</button>
      <button class="btn ${state.filter === "flagged" ? "" : "ghost"}" data-act="filter" data-v="flagged" style="margin:0">Flagged (${receipts.filter(r => r.tone !== "ok").length})</button>
    </div>
    ${list.map(itemRow).join("")}`;
  },

  receipt: () => {
    const r = receipts.find(x => x.id === state.receiptId);
    const tagCls = r.tone === "ok" ? "ok" : r.tone;
    return `
    <button class="back" data-go="${state.back || "digest"}">‹ Back</button>
    <div class="receipt">
      <div class="head"><div><b>${r.title}</b><div class="small muted">${r.cat} · ${r.when}</div></div><div style="text-align:right"><b class="num">${inr(r.amount)}</b></div></div>
      <div style="margin-top:10px"><span class="tag ${tagCls}">${r.flag}</span></div>
      <div class="rule"></div>
      <div class="small muted" style="margin-bottom:6px">Options Aria considered</div>
      ${r.options.map(o => `<div class="opt ${o.k || ""}"><span><span class="n">${o.n}</span><span class="why">${o.note}</span></span><span class="num" style="text-align:right">${inr(o.p)}${o.r ? `<br><span class="why">★ ${o.r}</span>` : ""}</span></div>`).join("")}
      <div class="rule"></div>
      <p class="small"><b>Why Aria chose it:</b> ${r.why}</p>
      ${r.saving ? `<p class="verdict">Passed up: <b class="num">${inr(r.saving)}</b> in savings.</p>` : ""}
    </div>
    ${r.status === "open" ? `
      <button class="btn danger" data-act="reverse" data-id="${r.id}">${r.id === "r2" ? "Downgrade to Basic" : "Return and reorder from ClearBreath"}</button>
      <button class="btn ghost" data-act="keep" data-id="${r.id}">Keep Aria's choice</button>
      <button class="btn ghost" data-act="rule" data-id="${r.id}">Add a rule to my charter</button>`
      : r.status === "reversed" ? `<div class="panel small">Reversed. Aria will be checked against this next time.</div>`
      : r.status === "kept" ? `<div class="panel small">Kept. Tether won't flag similar choices from this seller.</div>`
      : ""}`;
  },

  alert: () => `
    <button class="back" data-go="digest">‹ Back</button>
    <span class="tag amber">Drift alert</span>
    <h2>One seller wins almost every grocery order</h2>
    <p>FreshCart Prime got <b>9 of your last 10</b> grocery orders. Its prices rose <b>11%</b> in six weeks while two other stores stayed flat.</p>
    <div class="panel">
      <div class="small muted" style="margin-bottom:6px">Price of your usual basket, last 6 weeks</div>
      ${spark()}
      <div class="small" style="display:flex;gap:16px;margin-top:6px"><span style="color:var(--amber);font-weight:600">● FreshCart Prime</span><span style="color:var(--tether);font-weight:600">● Market median</span></div>
    </div>
    <div class="panel small"><b>What this cost you:</b> ${inr(1180)} more than the market median this month.<br><span class="muted">FreshCart Prime runs a partner program with Aria's maker. Confidence: high.</span></div>
    ${state.alertDone ? `<div class="panel small">Done. Tether will check the next 4 orders.</div>` : `
    <button class="btn" data-act="alert-compare">Ask Aria to compare 3 stores every order</button>
    <button class="btn ghost" data-act="alert-allow">Allow FreshCart Prime</button>`}`,

  charter: () => `
    <h2>Your charter</h2>
    <p class="muted">Your goals, in your words. Tether checks Aria against these every day and asks you to review them each quarter.</p>
    <div class="panel">${bars()}</div>
    <div class="panel">${charterFields()}</div>
    <button class="btn" data-act="save-charter">Save charter</button>`,

  wheel: () => `
    <h2>Keep the wheel</h2>
    <p class="muted">Aria must ask you before acting in these areas.</p>
    <div class="panel">
      ${toggle("health", "Health and medicines")}
      ${toggle("family", "Messages to family")}
      ${toggle("finance", "Loans, insurance and investments")}
      ${toggle("travel", "Travel bookings")}
    </div>
    <div class="panel">
      <label for="limit" style="display:flex;justify-content:space-between"><span>Ask before any spend above</span><b class="num" id="limitv">${inr(state.wheel.limit)}</b></label>
      <input id="limit" type="range" min="1000" max="20000" step="500" value="${state.wheel.limit}" data-act="limit">
    </div>
    <div class="panel">
      <h3 style="margin-top:0">Switch agents anytime</h3>
      <p class="small muted">Export everything Aria knows about you, so a new agent can start where Aria left off. No agent can lock you in.</p>
      <button class="btn ghost" data-act="export">Export my profile</button>
    </div>`,
};

function itemRow(r) {
  const tone = r.tone === "ok" ? "" : r.tone;
  const done = r.status === "reversed" || r.status === "kept";
  return `<button class="item ${tone} ${done ? "done" : ""}" data-go="receipt:${r.id}" data-back="${state.screen}"><span class="dot"></span><span><span class="t">${r.title}</span><span class="s">${r.flag}${done ? " · " + r.status : ""} · ${r.when}</span></span><span class="amt num">${inr(r.amount)}</span></button>`;
}

function bars() {
  const rows = [["food", "Food delivery"], ["groceries", "Groceries"], ["subs", "Subscriptions"], ["shopping", "Shopping"]];
  return rows.map(([k, l]) => {
    const lim = state.charter[k], s = spent[k], max = Math.max(lim, s) * 1.1;
    return `<div class="bar ${s > lim ? "over" : ""}"><div class="lbl"><span>${l}</span><span class="num">${inr(s)} <span class="muted">of ${inr(lim)}</span></span></div>
      <div class="track"><div class="fill" style="width:${(s / max) * 100}%"></div><div class="limit" style="left:${(lim / max) * 100}%"></div></div></div>`;
  }).join("") + `<p class="small muted" style="margin:0">Black line marks your monthly goal.</p>`;
}

function charterFields() {
  const c = state.charter;
  const num = (k, l) => `<div class="goal"><label for="c-${k}">${l} per month</label><input id="c-${k}" type="number" step="500" min="0" value="${c[k]}" data-k="${k}"></div>`;
  return num("food", "Food delivery") + num("groceries", "Groceries") + num("subs", "Subscriptions") + num("shopping", "Shopping") +
    `<div class="goal"><label for="c-noRenew">No auto-renewals without asking me</label><span class="switch"><input id="c-noRenew" type="checkbox" ${c.noRenew ? "checked" : ""} data-k="noRenew"><span></span></span></div>
     <div class="goal" style="display:block"><label for="c-note" style="display:block;margin-bottom:6px">Anything else, in your words</label><textarea id="c-note" data-k="note">${c.note}</textarea></div>`;
}

function toggle(k, l) {
  return `<div class="goal"><label for="w-${k}">${l}</label><span class="switch"><input id="w-${k}" type="checkbox" ${state.wheel[k] ? "checked" : ""} data-w="${k}"><span></span></span></div>`;
}

function spark() {
  const fc = [2380, 2420, 2470, 2530, 2590, 2640], mk = [2370, 2360, 2380, 2370, 2390, 2380];
  const W = 320, H = 110, lo = 2300, hi = 2700, x = i => 16 + i * ((W - 32) / 5), y = v => H - 12 - ((v - lo) / (hi - lo)) * (H - 24);
  const path = a => a.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="FreshCart Prime basket price rose from ₹2,380 to ₹2,640 while the market median stayed near ₹2,380">
    <path d="${path(mk)}" fill="none" stroke="var(--tether)" stroke-width="2.5"/>
    <path d="${path(fc)}" fill="none" stroke="var(--amber)" stroke-width="2.5"/>
    ${fc.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--amber)"/>`).join("")}
    <text x="${x(5) - 2}" y="${y(fc[5]) - 8}" text-anchor="end" font-size="11" fill="var(--amber)" font-weight="600">${inr(fc[5])}</text>
    <text x="${x(5) - 2}" y="${y(mk[5]) + 16}" text-anchor="end" font-size="11" fill="var(--tether)" font-weight="600">${inr(mk[5])}</text>
  </svg>`;
}

/* Render */
function render() {
  $screen.innerHTML = screens[state.screen]();
  const tabbed = state.setupDone && !["connect", "setup"].includes(state.screen);
  $tabs.hidden = !tabbed;
  const tabFor = { receipt: state.back === "receipts" ? "receipts" : "digest", alert: "digest" }[state.screen] || state.screen;
  $tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.go === tabFor));
  const cur = state.screen === "receipt" ? "receipt:" + state.receiptId : state.screen;
  document.querySelectorAll("#steps button").forEach(b => b.classList.toggle("on", b.dataset.go === cur));
}

function readCharter() {
  $screen.querySelectorAll("[data-k]").forEach(el => {
    const k = el.dataset.k;
    state.charter[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? Math.max(0, +el.value || 0) : el.value;
  });
}

document.getElementById("steps").innerHTML = steps.map(([g, t, s]) => `<li><button data-go="${g}"><b>${t}</b>${s}</button></li>`).join("");

document.addEventListener("click", e => {
  const el = e.target.closest("[data-go],[data-act]");
  if (!el) return;
  if (el.dataset.go) {
    if (el.dataset.back) state.back = el.dataset.back;
    if (el.closest("#steps") || el.closest("#tabs")) state.back = "digest";
    return go(el.dataset.go);
  }
  const act = el.dataset.act, r = receipts.find(x => x.id === el.dataset.id);
  switch (act) {
    case "save-setup": readCharter(); toast("Charter saved. Tether is now checking Aria."); return go("digest");
    case "save-charter": readCharter(); toast("Charter saved"); return render();
    case "filter": state.filter = el.dataset.v; return render();
    case "reverse": r.status = "reversed"; state.reviewed++; state.reversed++; toast(r.id === "r2" ? `Downgraded to Basic. ${inr(450)} saved each month.` : `Reorder placed with ClearBreath. ${inr(r.saving)} saved.`); return render();
    case "keep": r.status = "kept"; state.reviewed++; toast("Kept Aria's choice"); return render();
    case "rule":
      state.charter.note += r.id === "r2" ? " Cancel subscriptions I haven't used in 30 days." : " Choose the best-rated cheapest seller for home supplies.";
      toast("Rule added to your charter"); return;
    case "alert-compare": state.alertDone = true; toast("Aria will compare 3 stores on every grocery order"); return render();
    case "alert-allow": state.alertDone = true; toast("FreshCart Prime allowed. Tether will keep watching prices."); return render();
    case "export": toast("Profile exported: aria-profile-2040.json"); return;
  }
});

document.addEventListener("change", e => {
  if (e.target.dataset.w) { state.wheel[e.target.dataset.w] = e.target.checked; toast(e.target.checked ? "Aria will ask you first" : "Aria can act on its own here"); }
});
document.addEventListener("input", e => {
  if (e.target.dataset.act === "limit") { state.wheel.limit = +e.target.value; document.getElementById("limitv").textContent = inr(state.wheel.limit); }
});

render();
