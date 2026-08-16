// Game Engine: Mega Planejador UFU - Engenharia Eletrônica e de Telecomunicações
// Sourced from Prof. Daniel Costa Ramos spreadsheet (UFU Patos de Minas)

let gameData = {};
let completedSubjects = new Set();
let selectedSubjects = new Set();
let currentPeriodFilter = 1;
let totalHours = 0;

// Audio System (Web Audio API Synthesizer)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'select') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'deselect') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, now); // G5
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08); // A4
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'victory') {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, now + idx * 0.1);
      g.gain.setValueAtTime(0.2, now + idx * 0.1);
      g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
      o.start(now + idx * 0.1);
      o.stop(now + idx * 0.1 + 0.3);
    });
  }
}

// Engineering Career Projects
const projectsList = [
  { id: 1, name: "Bancada Inicial de Eletrônica", level: "Estagiário", minHours: 0, icon: "🧰", desc: "Montagem da primeira bancada de testes com multímetro, protoboard e osciloscópio.", reqDesc: "Concluir disciplinas do 1º Período" },
  { id: 2, name: "Fonte de Alimentação Regulada 12V", level: "Técnico de Eletrônica", minHours: 300, icon: "⚡", desc: "Projeto e soldagem de uma fonte ajustável com diodos zener e reguladores LM317.", reqDesc: "Requer Fundamentos de Semicondutores & Circuitos I" },
  { id: 3, name: "Amplificador de Áudio Analógico", level: "Prototipador", minHours: 600, icon: "📻", desc: "Design de estágio amplificador de potência classe AB com resposta em frequência linear.", reqDesc: "Requer Eletrônica Analógica I & Circuitos II" },
  { id: 4, name: "Estação Microcontrolada de Sensores", level: "Engenheiro Júnior", minHours: 900, icon: "🤖", desc: "Automação industrial utilizando microcontroladores, interrupções e barramento I2C.", reqDesc: "Requer Microcontroladores & Eletrônica Digital" },
  { id: 5, name: "Transmissor RF & Receptor Super-Heteródino", level: "Engenheiro Pleno", minHours: 1400, icon: "📡", desc: "Módulo de radiofrequência para comunicação sem fio e modulação digital FM/QAM.", reqDesc: "Requer Princípios de Comunicação & Linhas de Transmissão" },
  { id: 6, name: "Estação de Antenas & Enlace 5G/Satélite", level: "Engenheiro Sênior", minHours: 1800, icon: "🛰️", desc: "Dimensionamento de antenas diretivas e arranjos de fase para redes móveis 5G e enlaces via satélite.", reqDesc: "Requer Antenas & Comunicações Digitais II" },
  { id: 7, name: "Projeto Final de Curso II (PFC II) - Formatura", level: "Engenheiro Eletrônico", minHours: 2300, icon: "🎓", desc: "Desenvolvimento e defesa pública da tese de engenharia na UFU Patos de Minas!", reqDesc: "Requer 2300h Integralizadas e PFC I" }
];

// Initialize Game
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('./eletronica_game_data.json');
    gameData = await res.json();
  } catch (err) {
    console.error('Failed to load JSON data, retrying inline load:', err);
  }
  
  setupUI();
  renderAll();
});

function setupUI() {
  // Setup Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      playSound('select');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Setup Period Filter Chips
  const periodContainer = document.getElementById('period-selector');
  periodContainer.innerHTML = '';
  for (let p = 1; p <= 10; p++) {
    const chip = document.createElement('div');
    chip.className = `period-chip ${p === currentPeriodFilter ? 'active' : ''}`;
    chip.innerText = `${p}º Período`;
    chip.addEventListener('click', () => {
      playSound('select');
      currentPeriodFilter = p;
      document.querySelectorAll('.period-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderSubjectList();
    });
    periodContainer.appendChild(chip);
  }

  // Setup Complete Semester Button
  document.getElementById('btn-finish-semester').addEventListener('click', finishSemester);
  document.getElementById('btn-reset-game').addEventListener('click', resetGame);
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.remove('active');
  });
}

function checkPrerequisites(subject) {
  // Check hours requirement
  if (subject.hours_req > 0 && totalHours < subject.hours_req) {
    return { passed: false, reason: `Requer ${subject.hours_req}h integralizadas (Você tem ${totalHours}h)` };
  }

  // Check direct prerequisites
  const missingPrereqs = [];
  if (subject.prerequisites && subject.prerequisites.length > 0) {
    subject.prerequisites.forEach(preId => {
      if (!completedSubjects.has(preId)) {
        const preObj = gameData[preId];
        missingPrereqs.push(preObj ? preObj.name : `Matéria #${preId}`);
      }
    });
  }

  if (missingPrereqs.length > 0) {
    return { passed: false, reason: `Pré-requisitos pendentes: ${missingPrereqs.join(', ')}` };
  }

  return { passed: true, reason: '' };
}

function toggleSubject(id) {
  const subject = gameData[id];
  if (!subject) return;

  if (completedSubjects.has(id)) {
    return; // Already passed
  }

  const prereqCheck = checkPrerequisites(subject);
  if (!prereqCheck.passed) {
    playSound('error');
    alert(`⛔ MATÉRIA EM CONSTRUÇÃO / BLOQUEADA!\n\n${prereqCheck.reason}\n\nAssim como na engenharia, você não pode construir o telhado sem erguer as paredes e fundações!`);
    return;
  }

  if (selectedSubjects.has(id)) {
    selectedSubjects.delete(id);
    playSound('deselect');
  } else {
    selectedSubjects.add(id);
    playSound('select');
  }

  renderAll();
}

function renderSubjectList() {
  const listEl = document.getElementById('subject-list');
  listEl.innerHTML = '';

  const filtered = Object.values(gameData).filter(s => s.period === currentPeriodFilter);

  filtered.forEach(s => {
    const isCompleted = completedSubjects.has(s.id);
    const isSelected = selectedSubjects.has(s.id);
    const prereqCheck = checkPrerequisites(s);
    const isLocked = !isCompleted && !prereqCheck.passed;

    const item = document.createElement('div');
    item.className = `subject-item ${isCompleted ? 'completed' : ''} ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`;

    let statusBadge = `<span class="badge badge-period">${s.period}º Período</span>`;
    if (isCompleted) statusBadge = `<span class="badge badge-completed">✓ Aprovado</span>`;
    else if (isSelected) statusBadge = `<span class="badge badge-selected">☑ Selecionada</span>`;
    else if (isLocked) statusBadge = `<span class="badge badge-locked">🔒 Bloqueada</span>`;

    item.innerHTML = `
      <div class="subject-top">
        <div class="subject-code-name">${s.id} — ${s.name}</div>
        ${statusBadge}
      </div>
      <div class="subject-meta">
        <span>⏱️ ${s.workload} horas</span>
        <span>👨‍🏫 ${s.schedule[0] ? s.schedule[0].teacher : 'Prof. UFU'}</span>
      </div>
      ${isLocked ? `<div class="subject-prereq">⚠️ ${prereqCheck.reason}</div>` : ''}
    `;

    item.addEventListener('click', () => toggleSubject(s.id));
    listEl.appendChild(item);
  });
}

function detectConflicts() {
  // Time slot mapping: Day -> TimeString -> Array of Subject Objects
  const slotMap = {};
  const conflicts = [];

  selectedSubjects.forEach(id => {
    const sub = gameData[id];
    if (sub && sub.schedule) {
      sub.schedule.forEach(slot => {
        const key = `${slot.day}_${slot.time}`;
        if (!slotMap[key]) slotMap[key] = [];
        slotMap[key].push({ subjectId: id, name: sub.name, day: slot.day, time: slot.time });
      });
    }
  });

  Object.values(slotMap).forEach(list => {
    if (list.length > 1) {
      conflicts.push(list);
    }
  });

  return { slotMap, conflicts };
}

function renderScheduleTable() {
  const container = document.getElementById('schedule-table-container');
  const alertBanner = document.getElementById('alert-banner');
  const alertText = document.getElementById('alert-text');

  const { slotMap, conflicts } = detectConflicts();

  if (conflicts.length > 0) {
    alertBanner.classList.remove('hidden');
    const conflictNames = conflicts.map(c => `${c[0].day} (${c[0].time}): [${c.map(x => x.name).join(' ⚡ CHOCA COM ')}]`);
    alertText.innerText = `CHOQUE DE HORÁRIO DETECTADO! ${conflictNames.join(' | ')}`;
  } else {
    alertBanner.classList.add('hidden');
  }

  // Days: Segunda, Terça, Quarta, Quinta, Sexta, Sábado
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const times = [
    '08:00 – 09:40',
    '09:50 – 11:30',
    '10:00 – 11:40',
    '14:00 – 15:40',
    '16:00 – 17:40',
    '18:00 – 19:40'
  ];

  let html = `<table class="schedule-table">
    <thead>
      <tr>
        <th>Horário</th>
        ${days.map(d => `<th>${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  times.forEach(t => {
    html += `<tr><td class="time-col">${t}</td>`;
    days.forEach(d => {
      // Find cards for this cell
      let cellCards = [];
      let isConflict = false;

      selectedSubjects.forEach(id => {
        const sub = gameData[id];
        if (sub && sub.schedule) {
          sub.schedule.forEach(sc => {
            if (sc.day === d && (sc.time === t || sc.time.includes(t.substring(0, 5)))) {
              cellCards.push({ id, sub, sc });
            }
          });
        }
      });

      if (cellCards.length > 1) {
        isConflict = true;
      }

      html += `<td class="schedule-cell">`;
      if (cellCards.length > 0) {
        cellCards.forEach(c => {
          html += `<div class="schedule-card ${isConflict ? 'conflict' : ''}">
            <div class="card-title">${c.sub.id} — ${c.sub.name}</div>
            <div class="card-info">
              <span>📍 ${c.sc.room}</span>
              <span>👨‍🏫 ${c.sc.teacher}</span>
            </div>
          </div>`;
        });
      }
      html += `</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderTreeTab() {
  const treeContainer = document.getElementById('tree-container');
  treeContainer.innerHTML = '';

  for (let p = 1; p <= 10; p++) {
    const periodSubs = Object.values(gameData).filter(s => s.period === p);
    if (periodSubs.length === 0) continue;

    const row = document.createElement('div');
    row.className = 'tree-period-row';
    row.innerHTML = `
      <div class="tree-period-title">📌 ${p}º Período da Engenharia</div>
      <div class="tree-nodes-grid" id="tree-grid-${p}"></div>
    `;
    treeContainer.appendChild(row);

    const grid = row.querySelector(`#tree-grid-${p}`);
    periodSubs.forEach(s => {
      const isPassed = completedSubjects.has(s.id);
      const prereqCheck = checkPrerequisites(s);
      const isUnlocked = isPassed || prereqCheck.passed;

      const node = document.createElement('div');
      node.className = `tree-node-card ${isPassed ? 'unlocked' : (isUnlocked ? '' : 'locked')}`;
      node.innerHTML = `
        <div class="subject-code-name" style="font-size: 13px;">${s.id} — ${s.name}</div>
        <div style="font-size: 11px; margin-top: 6px; color: var(--text-muted);">
          ${isPassed ? '✅ Cursado com Sucesso' : (isUnlocked ? '🟢 Liberado para Matrícula' : `🔒 Requer: ${s.prerequisites.join(', ')}`)}
        </div>
      `;
      grid.appendChild(node);
    });
  }
}

function renderProjectsTab() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';

  projectsList.forEach(proj => {
    const isUnlocked = totalHours >= proj.minHours;

    const card = document.createElement('div');
    card.className = `project-card ${isUnlocked ? '' : 'locked'}`;
    card.innerHTML = `
      <div class="project-icon">${proj.icon}</div>
      <div class="project-title">${proj.name}</div>
      <div class="project-desc">${proj.desc}</div>
      <div class="project-reqs">
        <span>${isUnlocked ? '✅ PROJETO DESBLOQUEADO' : `🔒 ${proj.reqDesc} (${proj.minHours}h)`}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderAll() {
  // Update header stats
  document.getElementById('stat-hours').innerText = `${totalHours} / 2300 h`;
  document.getElementById('stat-selected-count').innerText = `${selectedSubjects.size} matérias`;
  
  const pct = Math.min(100, Math.round((totalHours / 2300) * 100));
  document.getElementById('progress-bar').style.width = `${pct}%`;

  let title = "Estagiário de Eletrônica";
  if (totalHours >= 2300) title = "🎓 ENGENHEIRO ELETRÔNICO (FORMADO!)";
  else if (totalHours >= 1800) title = "Engenheiro Sênior de Projetos";
  else if (totalHours >= 1400) title = "Engenheiro Pleno de Sistemas";
  else if (totalHours >= 900) title = "Engenheiro Júnior de Telecom";
  else if (totalHours >= 600) title = "Prototipador de Eletrônica";
  else if (totalHours >= 300) title = "Técnico de Bancada";

  document.getElementById('stat-engineer-level').innerText = title;

  renderSubjectList();
  renderScheduleTable();
  renderTreeTab();
  renderProjectsTab();
}

function finishSemester() {
  if (selectedSubjects.size === 0) {
    playSound('error');
    alert('Selecione ao menos 1 disciplina para montar sua grade de matrícula do semestre!');
    return;
  }

  const { conflicts } = detectConflicts();
  if (conflicts.length > 0) {
    playSound('error');
    alert('⛔ NÃO É POSSÍVEL CONCLUIR O SEMESTRE COM CHOQUE DE HORÁRIOS!\n\nVocê não pode estar em dois lugares ao mesmo tempo! Remova a disciplina em conflito destacada em vermelho.');
    return;
  }

  playSound('victory');

  let gainedHours = 0;
  selectedSubjects.forEach(id => {
    completedSubjects.add(id);
    const sub = gameData[id];
    if (sub) gainedHours += sub.workload;
  });

  totalHours += gainedHours;
  selectedSubjects.clear();

  // Advance filter to next period automatically if possible
  if (currentPeriodFilter < 10) currentPeriodFilter++;

  document.querySelectorAll('.period-chip').forEach((c, idx) => {
    c.classList.toggle('active', idx + 1 === currentPeriodFilter);
  });

  renderAll();

  // Show Modal
  document.getElementById('modal-title').innerText = '🎉 Semestre Concluído com Sucesso!';
  document.getElementById('modal-desc').innerText = `Parabéns! Você aprovou em todas as disciplinas da sua grade sem nenhum choque de horário! Acumulou +${gainedHours} horas de carga horária e avançou para o próximo nível de Engenheiro!`;
  document.getElementById('modal-overlay').classList.add('active');
}

function resetGame() {
  if (confirm('Deseja reiniciar a sua carreira de Engenharia Eletrônica e refazer as matrículas do zero?')) {
    completedSubjects.clear();
    selectedSubjects.clear();
    totalHours = 0;
    currentPeriodFilter = 1;
    renderAll();
  }
}
