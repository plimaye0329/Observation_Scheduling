/* ---------------------------------------------------
   Observing Schedules — app.js
   Reads observations.json, renders the clock, the
   month calendar, the "up next" card, and the full log.
--------------------------------------------------- */

const TELESCOPE_COLORS = [
  "var(--telescope-0)",
  "var(--telescope-1)",
  "var(--telescope-2)",
  "var(--telescope-3)",
  "var(--telescope-4)",
  "var(--telescope-5)",
];

const state = {
  observations: [],
  telescopeColor: new Map(),
  activeTelescopes: new Set(), // empty set = show all
  viewYear: null,
  viewMonth: null, // 0-indexed
  selectedDay: null, // "YYYY-MM-DD" or null
  showPast: false,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheEls();
  const now = new Date();
  state.viewYear = now.getUTCFullYear();
  state.viewMonth = now.getUTCMonth();

  startClock();
  bindStaticEvents();

  try {
    const res = await fetch("observations.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load observations.json");
    const data = await res.json();
    state.observations = data
      .map((o) => ({ ...o, startDate: new Date(o.start), endDate: o.end ? new Date(o.end) : null }))
      .sort((a, b) => a.startDate - b.startDate);
  } catch (err) {
    console.error(err);
    els.agendaBody.innerHTML = `<div class="empty-state">Couldn't load observations.json. If you're opening this file directly from disk, run a local server (e.g. <code>python3 -m http.server</code>) since browsers block fetch() on file:// URLs.</div>`;
  }

  assignTelescopeColors();
  renderFilters();
  renderAll();
  setInterval(renderNextCard, 1000);
}

function cacheEls() {
  els.clockTime = document.getElementById("clockTime");
  els.clockDate = document.getElementById("clockDate");
  els.filterList = document.getElementById("filterList");
  els.nextCard = document.getElementById("nextCard");
  els.calGrid = document.getElementById("calGrid");
  els.monthLabel = document.getElementById("monthLabel");
  els.prevMonth = document.getElementById("prevMonth");
  els.nextMonth = document.getElementById("nextMonth");
  els.agendaBody = document.getElementById("agendaBody");
  els.agendaTitle = document.getElementById("agendaTitle");
  els.clearFilterBtn = document.getElementById("clearDayFilter");
  els.showPastToggle = document.getElementById("showPastToggle");
  els.openAddBtn = document.getElementById("openAddBtn");
  els.modalBackdrop = document.getElementById("modalBackdrop");
  els.closeModalBtn = document.getElementById("closeModalBtn");
  els.addForm = document.getElementById("addForm");
  els.jsonOutput = document.getElementById("jsonOutput");
  els.jsonPre = document.getElementById("jsonPre");
  els.copyJsonBtn = document.getElementById("copyJsonBtn");
}

function bindStaticEvents() {
  els.prevMonth.addEventListener("click", () => shiftMonth(-1));
  els.nextMonth.addEventListener("click", () => shiftMonth(1));
  els.clearFilterBtn.addEventListener("click", () => {
    state.selectedDay = null;
    renderAgenda();
    renderCalendar();
  });
  els.showPastToggle.addEventListener("change", (e) => {
    state.showPast = e.target.checked;
    renderAgenda();
  });
  els.openAddBtn.addEventListener("click", () => {
    els.modalBackdrop.classList.remove("hidden");
    els.jsonOutput.classList.remove("visible");
  });
  els.closeModalBtn.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === els.modalBackdrop) closeModal();
  });
  els.addForm.addEventListener("submit", handleAddSubmit);
  els.copyJsonBtn.addEventListener("click", copyJson);
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  els.addForm.reset();
  els.jsonOutput.classList.remove("visible");
}

/* ---------------- Clock ---------------- */

function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  els.clockTime.textContent = `${hh}:${mm}:${ss} UTC`;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  els.clockDate.textContent = `${dayNames[now.getUTCDay()]} ${now.getUTCDate()} ${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

/* ---------------- Telescope colors & filters ---------------- */

function assignTelescopeColors() {
  const names = [...new Set(state.observations.map((o) => o.telescope))].sort();
  names.forEach((name, i) => {
    state.telescopeColor.set(name, TELESCOPE_COLORS[i % TELESCOPE_COLORS.length]);
  });
}

function renderFilters() {
  const names = [...state.telescopeColor.keys()];
  els.filterList.innerHTML = "";

  const allItem = document.createElement("li");
  allItem.className = "filter-item" + (state.activeTelescopes.size === 0 ? " active" : "");
  allItem.innerHTML = `<span class="dot" style="background:var(--text-dimmer)"></span> All telescopes`;
  allItem.addEventListener("click", () => {
    state.activeTelescopes.clear();
    renderFilters();
    renderAll();
  });
  els.filterList.appendChild(allItem);

  names.forEach((name) => {
    const li = document.createElement("li");
    const isActive = state.activeTelescopes.has(name);
    li.className = "filter-item" + (isActive ? " active" : "");
    li.innerHTML = `<span class="dot" style="background:${state.telescopeColor.get(name)}"></span> ${escapeHtml(name)}`;
    li.addEventListener("click", () => {
      if (state.activeTelescopes.has(name)) {
        state.activeTelescopes.delete(name);
      } else {
        state.activeTelescopes.add(name);
      }
      renderFilters();
      renderAll();
    });
    els.filterList.appendChild(li);
  });
}

function visibleObservations() {
  if (state.activeTelescopes.size === 0) return state.observations;
  return state.observations.filter((o) => state.activeTelescopes.has(o.telescope));
}

/* ---------------- Render orchestration ---------------- */

function renderAll() {
  renderNextCard();
  renderCalendar();
  renderAgenda();
}

/* ---------------- Up next card ---------------- */

function renderNextCard() {
  const now = new Date();
  const obs = visibleObservations();
  const live = obs.find((o) => o.startDate <= now && o.endDate && o.endDate >= now);
  const upcoming = obs.filter((o) => o.startDate > now).sort((a, b) => a.startDate - b.startDate)[0];

  const target = live || upcoming;
  if (!target) {
    els.nextCard.innerHTML = `<div class="empty">Nothing scheduled. Add an observation to see it here.</div>`;
    return;
  }

  if (live) {
    const remaining = formatDuration(live.endDate - now);
    els.nextCard.innerHTML = `
      <span class="badge live"><span class="pulse"></span>observing now</span>
      <p class="project">${escapeHtml(live.project)}</p>
      <p class="telescope">${escapeHtml(live.telescope)}</p>
      <div class="countdown">${remaining} left</div>
    `;
  } else {
    const remaining = formatDuration(upcoming.startDate - now);
    els.nextCard.innerHTML = `
      <span class="badge">up next</span>
      <p class="project">${escapeHtml(upcoming.project)}</p>
      <p class="telescope">${escapeHtml(upcoming.telescope)}</p>
      <div class="countdown">${remaining}</div>
    `;
  }
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, "0")}h`);
  parts.push(`${String(minutes).padStart(2, "0")}m`);
  parts.push(`${String(seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

/* ---------------- Calendar ---------------- */

function shiftMonth(delta) {
  state.viewMonth += delta;
  if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear -= 1; }
  if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear += 1; }
  renderCalendar();
}

function dateKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function renderCalendar() {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  els.monthLabel.textContent = `${monthNames[state.viewMonth]} ${state.viewYear}`;

  const obs = visibleObservations();
  const byDay = new Map();
  obs.forEach((o) => {
    const key = dateKey(o.startDate);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(o);
  });

  const firstOfMonth = new Date(Date.UTC(state.viewYear, state.viewMonth, 1));
  // Monday-first grid: getUTCDay() 0=Sun..6=Sat -> convert so Monday=0
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(state.viewYear, state.viewMonth, 1 - startOffset));

  const todayKey = dateKey(new Date());

  els.calGrid.innerHTML = "";
  ["Mo","Tu","We","Th","Fr","Sa","Su"].forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = d;
    els.calGrid.appendChild(el);
  });

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setUTCDate(gridStart.getUTCDate() + i);
    const key = dateKey(cellDate);
    const inMonth = cellDate.getUTCMonth() === state.viewMonth;
    const dayObs = byDay.get(key) || [];

    const cell = document.createElement("div");
    cell.className = "cal-cell " + (inMonth ? "in-month" : "out-month");
    if (key === todayKey) cell.classList.add("today");
    if (dayObs.length) cell.classList.add("has-events");
    if (key === state.selectedDay) cell.classList.add("selected");

    const dotsHtml = dayObs.slice(0, 4).map((o) =>
      `<span class="dot" style="background:${state.telescopeColor.get(o.telescope)}"></span>`
    ).join("");
    const moreHtml = dayObs.length > 4 ? `<span class="cal-more">+${dayObs.length - 4}</span>` : "";

    cell.innerHTML = `<span class="daynum">${cellDate.getUTCDate()}</span><span class="cal-dots">${dotsHtml}${moreHtml}</span>`;

    if (dayObs.length) {
      cell.addEventListener("click", () => {
        state.selectedDay = state.selectedDay === key ? null : key;
        renderCalendar();
        renderAgenda();
      });
    }

    els.calGrid.appendChild(cell);
  }
}

/* ---------------- Agenda / log table ---------------- */

function renderAgenda() {
  const now = new Date();
  let obs = visibleObservations();

  if (state.selectedDay) {
    obs = obs.filter((o) => dateKey(o.startDate) === state.selectedDay);
    els.agendaTitle.textContent = `Observations on ${state.selectedDay}`;
    els.clearFilterBtn.style.display = "inline";
  } else {
    if (!state.showPast) obs = obs.filter((o) => !o.endDate || o.endDate >= now);
    els.agendaTitle.textContent = state.showPast ? "Full log" : "Upcoming & in progress";
    els.clearFilterBtn.style.display = "none";
  }

  obs = [...obs].sort((a, b) => a.startDate - b.startDate);

  if (!obs.length) {
    els.agendaBody.innerHTML = `<div class="empty-state">No observations to show.</div>`;
    return;
  }

  const rows = obs.map((o) => {
    const isLive = o.startDate <= now && o.endDate && o.endDate >= now;
    return `
      <tr>
        <td class="time-cell">${formatRange(o.startDate, o.endDate)}</td>
        <td class="telescope-cell"><span class="dot" style="background:${state.telescopeColor.get(o.telescope)}"></span>${escapeHtml(o.telescope)}</td>
        <td class="project-cell">
          <strong>${escapeHtml(o.project)}${isLive ? '<span class="live-tag">live</span>' : ""}</strong>
          ${o.notes ? `<span class="notes">${escapeHtml(o.notes)}</span>` : ""}
        </td>
      </tr>`;
  }).join("");

  els.agendaBody.innerHTML = `
    <table class="log-table">
      <thead>
        <tr><th>Time (UTC)</th><th>Telescope</th><th>Project</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatRange(start, end) {
  const pad = (n) => String(n).padStart(2, "0");
  const dstr = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`;
  const stime = `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`;
  if (!end) return `${dstr} ${stime}`;
  const sameDay = dateKey(start) === dateKey(end);
  const etime = `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
  return sameDay
    ? `${dstr} ${stime}–${etime}`
    : `${dstr} ${stime} → ${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())} ${etime}`;
}

/* ---------------- Add observation form ---------------- */

function handleAddSubmit(e) {
  e.preventDefault();
  const formData = new FormData(els.addForm);
  const telescope = formData.get("telescope").trim();
  const project = formData.get("project").trim();
  const startLocal = formData.get("start");
  const endLocal = formData.get("end");
  const notes = formData.get("notes").trim();

  if (!telescope || !project || !startLocal) return;

  const startIso = new Date(startLocal).toISOString();
  const endIso = endLocal ? new Date(endLocal).toISOString() : "";

  const id = `${startIso.slice(0, 10)}-${slugify(telescope)}-${slugify(project).slice(0, 20)}`;

  const entry = { id, telescope, project, start: startIso, end: endIso, notes };

  const json = JSON.stringify(entry, null, 2);
  els.jsonPre.textContent = json + ",";
  els.jsonOutput.classList.add("visible");

  // Show it live on the page immediately too (in-memory only, until committed)
  state.observations.push({ ...entry, startDate: new Date(startIso), endDate: endIso ? new Date(endIso) : null });
  state.observations.sort((a, b) => a.startDate - b.startDate);
  assignTelescopeColors();
  renderFilters();
  renderAll();
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function copyJson() {
  navigator.clipboard.writeText(els.jsonPre.textContent).then(() => {
    els.copyJsonBtn.textContent = "Copied";
    setTimeout(() => (els.copyJsonBtn.textContent = "Copy JSON"), 1500);
  });
}

/* ---------------- Utils ---------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
