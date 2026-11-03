// DOM ELEMENTS
const taskRowsContainer = document.getElementById('taskRowsContainer');
const btnAddRow = document.getElementById('btnAddRow');
const dailyReportForm = document.getElementById('dailyReportForm');
const reportDate = document.getElementById('reportDate');
const reportNotes = document.getElementById('reportNotes');
const btnSubmitReport = document.getElementById('btnSubmitReport');

// Navigation
const menuCreateReport = document.getElementById('menuCreateReport');
const menuHistoryReport = document.getElementById('menuHistoryReport');
const createReportView = document.getElementById('createReportView');
const historyReportView = document.getElementById('historyReportView');
const historyListContainer = document.getElementById('historyListContainer');
const btnExportAllCsv = document.getElementById('btnExportAllCsv');
const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');

// INITIALIZE
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  loadInitialRows();
  setupEventListeners();
  updateSubmitButtonState();
});

// Helper: Convert "HH:MM" string to total minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Helper: Convert total minutes from midnight to "HH:MM" string
function minutesToTime(totalMins) {
  if (totalMins === null || isNaN(totalMins)) return '';
  const normalized = ((totalMins % 1440) + 1440) % 1440; // clamp to 24h
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Set default input date to today
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  reportDate.value = `${yyyy}-${mm}-${dd}`;
}

// Load default initial rows
function loadInitialRows() {
  taskRowsContainer.innerHTML = '';
  // Baris pertama (contoh kosong untuk diisi user)
  createTaskRow('Contoh: Bersih-bersih lobby', '08:00', '10:30', false);
  updateRowNumbers();
  validateAndSyncTimes();
  updateSubmitButtonState();
}

// Create a single task row
function createTaskRow(jobPlaceholder = 'Contoh: Bersihkan ruangan', startTime = '', endTime = '', fillValue = false) {
  const tr = document.createElement('tr');
  tr.className = 'task-row';

  tr.innerHTML = `
    <td class="task-no-cell">1</td>
    <td>
      <input type="text" class="input-job" placeholder="${jobPlaceholder}" ${fillValue ? `value="${jobPlaceholder}"` : ''} required>
    </td>
    <td>
      <div class="time-wrapper start-time-wrapper">
        <input type="time" class="input-time start-time" value="${startTime}" required>
      </div>
      <div class="time-error-message start-error"></div>
    </td>
    <td>
      <div class="time-wrapper end-time-wrapper">
        <input type="time" class="input-time end-time" value="${endTime}" required>
      </div>
      <div class="time-error-message end-error"></div>
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn-delete-row" title="Hapus baris ini">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </td>
  `;

  // Attach listeners for real-time validation & auto-propagation
  const startTimeInput = tr.querySelector('.start-time');
  const endTimeInput = tr.querySelector('.end-time');

  startTimeInput.addEventListener('input', () => {
    handleStartTimeChange(tr);
    validateAndSyncTimes();
    updateSubmitButtonState();
  });

  endTimeInput.addEventListener('input', () => {
    handleEndTimeChange(tr);
    validateAndSyncTimes();
    updateSubmitButtonState();
  });

  // Delete row event
  const btnDelete = tr.querySelector('.btn-delete-row');
  btnDelete.addEventListener('click', () => {
    const totalRows = taskRowsContainer.querySelectorAll('.task-row').length;
    if (totalRows <= 1) {
      showToast('Minimal harus ada 1 jenis pekerjaan!', '#ef4444');
      return;
    }
    tr.remove();
    updateRowNumbers();
    validateAndSyncTimes();
    updateSubmitButtonState();
  });

  taskRowsContainer.appendChild(tr);
  updateRowNumbers();
  validateAndSyncTimes();
  updateSubmitButtonState();
}

// When Jam Mulai of a row is changed
function handleStartTimeChange(row) {
  const startInput = row.querySelector('.start-time');
  const endInput = row.querySelector('.end-time');
  const startMins = timeToMinutes(startInput.value);
  const endMins = timeToMinutes(endInput.value);

  // If start is after or equal to end, auto-suggest end = start + 30 mins
  if (startMins !== null && (endMins === null || startMins >= endMins)) {
    endInput.value = minutesToTime(startMins + 30);
  }
}

// When Jam Selesai of a row is changed: propagate forward to next row
function handleEndTimeChange(row) {
  const nextRow = row.nextElementSibling;
  if (!nextRow) return;

  const endInput = row.querySelector('.end-time');
  const endMins = timeToMinutes(endInput.value);
  if (endMins === null) return;

  const nextStartInput = nextRow.querySelector('.start-time');
  const nextStartMins = timeToMinutes(nextStartInput.value);

  // Jika jam mulai baris berikutnya lebih awal dari jam selesai baris ini,
  // otomatis sesuaikan jam mulai baris berikutnya agar >= jam selesai baris ini!
  if (nextStartMins === null || nextStartMins < endMins) {
    nextStartInput.value = endInput.value;
    handleStartTimeChange(nextRow);
  }
}

// Validate sequence across ALL rows and update UI alerts
function validateAndSyncTimes() {
  const rows = taskRowsContainer.querySelectorAll('.task-row');
  let prevEndTimeStr = null;
  let allValid = true;

  rows.forEach((row, index) => {
    const startInput = row.querySelector('.start-time');
    const endInput = row.querySelector('.end-time');
    const startWrapper = row.querySelector('.start-time-wrapper');
    const endWrapper = row.querySelector('.end-time-wrapper');
    const startError = row.querySelector('.start-error');
    const endError = row.querySelector('.end-error');

    const startVal = startInput.value;
    const endVal = endInput.value;
    const startMins = timeToMinutes(startVal);
    const endMins = timeToMinutes(endVal);

    // Reset errors first
    startWrapper.classList.remove('invalid');
    endWrapper.classList.remove('invalid');
    startError.textContent = '';
    startError.classList.remove('active');
    endError.textContent = '';
    endError.classList.remove('active');

    // Rule 1: Antar baris -> Jam Mulai baris ini harus >= Jam Selesai baris sebelumnya
    if (prevEndTimeStr !== null) {
      startInput.min = prevEndTimeStr;
      const prevEndMins = timeToMinutes(prevEndTimeStr);

      if (startMins !== null && startMins < prevEndMins) {
        startWrapper.classList.add('invalid');
        startError.textContent = `Harus di atas jam selesai data ${index} (min. ${prevEndTimeStr})`;
        startError.classList.add('active');
        allValid = false;
      }
    } else {
      startInput.removeAttribute('min');
    }

    // Rule 2: Dalam baris yang sama -> Jam Selesai harus > Jam Mulai
    if (startVal) {
      endInput.min = startVal;
      if (endMins !== null && endMins <= startMins) {
        endWrapper.classList.add('invalid');
        endError.textContent = `Harus lebih besar dari jam mulai (${startVal})`;
        endError.classList.add('active');
        allValid = false;
      }
    } else {
      endInput.removeAttribute('min');
    }

    // Set prevEndTime for next iteration
    prevEndTimeStr = endVal || null;
  });

  return allValid;
}

// REAL-TIME CHECK: Update submit button enabled/disabled state
function updateSubmitButtonState() {
  const btn = document.getElementById('btnSubmitReport');
  if (!btn) return;

  const dateValue = reportDate ? reportDate.value : '';
  if (!dateValue) {
    btn.disabled = true;
    btn.title = 'Pilih tanggal terlebih dahulu';
    return;
  }

  const rows = taskRowsContainer.querySelectorAll('.task-row');
  if (rows.length === 0) {
    btn.disabled = true;
    btn.title = 'Tambahkan minimal 1 pekerjaan';
    return;
  }

  // Check sequence validity
  const isTimeValid = validateAndSyncTimes();
  if (!isTimeValid) {
    btn.disabled = true;
    btn.title = 'Perbaiki urutan jam yang tidak sesuai terlebih dahulu';
    return;
  }

  // Check if each row has job description, start time, and end time filled
  for (let i = 0; i < rows.length; i++) {
    const jobInput = rows[i].querySelector('.input-job');
    const startInput = rows[i].querySelector('.start-time');
    const endInput = rows[i].querySelector('.end-time');

    const job = jobInput ? jobInput.value.trim() : '';
    const start = startInput ? startInput.value : '';
    const end = endInput ? endInput.value : '';

    if (!job || !start || !end) {
      btn.disabled = true;
      btn.title = `Lengkapi jenis pekerjaan dan jam pada baris #${i + 1} untuk menyimpan`;
      return;
    }
  }

  // All filled and valid!
  btn.disabled = false;
  btn.title = 'Simpan Laporan';
}

// Update row numbers (1, 2, 3...)
function updateRowNumbers() {
  const rows = taskRowsContainer.querySelectorAll('.task-row');
  rows.forEach((row, index) => {
    const noCell = row.querySelector('.task-no-cell');
    if (noCell) {
      noCell.textContent = index + 1;
    }
  });
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
  // Add new job row
  btnAddRow.addEventListener('click', () => {
    const rows = taskRowsContainer.querySelectorAll('.task-row');
    let defaultStart = '08:00';
    let defaultEnd = '08:30';

    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const lastEndInput = lastRow.querySelector('.end-time');
      if (lastEndInput && lastEndInput.value) {
        defaultStart = lastEndInput.value;
        const startMins = timeToMinutes(defaultStart);
        defaultEnd = minutesToTime(startMins + 30);
      }
    }

    createTaskRow('Tulis jenis pekerjaan di sini...', defaultStart, defaultEnd, false);
    updateSubmitButtonState();
  });

  // Listen to inputs throughout the form to live-toggle the submit button
  dailyReportForm.addEventListener('input', () => {
    updateSubmitButtonState();
  });

  dailyReportForm.addEventListener('change', () => {
    updateSubmitButtonState();
  });

  // Submit report form
  dailyReportForm.addEventListener('submit', handleReportSubmit);

  // Switch menu tabs
  menuCreateReport.addEventListener('click', () => switchView('create'));
  menuHistoryReport.addEventListener('click', () => switchView('history'));

  // Export CSV
  if (btnExportAllCsv) {
    btnExportAllCsv.addEventListener('click', exportReportsToCsv);
  }
}

// SWITCH VIEWS
function switchView(view) {
  if (view === 'create') {
    menuCreateReport.classList.add('active');
    menuHistoryReport.classList.remove('active');
    createReportView.style.display = 'block';
    historyReportView.style.display = 'none';
  } else {
    menuCreateReport.classList.remove('active');
    menuHistoryReport.classList.add('active');
    createReportView.style.display = 'none';
    historyReportView.style.display = 'block';
    renderHistoryList();
  }
}

// HANDLE FORM SUBMIT
function handleReportSubmit(e) {
  e.preventDefault();

  // Validate time sequence
  const isValid = validateAndSyncTimes();
  if (!isValid) {
    showToast('Terdapat urutan jam yang tidak sesuai! Periksa kotak bergaris merah.', '#ef4444');
    return;
  }

  const dateValue = reportDate.value;
  const notesValue = reportNotes.value.trim();

  const rows = taskRowsContainer.querySelectorAll('.task-row');
  const tasksData = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const jobInput = row.querySelector('.input-job');
    const startTimeInput = row.querySelector('.start-time');
    const endTimeInput = row.querySelector('.end-time');

    const job = jobInput ? jobInput.value.trim() : '';
    const startTime = startTimeInput ? startTimeInput.value : '';
    const endTime = endTimeInput ? endTimeInput.value : '';

    if (!job) {
      showToast(`Harap isi jenis pekerjaan pada nomor ${i + 1}!`, '#ef4444');
      jobInput.focus();
      return;
    }

    if (!startTime || !endTime) {
      showToast(`Harap lengkapi jam mulai dan selesai pada nomor ${i + 1}!`, '#ef4444');
      return;
    }

    // Double check sequential constraint
    if (i > 0) {
      const prevEnd = tasksData[i - 1].endTime;
      if (timeToMinutes(startTime) < timeToMinutes(prevEnd)) {
        showToast(`Nomor ${i + 1}: Jam mulai (${startTime}) harus di atas jam selesai data sebelumnya (${prevEnd})!`, '#ef4444');
        startTimeInput.focus();
        return;
      }
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      showToast(`Nomor ${i + 1}: Jam selesai (${endTime}) harus lebih besar dari jam mulai (${startTime})!`, '#ef4444');
      endTimeInput.focus();
      return;
    }

    tasksData.push({ job, startTime, endTime });
  }

  const newReport = {
    id: 'report-' + Date.now(),
    date: dateValue,
    author: 'OB01',
    tasks: tasksData,
    notes: notesValue,
    createdAt: new Date().toISOString()
  };

  // Save to localStorage
  const existingReports = getSavedReports();
  existingReports.unshift(newReport);
  localStorage.setItem('ob_daily_reports_v2', JSON.stringify(existingReports));

  // Reset form
  reportNotes.value = '';
  loadInitialRows();
  showToast('Laporan berhasil disimpan!');
}

// GET SAVED REPORTS
function getSavedReports() {
  const data = localStorage.getItem('ob_daily_reports_v2');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// RENDER HISTORY
function renderHistoryList() {
  const reports = getSavedReports();
  historyListContainer.innerHTML = '';

  if (reports.length === 0) {
    historyListContainer.innerHTML = `
      <div style="background: white; padding: 3rem 1.5rem; text-align: center; border-radius: 12px; border: 1px solid #e2e8f0; color: #64748b;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">📋</span>
        <p style="font-weight: 600;">Belum ada riwayat laporan yang disimpan.</p>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">Klik menu <strong>"Buat Laporan"</strong> untuk mulai membuat laporan harian.</p>
      </div>
    `;
    return;
  }

  reports.forEach((rep) => {
    const card = document.createElement('div');
    card.className = 'history-card';

    // Format date in Indonesian
    const dateObj = new Date(rep.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let tasksHtml = '';
    rep.tasks.forEach((t, i) => {
      tasksHtml += `
        <li class="history-item">
          <div>
            <strong style="color: #0f172a;">${i + 1}. ${escapeHtml(t.job)}</strong>
          </div>
          <span style="background: #e2e8f0; color: #334155; font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px;">
            🕒 ${t.startTime} - ${t.endTime}
          </span>
        </li>
      `;
    });

    const notesHtml = rep.notes ? `
      <div class="history-notes" style="margin-top: 0.75rem;">
        <strong>Catatan:</strong> ${escapeHtml(rep.notes)}
      </div>
    ` : '';

    card.innerHTML = `
      <div class="history-header">
        <div>
          <div class="history-date">📅 ${formattedDate}</div>
          <small style="color: #64748b; font-weight: 500;">Oleh: ${rep.author || 'OB01'}</small>
        </div>
        <button class="btn-delete-row" title="Hapus laporan ini" onclick="deleteReport('${rep.id}')" style="margin: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <ul class="history-list">
        ${tasksHtml}
      </ul>
      ${notesHtml}
    `;

    historyListContainer.appendChild(card);
  });
}

// DELETE REPORT
window.deleteReport = function(id) {
  if (confirm('Apakah Anda yakin ingin menghapus laporan ini?')) {
    let reports = getSavedReports();
    reports = reports.filter(r => r.id !== id);
    localStorage.setItem('ob_daily_reports_v2', JSON.stringify(reports));
    renderHistoryList();
    showToast('Laporan berhasil dihapus!', '#ef4444');
  }
};

// EXPORT ALL TO CSV
function exportReportsToCsv() {
  const reports = getSavedReports();
  if (reports.length === 0) {
    showToast('Belum ada data untuk diunduh.', '#ef4444');
    return;
  }

  const headers = ['Tanggal', 'Petugas', 'No Pekerjaan', 'Jenis Pekerjaan', 'Jam Mulai', 'Jam Selesai', 'Catatan'];
  const csvRows = [];

  reports.forEach(r => {
    r.tasks.forEach((t, i) => {
      csvRows.push([
        `"${r.date}"`,
        `"${r.author || 'OB01'}"`,
        `"${i + 1}"`,
        `"${t.job.replace(/"/g, '""')}"`,
        `"${t.startTime}"`,
        `"${t.endTime}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ]);
    });
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Daily_Report_OB_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// TOAST HELPER
function showToast(message, bgColor = '#10b981') {
  toastMessage.textContent = message;
  toastNotification.style.backgroundColor = bgColor;
  toastNotification.style.display = 'flex';

  setTimeout(() => {
    toastNotification.style.display = 'none';
  }, 3500);
}

// XSS ESCAPE HELPER
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
