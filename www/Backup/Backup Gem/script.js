let state = {
    view: 'main', scale: 'daily', viewingNextWeek: false,
    theme: localStorage.getItem('vasesTheme') || 'dark',
    lastDailyReset: localStorage.getItem('lastDailyReset') || "",
    activities: JSON.parse(localStorage.getItem('vasesData')) || [
        { id: 1, name: "Focus", dTarget: 120, wTarget: 840, dCurr: 0, wCurr: 0, type: 'bonus', carry: 0, streak: 0 },
        { id: 2, name: "Écran", dTarget: 60, wTarget: 420, dCurr: 0, wCurr: 0, type: 'malus', carry: 0, streak: 0 }
    ],
    planning: JSON.parse(localStorage.getItem('vasesPlanning')) || {},
    notifTimes: JSON.parse(localStorage.getItem('vasesNotifTimes')) || [],
    globalStreak: parseInt(localStorage.getItem('globalStreak')) || 0,
    malusStreak: parseInt(localStorage.getItem('malusStreak')) || 0
};

window.onload = () => {
    document.body.setAttribute('data-theme', state.theme);
    document.getElementById('themeSwitch').checked = (state.theme === 'light');
    checkAndReset(); updateDates(); render();
};

function render() {
    localStorage.setItem('vasesData', JSON.stringify(state.activities));
    const grid = document.getElementById('vasesGrid');
    if (!grid) return; grid.innerHTML = '';
    const sorted = [...state.activities].sort((a, b) => b.dTarget - a.dTarget);

    sorted.forEach(act => {
        const target = state.scale === 'daily' ? act.dTarget : act.wTarget;
        const current = state.scale === 'daily' ? act.dCurr : act.wCurr;
        const pct = target > 0 ? (current / target) * 100 : 0;
        const vHeight = 85 + Math.min((act.dTarget / 420) * 100, 110);
        const isMalus = act.type === 'malus';

        let colorClass = ''; let cardClass = '';
        if (pct > 100) {
            colorClass = isMalus ? 'p-over-lava' : 'p-over-rainbow';
            cardClass = isMalus ? 'malus-overflowing' : 'overflowing';
        } else {
            let level = 0;
            if (pct >= 100) level = 100; else if (pct >= 75) level = 75; else if (pct >= 50) level = 50; else if (pct >= 25) level = 25;
            colorClass = isMalus ? {0:'p-100', 25:'p-75', 50:'p-50', 75:'p-25', 100:'p-0'}[level] : `p-${level}`;
        }

        grid.innerHTML += `
            <div class="vase-card ${cardClass}" onclick="openModal(${act.id})">
                <strong>${act.name}</strong>
                <div class="fx-layer"></div>
                <div class="vase-container" style="height: ${vHeight}px; width: ${vHeight*0.65}px">
                    <div class="liquid ${colorClass}" style="height: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="drip left"></div><div class="drip right"></div>
                <small>${formatTime(current)} / ${formatTime(target)}</small>
            </div>`;
    });
    document.getElementById('streakCount').innerText = state.globalStreak;
    if (state.view === 'calendar') renderCalendar();
    if (state.view === 'settings') renderSettings();
}

function saveTime() {
    const tV = parseFloat(document.getElementById('timeValueInput').value) || 0;
    const gV = parseFloat(document.getElementById('targetValueInput').value) || 0;
    const unit = document.getElementById('timeUnitInput').value;
    const act = state.activities.find(a => a.id === activeVaseId);
    const mins = unit === 'h' ? Math.round(tV * 60) : Math.round(tV);
    const tMins = unit === 'h' ? Math.round(gV * 60) : Math.round(gV);

    if (state.scale === 'daily') {
        act.dCurr = Math.max(0, act.dCurr + mins); act.wCurr = Math.max(0, act.wCurr + mins);
        act.dTarget = Math.max(1, act.dTarget + tMins); act.wTarget = Math.max(1, act.wTarget + tMins);
        if (act.dCurr > act.dTarget && act.type === 'bonus') {
            act.carry = act.dCurr - act.dTarget;
            document.getElementById('overflowMsg').innerHTML = `L'objectif <b>${act.name}</b> a explosé !<br>Le surplus de <b>${formatTime(act.carry)}</b> est déjà prêt pour demain. 🌈`;
            document.getElementById('overflowModal').style.display = 'flex';
        }
    } else {
        act.wCurr = Math.max(0, act.wCurr + mins); act.wTarget = Math.max(1, act.wTarget + tMins);
    }
    render(); closeModal();
}

// LOGIQUE SYSTEME (Inchangée pour garantir la stabilité)
function getMonday(d) { d = new Date(d); const day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1); return new Date(d.setDate(diff)); }
function getWeekID(date) { const mon = getMonday(date); return `${mon.getFullYear()}-W${Math.ceil((((mon - new Date(mon.getFullYear(),0,1)) / 86400000) + 1) / 7).toString().padStart(2,'0')}`; }
function updateDates() { const now = new Date(); document.getElementById('currentDate').innerText = now.toLocaleDateString('fr-FR', {day:'numeric', month:'long'}); const mon = getMonday(now); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); document.getElementById('currentWeekRange').innerText = `${mon.getDate()} ${mon.toLocaleDateString('fr-FR', {month:'short'})} au ${sun.getDate()} ${sun.toLocaleDateString('fr-FR', {month:'short'})}`; }
function checkAndReset() { const now = new Date(); const today = now.toISOString().split('T')[0]; const weekID = getWeekID(now); if (state.lastDailyReset !== "" && state.lastDailyReset !== today) { const bonusVases = state.activities.filter(a => a.type === 'bonus'); const malusVases = state.activities.filter(a => a.type === 'malus'); if (bonusVases.length > 0 && bonusVases.every(a => (a.dCurr / a.dTarget) >= 1.0)) state.globalStreak++; else state.globalStreak = 0; if (malusVases.length > 0 && malusVases.every(a => (a.dCurr / a.dTarget) < 1.0)) state.malusStreak++; else state.malusStreak = 0; state.activities.forEach(act => { const r = act.dTarget > 0 ? act.dCurr / act.dTarget : 0; if (act.type === 'bonus') act.streak = (r >= 1.0) ? (act.streak || 0) + 1 : 0; else act.streak = (r < 1.0) ? (act.streak || 0) + 1 : 0; act.dCurr = act.carry || 0; act.carry = 0; const tIdx = (now.getDay() + 6) % 7; const planned = (state.planning[weekID] && state.planning[weekID][tIdx] && state.planning[weekID][tIdx][act.id]); if (planned) act.dTarget = planned; }); localStorage.setItem('lastDailyReset', today); } if (state.lastDailyReset === "") state.lastDailyReset = today; render(); }
function switchView(v) { state.view = v; document.querySelectorAll('.view').forEach(e => e.style.display = 'none'); document.getElementById('view-'+v).style.display = 'block'; document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active')); if(v === 'main') document.getElementById('navMain').classList.add('active'); if(v === 'calendar') document.getElementById('navCalendar').classList.add('active'); if(v === 'settings') document.getElementById('navSettings').classList.add('active'); render(); }
function setScale(s) { state.scale = s; document.getElementById('scaleDaily').classList.toggle('active', s === 'daily'); document.getElementById('scaleWeekly').classList.toggle('active', s === 'weekly'); render(); }
function formatTime(min) { if(min < 60) return min+"m"; return Math.floor(min/60)+"h"+(min%60||""); }
function openModal(id) { activeVaseId = id; document.getElementById('modalVaseName').innerText = state.activities.find(a => a.id === id).name; document.getElementById('timeModal').style.display = 'flex'; setTimeout(() => document.getElementById('timeValueInput').focus(), 150); }
function closeModal() { document.getElementById('timeModal').style.display = 'none'; document.getElementById('timeValueInput').value = ""; document.getElementById('targetValueInput').value = ""; }
function closeOverflowModal() { document.getElementById('overflowModal').style.display = 'none'; }
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.body.setAttribute('data-theme', state.theme); localStorage.setItem('vasesTheme', state.theme); }
function setCalendarWeek(n) { state.viewingNextWeek = n; document.getElementById('btnThisWeek').classList.toggle('active', !n); document.getElementById('btnNextWeek').classList.toggle('active', n); renderCalendar(); }
function openStreakDashboard() { const list = document.getElementById('streakList'); let html = `<div class="streak-item"><b>Global</b> <span>${state.globalStreak} 🔥</span></div><div class="streak-item"><b>Résistance Malus</b> <span>${state.malusStreak} 💀</span></div>`; state.activities.forEach(a => html += `<div class="streak-item"><b>${a.name}</b> <span>${a.streak || 0} 🔥</span></div>`); list.innerHTML = html; document.getElementById('streakModal').style.display = 'flex'; }
function closeStreakDashboard() { document.getElementById('streakModal').style.display = 'none'; }
function renderCalendar() { const calGrid = document.getElementById('calendarGrid'); const unit = document.getElementById('calendarUnit').value; let baseDate = new Date(); if (state.viewingNextWeek) baseDate.setDate(baseDate.getDate() + 7); const mon = getMonday(baseDate); const weekID = getWeekID(mon); calGrid.innerHTML = Array.from({length: 7}).map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return `<div class="cal-day-row"><div class="cal-day-name">${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}</div><div class="cal-inputs-row">${state.activities.map(act => { let val = (state.planning[weekID] && state.planning[weekID][i] && state.planning[weekID][i][act.id]) || 0; if (unit === 'h') val = (val / 60).toFixed(1); return `<div><label>${act.name}</label><input type="number" step="0.1" value="${val || ''}" onchange="updatePlanning('${weekID}', ${i}, ${act.id}, this.value, '${unit}')"></div>`; }).join('')}</div></div>`; }).join(''); }
function updatePlanning(w, d, a, v, u) { if(!state.planning[w]) state.planning[w] = {}; if(!state.planning[w][d]) state.planning[w][d] = {}; state.planning[w][d][a] = u === 'h' ? Math.round(parseFloat(v)*60) : parseInt(v) || 0; localStorage.setItem('vasesPlanning', JSON.stringify(state.planning)); }
function saveCalendarBatch() { const now = new Date(); const mon = state.viewingNextWeek ? new Date(getMonday(now).getTime() + 7*86400000) : getMonday(now); const weekID = getWeekID(mon); const todayIdx = (now.getDay() + 6) % 7; state.activities.forEach(act => { let weeklySum = 0; for (let i=0; i<7; i++) { const val = (state.planning[weekID] && state.planning[weekID][i] && state.planning[weekID][i][act.id]) || 0; weeklySum += val; if (!state.viewingNextWeek && i === todayIdx) act.dTarget = val || act.dTarget; } if (!state.viewingNextWeek && weeklySum > 0) act.wTarget = weeklySum; }); alert("Planning enregistré !"); switchView('main'); }
function renderSettings() { document.getElementById('editList').innerHTML = state.activities.map(act => `<div class="glass-card"><input type="text" value="${act.name}" onchange="updateVase(${act.id}, 'name', this.value)" style="width:100%; background:none; border:none; color:var(--text); font-weight:bold; font-size:1.1rem; border-bottom:1px solid var(--border); margin-bottom:10px;"><select onchange="updateVase(${act.id}, 'type', this.value)" style="width:100%; padding:10px; border-radius:10px; margin-bottom:10px; background:var(--bg); color:var(--text); border:1px solid var(--border);"><option value="bonus" ${act.type==='bonus'?'selected':''}>Objectif (Bonus)</option><option value="malus" ${act.type==='malus'?'selected':''}>Limite (Malus)</option></select><div style="display:flex; justify-content:space-between; align-items:center;"><span>Base jour (min) : <input type="number" value="${act.dTarget}" style="width:50px; border:none; color:var(--accent); background:none;" onchange="updateVase(${act.id}, 'dTarget', this.value)"></span><button onclick="deleteVase(${act.id})" style="color:#ff3b30; background:none; border:none; font-weight:bold;">Supprimer</button></div></div>`).join(''); const n = document.getElementById('notifList'); if(n) n.innerHTML = state.notifTimes.map(t => `<div class="glass-card" style="display:flex; justify-content:space-between; padding:10px 15px; margin-bottom:10px; align-items:center;"><span>Rappel à <b>${t.h}h${t.m.toString().padStart(2,'0')}</b></span><button onclick="deleteNotif(${t.id})" style="background:none; border:none; color:#ff3b30; font-weight:bold;">✕</button></div>`).join(''); }
function updateVase(id, f, v) { const a = state.activities.find(x => x.id === id); a[f] = (f === 'name') ? v : (f === 'type' ? v : parseInt(v)); render(); }
function deleteNotif(id) { state.notifTimes = state.notifTimes.filter(n => n.id !== id); render(); }
function addNotifTime() { const h = prompt("Heure ?", "12"), m = prompt("Min ?", "00"); if(h) { state.notifTimes.push({id: Date.now(), h: parseInt(h), m: parseInt(m)}); render(); } }
function addNewVase() { state.activities.push({id: Date.now(), name: "Nouveau", dTarget: 60, wTarget: 420, dCurr: 0, wCurr: 0, type: 'bonus', carry: 0, streak: 0}); render(); }
function deleteVase(id) { if(confirm("Supprimer ?")) { state.activities = state.activities.filter(a => a.id !== id); render(); } }