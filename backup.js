// Textus — progress backup: export, validate, and merge state across devices.
// Pure functions over plain state objects; no DOM, no storage access.

const Backup = (function () {
  const FORMAT = 'textus-backup';
  const FORMAT_VERSION = 1;

  function summarize(state) {
    const words = Object.keys(state.words || {}).filter((id) => state.words[id].introduced).length;
    const cards = Object.keys(state.cards || {}).length;
    const p = state.progress || {};
    const modules = ['m1Complete', 'm2Complete', 'm3Complete'].filter((k) => p[k]).length;
    return {
      words,
      cards,
      lessonsCompleted: p.lessonsCompleted || 0,
      modulesComplete: modules,
      streak: (state.stats && state.stats.streak) || 0,
    };
  }

  function buildBackup(state, appVersion, nowIso) {
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      appVersion: appVersion,
      exportedAt: nowIso,
      summary: summarize(state),
      state: state,
    };
  }

  function serialize(state, appVersion, nowIso) {
    return JSON.stringify(buildBackup(state, appVersion, nowIso), null, 2);
  }

  // Accepts either a full backup envelope or a bare state object, so a file hand-edited
  // or copied out of devtools still imports. Returns {ok, state, meta} or {ok:false, error}.
  function parseBackup(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: 'Nothing to import — the text is empty.' };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: "That isn't valid JSON. Make sure the whole file was copied." };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'That file does not contain Textus progress.' };
    }

    const envelope = data.format === FORMAT;
    const state = envelope ? data.state : data;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return { ok: false, error: 'That file does not contain Textus progress.' };
    }
    if (envelope && data.formatVersion > FORMAT_VERSION) {
      return { ok: false, error: `That backup was made by a newer version of Textus (format ${data.formatVersion}). Update this device first.` };
    }

    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(state.cards) || !isObj(state.words) || !isObj(state.progress)) {
      return { ok: false, error: 'That file is missing the progress, words or cards section.' };
    }

    // Structural check on every card — a malformed one would break scheduling silently.
    const cardIds = Object.keys(state.cards);
    for (let i = 0; i < cardIds.length; i++) {
      const id = cardIds[i];
      const c = state.cards[id];
      if (!isObj(c) || typeof c.type !== 'string' || typeof c.dueDate !== 'string' ||
          typeof c.interval !== 'number' || typeof c.ease !== 'number') {
        return { ok: false, error: `Card "${id}" is malformed, so the file was not imported.` };
      }
    }

    return {
      ok: true,
      state,
      meta: {
        appVersion: envelope ? data.appVersion : null,
        exportedAt: envelope ? data.exportedAt : null,
        summary: summarize(state),
      },
    };
  }

  // Of two records for the same card, keep whichever reflects more study: most recently
  // reviewed wins, then more reviews, then the longer interval.
  function pickCard(a, b) {
    const at = a.lastReviewed || '';
    const bt = b.lastReviewed || '';
    if (at !== bt) return at > bt ? a : b;
    const ar = a.reviewsCount || 0;
    const br = b.reviewsCount || 0;
    if (ar !== br) return ar > br ? a : b;
    return (a.interval || 0) >= (b.interval || 0) ? a : b;
  }

  function laterDate(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
  }

  // Combine two devices' progress. Settings and today's counters stay local — theme,
  // text size and daily caps belong to the device you're holding, not the backup.
  function mergeStates(local, incoming) {
    const out = JSON.parse(JSON.stringify(local));
    out.words = out.words || {};
    out.cards = out.cards || {};

    Object.keys(incoming.words || {}).forEach((id) => {
      const inc = incoming.words[id];
      const loc = out.words[id];
      if (!loc) { out.words[id] = JSON.parse(JSON.stringify(inc)); return; }
      if (inc.introduced && !loc.introduced) loc.introduced = true;
      // Keep the earliest introduction date — that's when the word was really first met.
      if (inc.introducedDate && (!loc.introducedDate || inc.introducedDate < loc.introducedDate)) {
        loc.introducedDate = inc.introducedDate;
      }
    });

    Object.keys(incoming.cards || {}).forEach((id) => {
      const inc = incoming.cards[id];
      const loc = out.cards[id];
      out.cards[id] = loc ? JSON.parse(JSON.stringify(pickCard(loc, inc))) : JSON.parse(JSON.stringify(inc));
    });

    const lp = local.progress || {};
    const ip = incoming.progress || {};
    out.progress = {
      m1Complete: !!(lp.m1Complete || ip.m1Complete),
      m2Complete: !!(lp.m2Complete || ip.m2Complete),
      m3Complete: !!(lp.m3Complete || ip.m3Complete),
      m4NextLesson: Math.max(lp.m4NextLesson || 2, ip.m4NextLesson || 2),
      lessonsCompleted: Math.max(lp.lessonsCompleted || 0, ip.lessonsCompleted || 0),
    };

    const ls = local.stats || {};
    const is = incoming.stats || {};
    out.stats = {
      streak: Math.max(ls.streak || 0, is.streak || 0),
      lastStudyDate: laterDate(ls.lastStudyDate, is.lastStudyDate),
    };

    return out;
  }

  // What an import would change, for showing before it is applied.
  function diffSummary(local, incoming, mode) {
    const before = summarize(local);
    const after = summarize(mode === 'merge' ? mergeStates(local, incoming) : incoming);
    return { before, after };
  }

  return {
    FORMAT, FORMAT_VERSION,
    summarize, buildBackup, serialize, parseBackup, mergeStates, pickCard, diffSummary,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = Backup;
}
