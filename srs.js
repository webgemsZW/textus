// Textus — spaced repetition engine (simplified SM-2). Pure functions over plain state objects.

const SRS = (function () {
  // Fraction of the remaining distance to a full review's credit that ONE correct
  // practice answer earns. Applied repeatedly it converges on 1.0 but never exceeds
  // it, so an unlimited practice session is worth at most a single real review.
  const PRACTICE_WEIGHT = 0.35;
  // Practice is a weak signal of intrinsic difficulty, so ease moves at half rate.
  const PRACTICE_EASE_PENALTY = 0.10;
  const REVIEW_EASE_PENALTY = 0.20;

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Math.round(days));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function isOnOrBefore(dateStr, refStr) {
    return dateStr <= refStr;
  }

  function cardId(itemKey, type) {
    return `${itemKey}:${type}`;
  }

  function newCard(itemKey, type, dueDate) {
    return {
      id: cardId(itemKey, type),
      itemKey: String(itemKey),
      type,
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate,
      reviewsCount: 0,
      lastReviewed: null,
      practiceDate: null,
      practiceCredit: 0,
      practiceBaseInterval: 0,
    };
  }

  // What a single Good review would set the interval to, from a given base.
  function projectedGoodInterval(card, baseInterval) {
    if (card.repetitions === 0) return 1;
    if (card.repetitions === 1) return 3;
    return Math.ceil(baseInterval * card.ease);
  }

  // Mutates and returns the card per the grading rules in spec §4.3.
  function gradeCard(card, grade, nowDateStr) {
    nowDateStr = nowDateStr || todayStr();
    if (grade === 'again') {
      card.repetitions = 0;
      card.interval = 0;
      card.ease = Math.max(1.3, card.ease - REVIEW_EASE_PENALTY);
      card.dueDate = nowDateStr;
    } else if (grade === 'hard') {
      const interval = Math.max(1, card.interval * 1.2);
      card.interval = Math.ceil(interval);
      card.ease = Math.max(1.3, card.ease - 0.15);
      card.repetitions += 1;
      card.dueDate = addDays(nowDateStr, card.interval);
    } else if (grade === 'good' || grade === 'easy') {
      let interval;
      if (card.repetitions === 0) interval = 1;
      else if (card.repetitions === 1) interval = 3;
      else interval = card.interval * card.ease;
      if (grade === 'easy') {
        interval *= 1.3;
        card.ease += 0.15;
      }
      card.interval = Math.ceil(interval);
      card.repetitions += 1;
      card.dueDate = addDays(nowDateStr, card.interval);
    }
    card.reviewsCount += 1;
    card.lastReviewed = nowDateStr;
    // A real review supersedes the day's accumulated practice credit.
    card.practiceCredit = 0;
    card.practiceBaseInterval = card.interval;
    card.practiceDate = nowDateStr;
    return card;
  }

  // Weighted grading for Practice mode (see PRACTICE_WEIGHT above).
  // Correct answers earn decaying partial credit; wrong answers reset the due date in
  // full but only half-penalise ease. Cards never reviewed cold earn no advance at all,
  // so practice cannot let a brand-new card skip its first real review.
  function gradePractice(card, correct, nowDateStr) {
    nowDateStr = nowDateStr || todayStr();

    if (card.practiceDate !== nowDateStr) {
      card.practiceDate = nowDateStr;
      card.practiceCredit = 0;
      card.practiceBaseInterval = card.interval;
    }

    if (!correct) {
      card.repetitions = 0;
      card.interval = 0;
      card.ease = Math.max(1.3, card.ease - PRACTICE_EASE_PENALTY);
      card.dueDate = nowDateStr;
      card.practiceCredit = 0;
      card.practiceBaseInterval = 0;
      return card;
    }

    if (card.reviewsCount === 0) return card; // no credit before a cold review

    const base = card.practiceBaseInterval;
    const target = projectedGoodInterval(card, base);
    card.practiceCredit += PRACTICE_WEIGHT * (1 - card.practiceCredit);
    const advanced = Math.ceil(base + (target - base) * card.practiceCredit);
    card.interval = Math.max(card.interval, advanced);
    card.dueDate = addDays(nowDateStr, card.interval);
    return card;
  }

  // Adaptive new-card throttle: when the day's review load is heavy, introduce fewer
  // new cards so the backlog cannot compound. Full allowance below half load, tapering
  // linearly to zero at full load.
  function newCardAllowance(state, dueReviewCount) {
    const base = state.settings.newPerDay;
    const cap = state.settings.reviewsPerDay;
    if (!cap) return base;
    const load = dueReviewCount / cap;
    let factor;
    if (load <= 0.5) factor = 1;
    else if (load >= 1) factor = 0;
    else factor = (1 - load) / 0.5;
    return Math.max(0, Math.round(base * factor));
  }

  // Create any newly-unlocked vocabulary cards (§4.1 unlock rules). Mutates state.cards.
  function checkUnlocks(state, todayDateStr) {
    todayDateStr = todayDateStr || todayStr();
    const cards = state.cards;
    const introducedWordIds = Object.keys(state.words || {}).filter((id) => state.words[id].introduced);
    for (const wordIdStr of introducedWordIds) {
      const wordId = Number(wordIdStr);
      const decode = cards[cardId(wordId, 'decode')];
      const recogniseId = cardId(wordId, 'recognise');
      if (decode && decode.interval >= 2 && !cards[recogniseId]) {
        cards[recogniseId] = newCard(wordId, 'recognise', todayDateStr);
      }
      const recognise = cards[recogniseId];
      const produceId = cardId(wordId, 'produce');
      // unlockAll opens the module gate for testing; the interval gate still applies,
      // since that is the actual retention requirement.
      const diphthongsDone = state.progress.m3Complete || !!(state.settings && state.settings.unlockAll);
      if (recognise && recognise.interval >= 5 && diphthongsDone && !cards[produceId]) {
        cards[produceId] = newCard(wordId, 'produce', todayDateStr);
      }
    }

    // Typed letter recall graduates from letter recognition, mirroring Produce's gate.
    // Collected first, then added — mutating during the for..in would be unsafe.
    const pending = [];
    for (const id in cards) {
      const c = cards[id];
      if (c.type !== 'letterName' || c.interval < 5) continue;
      const writeId = cardId(c.itemKey, 'letterWrite');
      if (!cards[writeId]) pending.push(newCard(c.itemKey, 'letterWrite', todayDateStr));
    }
    pending.forEach((c) => { cards[c.id] = c; });
  }

  function resetDailyCountersIfNeeded(state, todayDateStr) {
    todayDateStr = todayDateStr || todayStr();
    if (!state.daily || state.daily.date !== todayDateStr) {
      state.daily = { date: todayDateStr, newShown: 0, reviewsShown: 0 };
    }
  }

  function dueCards(state, todayDateStr) {
    const out = [];
    for (const id in state.cards) {
      const c = state.cards[id];
      if (isOnOrBefore(c.dueDate, todayDateStr)) out.push(c);
    }
    return out;
  }

  // Reporting for the dashboard: how many are due, and whether new cards are throttled.
  function getQueueStats(state, todayDateStr) {
    todayDateStr = todayDateStr || todayStr();
    checkUnlocks(state, todayDateStr);
    resetDailyCountersIfNeeded(state, todayDateStr);
    const due = dueCards(state, todayDateStr);
    const dueReviews = due.filter((c) => c.reviewsCount > 0).length;
    const dueNew = due.filter((c) => c.reviewsCount === 0).length;
    const allowance = newCardAllowance(state, dueReviews);
    return {
      dueReviews,
      dueNew,
      newAllowance: allowance,
      throttled: allowance < state.settings.newPerDay && dueNew > 0,
    };
  }

  // Build today's session queue: due cards, oldest-due-first, interleaving card types,
  // respecting the review cap and the adaptive new-card allowance.
  function buildQueue(state, todayDateStr) {
    todayDateStr = todayDateStr || todayStr();
    checkUnlocks(state, todayDateStr);
    resetDailyCountersIfNeeded(state, todayDateStr);

    const due = dueCards(state, todayDateStr);
    const dueReviewCount = due.filter((c) => c.reviewsCount > 0).length;

    let reviewBudget = Math.max(0, state.settings.reviewsPerDay - state.daily.reviewsShown);
    let newBudget = Math.max(0, newCardAllowance(state, dueReviewCount) - state.daily.newShown);

    const byType = {};
    due.forEach((c) => {
      (byType[c.type] = byType[c.type] || []).push(c);
    });
    const types = Object.keys(byType);
    types.forEach((t) => {
      byType[t].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : String(a.itemKey).localeCompare(String(b.itemKey))));
    });

    const queue = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const t of types) {
        const list = byType[t];
        if (!list.length) continue;
        const c = list[0];
        const isNew = c.reviewsCount === 0;
        if (isNew) {
          if (newBudget <= 0) { list.shift(); continue; }
          newBudget -= 1;
        } else {
          if (reviewBudget <= 0) { list.shift(); continue; }
          reviewBudget -= 1;
        }
        queue.push(list.shift().id);
        progressed = true;
      }
    }
    return queue;
  }

  // English typed-answer check (§4.4): case-insensitive, trimmed, any listed gloss, ignore leading article.
  function normalizeEnglish(s) {
    return s.trim().toLowerCase().replace(/^(a|an|the)\s+/, '').replace(/\s+/g, ' ');
  }

  function checkEnglishAnswer(input, glosses) {
    const norm = normalizeEnglish(input);
    return glosses.some((g) => normalizeEnglish(g) === norm);
  }

  // Greek typed-answer check (§4.4): exact match after NFC normalisation.
  function normalizeGreek(s) {
    return s.trim().normalize('NFC');
  }

  function checkGreekAnswer(input, correctGreek) {
    return normalizeGreek(input) === normalizeGreek(correctGreek);
  }

  return {
    PRACTICE_WEIGHT, todayStr, addDays, cardId, newCard, gradeCard, gradePractice,
    projectedGoodInterval, newCardAllowance, checkUnlocks, resetDailyCountersIfNeeded,
    dueCards, getQueueStats, buildQueue, checkEnglishAnswer, checkGreekAnswer,
    normalizeEnglish, normalizeGreek,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = SRS;
}
