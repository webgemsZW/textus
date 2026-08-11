# Textus — Biblical Greek Learning PWA — v1 Build Spec

## 0. Instructions for the builder

Build this as a **zero-build-step, single-page PWA**. No framework, no bundler, no npm install. Plain HTML/CSS/JS so it runs by opening `index.html` or serving the folder statically. The user wants to be using v1 within the hour — prioritise a working app over polish. Do not ask clarifying questions; where this spec is silent, pick the simplest option and proceed.

**File layout:**

```
/index.html
/styles.css
/app.js          — UI, routing, session logic
/srs.js          — spaced repetition engine
/data.js         — all content (alphabet, diphthongs, vocabulary)
/manifest.json
/sw.js           — service worker
/icons/icon-192.png, /icons/icon-512.png
```

Generate the two icons as simple flat-colour PNGs with a Greek letter (α or Ω) on them. No external assets, no CDN dependencies, no network calls at runtime.

---

## 1. Goal & scope

A personal-use app to learn Biblical Greek from zero, using **Erasmian pronunciation**, built around a lesson → spaced-repetition loop.

### Design principles

- **Understanding over translation.** The priority is reading Greek and grasping meaning directly, not producing English translations. Greek→meaning recognition is the core skill and gets the most review weight. English→Greek production is secondary and unlocks last.
- **Maximise Greek on screen.** Greek text is always the largest element. English glosses are visually subordinate (smaller, lighter).
- **Progressive difficulty.** Every skill starts as recognition (multiple choice) and graduates to recall (typed). Nothing is tested in a hard mode before it has been tested in an easy one.
- **Never blocked.** No audio, no network, no accounts. Everything works offline on first load.

### v1 non-goals (do not build)

- Audio of any kind — no recordings, no text-to-speech
- Grammar instruction (cases, declensions, conjugations, parsing)
- Reading passages or sentence-level work
- Accounts, cloud sync, multi-user, notifications
- Any backend

---

## 2. Tech constraints

- **Storage:** `localStorage`, single JSON blob under key `greekAppState`. Write on every state change. Data volume is tiny; IndexedDB is unnecessary.
- **PWA:** `manifest.json` with `display: standalone`, `name` and `short_name` both **"Textus"**, theme colour matching the UI. Service worker uses **cache-first** for all app files, precached on install. App must be installable to home screen on iOS and Android and fully functional offline.
- **Rendering:** Greek must display correctly with polytonic diacritics. Use a font stack with good polytonic coverage and a system fallback — do not load a webfont over the network.
- **Responsive:** designed mobile-first, single column, thumb-reachable controls. Must also work on desktop.
- **Reset:** a "Reset all progress" button in Settings, behind a confirm dialog.

---

## 3. Learning path (module order)

The user progresses through modules in this order. Each unlocks on completion of the previous.

| # | Module | Contents |
|---|--------|----------|
| M1 | **The Alphabet** | 24 letters: form, name, Erasmian sound. Then breathing marks. Then accents & iota subscript. |
| M2 | **First Words** | The 10 core words (§5.3). Includes two diphthongs taught inline as word-specific facts. |
| M3 | **Diphthongs** | All 8 diphthongs, systematised. |
| M4 | **Vocabulary** | Ongoing 10-word lessons in NT frequency order. |

**Note on the M2/M3 ordering:** this is deliberate and must not be "corrected." The user wants real words before the chore of diphthongs. Two of the ten words contain diphthongs (Ἰησοῦς has ου, πνεῦμα has ευ). Teach those two sounds inline in M2 as facts about those specific words — a short interstitial card before the word is introduced — then teach the complete system in M3.

---

## 4. Card model & the SRS engine

### 4.1 Card types

Every vocabulary word generates **three cards**, which unlock sequentially. This is the key mechanic — it prevents 10 new words from meaning 30 new facts at once.

| Stage | Card type | Prompt → Answer | Input mode |
|-------|-----------|-----------------|------------|
| 1 | **Decode** | Greek word → its pronunciation | Multiple choice (4 options) |
| 2 | **Recognise** | Greek word → English meaning | MC (4 options) for first 3 reviews, then typed English |
| 3 | **Produce** | English meaning → Greek word | Typed Greek, full diacritic accuracy required |

**Unlock rules (per word, independently):**
- Decode exists from the moment the word is introduced in its lesson.
- **Recognise** unlocks when that word's Decode card reaches an interval of ≥ 2 days.
- **Produce** unlocks when that word's Recognise card reaches an interval of ≥ 5 days **and** the Diphthongs module (M3) is complete.

Newly unlocked cards enter the queue as new cards, subject to the daily new-card cap.

**Rationale for the thresholds** (do not "optimise" these away — they are tuned against the interval steps in §4.3): on all-Good answers a card's interval runs 1 day → 3 days → ~7.5 days. A threshold of **2 days** therefore triggers at exactly the second successful review, and because the second step is a fixed 3 days regardless of ease, it is deterministic. A threshold of **5 days** triggers at the third successful review, but only if ease has stayed healthy — a word repeatedly graded Hard drops toward ease 1.5, giving 3 × 1.5 = 4.5 days, which falls short and holds the word back for another round. That is intended: struggling words should not be promoted to production. The two gates are asymmetric because Decode is a low-stakes skill that mostly re-tests the alphabet, whereas Recognise is the core skill and Produce should wait on real retention.

### 4.2 The pronunciation self-check

A fourth, non-SRS interaction. At the end of every review session, show 3 random words from the user's mature pool one at a time. The user says each aloud, taps to reveal the phonetic respelling and meaning, and self-rates *Got it* / *Not quite*. This does not affect scheduling — it exists purely as speaking practice. Skippable.

### 4.3 Scheduling algorithm

Implement **SM-2**, simplified:

- Each card stores: `ease` (default 2.5), `interval` (days), `repetitions`, `dueDate`, `stage`, `wordId`.
- Four grades: **Again** (1), **Hard** (2), **Good** (3), **Easy** (4).
- On **Again**: `repetitions = 0`, `interval = 0` (re-show later in the same session, minimum 10 minutes), `ease -= 0.20` (floor 1.3).
- On **Hard**: `interval = max(1, interval × 1.2)`, `ease -= 0.15`.
- On **Good**: `repetitions == 0` → 1 day; `repetitions == 1` → 3 days; else `interval × ease`.
- On **Easy**: as Good but `× 1.3`, and `ease += 0.15`.
- Round intervals up to whole days.

**Grading input:** For multiple-choice and typed cards, a wrong answer is automatically **Again**. A correct answer shows the Again/Hard/Good/Easy buttons so the user can self-rate confidence — default focus on Good.

**Daily limits:** 10 new cards/day, 60 reviews/day (both adjustable in Settings). Cards due are drawn oldest-due-first, interleaving card types rather than grouping them.

### 4.4 Typed answer checking

- **Typed English (Recognise):** case-insensitive, whitespace-trimmed. Accept **any one** of the word's listed glosses. Ignore leading articles ("a", "the").
- **Typed Greek (Produce):** **exact match required, including breathing marks, accents, and final sigma.** Normalise both strings to Unicode NFC before comparing. On a miss, show the user's input and the correct form side by side with the differing characters highlighted.

---

## 5. Content

All of the following goes in `data.js` as plain JS objects.

### 5.1 The alphabet (Erasmian)

| Upper | Lower | Name | Erasmian sound |
|-------|-------|------|----------------|
| Α | α | alpha | *a* as in f**a**ther |
| Β | β | beta | *b* as in **b**at |
| Γ | γ | gamma | hard *g* as in **g**o |
| Δ | δ | delta | *d* as in **d**og |
| Ε | ε | epsilon | short *e* as in m**e**t |
| Ζ | ζ | zeta | *dz* as in a**dz**e |
| Η | η | eta | long *e* as in th**ey** |
| Θ | θ | theta | *th* as in **th**in |
| Ι | ι | iota | *i* as in mach**i**ne (long) / p**i**t (short) |
| Κ | κ | kappa | *k* as in **k**ing |
| Λ | λ | lambda | *l* as in **l**amp |
| Μ | μ | mu | *m* as in **m**an |
| Ν | ν | nu | *n* as in **n**et |
| Ξ | ξ | xi | *x* as in a**x**e |
| Ο | ο | omicron | short *o* as in n**o**t |
| Π | π | pi | *p* as in **p**en |
| Ρ | ρ | rho | trilled *r* |
| Σ | σ ς | sigma | *s* as in **s**it (ς only at word end) |
| Τ | τ | tau | *t* as in **t**op |
| Υ | υ | upsilon | *ü* — French *t**u***, German *ü* |
| Φ | φ | phi | *ph/f* as in **ph**one |
| Χ | χ | chi | *ch* as in Ba**ch** (aspirated k) |
| Ψ | ψ | psi | *ps* as in li**ps** |
| Ω | ω | omega | long *o* as in b**o**ne |

**Breathing marks** (on initial vowels and ρ):
- Smooth ( ᾿ ) — silent, e.g. ἄνθρωπος = *AN-thro-pos*
- Rough ( ῾ ) — adds an *h* sound, e.g. ἁμαρτία = *ha-mar-TEE-a*

**Accents:** acute ( ´ ), grave ( ` ), circumflex ( ῀ ). In Erasmian practice, all three simply mark the **stressed syllable**; pitch distinctions are not observed. **Iota subscript** ( ᾳ ῃ ῳ ) is not pronounced.

### 5.2 Diphthongs (M3)

| Diphthong | Sound |
|-----------|-------|
| αι | *ai* as in **ai**sle |
| ει | *ei* as in v**ei**n |
| οι | *oi* as in **oi**l |
| υι | *ui* — *oo-ee* |
| αυ | *au* as in h**ow** |
| ευ | *eu* — *eh-oo* |
| ηυ | *ēu* — *ay-oo* |
| ου | *ou* as in s**ou**p |

### 5.3 Lesson 1 — the first ten words

This exact set, in this order. Frequencies are approximate NT occurrence counts, for display only.

| # | Greek | Transliteration | Pronunciation | Meaning(s) | ~Freq |
|---|-------|-----------------|---------------|------------|-------|
| 1 | θεός | theos | *theh-OS* | God, god | 1317 |
| 2 | λόγος | logos | *LOH-gos* | word, message, statement | 330 |
| 3 | Ἰησοῦς | Iēsous | *ee-ay-SOOS* | Jesus | 917 |
| 4 | Χριστός | Christos | *khris-TOS* | Christ, Anointed One, Messiah | 529 |
| 5 | κύριος | kyrios | *KÜ-ree-os* | lord, master, Lord | 717 |
| 6 | ἄνθρωπος | anthrōpos | *AN-thro-pos* | man, human being, person | 550 |
| 7 | κόσμος | kosmos | *KOS-mos* | world, universe, humankind | 186 |
| 8 | ζωή | zōē | *dzo-AY* | life | 135 |
| 9 | πνεῦμα | pneuma | *PNEH-oo-ma* | spirit, Spirit, wind, breath | 379 |
| 10 | πατήρ | patēr | *pa-TAYR* | father, Father | 413 |

**Transliteration is a distinct field from pronunciation** and both must be stored per word. Transliteration is a letter-by-letter Latin mapping following standard academic convention: η → ē, ω → ō, υ → y, χ → ch, θ → th, φ → ph, ψ → ps, rough breathing → a leading *h*, smooth breathing → nothing. Pronunciation is the Erasmian respelling showing how to *say* the word, with the stressed syllable in caps.

**Inline diphthong notes** (shown as an interstitial card immediately before words 3 and 9):
- Before Ἰησοῦς: "**ου** is a single sound — *oo*, as in soup."
- Before πνεῦμα: "**ευ** is a single sound — *eh-oo*, said quickly."

### 5.4 Lessons 2+

Generate a further **90 words** in descending NT frequency order, excluding the ten above, batched into lessons of 10. Include high-frequency function words (καί, ὁ, δέ, ἐν, εἰμί, αὐτός, οὐ, ὅτι, εἰς, οὗτος, ἐγώ, ἔχω, λέγω, and so on) alongside common nouns and verbs. Each entry needs: Greek form (with correct diacritics), transliteration per the convention above, phonetic respelling following the Erasmian rules above, one to three English glosses, and approximate frequency.

Structure `data.js` so adding more words later is a matter of appending to an array — no code changes.

---

## 6. The on-screen Greek keyboard

Required for all typed-Greek input, **always visible** on those screens. The user's device keyboard is monotonic-only, so this is the sole reliable input path.

- **Layout:** all 24 lowercase letters plus final sigma (ς), in alphabetical order, in a compact grid.
- **Diacritic row:** buttons for smooth breathing, rough breathing, acute, grave, circumflex, iota subscript.
- **Behaviour:** tapping a diacritic applies it to the **most recently typed character**, combining correctly and outputting the precomposed Unicode form (NFC). Diacritics must be stackable — e.g. ι → rough breathing → circumflex must produce a correctly composed character. Build a lookup table for the composed forms rather than relying on runtime normalisation alone; verify it round-trips for every combination used in the vocabulary set.
- **Controls:** backspace and a clear button.
- The field must also accept input from a hardware/OS keyboard if one is present — do not make the field read-only.

---

## 7. Screens

**Home / Dashboard**
- Cards due today (large, tappable — primary action)
- Current module and next lesson (secondary action)
- Streak, total words learned, lessons completed
- Link to Settings

**Lesson**
- Introduces new material one item at a time, with a *Next* control
- For vocabulary: Greek large, then transliteration, then pronunciation, then meaning, with frequency as a small tag. Transliteration and pronunciation are visually distinguished from each other (e.g. transliteration in italic serif, pronunciation in small caps or monospace) so they are never confused.
- **Transliteration must not appear on the front of a Decode card** — it would give the answer away. It belongs on lesson screens, answer reveals, and the Reference section only.
- Ends with a short check of the just-introduced material, then adds the items to the SRS pool

**Review**
- One card at a time, progress indicator showing remaining count
- Card type indicated subtly (Decode / Recognise / Produce)
- MC: four large tappable options. Typed: input field, plus the Greek keyboard where relevant
- After answering: correct answer shown, then the four grade buttons
- Session summary at the end, followed by the pronunciation self-check (§4.2)

**Reference** (always accessible, never gated)
- Full alphabet table
- Diphthong table
- Breathing marks and accents
- All words learned so far, searchable

**Settings**
- New cards/day, reviews/day
- Reset all progress

---

## 8. Visual design

Clean, calm, readable. High contrast, generous whitespace, large type — this is a reading app and Greek text with diacritics needs room to breathe. Dark mode by default with a light toggle. No decorative imagery. Avoid a gamified, badge-heavy aesthetic; the streak counter is enough.

---

## 9. Build order

Build in this sequence so the app is usable as early as possible:

1. Shell: HTML structure, styles, routing, localStorage state
2. `data.js`: alphabet, diphthongs, the 10 words
3. SRS engine + review screen with MC only
4. M1 alphabet lesson + M2 first-words lesson
5. Greek keyboard + typed cards
6. M3 diphthongs, M4 vocabulary lessons, remaining 90 words
7. Dashboard, Reference, Settings
8. Manifest + service worker + icons

Steps 1–4 constitute a usable app. Ship that, then continue.
