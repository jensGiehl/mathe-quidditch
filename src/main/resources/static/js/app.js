import { QuidditchScene } from './scene.js';
import { FlightAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const elements = {
  app: $('#app'), canvas: $('#game-canvas'), stadium: $('#stadium'),
  start: $('#start-button'), restart: $('#restart-button'), pause: $('#pause-button'), resume: $('#resume-button'), boost: $('#boost-button'),
  welcome: $('#welcome-overlay'), paused: $('#pause-overlay'), result: $('#result-overlay'),
  question: $('#question-card'), questionText: $('#question-text'), questionIndex: $('#question-index'),
  time: $('#time-left'), progress: $('#time-progress'), score: $('#score'), distance: $('#distance'), multiplier: $('#multiplier'),
  reward: $('#reward-announcement'), rewardTitle: $('#reward-title'), rewardSubtitle: $('#reward-subtitle'),
  settings: $('#settings-form'), summary: $('#flight-summary'), leaderboard: $('#leaderboard'),
  highscore: $('#highscore-form'), name: $('#player-name'), save: $('#save-button'), ownRank: $('#own-rank'),
  effects: $('#effects-toggle'), music: $('#music-toggle'), fullscreen: $('#fullscreen-toggle'),
  notification: $('#notification'), announcement: $('#announcement'), caption: $('#scene-caption'),
  lanes: [...document.querySelectorAll('[data-lane]')]
};

function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(`mathe-quidditch.${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch { return fallback; }
}

function writePreference(key, value) {
  try { localStorage.setItem(`mathe-quidditch.${key}`, JSON.stringify(value)); } catch {}
}

const scene = new QuidditchScene(elements.canvas);
const audio = new FlightAudio({ effects: readPreference('effects', true) !== false, music: readPreference('music', false) === true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
scene.setReducedMotion(reducedMotion.matches);
reducedMotion.addEventListener('change', event => scene.setReducedMotion(event.matches));
const numberFormat = new Intl.NumberFormat('de-DE');
const state = {
  snapshot: null, phase: 'lobby', lane: 1, house: 'red', boost: false,
  clockRemaining: 0, clockStarted: performance.now(), rewardDeadline: 0,
  desiredPause: false, pauseSyncing: false, busy: false, starting: false,
  submission: null, nextRetry: 0, seenRewards: new Set(), questionId: null,
  lastAnswers: [], resultAt: 0, resultShown: false, saved: false, visualProgress: 0, visualAnchor: null,
  notificationUntil: 0, lastTimeText: '', generation: 0, leaderboardVersion: 0
};

elements.name.value = readPreference('name', '');

function announce(text) {
  elements.announcement.textContent = text;
}

function notify(text, duration = 6500) {
  elements.notification.textContent = text;
  elements.notification.hidden = false;
  state.notificationUntil = performance.now() + duration;
}

async function request(path, body, method = 'POST') {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      method, signal: controller.signal,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Das Stadion ist gerade nicht erreichbar. Bitte versuche es noch einmal.');
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Die Verbindung zum Stadion ist unterbrochen. Bitte versuche es noch einmal.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function settings() {
  const data = new FormData(elements.settings);
  return {
    operations: data.getAll('operation'), range: Number(data.get('range')) || 100,
    speed: data.get('speed') || 'NORMAL', house: data.get('house') || 'red'
  };
}

function updateSummary() {
  const selected = settings();
  const speeds = { RELAXED: 'Entspanntes Tempo', NORMAL: 'Normales Tempo', FAST: 'Schnelles Tempo' };
  const operations = { ADD: 'Plus', SUBTRACT: 'Minus', MULTIPLY: 'Mal', DIVIDE: 'Geteilt' };
  elements.summary.replaceChildren();
  const parts = [`Bis ${numberFormat.format(selected.range)}`, speeds[selected.speed], selected.operations.length === 4 ? 'Alle Rechenarten' : selected.operations.map(operation => operations[operation]).join(' & ') || 'Wähle eine Rechenart'];
  parts.forEach((part, index) => {
    if (index) {
      const divider = document.createElement('span');
      divider.textContent = '·';
      elements.summary.append(divider);
    }
    elements.summary.append(document.createTextNode(part));
  });
  state.house = selected.house;
  state.house = ['red', 'blue', 'green', 'yellow'].includes(state.house) ? state.house : 'red';
}

function remaining(now = performance.now()) {
  if (state.desiredPause || state.snapshot?.status === 'PAUSED') return state.clockRemaining;
  return Math.max(0, state.clockRemaining - (now - state.clockStarted));
}

function active() {
  return state.snapshot && ['PLAYING', 'REWARD', 'PAUSED'].includes(state.snapshot.status);
}

function recoverMissingGame(error) {
  if (error.status !== 404 && error.status !== 410) return false;
  state.generation += 1;
  state.snapshot = null;
  state.submission = null;
  state.questionId = null;
  state.lastAnswers = [];
  state.desiredPause = false;
  state.seenRewards.clear();
  state.boost = false;
  state.resultAt = 0;
  state.resultShown = false;
  state.saved = false;
  audio.stopEffects();
  elements.score.textContent = '0';
  elements.distance.textContent = '0';
  elements.multiplier.textContent = '× 1';
  elements.questionIndex.textContent = '–';
  setPhase('lobby');
  updateSummary();
  notify('Nach einer längeren Unterbrechung ist dein Flug nicht mehr verfügbar. Starte eine neue Runde.');
  return true;
}

function syncSoundButtons() {
  for (const [button, enabled, name] of [[elements.effects, audio.effectsEnabled, 'Spieleffekte'], [elements.music, audio.musicEnabled, 'Hintergrundmusik']]) {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `${name} ${enabled ? 'ausschalten' : 'einschalten'}`);
    button.classList.toggle('is-off', !enabled);
  }
}

function updateControls() {
  const playing = state.phase === 'playing' && !state.desiredPause && !state.submission;
  elements.lanes.forEach((button, lane) => {
    button.disabled = !playing;
    button.classList.toggle('selected', lane === state.lane);
    button.setAttribute('aria-pressed', String(lane === state.lane));
    const value = state.lastAnswers[lane];
    button.querySelector('strong').textContent = state.snapshot && state.phase !== 'finished' && state.phase !== 'landing' && value !== undefined ? numberFormat.format(value) : ['Links', 'Mitte', 'Rechts'][lane];
    button.setAttribute('aria-label', `${['Linke', 'Mittlere', 'Rechte'][lane]} Flugbahn${value !== undefined && state.phase !== 'lobby' ? `, Antwort ${value}` : ''}`);
  });
  elements.boost.disabled = !playing || state.boost || state.busy;
  elements.boost.classList.toggle('is-boosting', state.boost && playing);
  elements.pause.disabled = !active();
  elements.pause.setAttribute('aria-label', state.phase === 'paused' ? 'Spiel fortsetzen' : 'Spiel pausieren');
  elements.pause.title = state.phase === 'paused' ? 'Weiterfliegen (P)' : 'Pause (P)';
  elements.start.disabled = state.starting;
  elements.restart.disabled = state.starting;
  const lockSettings = active() || state.starting || state.phase === 'landing';
  elements.settings.querySelectorAll('input').forEach(input => { input.disabled = lockSettings; });
  $('.settings-panel').classList.toggle('is-locked', lockSettings);
}

function setPhase(phase) {
  state.phase = phase;
  elements.app.dataset.phase = phase;
  elements.welcome.hidden = phase !== 'lobby';
  elements.paused.hidden = phase !== 'paused';
  elements.result.hidden = phase !== 'finished';
  elements.question.hidden = phase !== 'playing';
  elements.reward.hidden = phase !== 'reward';
  elements.caption.textContent = phase === 'lobby' ? 'DAS GROSSE QUIDDITCH-STADION' : phase === 'finished' ? 'BEREIT FÜR DIE NÄCHSTE RUNDE?' : 'FLUG ZUM HAUSPOKAL';
  scene.setPaused(phase === 'paused' || document.hidden);
  audio.setPaused(phase === 'paused' || document.hidden);
  updateControls();
}

function displayQuestion(question) {
  const text = String(question.text || '').trim();
  elements.questionText.textContent = text.includes('?') ? text : `${text.replace(/\s*=\s*$/, '')} = ?`;
  elements.questionIndex.textContent = numberFormat.format(question.index);
  state.lastAnswers = question.answers;
  state.lastTimeText = '';
  announce(`Aufgabe ${question.index}: ${elements.questionText.textContent} Antworten: ${question.answers.join(', ')}.`);
}

function showResult() {
  const snapshot = state.snapshot;
  if (!snapshot || state.resultShown) return;
  state.resultShown = true;
  elements.highscore.hidden = state.saved;
  elements.ownRank.hidden = !state.saved;
  elements.save.disabled = false;
  $('#result-score').textContent = numberFormat.format(snapshot.score || 0);
  $('#result-distance').textContent = `${numberFormat.format(snapshot.distance || 0)} m`;
  $('#result-correct').textContent = numberFormat.format(snapshot.correctAnswers || 0);
  $('#result-reason').textContent = snapshot.questionText ? 'Dieses Tor war leider nicht das richtige. So geht’s:' : 'Deine Flugzeit ist vorbei. Das nächste Mal schaffst du mehr!';
  $('#result-solution').textContent = snapshot.questionText && snapshot.correctAnswer !== null && snapshot.correctAnswer !== undefined ? `${String(snapshot.questionText).replace(/\s*=\s*\??$/, '')} = ${numberFormat.format(snapshot.correctAnswer)}` : 'Bereit für die nächste Runde?';
  setPhase('finished');
  announce(`Flug beendet. ${snapshot.score} Punkte. ${snapshot.correctAnswers} Aufgaben richtig. ${$('#result-solution').textContent}`);
}

function applySnapshot(snapshot, { boosted = false } = {}) {
  if (state.snapshot && state.snapshot.id !== snapshot.id) return;
  const now = performance.now();
  state.snapshot = snapshot;
  elements.score.replaceChildren(document.createTextNode(numberFormat.format(snapshot.score || 0)));
  const star = document.createElement('span');
  star.className = 'stat-star';
  star.textContent = '✦';
  elements.score.append(star);
  elements.distance.textContent = numberFormat.format(snapshot.distance || 0);
  elements.multiplier.textContent = `× ${numberFormat.format(snapshot.multiplier || 1)}`;
  state.clockRemaining = Math.max(0, snapshot.remainingMs || 0);
  state.clockStarted = now;
  const phase = snapshot.status === 'PAUSED' ? snapshot.phase : snapshot.status;
  if (snapshot.question) {
    if (state.questionId !== snapshot.question.id) {
      state.questionId = snapshot.question.id;
      state.boost = false;
      state.submission = null;
      state.visualAnchor = null;
      state.visualProgress = Math.max(0, Math.min(1, 1 - state.clockRemaining / snapshot.question.durationMs));
      displayQuestion(snapshot.question);
    }
    if (boosted) state.visualAnchor = { progress: state.visualProgress, remaining: Math.max(1, state.clockRemaining) };
  }
  if (phase === 'REWARD') {
    const reward = snapshot.reward;
    const firstReward = reward && !state.seenRewards.has(reward.id);
    if (firstReward) {
      state.seenRewards.add(reward.id);
      state.submission = null;
      scene.reward(reward);
      audio.reward(reward);
      elements.rewardTitle.textContent = reward.milestone ? `${reward.correctCount} richtige! Zauberhaft!` : 'Das Stadion feiert dich!';
      elements.rewardSubtitle.textContent = reward.milestone ? 'Ein großer Zauber für deinen Hauspokal.' : ['Ein goldener Moment für dein Haus.', 'Auf Kurs zum Hauspokal!', 'Schnatz gesichtet. Aufgabe gemeistert.'][snapshot.correctAnswers % 3];
      elements.reward.classList.toggle('milestone', Boolean(reward.milestone));
      announce(elements.rewardTitle.textContent);
    }
    state.rewardDeadline = now + (snapshot.rewardRemainingMs ?? (firstReward ? (reward?.milestone ? 1700 : 1200) : Math.max(0, state.rewardDeadline - now)));
  }
  if (phase === 'FINISHED' || snapshot.status === 'FINISHED') {
    state.submission = null;
    state.desiredPause = false;
    if (!state.resultShown && !state.resultAt) {
      state.resultAt = now + (reducedMotion.matches ? 350 : 850);
      setPhase('landing');
      scene.land();
      audio.stopEffects();
      if (snapshot.correct === false) audio.wrongAnswer();
    }
    return;
  }
  if (state.desiredPause || snapshot.status === 'PAUSED') setPhase('paused');
  else setPhase(phase === 'REWARD' ? 'reward' : 'playing');
}

async function startGame() {
  if (state.starting || state.busy) return;
  const configuration = settings();
  if (!configuration.operations.length) {
    notify('Wähle mindestens eine Rechenart für deinen Flug.');
    elements.settings.querySelector('input').focus();
    return;
  }
  state.starting = true;
  state.generation += 1;
  const generation = state.generation;
  updateControls();
  audio.stopEffects();
  audio.setPaused(false);
  audio.unlock();
  try {
    const snapshot = await request('/api/games', { operations: configuration.operations, range: configuration.range, speed: configuration.speed });
    if (generation !== state.generation) return;
    state.snapshot = null;
    state.seenRewards.clear();
    state.questionId = null;
    state.lastAnswers = [];
    state.resultAt = 0;
    state.resultShown = false;
    state.saved = false;
    state.desiredPause = document.hidden;
    state.submission = null;
    state.lane = 1;
    state.house = configuration.house;
    state.nextRetry = 0;
    elements.notification.hidden = true;
    elements.save.querySelector('span').textContent = 'Eintragen';
    scene.setState({ phase: 'lobby', progress: 0, lane: 1, answers: [], boost: false, house: state.house });
    applySnapshot(snapshot);
    if (window.innerWidth < 992) elements.app.scrollIntoView({ block: 'start', behavior: 'instant' });
  } catch (error) {
    notify(error.message);
  } finally {
    state.starting = false;
    updateControls();
    reconcilePause();
  }
}

async function submitAnswer() {
  if (state.busy || !state.snapshot || state.desiredPause || state.snapshot.status !== 'PLAYING') return;
  if (!state.submission) state.submission = { questionId: state.snapshot.question.id, lane: state.lane, requestId: globalThis.crypto?.randomUUID?.() || `flight-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  const submission = state.submission;
  const gameId = state.snapshot.id;
  state.busy = true;
  updateControls();
  try {
    const snapshot = await request(`/api/games/${encodeURIComponent(gameId)}/answers`, submission);
    if (state.snapshot?.id === gameId) applySnapshot(snapshot);
  } catch (error) {
    state.nextRetry = performance.now() + 1600;
    if (recoverMissingGame(error)) return;
    if (error.status === 409) {
      try {
        const snapshot = await request(`/api/games/${encodeURIComponent(gameId)}`, undefined, 'GET');
        if (state.snapshot?.id === gameId) applySnapshot(snapshot);
      } catch (recoveryError) {
        if (!recoverMissingGame(recoveryError)) notify(recoveryError.message);
      }
    } else {
      notify(`${error.message} Deine Antwort bleibt gespeichert.`, 5000);
    }
  } finally {
    state.busy = false;
    updateControls();
    reconcilePause();
  }
}

async function nextQuestion() {
  if (state.busy || state.desiredPause || state.snapshot?.status !== 'REWARD') return;
  state.busy = true;
  const gameId = state.snapshot.id;
  try {
    const snapshot = await request(`/api/games/${encodeURIComponent(gameId)}/next`, {});
    if (state.snapshot?.id === gameId) applySnapshot(snapshot);
    state.nextRetry = performance.now() + 100;
  } catch (error) {
    state.nextRetry = performance.now() + 1800;
    if (!recoverMissingGame(error)) notify(error.message);
  } finally {
    state.busy = false;
    updateControls();
    reconcilePause();
  }
}

function setPaused(paused) {
  if (!active()) return;
  state.clockRemaining = remaining();
  state.clockStarted = performance.now();
  state.desiredPause = paused || document.hidden;
  if (state.desiredPause) setPhase('paused');
  elements.resume.disabled = !state.desiredPause;
  reconcilePause();
}

async function reconcilePause() {
  if (!active() || state.busy || state.starting || state.pauseSyncing) return;
  const serverPaused = state.snapshot.status === 'PAUSED';
  if (serverPaused === state.desiredPause) return;
  state.pauseSyncing = true;
  state.busy = true;
  const gameId = state.snapshot.id;
  const paused = state.desiredPause;
  try {
    const snapshot = await request(`/api/games/${encodeURIComponent(gameId)}/${paused ? 'pause' : 'resume'}`, {});
    if (state.snapshot?.id === gameId) applySnapshot(snapshot);
  } catch (error) {
    if (!recoverMissingGame(error)) {
      notify(error.message);
      state.desiredPause = true;
      state.nextRetry = performance.now() + 1800;
      setPhase('paused');
    }
  } finally {
    state.busy = false;
    state.pauseSyncing = false;
    elements.resume.disabled = false;
    updateControls();
    if (active() && (state.snapshot.status === 'PAUSED') !== state.desiredPause && performance.now() >= state.nextRetry) reconcilePause();
  }
}

function selectLane(lane) {
  if (state.phase !== 'playing' || state.desiredPause || state.submission) return;
  state.lane = Math.max(0, Math.min(2, lane));
  updateControls();
}

async function boost() {
  if (state.phase !== 'playing' || state.boost || state.desiredPause || state.busy || state.submission) return;
  const gameId = state.snapshot.id;
  state.boost = true;
  state.busy = true;
  audio.boost();
  updateControls();
  try {
    const snapshot = await request(`/api/games/${encodeURIComponent(gameId)}/boost`, {});
    if (state.snapshot?.id === gameId) applySnapshot(snapshot, { boosted: true });
  } catch (error) {
    state.boost = false;
    if (!recoverMissingGame(error)) notify(error.message);
  } finally {
    state.busy = false;
    updateControls();
    reconcilePause();
  }
}

function renderLeaderboard(entries) {
  elements.leaderboard.replaceChildren();
  if (!entries?.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-leaderboard';
    empty.textContent = 'Dein Name könnte hier stehen. Flieg die erste Bestleistung!';
    elements.leaderboard.append(empty);
    return;
  }
  entries.slice(0, 3).forEach((entry, index) => {
    const row = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'rank-number';
    rank.textContent = entry.rank || index + 1;
    const player = document.createElement('span');
    player.className = 'rank-player';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const distance = document.createElement('small');
    distance.textContent = `${numberFormat.format(entry.distance || 0)} m geflogen`;
    player.append(name, distance);
    const score = document.createElement('span');
    score.className = 'rank-score';
    score.textContent = numberFormat.format(entry.score);
    const label = document.createElement('small');
    label.textContent = 'PKT';
    score.append(label);
    row.append(rank, player, score);
    elements.leaderboard.append(row);
  });
}

async function loadHighscores() {
  const version = state.leaderboardVersion;
  try {
    const payload = await request('/api/highscores', undefined, 'GET');
    if (state.leaderboardVersion === version) renderLeaderboard(payload.entries);
  } catch {
    if (state.leaderboardVersion !== version) return;
    const row = document.createElement('li');
    row.className = 'empty-leaderboard';
    row.textContent = 'Die Bestenliste macht eine kurze Flugpause.';
    elements.leaderboard.replaceChildren(row);
  }
}

elements.highscore.addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.snapshot || state.snapshot.status !== 'FINISHED' || state.saved || elements.save.disabled) return;
  const name = elements.name.value.trim();
  if (!name) { elements.name.focus(); return; }
  const gameId = state.snapshot.id;
  const generation = state.generation;
  elements.save.disabled = true;
  elements.save.querySelector('span').textContent = 'Speichert …';
  writePreference('name', name);
  try {
    const result = await request('/api/highscores', { gameId, name });
    state.leaderboardVersion += 1;
    renderLeaderboard(result.entries);
    if (state.snapshot?.id !== gameId || state.generation !== generation) return;
    state.saved = true;
    elements.highscore.hidden = true;
    elements.ownRank.hidden = false;
    elements.ownRank.textContent = `✦ Platz ${numberFormat.format(result.own?.rank || 1)} für ${result.own?.name || name}. Dein Flug ist verewigt!`;
    announce(elements.ownRank.textContent);
  } catch (error) {
    if (state.snapshot?.id !== gameId || state.generation !== generation) return;
    notify(error.message);
    elements.save.disabled = false;
    elements.save.querySelector('span').textContent = 'Eintragen';
  }
});

elements.start.addEventListener('click', startGame);
elements.restart.addEventListener('click', startGame);
elements.pause.addEventListener('click', () => setPaused(state.phase !== 'paused'));
elements.resume.addEventListener('click', () => { audio.unlock(); setPaused(false); });
elements.boost.addEventListener('click', boost);
elements.lanes.forEach(button => button.addEventListener('click', () => selectLane(Number(button.dataset.lane))));
elements.settings.addEventListener('change', updateSummary);
elements.effects.addEventListener('click', () => {
  audio.setEffects(!audio.effectsEnabled);
  audio.unlock();
  writePreference('effects', audio.effectsEnabled);
  syncSoundButtons();
});
elements.music.addEventListener('click', () => {
  audio.setMusic(!audio.musicEnabled);
  writePreference('music', audio.musicEnabled);
  syncSoundButtons();
});
elements.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (elements.app.requestFullscreen) await elements.app.requestFullscreen();
    else notify('Für mehr Platz drehe dein Gerät ins Querformat.');
  } catch { notify('Vollbild ist in diesem Browser gerade nicht verfügbar.'); }
});
document.addEventListener('fullscreenchange', () => {
  elements.fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Vollbild ausschalten' : 'Vollbild einschalten');
  scene.resize();
});
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const key = event.key.toLowerCase();
  if (['p', 'escape'].includes(key) && active()) {
    event.preventDefault();
    setPaused(state.phase !== 'paused');
    return;
  }
  if (state.phase !== 'playing') return;
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) event.preventDefault();
  if (['arrowleft', 'a'].includes(key)) selectLane(state.lane - 1);
  if (['arrowright', 'd'].includes(key)) selectLane(state.lane + 1);
  if (['arrowdown', 's'].includes(key)) selectLane(1);
  if (['arrowup', 'w'].includes(key)) boost();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (active()) setPaused(true);
    scene.setPaused(true);
    audio.setPaused(true);
  } else {
    scene.setPaused(state.phase === 'paused');
    audio.setPaused(state.phase === 'paused');
  }
});
window.addEventListener('pagehide', () => {
  if (active()) fetch(`/api/games/${encodeURIComponent(state.snapshot.id)}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {});
  audio.setPaused(true);
});
if (window.ResizeObserver) new ResizeObserver(() => scene.resize()).observe(elements.stadium);
else window.addEventListener('resize', () => scene.resize());

function frame(now) {
  if (state.notificationUntil && now > state.notificationUntil) {
    elements.notification.hidden = true;
    state.notificationUntil = 0;
  }
  let progress = 0;
  if (state.snapshot?.question) {
    const timeRemaining = remaining(now);
    progress = Math.max(0, Math.min(1, 1 - timeRemaining / state.snapshot.question.durationMs));
    state.visualProgress = state.visualAnchor
      ? Math.max(0, Math.min(1, state.visualAnchor.progress + (1 - state.visualAnchor.progress) * (1 - timeRemaining / state.visualAnchor.remaining)))
      : progress;
    if (state.phase === 'playing') {
      const text = `${(timeRemaining / 1000).toFixed(1).replace('.', ',')} s`;
      if (text !== state.lastTimeText) { elements.time.textContent = text; state.lastTimeText = text; }
      elements.progress.style.transform = `scaleX(${Math.max(0, 1 - progress)})`;
      elements.question.classList.toggle('is-urgent', timeRemaining < 2000);
      if (!state.busy && timeRemaining <= 0 && now >= state.nextRetry) submitAnswer();
    }
  }
  if (state.phase === 'reward' && now >= state.rewardDeadline && now >= state.nextRetry && !state.busy) nextQuestion();
  if (state.phase === 'landing' && now >= state.resultAt) showResult();
  if (state.phase === 'paused' && !state.busy && now >= state.nextRetry && (state.snapshot?.status === 'PAUSED') !== state.desiredPause) reconcilePause();
  scene.setState({ phase: state.phase === 'landing' ? 'finished' : state.phase, progress: state.visualProgress, lane: state.lane, answers: state.phase === 'lobby' ? [] : state.lastAnswers, boost: state.boost, house: state.house });
  window.requestAnimationFrame(frame);
}

updateSummary();
syncSoundButtons();
setPhase('lobby');
loadHighscores();
window.requestAnimationFrame(frame);
