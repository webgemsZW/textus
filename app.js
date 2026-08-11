// Textus — UI, routing, session logic.
'use strict';

/* ============================== State ============================== */

const STORAGE_KEY = 'greekAppState';

const VOCAB_BY_ID = {};
VOCAB.forEach((w) => { VOCAB_BY_ID[w.id] = w; });

// Cards are keyed by item: a bare number is a vocabulary word, "L<n>" a letter of the
// alphabet, "D<n>" a diphthong. Keeping words on bare numbers means state saved by
// earlier versions still loads unchanged.
function resolveItem(itemKey) {
  const k = String(itemKey);
  if (k[0] === 'L') return { kind: 'letter', index: +k.slice(1), data: ALPHABET[+k.slice(1)] };
  if (k[0] === 'D') return { kind: 'diphthong', index: +k.slice(1), data: DIPHTHONGS[+k.slice(1)] };
  return { kind: 'word', index: +k, data: VOCAB_BY_ID[+k] };
}

const CARD_TYPE_LABEL = {
  decode: 'Decode',
  recognise: 'Recognise',
  produce: 'Produce',
  letterName: 'Letter',
  letterWrite: 'Write letter',
  diphSound: 'Diphthong',
};

// Letters must be recognisable in either case on their own, not only as the familiar
// pair — so prompts and options are rendered in one of these forms. All options within
// a single question share a form, otherwise the odd one out gives the answer away.
const LETTER_FORMS = ['both', 'upper', 'lower'];

// Sigma's lower field holds two glyphs ("σ ς"). Questions must use just the primary
// one, or sigma becomes the only option containing a space and is identifiable by
// shape alone. Lessons and the reference table still show both forms.
function primaryLower(l) {
  return l.lower.split(/\s+/)[0];
}

// Every glyph that legitimately answers "write this letter" — includes final sigma.
function letterGlyphs(l) {
  return l.lower.split(/\s+/).concat([l.upper]);
}

// Strip diacritics and case to find which alphabet letter a character is.
function baseLetterOf(ch) {
  const base = Array.from(ch.normalize('NFD'))[0].toLowerCase();
  return base === 'ς' ? 'σ' : base;
}

function letterByBase(base) {
  return ALPHABET.find((l) => l.lower.split(/\s+/).includes(base));
}

// Break a Greek word into its sounded units so a beginner can see how the alphabet
// they just learned maps onto a real word. Adjacent vowels that form a diphthong are
// kept together, since treating them separately would teach the wrong pronunciation.
function segmentGreekWord(greek) {
  const chars = Array.from(greek.normalize('NFC'));
  const segments = [];
  let i = 0;
  while (i < chars.length) {
    const b1 = baseLetterOf(chars[i]);
    const b2 = i + 1 < chars.length ? baseLetterOf(chars[i + 1]) : null;
    const diphthong = b2 ? DIPHTHONGS.find((d) => d.digraph === b1 + b2) : null;
    if (diphthong) {
      segments.push({ glyph: chars[i] + chars[i + 1], label: 'one sound', isDiphthong: true });
      i += 2;
      continue;
    }
    const letter = letterByBase(b1);
    segments.push({ glyph: chars[i], label: letter ? letter.name : '' });
    i += 1;
  }
  return segments;
}

function breakdownHtml(greek) {
  const chips = segmentGreekWord(greek).map((s) => `
    <div class="breakdown-chip ${s.isDiphthong ? 'is-diphthong' : ''}">
      <div class="breakdown-glyph">${s.glyph}</div>
      <div class="breakdown-name">${s.label}</div>
    </div>`).join('');
  return `<div class="breakdown">${chips}</div>`;
}

function letterForm(l, form) {
  if (form === 'upper') return l.upper;
  if (form === 'lower') return primaryLower(l);
  return `${l.upper} ${primaryLower(l)}`;
}

function randomLetterForm() {
  return LETTER_FORMS[Math.floor(Math.random() * LETTER_FORMS.length)];
}

function defaultState() {
  return {
    version: 1,
    settings: {
      newPerDay: 10, reviewsPerDay: 60, theme: 'dark', fontScale: 1,
      unlockAll: false, titleScript: 'latin', practiceSetup: null,
    },
    progress: {
      m1Complete: false,
      m2Complete: false,
      m3Complete: false,
      m4NextLesson: 2,
      lessonsCompleted: 0,
    },
    words: {},   // wordId -> { introduced, introducedDate }
    cards: {},   // cardId -> card
    daily: { date: SRS.todayStr(), newShown: 0, reviewsShown: 0 },
    stats: { streak: 0, lastStudyDate: null },
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.version) return defaultState();
    // 1.3.0 called this unlockAllLessons; it now covers practice and reference too.
    if (parsed.settings && parsed.settings.unlockAll === undefined) {
      parsed.settings.unlockAll = !!parsed.settings.unlockAllLessons;
      delete parsed.settings.unlockAllLessons;
    }
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetAllProgress() {
  state = defaultState();
  saveState();
}

function updateStreak() {
  const today = SRS.todayStr();
  if (state.stats.lastStudyDate === today) return;
  const yesterday = SRS.addDays(today, -1);
  state.stats.streak = state.stats.lastStudyDate === yesterday ? state.stats.streak + 1 : 1;
  state.stats.lastStudyDate = today;
}

function totalWordsLearned() {
  return Object.values(state.words).filter((w) => w.introduced).length;
}

/* ============================== Utilities ============================== */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Words to draw wrong answers from — prefer ones already learned, fall back to the
// whole list early on when little has been introduced.
function wordCandidatePool(excludeId) {
  const learned = VOCAB.filter((w) => w.id !== excludeId && state.words[w.id] && state.words[w.id].introduced);
  return learned.length >= 3 ? learned : VOCAB.filter((w) => w.id !== excludeId);
}

// Build 4 MC options, de-duplicated so a distractor can never read as correct too
// (several words share a gloss — καί, δέ and τε all mean "and").
function buildMcOptions(correct, candidates) {
  const seen = new Set([correct]);
  const distractors = [];
  for (const cand of shuffle(candidates)) {
    if (cand == null || seen.has(cand)) continue;
    seen.add(cand);
    distractors.push(cand);
    if (distractors.length === 3) break;
  }
  return shuffle([correct, ...distractors]);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============================== Router ============================== */

const APP_EL = document.getElementById('app');

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  return h.split('?')[0];
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function route() {
  const r = currentRoute();
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.route === r));
  if (r === 'home') renderHome();
  else if (r === 'lesson') renderLesson();
  else if (r === 'review') renderReview();
  else if (r === 'practice') renderPractice();
  else if (r === 'reference') renderReference();
  else if (r === 'settings') renderSettings();
  else renderHome();
}

window.addEventListener('hashchange', route);
document.querySelectorAll('.nav-btn').forEach((b) => {
  b.addEventListener('click', () => navigate(b.dataset.route));
});

/* ============================== Theme ============================== */

function applyTheme() {
  const light = state.settings.theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.getElementById('theme-toggle').textContent = light ? 'Dark' : 'Light';
}

// The title can be shown in Latin or Greek script. Τέξτους transliterates "Textus"
// letter-for-letter under the conventions the app teaches (x → ξ, u → ου).
const TITLE_LATIN = 'Textus';
const TITLE_GREEK = 'Τέξτους';

function applyTitleScript() {
  const greek = state.settings.titleScript === 'greek';
  const elTitle = document.getElementById('app-title-text');
  elTitle.textContent = greek ? TITLE_GREEK : TITLE_LATIN;
  elTitle.className = greek ? 'title-greek' : '';
}

function toggleTitleScript() {
  state.settings.titleScript = state.settings.titleScript === 'greek' ? 'latin' : 'greek';
  saveState();
  applyTitleScript();
}

// Every type size in the stylesheet is in rem, so scaling the root font size scales
// the whole app — Greek included — without touching layout padding.
const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75];

function applyFontScale() {
  const scale = state.settings.fontScale || 1;
  document.documentElement.style.fontSize = (16 * scale) + 'px';
}

function nudgeFontScale(direction) {
  const current = state.settings.fontScale || 1;
  let i = FONT_STEPS.indexOf(current);
  if (i === -1) i = FONT_STEPS.indexOf(1);
  const next = Math.min(FONT_STEPS.length - 1, Math.max(0, i + direction));
  state.settings.fontScale = FONT_STEPS[next];
  saveState();
  applyFontScale();
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  saveState();
  applyTheme();
});

/* ============================== Home ============================== */

function getNextLesson() {
  if (!state.progress.m1Complete) return { module: 'M1', label: 'The Alphabet' };
  if (!state.progress.m2Complete) return { module: 'M2', label: 'First Words' };
  if (!state.progress.m3Complete) return { module: 'M3', label: 'Diphthongs' };
  if (state.progress.m4NextLesson <= 10) {
    return { module: 'M4', label: `Vocabulary — Lesson ${state.progress.m4NextLesson}`, lessonNumber: state.progress.m4NextLesson };
  }
  return null;
}

function renderHome() {
  SRS.checkUnlocks(state, SRS.todayStr());
  const dueCount = SRS.buildQueue(state, SRS.todayStr()).length;
  const qStats = SRS.getQueueStats(state, SRS.todayStr());
  saveState();
  const next = getNextLesson();

  APP_EL.innerHTML = '';
  const dueCard = el(`
    <div class="card due-cta">
      <div class="due-count">${dueCount}</div>
      <div class="muted">card${dueCount === 1 ? '' : 's'} due today</div>
      <button class="btn btn-primary btn-block btn-lg" id="btn-review" style="margin-top:18px;" ${dueCount === 0 ? 'disabled' : ''}>
        ${dueCount === 0 ? 'All caught up' : 'Start review'}
      </button>
      ${qStats.throttled
        ? `<p class="faint" style="margin-top:12px;">New cards held back to ${qStats.newAllowance} today — ${qStats.dueReviews} reviews are already waiting. Clear some and more will come through.</p>`
        : ''}
    </div>
  `);
  APP_EL.appendChild(dueCard);

  const practiceCard = el(`
    <div class="card">
      <h3 style="margin-bottom:4px;">Practice</h3>
      <p class="faint" style="margin-top:0;">Drill any deck exhaustively — no cap, as much or as little as you have time for.</p>
      <button class="btn btn-block" id="btn-practice">Open practice</button>
    </div>
  `);
  APP_EL.appendChild(practiceCard);

  const lessonCard = el(`
    <div class="card">
      <h3 style="margin-bottom:4px;">Next lesson</h3>
      ${next
        ? `<p class="muted" style="margin-top:0;">${next.label}</p><button class="btn btn-block" id="btn-lesson">Continue lesson</button>`
        : `<p class="faint">All content complete — keep reviewing to build retention.</p>`}
    </div>
  `);
  APP_EL.appendChild(lessonCard);

  const statsCard = el(`
    <div class="card">
      <div class="stats-row">
        <div class="stat"><div class="num">${state.stats.streak}</div><div class="label">Streak</div></div>
        <div class="stat"><div class="num">${totalWordsLearned()}</div><div class="label">Words learned</div></div>
        <div class="stat"><div class="num">${state.progress.lessonsCompleted}</div><div class="label">Lessons done</div></div>
      </div>
    </div>
  `);
  APP_EL.appendChild(statsCard);

  const settingsLink = el(`<button class="btn btn-block" id="btn-settings">Settings</button>`);
  APP_EL.appendChild(settingsLink);

  if (dueCount > 0) document.getElementById('btn-review').addEventListener('click', () => navigate('review'));
  document.getElementById('btn-practice').addEventListener('click', () => navigate('practice'));
  const lessonBtn = document.getElementById('btn-lesson');
  if (lessonBtn) lessonBtn.addEventListener('click', () => { startNextLesson(); navigate('lesson'); });
  document.getElementById('btn-settings').addEventListener('click', () => navigate('settings'));
}

/* ============================== Lesson ============================== */

let lessonSession = null;

function buildLessonItems(next) {
  if (next.module === 'M1') {
    const items = ALPHABET.map((l) => ({ type: 'letter', data: l }));
    BREATHING_MARKS.forEach((m) => items.push({ type: 'breathing', data: m }));
    items.push({ type: 'accents', data: ACCENTS_INFO });
    return items;
  }
  if (next.module === 'M2') {
    const words = VOCAB.filter((w) => w.lesson === 1).sort((a, b) => a.id - b.id);
    const items = [];
    words.forEach((w) => {
      if (INLINE_DIPHTHONG_NOTES[w.id]) items.push({ type: 'diphthongNote', data: INLINE_DIPHTHONG_NOTES[w.id] });
      items.push({ type: 'word', data: w });
    });
    return items;
  }
  if (next.module === 'M3') {
    return DIPHTHONGS.map((d) => ({ type: 'diphthong', data: d }));
  }
  if (next.module === 'M4') {
    const words = VOCAB.filter((w) => w.lesson === next.lessonNumber).sort((a, b) => a.id - b.id);
    return words.map((w) => ({ type: 'word', data: w }));
  }
  return [];
}

function buildCheckQuestions(next, items) {
  const qs = [];
  if (next.module === 'M1') {
    const letters = shuffle(ALPHABET).slice(0, 4);
    letters.forEach((letter) => {
      const options = shuffle([letter, ...shuffle(ALPHABET.filter((l) => l !== letter)).slice(0, 3)]);
      qs.push({
        prompt: `Which letter is "${letter.name}"?`,
        options: options.map((o) => `${o.upper} ${o.lower}`),
        correctIndex: options.indexOf(letter),
      });
    });
  } else if (next.module === 'M3') {
    shuffle(DIPHTHONGS).slice(0, 4).forEach((d) => {
      const options = shuffle([d, ...shuffle(DIPHTHONGS.filter((x) => x !== d)).slice(0, 3)]);
      qs.push({
        prompt: `Which diphthong sounds like: ${d.sound}?`,
        options: options.map((o) => o.digraph),
        correctIndex: options.indexOf(d),
      });
    });
  } else {
    const words = items.filter((i) => i.type === 'word').map((i) => i.data);
    shuffle(words).slice(0, Math.min(4, words.length)).forEach((w) => {
      const distractors = shuffle(words.filter((x) => x.id !== w.id)).slice(0, 3).map((x) => x.pron);
      const options = shuffle([w.pron, ...distractors]);
      qs.push({
        prompt: w.greek,
        promptIsGreek: true,
        options,
        correctIndex: options.indexOf(w.pron),
      });
    });
  }
  return qs;
}

// Every lesson in the course, in order, so any completed one can be replayed.
function allLessons() {
  const list = [
    { module: 'M1', label: 'The Alphabet', detail: `${ALPHABET.length} letters, breathings, accents` },
    { module: 'M2', label: 'First Words', detail: '10 core words' },
    { module: 'M3', label: 'Diphthongs', detail: `${DIPHTHONGS.length} diphthongs` },
  ];
  for (let n = 2; n <= 10; n++) {
    list.push({ module: 'M4', lessonNumber: n, label: `Vocabulary — Lesson ${n}`, detail: '10 words' });
  }
  return list;
}

function lessonStatus(lesson) {
  const p = state.progress;
  let status;
  if (lesson.module === 'M1') status = p.m1Complete ? 'done' : 'next';
  else if (lesson.module === 'M2') status = p.m2Complete ? 'done' : (p.m1Complete ? 'next' : 'locked');
  else if (lesson.module === 'M3') status = p.m3Complete ? 'done' : (p.m2Complete ? 'next' : 'locked');
  else if (!p.m3Complete) status = 'locked';
  else if (p.m4NextLesson > lesson.lessonNumber) status = 'done';
  else if (p.m4NextLesson === lesson.lessonNumber) status = 'next';
  else status = 'locked';

  // The unlock-all setting exposes unearned lessons for previewing and testing.
  if (status === 'locked' && unlockAllOn()) return 'preview';
  return status;
}

// replay = true means "let me see this again" — the content runs identically but no
// progress is advanced and no lesson counted twice.
function startLesson(lesson, replay) {
  lessonSession = {
    module: lesson.module,
    lessonNumber: lesson.lessonNumber,
    label: lesson.label,
    replay: !!replay,
    items: buildLessonItems(lesson),
    index: 0,
    phase: 'items',
    checkQuestions: [],
    checkIndex: 0,
    checkCorrect: 0,
  };
}

function startNextLesson() {
  const next = getNextLesson();
  if (next) startLesson(next, false);
}

function renderLesson() {
  if (lessonSession) {
    if (lessonSession.phase === 'items') renderLessonItem();
    else if (lessonSession.phase === 'check') renderLessonCheck();
    else renderLessonDone();
    return;
  }
  renderLessonPicker();
}

function renderLessonPicker() {
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="card">
      <h3 style="margin-bottom:4px;">Lessons</h3>
      <p class="faint" style="margin-top:0;">Replay any lesson you've finished — it won't affect your progress or schedule.</p>
    </div>
  `));

  allLessons().forEach((lesson) => {
    const status = lessonStatus(lesson);
    const badge = { done: 'Done', next: 'Next', locked: 'Locked', preview: 'Preview' }[status];
    const row = el(`
      <div class="card lesson-row ${status === 'locked' ? 'is-locked' : ''}">
        <div>
          <strong>${lesson.label}</strong>
          <div class="faint">${lesson.detail}</div>
        </div>
        <div class="lesson-row-action">
          <span class="tag status-${status}">${badge}</span>
        </div>
      </div>
    `);
    if (status !== 'locked') {
      const actionLabel = { done: 'Replay', next: 'Start', preview: 'Preview' }[status];
      const btn = el(`<button class="btn">${actionLabel}</button>`);
      btn.addEventListener('click', () => {
        startLesson(lesson, status === 'done');
        renderLesson();
      });
      row.querySelector('.lesson-row-action').appendChild(btn);
    }
    APP_EL.appendChild(row);
  });
}

function renderLessonItem() {
  const s = lessonSession;
  const item = s.items[s.index];
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`<div class="lesson-progress">${s.label} · ${s.index + 1} / ${s.items.length}</div>`));

  let bodyHtml = '';
  let nextLabel = 'Next';

  if (item.type === 'letter') {
    const l = item.data;
    bodyHtml = `
      <div class="lesson-item">
        <div class="greek-lg">${l.upper} ${l.lower}</div>
        <div class="gloss" style="margin-top:14px;">${l.name}</div>
        <div class="translit" style="margin-top:2px;">${l.nameGreek}</div>
        <div class="pron" style="margin-top:4px;">say the name: ${l.namePron}</div>
        <div class="pron" style="margin-top:10px;">sounds like: ${l.sound}</div>
      </div>`;
  } else if (item.type === 'breathing') {
    const b = item.data;
    bodyHtml = `
      <div class="lesson-item">
        <div class="greek-lg">${b.mark}</div>
        <div class="gloss" style="margin-top:14px;">${b.name} breathing — ${b.desc}</div>
        <div class="pron" style="margin-top:10px;">${b.example} = ${b.exampleSound}</div>
      </div>`;
  } else if (item.type === 'accents') {
    bodyHtml = `<div class="lesson-item"><p class="gloss">${item.data.text}</p></div>`;
  } else if (item.type === 'diphthong') {
    const d = item.data;
    bodyHtml = `
      <div class="lesson-item">
        <div class="greek-lg">${d.digraph}</div>
        <div class="pron" style="margin-top:14px;">${d.sound}</div>
      </div>`;
  } else if (item.type === 'diphthongNote') {
    bodyHtml = `<div class="lesson-item"><div class="greek-lg">${item.data.digraph}</div><p class="gloss" style="margin-top:14px;">${item.data.text}</p></div>`;
  } else if (item.type === 'word') {
    // The whole word at once — Greek, how to say it, what it means, and how its
    // letters produce that sound. Nothing withheld behind extra taps.
    const w = item.data;
    bodyHtml = `
      <div class="lesson-item">
        <div class="greek-lg">${w.greek}</div>
        <div class="pron pron-lead">${w.pron}</div>
        <div class="gloss gloss-lead">${w.glosses.join(', ')}</div>
        ${breakdownHtml(w.greek)}
        <div class="word-footnote">
          <span class="translit">${w.translit}</span>
          <span class="tag">~${w.freq} in the NT</span>
        </div>
      </div>`;
    nextLabel = 'Next word';
  }

  APP_EL.appendChild(el(`<div class="card">${bodyHtml}</div>`));

  // At the very first item there is nothing to go back to, so Back becomes the way out.
  const atStart = s.index === 0;
  const nav = el(`
    <div class="lesson-nav">
      <button class="btn" id="btn-back">${atStart ? 'Lessons' : 'Back'}</button>
      <button class="btn btn-primary btn-lg" id="btn-next">${nextLabel}</button>
    </div>
  `);
  APP_EL.appendChild(nav);

  document.getElementById('btn-back').addEventListener('click', () => {
    if (atStart) {
      lessonSession = null;
      renderLesson();
      return;
    }
    s.index -= 1;
    renderLessonItem();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    s.index += 1;
    if (s.index >= s.items.length) {
      s.phase = 'check';
      s.checkQuestions = buildCheckQuestions(s, s.items);
      s.checkIndex = 0;
      s.checkCorrect = 0;
    }
    renderLesson();
  });
}

function renderLessonCheck() {
  const s = lessonSession;
  if (s.checkQuestions.length === 0 || s.checkIndex >= s.checkQuestions.length) {
    s.phase = 'done';
    renderLesson();
    return;
  }
  const q = s.checkQuestions[s.checkIndex];
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`<div class="lesson-progress">Quick check · ${s.checkIndex + 1} / ${s.checkQuestions.length}</div>`));
  APP_EL.appendChild(el(`
    <div class="card review-prompt">
      <div class="${q.promptIsGreek ? 'greek-lg' : 'gloss'}">${q.prompt}</div>
    </div>
  `));
  const grid = el('<div class="mc-grid"></div>');
  q.options.forEach((opt, i) => {
    const optEl = el(`<div class="mc-option">${opt}</div>`);
    optEl.addEventListener('click', () => {
      const correct = i === q.correctIndex;
      if (correct) s.checkCorrect += 1;
      Array.from(grid.children).forEach((c, ci) => {
        c.classList.toggle('correct', ci === q.correctIndex);
        if (!correct && ci === i) c.classList.add('incorrect');
      });
      setTimeout(() => {
        s.checkIndex += 1;
        renderLesson();
      }, 700);
    });
    grid.appendChild(optEl);
  });
  APP_EL.appendChild(grid);
}

function renderLessonDone() {
  const s = lessonSession;

  // A replay re-teaches the material but must not advance progress or re-count the
  // lesson. Card creation is idempotent, so nothing is duplicated either way.
  if (!s.replay) {
    if (s.module === 'M1') {
      state.progress.m1Complete = true;
      introduceAlphabetCards();
    }
    if (s.module === 'M2') {
      state.progress.m2Complete = true;
      VOCAB.filter((w) => w.lesson === 1).forEach((w) => introduceWord(w.id));
    }
    if (s.module === 'M3') {
      state.progress.m3Complete = true;
      introduceDiphthongCards();
    }
    if (s.module === 'M4') {
      VOCAB.filter((w) => w.lesson === s.lessonNumber).forEach((w) => introduceWord(w.id));
      // A previewed lesson may be out of order, so only ever move the marker forward.
      state.progress.m4NextLesson = Math.max(state.progress.m4NextLesson, s.lessonNumber + 1);
    }
    state.progress.lessonsCompleted += 1;
  }
  updateStreak();
  saveState();

  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="card" style="text-align:center;">
      <h2>${s.replay ? 'Replay finished' : 'Lesson complete'}</h2>
      <p class="muted">${s.checkCorrect} / ${s.checkQuestions.length || 0} correct on the quick check.</p>
      ${s.replay ? '<p class="faint">Progress and scheduling untouched.</p>' : ''}
      <button class="btn btn-primary btn-block btn-lg" id="btn-home" style="margin-top:10px;">Back to home</button>
    </div>
  `));
  document.getElementById('btn-home').addEventListener('click', () => {
    lessonSession = null;
    navigate('home');
  });
  const more = el('<button class="btn btn-block" style="margin-top:10px;">Choose another lesson</button>');
  APP_EL.appendChild(more);
  more.addEventListener('click', () => {
    lessonSession = null;
    renderLesson();
  });
}

function introduceWord(wordId) {
  if (!state.words[wordId]) state.words[wordId] = { introduced: false, introducedDate: null };
  if (state.words[wordId].introduced) return;
  state.words[wordId].introduced = true;
  state.words[wordId].introducedDate = SRS.todayStr();
  const id = SRS.cardId(wordId, 'decode');
  state.cards[id] = SRS.newCard(wordId, 'decode', SRS.todayStr());
}

// The alphabet and diphthongs are SRS items in their own right, not just implicit
// practice inside vocabulary cards. One card each keeps the daily queue lean — the
// other directions (name→letter, sound→letter) live in uncapped Practice mode.
function introduceAlphabetCards() {
  ALPHABET.forEach((_, i) => {
    const id = SRS.cardId('L' + i, 'letterName');
    if (!state.cards[id]) state.cards[id] = SRS.newCard('L' + i, 'letterName', SRS.todayStr());
  });
}

function introduceDiphthongCards() {
  DIPHTHONGS.forEach((_, i) => {
    const id = SRS.cardId('D' + i, 'diphSound');
    if (!state.cards[id]) state.cards[id] = SRS.newCard('D' + i, 'diphSound', SRS.todayStr());
  });
}

/* ============================== Review ============================== */

let session = null;

function startSession() {
  const queue = SRS.buildQueue(state, SRS.todayStr());
  saveState();
  session = { queue, index: 0, stats: { reviewed: 0, correct: 0 }, phase: queue.length ? 'card' : 'empty' };
}

function renderReview() {
  if (!session) startSession();
  if (session.phase === 'empty') {
    APP_EL.innerHTML = '';
    APP_EL.appendChild(el(`<div class="empty-state"><p>Nothing due right now.</p><button class="btn" id="btn-home">Back home</button></div>`));
    document.getElementById('btn-home').addEventListener('click', () => { session = null; navigate('home'); });
    return;
  }
  if (session.phase === 'card') renderReviewCard();
  else if (session.phase === 'summary') renderReviewSummary();
  else if (session.phase === 'selfcheck') renderSelfCheck();
}

function currentCardMeta() {
  const cardId = session.queue[session.index];
  const [itemKey, type] = cardId.split(':');
  return { cardId, itemKey, type, item: resolveItem(itemKey), card: state.cards[cardId] };
}

function othersIn(pool, excludeIndex, field) {
  return pool.filter((_, i) => i !== excludeIndex).map(field);
}

function renderReviewCard() {
  const { cardId, type, item, card } = currentCardMeta();
  const wasNew = card.reviewsCount === 0;
  const remaining = session.queue.length - session.index;
  const d = item.data;

  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="review-progress">
      <span class="card-type-label">${CARD_TYPE_LABEL[type] || type}</span>
      <span class="faint">${remaining} left</span>
    </div>
  `));

  const promptCard = el('<div class="card review-prompt"></div>');
  let mcOptions = null;
  let correctVal = null;
  let useTypedEnglish = false;
  let useTypedGreek = false;
  let greekTargets = null; // accepted forms for typed Greek; defaults to the word itself

  if (type === 'decode') {
    promptCard.innerHTML = `<div class="greek-lg">${d.greek}</div>`;
    correctVal = d.pron;
    mcOptions = buildMcOptions(correctVal, wordCandidatePool(d.id).map((w) => w.pron));
  } else if (type === 'recognise') {
    promptCard.innerHTML = `<div class="greek-lg">${d.greek}</div>`;
    if (card.reviewsCount < 3) {
      correctVal = d.glosses[0];
      mcOptions = buildMcOptions(correctVal, wordCandidatePool(d.id).map((w) => w.glosses[0]));
    } else {
      useTypedEnglish = true;
    }
  } else if (type === 'produce') {
    promptCard.innerHTML = `<div class="gloss">${d.glosses.join(' / ')}</div>`;
    useTypedGreek = true;
  } else if (type === 'letterName') {
    // Progressive difficulty: the easy paired form for the first three reviews, then
    // a single case, so nothing is tested hard before it has been tested easy.
    const form = card.reviewsCount < 3 ? 'both' : (Math.random() < 0.5 ? 'upper' : 'lower');
    promptCard.innerHTML = `<div class="greek-lg">${letterForm(d, form)}</div>`;
    correctVal = d.name;
    mcOptions = buildMcOptions(correctVal, othersIn(ALPHABET, item.index, (l) => l.name));
  } else if (type === 'letterWrite') {
    // Only the English name — showing the name in Greek (θῆτα) would spell out θ.
    promptCard.innerHTML = `<div class="gloss">${d.name}</div>`;
    useTypedGreek = true;
    greekTargets = letterGlyphs(d);
  } else if (type === 'diphSound') {
    promptCard.innerHTML = `<div class="greek-lg">${d.digraph}</div>`;
    correctVal = d.sound;
    mcOptions = buildMcOptions(correctVal, othersIn(DIPHTHONGS, item.index, (x) => x.sound));
  }

  APP_EL.appendChild(promptCard);

  const answerArea = el('<div id="answer-area"></div>');
  APP_EL.appendChild(answerArea);

  function afterAnswer(isCorrect, userInput) {
    if (wasNew) state.daily.newShown += 1; else state.daily.reviewsShown += 1;
    session.stats.reviewed += 1;
    if (isCorrect) session.stats.correct += 1;
    showAnswerReveal(isCorrect, userInput, item, type, cardId);
  }

  if (mcOptions) {
    const grid = el('<div class="mc-grid"></div>');
    mcOptions.forEach((opt) => {
      const optEl = el(`<div class="mc-option">${escapeHtml(opt)}</div>`);
      optEl.addEventListener('click', () => {
        const isCorrect = opt === correctVal;
        Array.from(grid.children).forEach((c) => { c.style.pointerEvents = 'none'; });
        optEl.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
          Array.from(grid.children).find((c) => c.textContent === correctVal)?.classList.add('correct');
        }
        afterAnswer(isCorrect, opt);
      });
      grid.appendChild(optEl);
    });
    answerArea.appendChild(grid);
  } else if (useTypedEnglish) {
    const input = el(`<input type="text" class="typed-input" placeholder="Type the English meaning" autocomplete="off" autocapitalize="off" spellcheck="false">`);
    const btn = el(`<button class="btn btn-primary btn-block" style="margin-top:10px;">Submit</button>`);
    answerArea.appendChild(input);
    answerArea.appendChild(btn);
    input.focus();
    const submit = () => {
      const isCorrect = SRS.checkEnglishAnswer(input.value, d.glosses);
      btn.disabled = true; input.disabled = true;
      afterAnswer(isCorrect, input.value);
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  } else if (useTypedGreek) {
    const targets = greekTargets || [d.greek];
    const isLetter = type === 'letterWrite';
    const input = el(`<input type="text" class="typed-input greek" placeholder="${isLetter ? 'Type the letter' : 'Type the Greek word'}" autocomplete="off" autocapitalize="off" spellcheck="false">`);
    const btn = el(`<button class="btn btn-primary btn-block" style="margin-top:10px;">Submit</button>`);
    answerArea.appendChild(input);
    const kbWrap = el('<div class="keyboard"></div>');
    answerArea.appendChild(kbWrap);
    answerArea.appendChild(btn);
    attachGreekKeyboard(kbWrap, input);
    input.focus();
    const submit = () => {
      const isCorrect = targets.some((t) => SRS.checkGreekAnswer(input.value, t));
      btn.disabled = true; input.disabled = true;
      afterAnswer(isCorrect, input.value);
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
}

function diffHtml(userStr, correctStr) {
  const u = Array.from(userStr.normalize('NFC'));
  const c = Array.from(correctStr.normalize('NFC'));
  const len = Math.max(u.length, c.length);
  let userHtml = '', correctHtml = '';
  for (let i = 0; i < len; i++) {
    const uc = u[i] || '';
    const cc = c[i] || '';
    const mismatch = uc !== cc;
    userHtml += mismatch ? `<span class="diff-char">${escapeHtml(uc)}</span>` : escapeHtml(uc);
    correctHtml += mismatch ? `<span class="diff-char">${escapeHtml(cc)}</span>` : escapeHtml(cc);
  }
  return { userHtml, correctHtml };
}

// Full detail for the item under review, whatever kind it is.
function itemRevealHtml(item) {
  const d = item.data;
  if (item.kind === 'letter') {
    return `
      <div class="greek-md">${d.upper} ${d.lower}</div>
      <div class="gloss">${d.name}</div>
      <div class="translit">${d.nameGreek}</div>
      <div class="pron">say the name: ${d.namePron}</div>
      <div class="pron" style="margin-top:4px;">sounds like: ${d.sound}</div>`;
  }
  if (item.kind === 'diphthong') {
    return `
      <div class="greek-md">${d.digraph}</div>
      <div class="pron">${d.sound}</div>`;
  }
  return `
    <div class="greek-md">${d.greek}</div>
    <div class="translit">${d.translit}</div>
    <div class="pron">${d.pron}</div>
    <div class="gloss" style="margin-top:6px;">${d.glosses.join(', ')}</div>`;
}

function showAnswerReveal(isCorrect, userInput, item, type, cardId) {
  const answerArea = document.getElementById('answer-area');
  const reveal = el(`<div class="answer-reveal ${isCorrect ? 'correct' : 'incorrect'}"></div>`);

  if (type === 'produce' && !isCorrect) {
    const { userHtml, correctHtml } = diffHtml(userInput || '', item.data.greek);
    reveal.innerHTML = `
      <div class="faint">Not quite</div>
      <div class="diff-compare">
        <div><div class="faint">You wrote</div><div class="greek-md">${userHtml}</div></div>
        <div><div class="faint">Correct</div><div class="greek-md">${correctHtml}</div></div>
      </div>`;
  } else {
    reveal.innerHTML = `
      <div class="faint">${isCorrect ? 'Correct' : 'Correct answer'}</div>
      ${itemRevealHtml(item)}`;
  }
  answerArea.appendChild(reveal);

  if (!isCorrect) {
    const cont = el(`<button class="btn btn-primary btn-block btn-lg" style="margin-top:14px;">Continue</button>`);
    answerArea.appendChild(cont);
    cont.addEventListener('click', () => {
      SRS.gradeCard(state.cards[cardId], 'again', SRS.todayStr());
      requeueCard(cardId);
      advanceSession();
    });
  } else {
    const gradeRow = el(`
      <div class="grade-row">
        <button class="grade-btn grade-again" data-g="again">Again</button>
        <button class="grade-btn grade-hard" data-g="hard">Hard</button>
        <button class="grade-btn grade-good" data-g="good">Good</button>
        <button class="grade-btn grade-easy" data-g="easy">Easy</button>
      </div>
    `);
    answerArea.appendChild(gradeRow);
    gradeRow.querySelectorAll('.grade-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const grade = b.dataset.g;
        SRS.gradeCard(state.cards[cardId], grade, SRS.todayStr());
        if (grade === 'again') requeueCard(cardId);
        advanceSession();
      });
    });
    setTimeout(() => gradeRow.querySelector('.grade-good').focus(), 0);
  }
}

function requeueCard(cardId) {
  const remaining = session.queue.length - session.index - 1;
  const offset = Math.min(6, Math.max(1, remaining));
  session.queue.splice(session.index + 1 + offset, 0, cardId);
}

function advanceSession() {
  SRS.checkUnlocks(state, SRS.todayStr());
  saveState();
  session.index += 1;
  if (session.index >= session.queue.length) session.phase = 'summary';
  renderReview();
}

function renderReviewSummary() {
  updateStreak();
  saveState();
  const s = session.stats;
  const pct = s.reviewed ? Math.round((s.correct / s.reviewed) * 100) : 0;
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="card" style="text-align:center;">
      <h2>Session complete</h2>
      <p class="muted">${s.reviewed} card${s.reviewed === 1 ? '' : 's'} reviewed — ${pct}% correct</p>
      <button class="btn btn-primary btn-block btn-lg" id="btn-continue" style="margin-top:10px;">Continue</button>
    </div>
  `));
  document.getElementById('btn-continue').addEventListener('click', () => {
    session.phase = 'selfcheck';
    session.selfCheck = buildSelfCheckPool();
    renderReview();
  });
}

function buildSelfCheckPool() {
  const introducedIds = Object.keys(state.words).filter((id) => state.words[id].introduced).map(Number);
  const maxInterval = (wordId) => {
    let m = 0;
    ['decode', 'recognise', 'produce'].forEach((t) => {
      const c = state.cards[SRS.cardId(wordId, t)];
      if (c && c.interval > m) m = c.interval;
    });
    return m;
  };
  let mature = introducedIds.filter((id) => maxInterval(id) >= 21);
  if (mature.length < 3) mature = introducedIds.sort((a, b) => maxInterval(b) - maxInterval(a));
  const chosen = shuffle(mature).slice(0, 3);
  return { words: chosen.map((id) => VOCAB_BY_ID[id]), index: 0 };
}

function renderSelfCheck() {
  const sc = session.selfCheck;
  if (!sc || sc.words.length === 0 || sc.index >= sc.words.length) {
    session = null;
    navigate('home');
    return;
  }
  const w = sc.words[sc.index];
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`<div class="lesson-progress">Pronunciation practice · ${sc.index + 1} / ${sc.words.length}</div>`));
  const card = el(`
    <div class="card" style="text-align:center;">
      <p class="faint">Say this word aloud, then reveal.</p>
      <div class="greek-lg">${w.greek}</div>
      <div id="sc-reveal"></div>
    </div>
  `);
  APP_EL.appendChild(card);
  const revealBtn = el(`<button class="btn btn-block btn-lg" style="margin-top:10px;">Reveal</button>`);
  APP_EL.appendChild(revealBtn);
  const skip = el(`<button class="btn btn-block" id="btn-skip-sc" style="margin-top:10px;">Skip practice</button>`);
  APP_EL.appendChild(skip);

  revealBtn.addEventListener('click', () => {
    document.getElementById('sc-reveal').innerHTML = `
      <div class="pron" style="margin-top:10px;">${w.pron}</div>
      <div class="gloss" style="margin-top:6px;">${w.glosses.join(', ')}</div>`;
    revealBtn.remove();
    const row = el(`
      <div class="btn-row" style="margin-top:14px; justify-content:center;">
        <button class="btn" id="sc-got-it">Got it</button>
        <button class="btn" id="sc-not-quite">Not quite</button>
      </div>
    `);
    card.appendChild(row);
    const advanceSc = () => { sc.index += 1; renderReview(); };
    document.getElementById('sc-got-it').addEventListener('click', advanceSc);
    document.getElementById('sc-not-quite').addEventListener('click', advanceSc);
  });
  skip.addEventListener('click', () => { session = null; navigate('home'); });
}

/* ============================== Practice mode ==============================
   Uncapped, exhaustive drilling. Every item in the chosen deck appears exactly once
   per round (shuffled — not sampled), then a follow-up round repeats only what was
   missed, until the sweep comes back clean. Answers feed the SRS through
   SRS.gradePractice, which weights the credit so a long session cannot inflate
   intervals beyond a single review's worth.

   A session is built from four independent choices — deck, scope, direction and
   answer mode — rather than a fixed grid of presets. Direction (which way the
   question runs) and mode (multiple choice or typed) are separate axes, so any
   direction that can reasonably be typed can be drilled that way deliberately. */

let practiceSession = null;

// When on, every gate in the app opens: locked lessons become previewable, all practice
// decks unlock over the full content set, and the reference lists everything.
function unlockAllOn() {
  return !!(state.settings && state.settings.unlockAll);
}

function learnedWords() {
  return VOCAB.filter((w) => state.words[w.id] && state.words[w.id].introduced);
}

const ALPHABET_DIRS = [
  { key: 'letterName', label: 'Letter → name', modes: ['mc', 'typed'] },
  { key: 'nameLetter', label: 'Name → letter', modes: ['mc', 'typed'] },
  { key: 'letterSound', label: 'Letter → sound', modes: ['mc'] },
];

const DIPHTHONG_DIRS = [
  { key: 'diphSound', label: 'Diphthong → sound', modes: ['mc'] },
  { key: 'soundDiph', label: 'Sound → diphthong', modes: ['mc', 'typed'] },
];

const WORD_DIRS = [
  { key: 'recognise', label: 'Greek → meaning', modes: ['mc', 'typed'] },
  { key: 'decode', label: 'Greek → pronunciation', modes: ['mc'] },
  { key: 'produce', label: 'Meaning → Greek', modes: ['mc', 'typed'] },
];

const MIXED_DIR = { key: 'mixed', label: 'Mixed', modes: ['mc', 'typed'] };

const PRACTICE_DECKS = [
  {
    key: 'alphabet',
    label: 'Alphabet',
    dirs: ALPHABET_DIRS,
    available: () => state.progress.m1Complete || unlockAllOn(),
    lockedNote: 'Finish the Alphabet lesson first',
  },
  {
    key: 'diphthongs',
    label: 'Diphthongs',
    dirs: DIPHTHONG_DIRS,
    available: () => state.progress.m3Complete || unlockAllOn(),
    lockedNote: 'Finish the Diphthongs lesson first',
  },
  {
    key: 'words',
    label: 'Words',
    dirs: WORD_DIRS,
    scoped: true,
    available: () => wordsForScope('learned').length >= 2 || unlockAllOn(),
    lockedNote: 'Learn some words first',
  },
  {
    key: 'all',
    label: 'Everything',
    dirs: [],
    mixedOnly: true,
    available: () => state.progress.m1Complete || unlockAllOn(),
    lockedNote: 'Finish the Alphabet lesson first',
  },
];

function deckByKey(key) {
  return PRACTICE_DECKS.find((d) => d.key === key) || PRACTICE_DECKS[0];
}

function deckDirections(deck) {
  if (deck.mixedOnly) return [MIXED_DIR];
  return deck.dirs.concat([MIXED_DIR]);
}

// Which words a scope selects. 'learned' is the default and the only safe one for
// normal use — a numeric scope is a single lesson, 'all' is the whole vocabulary.
function wordsForScope(scope) {
  if (scope === 'all') return VOCAB;
  if (typeof scope === 'number') return VOCAB.filter((w) => w.lesson === scope);
  return VOCAB.filter((w) => state.words[w.id] && state.words[w.id].introduced);
}

// Lessons offered as scopes: any lesson with introduced words, or all when unlocked.
function availableLessonScopes() {
  const out = [];
  for (let n = 1; n <= 10; n++) {
    const words = VOCAB.filter((w) => w.lesson === n);
    if (!words.length) continue;
    const started = words.some((w) => state.words[w.id] && state.words[w.id].introduced);
    if (started || unlockAllOn()) out.push(n);
  }
  return out;
}

function scopeLabel(scope) {
  if (scope === 'all') return `All ${VOCAB.length}`;
  if (typeof scope === 'number') return `Lesson ${scope}`;
  return 'Learned';
}

function pickDir(dir, choices) {
  return dir === 'mixed' ? shuffle(choices)[0] : dir;
}

// Resolve the direction and whether this particular question is typed. A direction that
// cannot sensibly be typed (pronunciation respellings, sound descriptions) falls back
// to multiple choice rather than demanding an unreasonable exact string.
function resolveMode(dirDefs, dirKey, mode) {
  const dir = pickDir(dirKey, dirDefs.map((d) => d.key));
  const def = dirDefs.find((d) => d.key === dir) || dirDefs[0];
  return { dir, typed: mode === 'typed' && def.modes.includes('typed') };
}

function alphabetQuestion(i, dirKey, mode) {
  const l = ALPHABET[i];
  const item = { kind: 'letter', index: i, data: l };
  const cardId = SRS.cardId('L' + i, 'letterName');
  const writeCardId = state.cards[SRS.cardId('L' + i, 'letterWrite')] ? SRS.cardId('L' + i, 'letterWrite') : null;
  const { dir, typed } = resolveMode(ALPHABET_DIRS, dirKey, mode);

  if (dir === 'nameLetter') {
    if (typed) {
      // English name only — the Greek form of the name would spell out the answer.
      return { prompt: l.name, promptClass: 'gloss', typed: true, typedKind: 'greek',
        targets: letterGlyphs(l), correct: primaryLower(l), cardId: writeCardId || cardId, item };
    }
    const form = randomLetterForm();
    const correct = letterForm(l, form);
    return { prompt: l.name, promptClass: 'gloss', greekOptions: true, correct,
      options: buildMcOptions(correct, othersIn(ALPHABET, i, (x) => letterForm(x, form))), cardId, item };
  }

  if (dir === 'letterSound') {
    return { prompt: letterForm(l, randomLetterForm()), promptClass: 'greek-lg', correct: l.sound,
      options: buildMcOptions(l.sound, othersIn(ALPHABET, i, (x) => x.sound)), cardId, item };
  }

  // letterName
  const shown = letterForm(l, randomLetterForm());
  if (typed) {
    return { prompt: shown, promptClass: 'greek-lg', typed: true, typedKind: 'english',
      targets: [l.name], correct: l.name, cardId, item };
  }
  return { prompt: shown, promptClass: 'greek-lg', correct: l.name,
    options: buildMcOptions(l.name, othersIn(ALPHABET, i, (x) => x.name)), cardId, item };
}

function diphthongQuestion(i, dirKey, mode) {
  const dp = DIPHTHONGS[i];
  const item = { kind: 'diphthong', index: i, data: dp };
  const cardId = SRS.cardId('D' + i, 'diphSound');
  const { dir, typed } = resolveMode(DIPHTHONG_DIRS, dirKey, mode);

  if (dir === 'soundDiph') {
    if (typed) {
      return { prompt: dp.sound, promptClass: 'gloss', typed: true, typedKind: 'greek',
        targets: [dp.digraph], correct: dp.digraph, cardId, item };
    }
    return { prompt: dp.sound, promptClass: 'gloss', greekOptions: true, correct: dp.digraph,
      options: buildMcOptions(dp.digraph, othersIn(DIPHTHONGS, i, (x) => x.digraph)), cardId, item };
  }
  return { prompt: dp.digraph, promptClass: 'greek-lg', correct: dp.sound,
    options: buildMcOptions(dp.sound, othersIn(DIPHTHONGS, i, (x) => x.sound)), cardId, item };
}

function wordQuestion(w, dirKey, mode) {
  const item = { kind: 'word', index: w.id, data: w };
  const pool = wordCandidatePool(w.id);
  const { dir, typed } = resolveMode(WORD_DIRS, dirKey, mode);
  // Only grade a card that actually exists — practising ahead of an unlock is free.
  const idFor = (t) => (state.cards[SRS.cardId(w.id, t)] ? SRS.cardId(w.id, t) : null);

  if (dir === 'produce') {
    if (typed) {
      return { prompt: w.glosses.join(' / '), promptClass: 'gloss', typed: true, typedKind: 'greek',
        targets: [w.greek], correct: w.greek, cardId: idFor('produce'), item };
    }
    return { prompt: w.glosses.join(' / '), promptClass: 'gloss', greekOptions: true, correct: w.greek,
      options: buildMcOptions(w.greek, pool.map((x) => x.greek)), cardId: idFor('produce'), item };
  }

  if (dir === 'decode') {
    return { prompt: w.greek, promptClass: 'greek-lg', correct: w.pron,
      options: buildMcOptions(w.pron, pool.map((x) => x.pron)), cardId: idFor('decode'), item };
  }

  // recognise — typed here is the "translate θεός" challenge, accepting any gloss.
  if (typed) {
    return { prompt: w.greek, promptClass: 'greek-lg', typed: true, typedKind: 'english',
      targets: w.glosses, correct: w.glosses[0], cardId: idFor('recognise'), item };
  }
  return { prompt: w.greek, promptClass: 'greek-lg', correct: w.glosses[0],
    options: buildMcOptions(w.glosses[0], pool.map((x) => x.glosses[0])), cardId: idFor('recognise'), item };
}

function alphabetReady() { return state.progress.m1Complete || unlockAllOn(); }
function diphthongsReady() { return state.progress.m3Complete || unlockAllOn(); }

// How many questions a given setup will produce, without generating them.
function practiceItemCount(setup) {
  let n = 0;
  const combined = setup.deckKey === 'all';
  if ((setup.deckKey === 'alphabet' || combined) && alphabetReady()) n += ALPHABET.length;
  if ((setup.deckKey === 'diphthongs' || combined) && diphthongsReady()) n += DIPHTHONGS.length;
  if (setup.deckKey === 'words' || combined) {
    n += wordsForScope(combined ? 'learned' : setup.scope).length;
  }
  return n;
}

// One question per item in the deck — exhaustive by construction, then shuffled.
function buildPracticeQuestions(setup) {
  const qs = [];
  const combined = setup.deckKey === 'all';
  const dirKey = combined ? 'mixed' : setup.dirKey;
  const mode = setup.mode;

  if ((setup.deckKey === 'alphabet' || combined) && alphabetReady()) {
    ALPHABET.forEach((_, i) => qs.push(alphabetQuestion(i, dirKey, mode)));
  }
  if ((setup.deckKey === 'diphthongs' || combined) && diphthongsReady()) {
    DIPHTHONGS.forEach((_, i) => qs.push(diphthongQuestion(i, dirKey, mode)));
  }
  if (setup.deckKey === 'words' || combined) {
    // The combined deck always uses learned words; a 100-word sweep is never implicit.
    wordsForScope(combined ? 'learned' : setup.scope).forEach((w) => qs.push(wordQuestion(w, dirKey, mode)));
  }
  return shuffle(qs);
}

/* ---------- setup screen ---------- */

function defaultPracticeSetup() {
  const firstAvailable = PRACTICE_DECKS.find((d) => d.available()) || PRACTICE_DECKS[0];
  return { deckKey: firstAvailable.key, dirKey: 'mixed', mode: 'mc', scope: 'learned' };
}

function getPracticeSetup() {
  if (!state.settings.practiceSetup) state.settings.practiceSetup = defaultPracticeSetup();
  const setup = state.settings.practiceSetup;
  const deck = deckByKey(setup.deckKey);

  // Repair a stored setup that no longer makes sense (deck relocked, lesson scope gone).
  if (!deck.available()) setup.deckKey = defaultPracticeSetup().deckKey;
  const dirs = deckDirections(deckByKey(setup.deckKey));
  if (!dirs.some((d) => d.key === setup.dirKey)) setup.dirKey = 'mixed';
  if (typeof setup.scope === 'number' && !availableLessonScopes().includes(setup.scope)) setup.scope = 'learned';
  if (setup.mode !== 'mc' && setup.mode !== 'typed') setup.mode = 'mc';
  return setup;
}

function chipRow(label, options, selectedValue, onPick) {
  const wrap = el(`<div class="setup-group"><div class="setup-label">${label}</div><div class="chip-row"></div></div>`);
  const row = wrap.querySelector('.chip-row');
  options.forEach((opt) => {
    const chip = el(`<button type="button" class="chip ${opt.value === selectedValue ? 'selected' : ''}" ${opt.disabled ? 'disabled' : ''}>${opt.label}</button>`);
    if (!opt.disabled) chip.addEventListener('click', () => onPick(opt.value));
    if (opt.hint) chip.title = opt.hint;
    row.appendChild(chip);
  });
  return wrap;
}

function renderPracticeSetup() {
  const setup = getPracticeSetup();
  const deck = deckByKey(setup.deckKey);
  const dirs = deckDirections(deck);
  const dirDef = dirs.find((d) => d.key === setup.dirKey) || MIXED_DIR;
  const typedPossible = dirDef.modes.includes('typed');
  if (!typedPossible) setup.mode = 'mc';

  const update = (patch) => {
    Object.assign(state.settings.practiceSetup, patch);
    saveState();
    renderPracticeSetup();
  };

  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="card">
      <h3 style="margin-bottom:4px;">Practice</h3>
      <p class="faint" style="margin-top:0;">Every item in your selection, once per round, then a round of whatever you missed. No daily cap. Answers count toward your schedule at reduced weight.</p>
    </div>
  `));

  const form = el('<div class="card"></div>');

  form.appendChild(chipRow('Deck', PRACTICE_DECKS.map((d) => ({
    value: d.key,
    label: d.label,
    disabled: !d.available(),
    hint: d.available() ? '' : d.lockedNote,
  })), setup.deckKey, (v) => update({ deckKey: v, dirKey: 'mixed' })));

  if (deck.scoped) {
    const scopes = [{ value: 'learned', label: `Learned (${wordsForScope('learned').length})` }];
    availableLessonScopes().forEach((n) => {
      scopes.push({ value: n, label: `Lesson ${n}` });
    });
    if (unlockAllOn()) scopes.push({ value: 'all', label: `All ${VOCAB.length}` });
    form.appendChild(chipRow('Which words', scopes, setup.scope, (v) => update({ scope: v })));
  }

  if (!deck.mixedOnly) {
    form.appendChild(chipRow('Question', dirs.map((d) => ({ value: d.key, label: d.label })),
      setup.dirKey, (v) => update({ dirKey: v })));
  }

  form.appendChild(chipRow('Answer', [
    { value: 'mc', label: 'Multiple choice' },
    { value: 'typed', label: 'Typed', disabled: !typedPossible, hint: typedPossible ? '' : 'Not suited to typing' },
  ], setup.mode, (v) => update({ mode: v })));

  APP_EL.appendChild(form);

  const count = practiceItemCount(setup);
  const start = el(`<button class="btn btn-primary btn-block btn-lg" ${count === 0 ? 'disabled' : ''}>${count === 0 ? 'Nothing to practise yet' : `Start — ${count} question${count === 1 ? '' : 's'}`}</button>`);
  if (count > 0) {
    start.addEventListener('click', () => {
      const questions = buildPracticeQuestions(setup);
      if (!questions.length) return;
      const scopeNote = deck.scoped ? ` · ${scopeLabel(setup.scope)}` : '';
      practiceSession = {
        deckLabel: deck.label + scopeNote,
        questions, index: 0, round: 1, missed: [], correct: 0, phase: 'question',
      };
      renderPractice();
    });
  }
  APP_EL.appendChild(start);

  if (deck.mixedOnly) {
    APP_EL.appendChild(el(`<p class="faint" style="text-align:center;">Everything mixes the alphabet, diphthongs and your learned words.</p>`));
  }
}

/* ---------- session ---------- */

function renderPractice() {
  if (!practiceSession) { renderPracticeSetup(); return; }
  if (practiceSession.phase === 'question') renderPracticeQuestion();
  else renderPracticeSummary();
}

function checkTypedPractice(q, value) {
  if (q.typedKind === 'english') return SRS.checkEnglishAnswer(value, q.targets);
  return (q.targets || [q.correct]).some((t) => SRS.checkGreekAnswer(value, t));
}

function renderPracticeQuestion() {
  const s = practiceSession;
  const q = s.questions[s.index];
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="review-progress">
      <span class="card-type-label">${s.deckLabel}${s.round > 1 ? ` · missed round ${s.round - 1}` : ''}</span>
      <span class="faint">${s.index + 1} / ${s.questions.length}</span>
    </div>
  `));
  APP_EL.appendChild(el(`<div class="practice-bar"><div class="practice-bar-fill" style="width:${(s.index / s.questions.length) * 100}%"></div></div>`));
  APP_EL.appendChild(el(`
    <div class="card review-prompt">
      <div class="${q.promptClass}">${escapeHtml(q.prompt)}</div>
    </div>
  `));

  const answerArea = el('<div id="answer-area"></div>');
  APP_EL.appendChild(answerArea);

  // Shared by both answer modes: record the result, then either flash on and advance
  // or hold on a miss so the full answer can be read.
  function resolve(isCorrect) {
    if (q.cardId && state.cards[q.cardId]) SRS.gradePractice(state.cards[q.cardId], isCorrect, SRS.todayStr());
    if (isCorrect) s.correct += 1; else s.missed.push(q);
    saveState();
    if (isCorrect) {
      setTimeout(advancePractice, 450);
    } else {
      answerArea.appendChild(el(`<div class="answer-reveal incorrect">${itemRevealHtml(q.item)}</div>`));
      const cont = el('<button class="btn btn-primary btn-block btn-lg" style="margin-top:12px;">Continue</button>');
      answerArea.appendChild(cont);
      cont.addEventListener('click', advancePractice);
    }
  }

  if (q.typed) {
    const greek = q.typedKind === 'greek';
    const placeholder = greek
      ? (q.item.kind === 'letter' ? 'Type the letter' : q.item.kind === 'diphthong' ? 'Type the diphthong' : 'Type the Greek')
      : (q.item.kind === 'letter' ? "Type the letter's name" : 'Type the meaning');
    const input = el(`<input type="text" class="typed-input ${greek ? 'greek' : ''}" placeholder="${placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false">`);
    const btn = el('<button class="btn btn-primary btn-block" style="margin-top:10px;">Submit</button>');
    answerArea.appendChild(input);
    if (greek) {
      const kbWrap = el('<div class="keyboard"></div>');
      answerArea.appendChild(kbWrap);
      attachGreekKeyboard(kbWrap, input);
    }
    answerArea.appendChild(btn);
    input.focus();
    const submit = () => {
      btn.disabled = true; input.disabled = true;
      resolve(checkTypedPractice(q, input.value));
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  } else {
    const grid = el('<div class="mc-grid"></div>');
    q.options.forEach((opt) => {
      const optEl = el(`<div class="mc-option ${q.greekOptions ? 'greek-option' : ''}">${escapeHtml(opt)}</div>`);
      optEl.addEventListener('click', () => {
        const isCorrect = opt === q.correct;
        Array.from(grid.children).forEach((c) => { c.style.pointerEvents = 'none'; });
        optEl.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) Array.from(grid.children).find((c) => c.textContent === q.correct)?.classList.add('correct');
        resolve(isCorrect);
      });
      grid.appendChild(optEl);
    });
    answerArea.appendChild(grid);
  }

  // Kept outside answerArea so the reveal and Continue button land above it on a miss.
  const quit = el('<button class="btn btn-block" style="margin-top:16px;">End practice</button>');
  quit.addEventListener('click', () => { s.phase = 'summary'; renderPractice(); });
  APP_EL.appendChild(quit);
}

function advancePractice() {
  const s = practiceSession;
  if (!s || s.phase !== 'question') return; // ending the session beats a pending auto-advance
  s.index += 1;
  if (s.index >= s.questions.length) s.phase = 'summary';
  updateStreak();
  saveState();
  renderPractice();
}

function renderPracticeSummary() {
  const s = practiceSession;
  const answered = s.index;
  const missedCount = s.missed.length;
  APP_EL.innerHTML = '';
  APP_EL.appendChild(el(`
    <div class="card" style="text-align:center;">
      <h2 style="margin-bottom:4px;">${missedCount === 0 && answered > 0 ? 'Clean sweep' : 'Round complete'}</h2>
      <p class="muted" style="margin-top:0;">${s.correct} / ${answered} correct${missedCount ? ` — ${missedCount} to revisit` : ''}</p>
    </div>
  `));

  if (missedCount > 0) {
    const again = el(`<button class="btn btn-primary btn-block btn-lg">Practise the ${missedCount} you missed</button>`);
    again.addEventListener('click', () => {
      practiceSession = {
        deckLabel: s.deckLabel,
        questions: shuffle(s.missed),
        index: 0,
        round: s.round + 1,
        missed: [],
        correct: 0,
        phase: 'question',
      };
      renderPractice();
    });
    APP_EL.appendChild(again);
  }

  const another = el('<button class="btn btn-block" style="margin-top:10px;">Change practice setup</button>');
  another.addEventListener('click', () => { practiceSession = null; renderPractice(); });
  APP_EL.appendChild(another);

  const home = el('<button class="btn btn-block" style="margin-top:10px;">Back home</button>');
  home.addEventListener('click', () => { practiceSession = null; navigate('home'); });
  APP_EL.appendChild(home);
}

/* ============================== Greek keyboard (§6) ============================== */

const COMBINING = {
  smooth: '̓',
  rough: '̔',
  acute: '́',
  grave: '̀',
  circumflex: '͂',
  subscript: 'ͅ',
};

const KB_LETTERS = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','ς','τ','υ','φ','χ','ψ','ω'];
const VOWELS = ['α','ε','η','ι','ο','υ','ω'];
const SUBSCRIPT_ELIGIBLE = ['α','η','ω'];
const BREATHING_ELIGIBLE = VOWELS.concat(['ρ']);

function composeChar(base, diac) {
  let s = base;
  if (diac.breathing) s += COMBINING[diac.breathing];
  if (diac.accent) s += COMBINING[diac.accent];
  if (diac.subscript) s += COMBINING.subscript;
  return s.normalize('NFC');
}

function decomposeChar(ch) {
  const codes = Array.from(ch.normalize('NFD'));
  const base = codes[0];
  const diac = { breathing: null, accent: null, subscript: false };
  codes.slice(1).forEach((c) => {
    if (c === COMBINING.smooth) diac.breathing = 'smooth';
    else if (c === COMBINING.rough) diac.breathing = 'rough';
    else if (c === COMBINING.acute) diac.accent = 'acute';
    else if (c === COMBINING.grave) diac.accent = 'grave';
    else if (c === COMBINING.circumflex) diac.accent = 'circumflex';
    else if (c === COMBINING.subscript) diac.subscript = true;
  });
  return { base, diac };
}

function verifyComposeRoundTrip() {
  const corpus = VOCAB.map((w) => w.greek).join('');
  const uniqueChars = Array.from(new Set(Array.from(corpus)));
  let checked = 0, failed = 0;
  uniqueChars.forEach((ch) => {
    if (ch.normalize('NFD').length === 1) return; // no diacritics to verify
    checked += 1;
    const { base, diac } = decomposeChar(ch);
    const recomposed = composeChar(base, diac);
    if (recomposed !== ch) {
      failed += 1;
      console.warn('[Textus] compose round-trip mismatch', { ch, base, diac, recomposed });
    }
  });
  console.info(`[Textus] keyboard compose self-check: ${checked - failed}/${checked} decorated characters round-tripped correctly.`);
}

function attachGreekKeyboard(container, input) {
  let lastBase = null;
  let diac = { breathing: null, accent: null, subscript: false };

  container.innerHTML = '';
  const letterRow1 = el('<div class="keyboard-row"></div>');
  const letterRow2 = el('<div class="keyboard-row"></div>');
  const letterRow3 = el('<div class="keyboard-row"></div>');
  const diacRow = el('<div class="keyboard-row"></div>');
  const ctrlRow = el('<div class="keyboard-row"></div>');

  const rows = [letterRow1, letterRow2, letterRow3];
  KB_LETTERS.forEach((ch, i) => {
    const row = rows[Math.floor(i / 9)];
    const key = el(`<button type="button" class="key" data-letter="${ch}">${ch}</button>`);
    key.addEventListener('click', () => {
      input.value += ch;
      lastBase = ch;
      diac = { breathing: null, accent: null, subscript: false };
      updateDiacState();
      input.focus();
    });
    row.appendChild(key);
  });

  const diacDefs = [
    { key: 'smooth', label: '᾿', group: 'breathing' },
    { key: 'rough', label: '῾', group: 'breathing' },
    { key: 'acute', label: '´', group: 'accent' },
    { key: 'grave', label: '`', group: 'accent' },
    { key: 'circumflex', label: '῀', group: 'accent' },
    { key: 'subscript', label: 'ι͙', group: 'subscript' },
  ];
  diacDefs.forEach((d) => {
    const key = el(`<button type="button" class="key diacritic" data-diac="${d.key}">${d.label}</button>`);
    key.addEventListener('click', () => {
      if (!lastBase) return;
      if (d.group === 'subscript') {
        diac.subscript = !diac.subscript;
      } else if (d.group === 'breathing') {
        diac.breathing = diac.breathing === d.key ? null : d.key;
      } else if (d.group === 'accent') {
        diac.accent = diac.accent === d.key ? null : d.key;
      }
      const composed = composeChar(lastBase, diac);
      input.value = input.value.slice(0, -1) + composed;
      updateDiacState();
      input.focus();
    });
    diacRow.appendChild(key);
  });

  const backspaceKey = el('<button type="button" class="key wide">Backspace</button>');
  backspaceKey.addEventListener('click', () => {
    input.value = input.value.slice(0, -1);
    lastBase = null;
    diac = { breathing: null, accent: null, subscript: false };
    updateDiacState();
    input.focus();
  });
  const clearKey = el('<button type="button" class="key wide">Clear</button>');
  clearKey.addEventListener('click', () => {
    input.value = '';
    lastBase = null;
    diac = { breathing: null, accent: null, subscript: false };
    updateDiacState();
    input.focus();
  });
  ctrlRow.appendChild(backspaceKey);
  ctrlRow.appendChild(clearKey);

  container.appendChild(letterRow1);
  container.appendChild(letterRow2);
  container.appendChild(letterRow3);
  container.appendChild(diacRow);
  container.appendChild(ctrlRow);

  function updateDiacState() {
    diacRow.querySelectorAll('.key').forEach((k) => {
      const key = k.dataset.diac;
      const def = diacDefs.find((d) => d.key === key);
      let enabled = false;
      if (def.group === 'breathing') enabled = lastBase && BREATHING_ELIGIBLE.includes(lastBase);
      else if (def.group === 'accent') enabled = lastBase && VOWELS.includes(lastBase);
      else if (def.group === 'subscript') enabled = lastBase && SUBSCRIPT_ELIGIBLE.includes(lastBase);
      k.disabled = !enabled;
      const active = (def.group === 'breathing' && diac.breathing === key) ||
        (def.group === 'accent' && diac.accent === key) ||
        (def.group === 'subscript' && diac.subscript);
      k.classList.toggle('active-diacritic', !!active);
    });
  }
  updateDiacState();

  // Hardware keyboard input: resync tracking to whatever the user actually typed.
  input.addEventListener('input', () => {
    const val = input.value;
    lastBase = val.length ? val.slice(-1) : null;
    diac = { breathing: null, accent: null, subscript: false };
    updateDiacState();
  });
}

/* ============================== Reference ============================== */

let refTab = 'alphabet';

function renderReference() {
  APP_EL.innerHTML = '';
  const tabs = el(`
    <div class="tabs">
      <button class="tab-btn" data-tab="alphabet">Alphabet</button>
      <button class="tab-btn" data-tab="diphthongs">Diphthongs</button>
      <button class="tab-btn" data-tab="marks">Breathing &amp; accents</button>
      <button class="tab-btn" data-tab="words">Words</button>
    </div>
  `);
  tabs.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === refTab);
    b.addEventListener('click', () => { refTab = b.dataset.tab; renderReference(); });
  });
  APP_EL.appendChild(tabs);

  const body = el('<div></div>');
  if (refTab === 'alphabet') body.appendChild(renderAlphabetTable());
  else if (refTab === 'diphthongs') body.appendChild(renderDiphthongTable());
  else if (refTab === 'marks') body.appendChild(renderMarksInfo());
  else body.appendChild(renderWordsList());
  APP_EL.appendChild(body);
}

function renderAlphabetTable() {
  const rows = ALPHABET.map((l) => `
    <tr>
      <td class="greek-md">${l.upper} ${l.lower}</td>
      <td>
        ${l.name}
        <div class="translit" style="font-size:0.95rem;">${l.nameGreek}</div>
        <div class="pron" style="font-size:0.8rem;">${l.namePron}</div>
      </td>
      <td class="faint">${l.sound}</td>
    </tr>`).join('');
  return el(`
    <div class="card">
      <table class="ref-table">
        <thead><tr><th>Letter</th><th>Name</th><th>Sound</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}

function renderDiphthongTable() {
  const rows = DIPHTHONGS.map((d) => `
    <tr><td class="greek-md">${d.digraph}</td><td class="faint">${d.sound}</td></tr>
  `).join('');
  return el(`
    <div class="card">
      <table class="ref-table">
        <thead><tr><th>Diphthong</th><th>Sound</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}

function renderMarksInfo() {
  const rows = BREATHING_MARKS.map((m) => `
    <tr><td class="greek-md">${m.mark}</td><td>${m.name}</td><td class="faint">${m.desc} — e.g. ${m.example} (${m.exampleSound})</td></tr>
  `).join('');
  return el(`
    <div class="card">
      <table class="ref-table">
        <thead><tr><th>Mark</th><th>Name</th><th>Effect</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="faint" style="margin-top:14px;">${ACCENTS_INFO.text}</p>
    </div>
  `);
}

function renderWordsList() {
  const wrap = el('<div></div>');
  const search = el(`<input type="text" class="search-input" placeholder="${unlockAllOn() ? 'Search all words…' : 'Search words learned so far…'}">`);
  wrap.appendChild(search);
  const listEl = el('<div class="card"></div>');
  wrap.appendChild(listEl);

  function renderList(filterText) {
    const learned = unlockAllOn() ? VOCAB : learnedWords();
    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? learned.filter((w) => w.greek.toLowerCase().includes(q) || w.translit.toLowerCase().includes(q) || w.glosses.some((g) => g.toLowerCase().includes(q)))
      : learned;
    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="faint">No words learned yet.</p>`;
      return;
    }
    listEl.innerHTML = filtered.sort((a, b) => a.id - b.id).map((w) => `
      <div class="word-row">
        <div>
          <div class="greek-md">${w.greek}</div>
          <div class="translit">${w.translit}</div>
        </div>
        <div style="text-align:right;">
          <div class="pron">${w.pron}</div>
          <div class="faint">${w.glosses.join(', ')}</div>
        </div>
      </div>
    `).join('');
  }
  renderList('');
  search.addEventListener('input', () => renderList(search.value));
  return wrap;
}

/* ============================== Settings ============================== */

function renderSettings() {
  APP_EL.innerHTML = '';
  const card = el(`
    <div class="card">
      <div class="field-row">
        <span>New cards / day</span>
        <input type="number" id="in-new" min="1" max="100" value="${state.settings.newPerDay}">
      </div>
      <div class="field-row">
        <span>Reviews / day</span>
        <input type="number" id="in-rev" min="1" max="500" value="${state.settings.reviewsPerDay}">
      </div>
      <div class="field-row">
        <div>
          <span>Unlock everything</span>
          <div class="faint">Opens all lessons, every practice deck over the full word list, and the complete reference — for previewing and testing.</div>
        </div>
        <button class="btn ${unlockAllOn() ? 'btn-primary' : ''}" id="in-unlock">${unlockAllOn() ? 'On' : 'Off'}</button>
      </div>
      <div class="field-row">
        <span>Theme</span>
        <button class="btn" id="in-theme">${state.settings.theme === 'light' ? 'Light' : 'Dark'}</button>
      </div>
      <div class="field-row" style="border-bottom:none;">
        <span>Text size</span>
        <div class="font-size-controls">
          <button class="btn" id="font-down" aria-label="Smaller text">A−</button>
          <span class="faint" id="font-pct">${Math.round((state.settings.fontScale || 1) * 100)}%</span>
          <button class="btn" id="font-up" aria-label="Larger text">A+</button>
        </div>
      </div>
      <div class="font-preview">
        <div class="greek-lg">ἄνθρωπος</div>
        <div class="translit">anthrōpos</div>
        <div class="pron">AN-thro-pos</div>
      </div>
    </div>
    <div class="card">
      <div class="field-row" style="border-bottom:none;">
        <span>Version</span>
        <span class="faint">v${APP_VERSION}</span>
      </div>
      <button class="btn btn-block" id="btn-hard-refresh">Clear cached files &amp; reload</button>
      <p class="faint" style="margin-bottom:0;">Forces the newest code to load if the offline cache is serving something stale. Your progress is kept.</p>
    </div>
    <div class="danger-zone">
      <button class="btn btn-danger btn-block" id="btn-reset">Reset all progress</button>
    </div>
  `);
  APP_EL.appendChild(card);

  document.getElementById('in-new').addEventListener('change', (e) => {
    state.settings.newPerDay = Math.max(1, parseInt(e.target.value, 10) || 10);
    saveState();
  });
  document.getElementById('in-rev').addEventListener('change', (e) => {
    state.settings.reviewsPerDay = Math.max(1, parseInt(e.target.value, 10) || 60);
    saveState();
  });
  document.getElementById('in-unlock').addEventListener('click', () => {
    state.settings.unlockAll = !unlockAllOn();
    saveState();
    renderSettings();
  });
  document.getElementById('in-theme').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    saveState();
    applyTheme();
    renderSettings();
  });
  document.getElementById('font-down').addEventListener('click', () => { nudgeFontScale(-1); renderSettings(); });
  document.getElementById('font-up').addEventListener('click', () => { nudgeFontScale(1); renderSettings(); });
  document.getElementById('btn-hard-refresh').addEventListener('click', async () => {
    // Clears the offline file cache only — localStorage progress is untouched.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* fall through to the reload regardless */ }
    location.reload();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      resetAllProgress();
      session = null;
      lessonSession = null;
      navigate('home');
    }
  });
}

/* ============================== Boot ============================== */

document.getElementById('app-version').textContent = 'v' + APP_VERSION;
console.info('[Textus] running version ' + APP_VERSION);
document.getElementById('app-title').addEventListener('click', toggleTitleScript);
applyTitleScript();
applyTheme();
applyFontScale();
verifyComposeRoundTrip();
if (!location.hash) navigate('home');
route();

// Registering with the version in the URL forces the browser to treat each release as a
// service-worker update, so a version bump can never leave stale files being served.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).catch(() => {});
  });
}
