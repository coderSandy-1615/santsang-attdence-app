// ==== Constants & State ====
let rosterData = [];
let attendanceData = {}; // Format: { "YYYY-MM-DD": { memberId: true/false } }
let saveQueue = Promise.resolve();

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return response.json();
}

function reportSaveError(error) {
  console.error('Unable to save dashboard data:', error);
  alert(`डेटाबेसमध्ये डेटा जतन करता आला नाही: ${error.message}`);
}

function persistData() {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await apiRequest('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: rosterData, attendance: attendanceData })
    });
    stampUpdate();
    return true;
  });
  saveQueue = saveQueue.catch(error => {
    reportSaveError(error);
    return false;
  });
  return saveQueue;
}

function getLocalYMD(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function normalizeToSunday(dateLike) {
  const d = typeof dateLike === 'string'
    ? new Date(dateLike + 'T00:00:00')
    : new Date(dateLike);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday;
}

function getWeekRange(dateStr) {
  const sundayDate = normalizeToSunday(dateStr);
  const start = new Date(sundayDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // Sunday to next Sunday
  return { start, end, key: getLocalYMD(start) };
}

let currentDate = getLocalYMD(normalizeToSunday(new Date())); // Default to current Sunday
let currentWeek = getWeekRange(currentDate);
let allData = []; // Combined roster + attendance for the current view

// ==== DOM refs ====
const tbody = document.querySelector('#resultTable tbody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const exportBtn = document.getElementById('exportBtn');
const todayDateEl = document.getElementById('todayDate');
const datePicker = document.getElementById('datePicker');
const lastUpdateEl = document.getElementById('lastUpdate');
const gaugeEl = document.getElementById('gauge');

// Member management DOM
const memberForm = document.getElementById('memberForm');
const membersTbody = document.querySelector('#membersTable tbody');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const memberIdInput = document.getElementById('memberId');
const memberNameInput = document.getElementById('memberName');
const memberCensusInput = document.getElementById('memberCensus');
const memberMobileInput = document.getElementById('memberMobile');
const memberCategoryInput = document.getElementById('memberCategory');

// ==== Date display (Marathi) ====
const marathiMonths = ["जानेवारी","फेब्रुवारी","मार्च","एप्रिल","मे","जून","जुलै","ऑगस्ट","सप्टेंबर","ऑक्टोबर","नोव्हेंबर","डिसेंबर"];
const marathiDays = ["रविवार","सोमवार","मंगळवार","बुधवार","गुरुवार","शुक्रवार","शनिवार"];
const marathiMonthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtShort(d) {
  return `${d.getDate()} ${marathiMonths[d.getMonth()]} ${d.getFullYear()}`;
}

// ==== Data Initialization ====
async function initData() {
  const remoteData = await apiRequest('/api/data');

  if (remoteData.roster !== null) {
    rosterData = remoteData.roster;
  } else {
    let idCounter = 1;
    const generateId = () => 'm_' + (idCounter++) + '_' + Date.now().toString(36);

    rosterData = [
      ...remoteData.initialRoster.map(member => ({
        id: generateId(),
        name: member.name,
        census: member.census,
        mobile: member.mobile || '',
        category: member.category
      }))
    ];
  }

  rosterData = rosterData.map(member => ({
    ...member,
    name: member.name.replaceAll('मुंढये', 'मुंडये')
  }));
  if (remoteData.attendance !== null) {
    attendanceData = remoteData.attendance;
  } else {
    attendanceData = {};
  }

  if (remoteData.roster === null || remoteData.attendance === null) {
    await apiRequest('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: rosterData, attendance: attendanceData })
    });
  }
  clearLegacyData();
}

function saveRoster() {
  persistData();
}

function saveAttendance() {
  persistData();
}

function prepareCurrentViewData() {
  const weekKey = currentWeek.key;
  if (!attendanceData[weekKey]) {
    attendanceData[weekKey] = {}; // Default absent
  }
  const currentAtt = attendanceData[weekKey];
  
  allData = rosterData.map((member, index) => ({
    ...member,
    sr: index + 1,
    present: !!currentAtt[member.id]
  }));
}

// ==== UI Updates ====
function renderToday() {
  datePicker.value = currentDate;
  updateWeekDisplay();
}

function updateWeekDisplay() {
  const weekRangeEl = document.getElementById('weekRange');
  if (weekRangeEl) {
    weekRangeEl.style.display = 'inline-block';
    weekRangeEl.textContent = `साप्ताहिक उपस्थिती: ${fmtShort(new Date(currentDate + 'T00:00:00'))}`;
  }
}

function stampUpdate() {
  const now = new Date();
  const hh = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  const dd = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  lastUpdateEl.textContent = `${dd}/${mo}/${now.getFullYear()} ${hh}:${mm} ${ampm}`;
}

function updateStats(data) {
  const total = data.length;
  const present = data.filter(i => i.present).length;
  const absent = total - present;
  const pct = total ? Math.round((present / total) * 100) : 0;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('presentCount').textContent = present;
  document.getElementById('todayAbsentCount').textContent = absent;
  document.getElementById('percentCount').textContent = pct + '%';

  document.getElementById('sideTotalCount').textContent = total;
  document.getElementById('sidePresentCount').textContent = present;
  document.getElementById('sideAbsentCount').textContent = absent;

  gaugeEl.style.setProperty('--pct', pct);
}

// ==== Attendance Table rendering ====
function renderTable(data) {
  tbody.innerHTML = '';
  data.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.sr}</td>
      <td><button class="toggle-btn ${item.present ? 'is-present' : 'is-absent'}" data-id="${item.id}">
        ${item.present ? '✓ उपस्थित' : '✗ अनुपस्थित'}
      </button></td>
      <td>${item.name}</td>
      <td>${item.census || '-'}</td>
      <td>${item.mobile || '-'}</td>
      <td><button class="action-btn btn-delete delete-member-btn" data-id="${item.id}" title="सदस्य काढा">🗑️ काढा</button></td>
    `;
    tbody.appendChild(row);
  });
}

function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const filter = statusFilter.value;

  let filtered = allData.filter(i => {
    const matchesTerm = !term ||
      i.name.toLowerCase().includes(term) ||
      (i.census || '').toLowerCase().includes(term) ||
      (i.mobile || '').toLowerCase().includes(term);
    const matchesStatus = filter === 'all' || (filter === 'present' ? i.present : !i.present);
    return matchesTerm && matchesStatus;
  });

  renderTable(filtered);
  updateStats(allData); 
}

// ==== Toggle attendance ====
tbody.addEventListener('click', (e) => {
  // Toggle attendance
  const btn = e.target.closest('.toggle-btn');
  if (btn) {
    const { id } = btn.dataset;
    const weekKey = currentWeek.key;
    if (!attendanceData[weekKey]) attendanceData[weekKey] = {};
    attendanceData[weekKey][id] = !attendanceData[weekKey][id];
    saveAttendance();
    prepareCurrentViewData();
    applyFilters();
    return;
  }

  // Delete member
  const delBtn = e.target.closest('.delete-member-btn');
  if (delBtn) {
    const { id } = delBtn.dataset;
    const member = rosterData.find(m => m.id === id);
    if (!member) return;
    if (confirm(`"${member.name}" ला काढून टाकायचे आहे का?\nही क्रिया पूर्ववत होणार नाही.`)) {
      rosterData = rosterData.filter(m => m.id !== id);
      // Remove from all attendance records too
      Object.values(attendanceData).forEach(week => delete week[id]);
      saveRoster();
      saveAttendance();
      renderMembersTable();
      prepareCurrentViewData();
      applyFilters();
    }
  }
});

// ==== Search / filter listeners ====
searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
datePicker.addEventListener('change', (e) => {
  if(e.target.value) {
    const sundayDate = normalizeToSunday(e.target.value);
    currentDate = getLocalYMD(sundayDate);
    datePicker.value = currentDate;
    currentWeek = getWeekRange(currentDate);
    updateWeekDisplay();
    prepareCurrentViewData();
    applyFilters();
  }
});

function changeWeek(offsetDays) {
  const parts = currentDate.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offsetDays);
  const sundayDate = normalizeToSunday(d);
  currentDate = getLocalYMD(sundayDate);
  datePicker.value = currentDate;
  currentWeek = getWeekRange(currentDate);
  updateWeekDisplay();
  prepareCurrentViewData();
  applyFilters();
}

document.getElementById('prevWeekBtn').addEventListener('click', () => changeWeek(-7));
document.getElementById('nextWeekBtn').addEventListener('click', () => changeWeek(7));

// ==== PDF Export ====
function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function exportPdf(title, fileName, columns, rows, landscape, summary) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF तयार करण्यासाठी पॉप-अप विंडोला परवानगी द्या.');
    return;
  }

  const report = `<main style="padding:24px; color:#222; font-family:'Noto Sans Devanagari', Arial, sans-serif;">
    <h1 style="margin:0 0 6px; color:#7b1e2b; font-size:24px;">नरदास नगर सेवाकेंद्र, भांडुप</h1>
    <h2 style="margin:0 0 18px; font-size:18px;">${escapeHtml(title)}</h2>
    ${summary ? `<div style="margin:0 0 14px; padding:8px 10px; border:1px solid #bbb; background:#fff8ef; font-size:13px; font-weight:600;">${escapeHtml(summary)}</div>` : ''}
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead><tr>${columns.map(column => `<th style="border:1px solid #bbb; padding:6px; background:#f1e3d3; text-align:center;">${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td style="border:1px solid #bbb; padding:5px; text-align:center;">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </main>`;
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(fileName)}</title><style>@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; } body { margin: 0; } @media print { tr { break-inside: avoid; } }</style></head><body>${report}</body></html>`);
  printWindow.document.close();
  let hasPrinted = false;
  const printReport = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener('load', () => setTimeout(printReport, 300), { once: true });
  setTimeout(() => {
    if (printWindow.document.readyState === 'complete') printReport();
  }, 500);
}

function buildSectionedRows(groups, columns, rowBuilder) {
  const rows = [];
  groups.forEach(group => {
    if (group.length) {
      rows.push([group[0].category, ...Array(columns.length - 1).fill('')]);
      group.forEach(item => rows.push(rowBuilder(item)));
    }
  });
  return rows;
}

exportBtn.addEventListener('click', () => {
  const columns = ['अ. क्र.', 'नाव', 'स्थिती'];
  const groups = [allData.filter(item => item.category === 'पुरुष'), allData.filter(item => item.category === 'महिला')];
  const rows = buildSectionedRows(groups, columns, item => [item.sr, item.name, item.present ? 'उपस्थित' : 'अनुपस्थित']);
  const malePresent = groups[0].filter(item => item.present).length;
  const femalePresent = groups[1].filter(item => item.present).length;
  exportPdf('रविवार उपस्थिती', `Attendance_${currentWeek.key}.pdf`, columns, rows, false, `उपस्थित पुरुष: ${malePresent}    |    उपस्थित महिला: ${femalePresent}`);
});

const exportMonthlyBtn = document.getElementById('exportMonthlyBtn');
if (exportMonthlyBtn) {
  exportMonthlyBtn.addEventListener('click', () => {
    const parts = currentDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const sundays = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      if (date.getDay() === 0) sundays.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    const columns = ['अ. क्र.', 'नाव', 'स्थिती'];
    const groups = [allData.filter(item => item.category === 'पुरुष'), allData.filter(item => item.category === 'महिला')];
    const monthlyPresentByCategory = groups.map(group => group.reduce((total, item) => total + sundays.reduce((count, sunday) => count + (((attendanceData[getLocalYMD(sunday)] || {})[item.id]) ? 1 : 0), 0), 0));
    const rows = buildSectionedRows(groups, columns, item => {
      let presentCount = 0;
      const statuses = sundays.map(sunday => {
        const present = !!(attendanceData[getLocalYMD(sunday)] || {})[item.id];
        if (present) presentCount++;
        return present ? 'उपस्थित' : 'अनुपस्थित';
      });
      return [item.sr, item.name, `${presentCount} उपस्थित / ${sundays.length - presentCount} अनुपस्थित`];
    });
    const monthLabel = `${marathiMonths[month]} ${year}`;
    exportPdf(`मासिक उपस्थिती: ${monthLabel}`, `Monthly_Attendance_${year}_${String(month + 1).padStart(2, '0')}.pdf`, columns, rows, true, `मासिक उपस्थित पुरुष: ${monthlyPresentByCategory[0]}    |    मासिक उपस्थित महिला: ${monthlyPresentByCategory[1]}`);
  });
}

// ==== Nav Tabs Logic ====
function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(tc => {
    tc.style.display = 'none';
    tc.classList.remove('active');
  });
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.style.display = '';
    targetTab.classList.add('active');
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ==== Member Management ====
function renderMembersTable() {
  membersTbody.innerHTML = '';
  rosterData.forEach(member => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${member.name}</td>
      <td>${member.census || '-'}</td>
      <td>${member.mobile || '-'}</td>
      <td>${member.category}</td>
      <td>
        <button class="action-btn btn-edit" data-id="${member.id}">संपादित</button>
        <button class="action-btn btn-delete" data-id="${member.id}">काढा</button>
      </td>
    `;
    membersTbody.appendChild(row);
  });
}

memberForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = memberIdInput.value;
  const name = memberNameInput.value.trim();
  const census = memberCensusInput.value.trim();
  const mobile = memberMobileInput.value.trim();
  const category = memberCategoryInput.value;

  if (id) {
    // Edit existing
    const member = rosterData.find(m => m.id === id);
    if (member) {
      member.name = name;
      member.census = census;
      member.mobile = mobile;
      member.category = category;
    }
  } else {
    // Add new
    rosterData.push({
      id: 'm_' + Date.now().toString(36),
      name,
      census,
      mobile,
      category
    });
  }
  
  saveRoster();
  memberForm.reset();
  memberIdInput.value = '';
  btnCancelEdit.style.display = 'none';
  
  renderMembersTable();
  prepareCurrentViewData();
  applyFilters();
});

btnCancelEdit.addEventListener('click', () => {
  memberForm.reset();
  memberIdInput.value = '';
  btnCancelEdit.style.display = 'none';
});

membersTbody.addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('btn-delete')) {
    if (confirm('हा सदस्य काढून टाकायचा आहे का?')) {
      rosterData = rosterData.filter(m => m.id !== id);
      saveRoster();
      renderMembersTable();
      prepareCurrentViewData();
      applyFilters();
    }
  } else if (e.target.classList.contains('btn-edit')) {
    const member = rosterData.find(m => m.id === id);
    if (member) {
      memberIdInput.value = member.id;
      memberNameInput.value = member.name;
      memberCensusInput.value = member.census;
      memberMobileInput.value = member.mobile;
      memberCategoryInput.value = member.category;
      btnCancelEdit.style.display = 'inline-block';
      memberForm.scrollIntoView({ behavior: 'smooth' });
    }
  }
});


// ==== Init ====
async function startDashboard() {
  try {
    await initData();
    prepareCurrentViewData();
    renderToday();
    applyFilters();
    renderMembersTable();
    stampUpdate();
    switchTab('sheet');
  } catch (error) {
    console.error('Unable to load dashboard data:', error);
    alert(`डेटाबेसशी जोडता आले नाही: ${error.message}`);
  }
}

startDashboard();

// ==== New Member Button ====
document.getElementById('addNewMemberBtn').addEventListener('click', () => {
  switchTab('members');

  // Reset form (clear any existing edit)
  memberForm.reset();
  memberIdInput.value = '';
  btnCancelEdit.style.display = 'none';

  // Scroll form into view with highlight flash
  memberForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  memberForm.style.transition = 'box-shadow 0.3s ease';
  memberForm.style.boxShadow = '0 0 0 3px #43a047';
  setTimeout(() => { memberForm.style.boxShadow = ''; }, 1500);

  // Focus first input
  setTimeout(() => { document.getElementById('memberName').focus(); }, 400);
});

// ==== Settings Tab ====

// Update member count when settings tab opens
document.querySelector('.nav-btn[data-tab="settings"]').addEventListener('click', () => {
  const el = document.getElementById('settingsTotalMembers');
  if (el) el.textContent = rosterData.length;
});

// --- Backup ---
document.getElementById('backupBtn').addEventListener('click', () => {
  const backup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    sevakendra: 'SK2042',
    roster: rosterData,
    attendance: attendanceData
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SK2042_Backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Restore ---
document.getElementById('restoreInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('बॅकअप पुनर्संचयित केल्यानंतर सध्याचा सर्व डेटा बदलणार आहे.\nपुढे जायचे आहे का?')) {
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const backup = JSON.parse(ev.target.result);
      if (!backup.roster || !backup.attendance) {
        alert('अवैध बॅकअप फाईल. SK2042 बॅकअप फाईल वापरा.');
        return;
      }
      rosterData = backup.roster;
      attendanceData = backup.attendance;
      prepareCurrentViewData();
      applyFilters();
      renderMembersTable();
      document.getElementById('settingsTotalMembers').textContent = rosterData.length;
      persistData().then(saved => {
        if (saved) {
          alert(`✅ बॅकअप यशस्वीरित्या पुनर्संचयित झाला!\n${rosterData.length} सदस्य लोड झाले.`);
        }
      });
    } catch {
      alert('❌ फाईल वाचताना त्रुटी. वैध JSON बॅकअप फाईल निवडा.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// --- Clear Attendance Only ---
document.getElementById('clearAttendanceBtn').addEventListener('click', () => {
  if (!confirm('सर्व साप्ताहिक उपस्थिती नोंदी हटवायच्या आहेत का?\nसदस्य यादी कायम राहील.')) return;
  attendanceData = {};
  prepareCurrentViewData();
  applyFilters();
  persistData().then(saved => {
    if (saved) alert('✅ सर्व उपस्थिती नोंदी यशस्वीरित्या हटवण्यात आल्या.');
  });
});

// --- Clear All Data ---
document.getElementById('clearAllBtn').addEventListener('click', () => {
  const confirm1 = confirm('⚠️ सर्व सदस्य आणि उपस्थिती डेटा कायमचा हटवले जाईल!\nही क्रिया पूर्ववत होणार नाही.\nआधी बॅकअप घेतला आहे का?');
  if (!confirm1) return;
  const confirm2 = confirm('🔴 शेवटची संधी! तुम्हाला खात्री आहे की सर्व डेटा हटवायचे आहे?');
  if (!confirm2) return;
  rosterData = [];
  attendanceData = {};
  prepareCurrentViewData();
  applyFilters();
  renderMembersTable();
  document.getElementById('settingsTotalMembers').textContent = 0;
  persistData().then(saved => {
    if (saved) alert('✅ संपूर्ण डेटा हटवला. पेज रीफ्रेश करा.');
  });
});
