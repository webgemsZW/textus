# Changelog

All notable changes to Textus. The version shown in the app's top bar and in
Settings comes from `version.js`, which also names the service-worker cache — so
every version bump invalidates the offline cache and forces fresh files to load.

Versioning: minor (`1.x.0`) for new features, patch (`1.0.x`) for fixes.
**The major version is only ever incremented on the owner's explicit instruction.**

## [1.5.0] — 2026-08-10

### Fixed
- **Practising words forced all 100 on you.** "Unlock everything" was making the words
  deck *use* the full vocabulary rather than merely making it available, so a practice
  round included words from lessons never taught. The deck now defaults to words you
  have actually learned, and the full list is only ever used when explicitly chosen.
  The combined "Everything" deck always uses learned words only.

### Changed
- **Practice is now configured, not preset.** The old grid of direction buttons made
  typed questions reachable only through specific presets, with "Mixed" as the sole way
  to combine anything. Direction (which way the question runs) and answer mode
  (multiple choice or typed) are now independent axes, chosen separately:

  | Deck | Direction | Multiple choice | Typed |
  |---|---|---|---|
  | Alphabet | Letter → name | ✓ | ✓ |
  | Alphabet | Name → letter | ✓ | ✓ |
  | Alphabet | Letter → sound | ✓ | — |
  | Diphthongs | Diphthong → sound | ✓ | — |
  | Diphthongs | Sound → diphthong | ✓ | ✓ |
  | Words | Greek → meaning | ✓ | ✓ |
  | Words | Greek → pronunciation | ✓ | — |
  | Words | Meaning → Greek | ✓ | ✓ |

  So **Words → Greek → meaning → Typed** is the "translate θεός" challenge, accepting
  any of the word's glosses, case-insensitively, ignoring a leading article. Directions
  whose answers are descriptive prose (pronunciation respellings, sound descriptions)
  offer multiple choice only, rather than demanding an unreasonable exact string.
- **Word practice takes a scope**: words you've learned, a single named lesson, or the
  whole list. Lesson scopes appear once a lesson has been started.
- The combined "Everything" deck now accepts a typed answer mode too — 1.4.0 restricted
  it to multiple choice. Directions that cannot be typed still fall back automatically,
  so a typed sweep of Everything is a genuine mixed challenge rather than an unfair one.
- The chosen setup is remembered between sessions, and is repaired automatically if it
  becomes invalid (a deck relocks, a lesson scope disappears).

### Added
- **The title in the top bar toggles between scripts** — tap to switch Textus ↔ Τέξτους,
  a letter-for-letter transliteration under the conventions the app teaches (x → ξ,
  u → ου). The choice persists.

## [1.4.0] — 2026-08-10

### Changed
- **Word lessons no longer withhold information behind taps.** Introducing a word used
  to require clicking through "Show transliteration", "Show pronunciation", "Show
  meaning" — busywork, not teaching. The whole word now appears at once: Greek largest,
  then how to say it and what it means, with transliteration and NT frequency as a
  subordinate footnote.
- **Words now show a letter-by-letter breakdown**, connecting the alphabet just learned
  to the word on screen (θεός → θ theta · ε epsilon · ό omicron · ς sigma). Vowel pairs
  that form a diphthong are kept together and marked "one sound", so πνεῦμα shows
  `εῦ` as a single unit rather than teaching the wrong pronunciation.
- **"Unlock all lessons" is now "Unlock everything"** and opens every gate: all lessons,
  all practice decks over the full 100-word list, and the complete reference. It also
  opens the *module* gate on Produce cards while still enforcing the interval gate,
  since that is the real retention requirement. Existing settings migrate automatically.
- **Background texture**: a faint manuscript-inspired ground of Greek crosses and
  diamond points over a soft vignette. Inline SVG only — no network requests. Body text
  continues to sit on solid card surfaces, so contrast is unaffected.

### Added
- Practice direction **"Meaning → type Greek"** for words, giving a way to drill typed
  Greek production without waiting for the SRS unlock. The combined "Everything" deck
  stays multiple-choice only so long sweeps remain quick.

### Fixed
- **The typed-letter question gave away its own answer** by displaying the letter's name
  in Greek (θῆτα spells out θ). The prompt now shows only the English name.
- The background texture would have been invisible: `body` carried an opaque background
  that painted over the `z-index: -1` texture layer. The page background now lives on
  `html` alone.

## [1.3.0] — 2026-08-10

### Added
- **Changelog**, maintained alongside every version bump.
- **"Unlock all lessons" setting** (Settings → Learning, default off). When on, every
  lesson is playable regardless of progress, so material can be previewed or tested
  without grinding to it. Previewed lessons still add their words to the SRS, and
  completing one out of order advances progress only forward, never backward.
- **Typed letter recall.** Prompt shows a letter's name ("theta"); you type the Greek
  letter using the on-screen keyboard. Available immediately in Practice as
  "Name → type letter", and as a new `letterWrite` SRS card that unlocks once that
  letter's recognition card reaches a 5-day interval.

### Changed
- **Alphabet cards now vary letter case.** Letters were always shown as a pair
  ("Θ θ"), which let the pair be memorised as one shape. Prompts and multiple-choice
  options now appear as the pair, uppercase alone, or lowercase alone, so each case
  is recognisable on its own. Follows the progressive-difficulty principle: the SRS
  card shows the pair for its first three reviews and single cases thereafter, and all
  four options within a question always share the same case form so shape-matching
  can't be used to cheat. Lessons still introduce letters as a pair.

## [1.2.0] — 2026-08-10

### Added
- **Version badge** in the top bar and Settings, sourced from `version.js`.
- **Lesson picker** replacing the jump-straight-in Lesson tab: all 12 lessons listed
  with Done / Next / Locked status, and a **Replay** button on anything finished.
  Replays teach identical content but advance no progress and change no scheduling.
- **"Clear cached files & reload"** in Settings — unregisters the service worker and
  drops all caches while preserving progress.

### Fixed
- **Stale offline cache.** The service-worker cache name was hardcoded to `textus-v1`,
  so with cache-first serving, updated files could never reach an installed client.
  The cache name is now derived from `APP_VERSION` and the worker registers as
  `sw.js?v=<version>`, forcing a genuine update check per release.
- Lesson completion read the *next* lesson to decide what to mark complete, which
  would have credited the wrong module when replaying.

## [1.1.0] — 2026-08-10

### Added
- **Letter name pronunciations.** Each letter carries its name in Greek and an
  Erasmian respelling of that name (β → beta, βῆτα, *BAY-ta*), consistent with the
  app's own rules — ζῆτα is *DZAY-ta* because ζ is taught as *dz*.
- **Back button** on lesson screens, stepping back through individual reveals rather
  than whole items.
- **Alphabet and diphthongs as first-class SRS items** (24 + 8 cards). Previously only
  vocabulary generated cards, so the alphabet was tested once in its lesson check and
  then never reviewed again.
- **Practice mode** — uncapped, exhaustive drilling of any deck (Alphabet, Diphthongs,
  Words, Everything). Every item appears exactly once per round, shuffled rather than
  sampled, followed by a round of only the items missed, repeating until clean.
- **Weighted practice scoring.** Correct practice answers earn a decaying fraction of
  one review's credit, converging on but never exceeding it, so a long session cannot
  inflate intervals. Wrong answers reset the due date in full but take only a
  half-weight ease penalty. Cards never reviewed cold earn no advance at all.
- **Adaptive new-card throttle.** New cards taper as review load rises — full
  allowance below half load, zero at full load — surfaced on the dashboard rather
  than silently withheld.
- **Text size control** (Settings), six steps from 85% to 175% with a live preview.

### Fixed
- Multiple-choice questions could show two correct-looking options, since several
  words share a gloss (καί, δέ and τε all mean "and"). Options are now de-duplicated.
- Practice: the "End practice" button rendered above the "Continue" button after a
  miss, and ending a session could race the auto-advance timer.

## [1.0.0] — 2026-08-10

Initial build to spec: zero-build-step PWA, offline-capable, installable.

- Modules M1–M4: alphabet, first ten words, diphthongs, and 90 further words in NT
  frequency order, batched into lessons of ten.
- Simplified SM-2 engine with the three-stage Decode → Recognise → Produce card model
  and its interval-gated unlocks.
- On-screen Greek keyboard with stackable, correctly-composing diacritics.
- Review sessions with the end-of-session pronunciation self-check.
- Dashboard, Reference, Settings; dark and light themes.
