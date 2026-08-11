// Textus — all learning content. Pure data, no logic.
// Appending more words to VOCAB later requires no code changes elsewhere.

// namePron = how to say the letter's NAME, respelled under the same Erasmian rules
// the app teaches (η = ay, υ = ü, ζ = dz, ξ = ks, αυ = ow, ι = ee), so the names are
// themselves consistent practice. nameGreek = the name as actually written in Greek.
const ALPHABET = [
  { upper: 'Α', lower: 'α', name: 'alpha',   nameGreek: 'ἄλφα',     namePron: 'AL-fa',      sound: 'a as in father' },
  { upper: 'Β', lower: 'β', name: 'beta',    nameGreek: 'βῆτα',     namePron: 'BAY-ta',     sound: 'b as in bat' },
  { upper: 'Γ', lower: 'γ', name: 'gamma',   nameGreek: 'γάμμα',    namePron: 'GAM-ma',     sound: 'hard g as in go' },
  { upper: 'Δ', lower: 'δ', name: 'delta',   nameGreek: 'δέλτα',    namePron: 'DEL-ta',     sound: 'd as in dog' },
  { upper: 'Ε', lower: 'ε', name: 'epsilon', nameGreek: 'ἒ ψιλόν',  namePron: 'EP-si-lon',  sound: 'short e as in met' },
  { upper: 'Ζ', lower: 'ζ', name: 'zeta',    nameGreek: 'ζῆτα',     namePron: 'DZAY-ta',    sound: 'dz as in adze' },
  { upper: 'Η', lower: 'η', name: 'eta',     nameGreek: 'ἦτα',      namePron: 'AY-ta',      sound: 'long e as in they' },
  { upper: 'Θ', lower: 'θ', name: 'theta',   nameGreek: 'θῆτα',     namePron: 'THAY-ta',    sound: 'th as in thin' },
  { upper: 'Ι', lower: 'ι', name: 'iota',    nameGreek: 'ἰῶτα',     namePron: 'ee-OH-ta',   sound: 'i as in machine (long) / pit (short)' },
  { upper: 'Κ', lower: 'κ', name: 'kappa',   nameGreek: 'κάππα',    namePron: 'KAP-pa',     sound: 'k as in king' },
  { upper: 'Λ', lower: 'λ', name: 'lambda',  nameGreek: 'λάμβδα',   namePron: 'LAM-bda',    sound: 'l as in lamp' },
  { upper: 'Μ', lower: 'μ', name: 'mu',      nameGreek: 'μῦ',       namePron: 'MÜ',         sound: 'm as in man' },
  { upper: 'Ν', lower: 'ν', name: 'nu',      nameGreek: 'νῦ',       namePron: 'NÜ',         sound: 'n as in net' },
  { upper: 'Ξ', lower: 'ξ', name: 'xi',      nameGreek: 'ξῖ',       namePron: 'KSEE',       sound: 'x as in axe' },
  { upper: 'Ο', lower: 'ο', name: 'omicron', nameGreek: 'ὂ μικρόν', namePron: 'O-mi-kron',  sound: 'short o as in not' },
  { upper: 'Π', lower: 'π', name: 'pi',      nameGreek: 'πῖ',       namePron: 'PEE',        sound: 'p as in pen' },
  { upper: 'Ρ', lower: 'ρ', name: 'rho',     nameGreek: 'ῥῶ',       namePron: 'ROH',        sound: 'trilled r' },
  { upper: 'Σ', lower: 'σ ς', name: 'sigma', nameGreek: 'σῖγμα',    namePron: 'SEEG-ma',    sound: 's as in sit (ς only at word end)' },
  { upper: 'Τ', lower: 'τ', name: 'tau',     nameGreek: 'ταῦ',      namePron: 'TOW',        sound: 't as in top' },
  { upper: 'Υ', lower: 'υ', name: 'upsilon', nameGreek: 'ὖ ψιλόν',  namePron: 'Ü-psi-lon',  sound: 'ü — French tu, German ü' },
  { upper: 'Φ', lower: 'φ', name: 'phi',     nameGreek: 'φῖ',       namePron: 'FEE',        sound: 'ph/f as in phone' },
  { upper: 'Χ', lower: 'χ', name: 'chi',     nameGreek: 'χῖ',       namePron: 'KHEE',       sound: 'ch as in Bach (aspirated k)' },
  { upper: 'Ψ', lower: 'ψ', name: 'psi',     nameGreek: 'ψῖ',       namePron: 'PSEE',       sound: 'ps as in lips' },
  { upper: 'Ω', lower: 'ω', name: 'omega',   nameGreek: 'ὦ μέγα',   namePron: 'OH-me-ga',   sound: 'long o as in bone' },
];

const BREATHING_MARKS = [
  { mark: '᾿', name: 'smooth', desc: 'silent', example: 'ἄνθρωπος', exampleSound: 'AN-thro-pos' },
  { mark: '῾', name: 'rough', desc: 'adds an h sound', example: 'ἁμαρτία', exampleSound: 'ha-mar-TEE-a' },
];

const ACCENTS_INFO = {
  text: 'Acute (´), grave (`), and circumflex (῀) simply mark the stressed syllable in Erasmian practice — pitch distinctions are not observed. Iota subscript (ᾳ ῃ ῳ) is not pronounced.',
};

const DIPHTHONGS = [
  { digraph: 'αι', sound: 'ai as in aisle' },
  { digraph: 'ει', sound: 'ei as in vein' },
  { digraph: 'οι', sound: 'oi as in oil' },
  { digraph: 'υι', sound: 'ui — oo-ee' },
  { digraph: 'αυ', sound: 'au as in how' },
  { digraph: 'ευ', sound: 'eu — eh-oo' },
  { digraph: 'ηυ', sound: 'ēu — ay-oo' },
  { digraph: 'ου', sound: 'ou as in soup' },
];

// Inline diphthong facts taught in M2, before specific words (see spec §3, §5.3).
const INLINE_DIPHTHONG_NOTES = {
  3: { digraph: 'ου', text: 'ου is a single sound — oo, as in soup.' },
  9: { digraph: 'ευ', text: 'ευ is a single sound — eh-oo, said quickly.' },
};

// lesson 1 = the first ten words (M2). lessons 2-10 = M4 vocabulary batches of 10.
const VOCAB = [
  { id: 1,  greek: 'θεός',      translit: 'theos',      pron: 'theh-OS',        glosses: ['God', 'god'], freq: 1317, lesson: 1 },
  { id: 2,  greek: 'λόγος',     translit: 'logos',      pron: 'LOH-gos',        glosses: ['word', 'message', 'statement'], freq: 330, lesson: 1 },
  { id: 3,  greek: 'Ἰησοῦς',    translit: 'Iēsous',     pron: 'ee-ay-SOOS',     glosses: ['Jesus'], freq: 917, lesson: 1 },
  { id: 4,  greek: 'Χριστός',   translit: 'Christos',   pron: 'khris-TOS',      glosses: ['Christ', 'Anointed One', 'Messiah'], freq: 529, lesson: 1 },
  { id: 5,  greek: 'κύριος',    translit: 'kyrios',     pron: 'KÜ-ree-os',      glosses: ['lord', 'master', 'Lord'], freq: 717, lesson: 1 },
  { id: 6,  greek: 'ἄνθρωπος',  translit: 'anthrōpos',  pron: 'AN-thro-pos',    glosses: ['man', 'human being', 'person'], freq: 550, lesson: 1 },
  { id: 7,  greek: 'κόσμος',    translit: 'kosmos',     pron: 'KOS-mos',        glosses: ['world', 'universe', 'humankind'], freq: 186, lesson: 1 },
  { id: 8,  greek: 'ζωή',       translit: 'zōē',        pron: 'dzo-AY',         glosses: ['life'], freq: 135, lesson: 1 },
  { id: 9,  greek: 'πνεῦμα',    translit: 'pneuma',     pron: 'PNEH-oo-ma',     glosses: ['spirit', 'Spirit', 'wind', 'breath'], freq: 379, lesson: 1 },
  { id: 10, greek: 'πατήρ',     translit: 'patēr',      pron: 'pa-TAYR',        glosses: ['father', 'Father'], freq: 413, lesson: 1 },

  { id: 11, greek: 'ὁ',          translit: 'ho',           pron: 'HO',              glosses: ['the'], freq: 19867, lesson: 2 },
  { id: 12, greek: 'καί',        translit: 'kai',          pron: 'KAI',             glosses: ['and', 'also', 'even'], freq: 9153, lesson: 2 },
  { id: 13, greek: 'αὐτός',      translit: 'autos',        pron: 'ow-TOS',          glosses: ['he', 'she', 'it', 'self'], freq: 5595, lesson: 2 },
  { id: 14, greek: 'δέ',         translit: 'de',           pron: 'DEH',             glosses: ['but', 'and', 'now'], freq: 2792, lesson: 2 },
  { id: 15, greek: 'ἐν',         translit: 'en',           pron: 'EN',              glosses: ['in', 'on', 'among'], freq: 2752, lesson: 2 },
  { id: 16, greek: 'εἰμί',       translit: 'eimi',         pron: 'ay-MEE',          glosses: ['to be', 'exist'], freq: 2462, lesson: 2 },
  { id: 17, greek: 'λέγω',       translit: 'legō',         pron: 'LEH-go',          glosses: ['I say', 'I speak'], freq: 2354, lesson: 2 },
  { id: 18, greek: 'εἰς',        translit: 'eis',          pron: 'AYS',             glosses: ['into', 'to'], freq: 1767, lesson: 2 },
  { id: 19, greek: 'ἐγώ',        translit: 'egō',          pron: 'eh-GO',           glosses: ['I'], freq: 1725, lesson: 2 },
  { id: 20, greek: 'οὐ',         translit: 'ou',           pron: 'OO',              glosses: ['not'], freq: 1606, lesson: 2 },

  { id: 21, greek: 'οὗτος',      translit: 'houtos',       pron: 'HOO-tos',         glosses: ['this'], freq: 1388, lesson: 3 },
  { id: 22, greek: 'ὅς',         translit: 'hos',          pron: 'HOS',             glosses: ['who', 'which'], freq: 1365, lesson: 3 },
  { id: 23, greek: 'ὅτι',        translit: 'hoti',         pron: 'HO-tee',          glosses: ['that', 'because'], freq: 1296, lesson: 3 },
  { id: 24, greek: 'πᾶς',        translit: 'pas',          pron: 'PAS',             glosses: ['all', 'every'], freq: 1243, lesson: 3 },
  { id: 25, greek: 'σύ',         translit: 'sy',           pron: 'SÜ',              glosses: ['you'], freq: 1067, lesson: 3 },
  { id: 26, greek: 'μή',         translit: 'mē',           pron: 'MAY',             glosses: ['not'], freq: 1042, lesson: 3 },
  { id: 27, greek: 'γάρ',        translit: 'gar',          pron: 'GAR',             glosses: ['for'], freq: 1041, lesson: 3 },
  { id: 28, greek: 'ἐκ',         translit: 'ek',           pron: 'EK',              glosses: ['out of', 'from'], freq: 914, lesson: 3 },
  { id: 29, greek: 'ἐπί',        translit: 'epi',          pron: 'eh-PEE',          glosses: ['on', 'upon', 'over'], freq: 890, lesson: 3 },
  { id: 30, greek: 'ἔχω',        translit: 'echō',         pron: 'EH-kho',          glosses: ['I have', 'I hold'], freq: 708, lesson: 3 },

  { id: 31, greek: 'πρός',       translit: 'pros',         pron: 'PROS',            glosses: ['to', 'toward', 'with'], freq: 700, lesson: 4 },
  { id: 32, greek: 'γίνομαι',    translit: 'ginomai',      pron: 'GEE-no-mai',      glosses: ['I become', 'I happen'], freq: 669, lesson: 4 },
  { id: 33, greek: 'διά',        translit: 'dia',          pron: 'dee-AH',          glosses: ['through', 'because of'], freq: 667, lesson: 4 },
  { id: 34, greek: 'ἵνα',        translit: 'hina',         pron: 'HEE-na',          glosses: ['in order that', 'that'], freq: 663, lesson: 4 },
  { id: 35, greek: 'ἀπό',        translit: 'apo',          pron: 'a-PO',            glosses: ['from', 'away from'], freq: 646, lesson: 4 },
  { id: 36, greek: 'ἀλλά',       translit: 'alla',         pron: 'a-LA',            glosses: ['but'], freq: 638, lesson: 4 },
  { id: 37, greek: 'ἔρχομαι',    translit: 'erchomai',     pron: 'ER-kho-mai',      glosses: ['I come', 'I go'], freq: 632, lesson: 4 },
  { id: 38, greek: 'ποιέω',      translit: 'poieō',        pron: 'poy-EH-o',        glosses: ['I do', 'I make'], freq: 568, lesson: 4 },
  { id: 39, greek: 'ὡς',         translit: 'hōs',          pron: 'HOS',             glosses: ['as', 'like', 'when'], freq: 504, lesson: 4 },
  { id: 40, greek: 'κατά',       translit: 'kata',         pron: 'ka-TA',           glosses: ['according to', 'down'], freq: 473, lesson: 4 },

  { id: 41, greek: 'μετά',       translit: 'meta',         pron: 'meh-TA',          glosses: ['with', 'after'], freq: 469, lesson: 5 },
  { id: 42, greek: 'ἀκούω',      translit: 'akouō',        pron: 'a-KOO-o',         glosses: ['I hear', 'I listen'], freq: 428, lesson: 5 },
  { id: 43, greek: 'δίδωμι',     translit: 'didōmi',       pron: 'DEE-do-mi',       glosses: ['I give'], freq: 415, lesson: 5 },
  { id: 44, greek: 'ἡμέρα',      translit: 'hēmera',       pron: 'hay-MEH-ra',      glosses: ['day'], freq: 389, lesson: 5 },
  { id: 45, greek: 'υἱός',       translit: 'huios',        pron: 'hwee-OS',         glosses: ['son'], freq: 377, lesson: 5 },
  { id: 46, greek: 'εἷς',        translit: 'heis',         pron: 'HAYS',            glosses: ['one'], freq: 344, lesson: 5 },
  { id: 47, greek: 'ἀδελφός',    translit: 'adelphos',     pron: 'a-del-FOS',       glosses: ['brother'], freq: 343, lesson: 5 },
  { id: 48, greek: 'περί',       translit: 'peri',         pron: 'peh-REE',         glosses: ['concerning', 'about'], freq: 333, lesson: 5 },
  { id: 49, greek: 'οἶδα',       translit: 'oida',         pron: 'OY-da',           glosses: ['I know'], freq: 318, lesson: 5 },
  { id: 50, greek: 'οὐρανός',    translit: 'ouranos',      pron: 'oo-ra-NOS',       glosses: ['heaven', 'sky'], freq: 273, lesson: 5 },

  { id: 51, greek: 'μαθητής',    translit: 'mathētēs',     pron: 'ma-thay-TAYS',    glosses: ['disciple'], freq: 261, lesson: 6 },
  { id: 52, greek: 'λαμβάνω',    translit: 'lambanō',      pron: 'lam-BA-no',       glosses: ['I take', 'I receive'], freq: 258, lesson: 6 },
  { id: 53, greek: 'γῆ',         translit: 'gē',           pron: 'GAY',             glosses: ['earth', 'land'], freq: 250, lesson: 6 },
  { id: 54, greek: 'πίστις',     translit: 'pistis',       pron: 'PIS-tis',         glosses: ['faith'], freq: 243, lesson: 6 },
  { id: 55, greek: 'πιστεύω',    translit: 'pisteuō',      pron: 'pis-TEH-oo-o',    glosses: ['I believe', 'I trust'], freq: 241, lesson: 6 },
  { id: 56, greek: 'ἀποκρίνομαι',translit: 'apokrinomai',  pron: 'a-po-KREE-no-mai',glosses: ['I answer'], freq: 231, lesson: 6 },
  { id: 57, greek: 'ὄνομα',      translit: 'onoma',        pron: 'O-no-ma',         glosses: ['name'], freq: 231, lesson: 6 },
  { id: 58, greek: 'γινώσκω',    translit: 'ginōskō',      pron: 'gee-NOH-sko',     glosses: ['I know', 'I come to know'], freq: 222, lesson: 6 },
  { id: 59, greek: 'ὑπό',        translit: 'hypo',         pron: 'hü-PO',           glosses: ['by', 'under'], freq: 220, lesson: 6 },
  { id: 60, greek: 'τε',         translit: 'te',           pron: 'TEH',             glosses: ['and', 'both'], freq: 215, lesson: 6 },

  { id: 61, greek: 'γυνή',       translit: 'gynē',         pron: 'gü-NAY',          glosses: ['woman', 'wife'], freq: 215, lesson: 7 },
  { id: 62, greek: 'δύναμαι',    translit: 'dynamai',      pron: 'DÜ-na-mai',       glosses: ['I am able', 'I can'], freq: 210, lesson: 7 },
  { id: 63, greek: 'θέλω',       translit: 'thelō',        pron: 'THEH-lo',         glosses: ['I wish', 'I want'], freq: 208, lesson: 7 },
  { id: 64, greek: 'νόμος',      translit: 'nomos',        pron: 'NO-mos',          glosses: ['law'], freq: 194, lesson: 7 },
  { id: 65, greek: 'γράφω',      translit: 'graphō',       pron: 'GRA-fo',          glosses: ['I write'], freq: 191, lesson: 7 },
  { id: 66, greek: 'χείρ',       translit: 'cheir',        pron: 'KHAYR',           glosses: ['hand'], freq: 177, lesson: 7 },
  { id: 67, greek: 'εὑρίσκω',    translit: 'heuriskō',     pron: 'heh-oo-RIS-ko',   glosses: ['I find'], freq: 176, lesson: 7 },
  { id: 68, greek: 'ὄχλος',      translit: 'ochlos',       pron: 'OKH-los',         glosses: ['crowd'], freq: 175, lesson: 7 },
  { id: 69, greek: 'ἁμαρτία',    translit: 'hamartia',     pron: 'ha-mar-TEE-a',    glosses: ['sin'], freq: 173, lesson: 7 },
  { id: 70, greek: 'ἔργον',      translit: 'ergon',        pron: 'ER-gon',          glosses: ['work', 'deed'], freq: 169, lesson: 7 },

  { id: 71, greek: 'δόξα',       translit: 'doxa',         pron: 'DOK-sa',          glosses: ['glory'], freq: 166, lesson: 8 },
  { id: 72, greek: 'πόλις',      translit: 'polis',        pron: 'PO-lis',          glosses: ['city'], freq: 163, lesson: 8 },
  { id: 73, greek: 'βασιλεία',   translit: 'basileia',     pron: 'ba-si-LAY-a',     glosses: ['kingdom'], freq: 162, lesson: 8 },
  { id: 74, greek: 'ἔθνος',      translit: 'ethnos',       pron: 'ETH-nos',         glosses: ['nation', 'gentile'], freq: 162, lesson: 8 },
  { id: 75, greek: 'ἐσθίω',      translit: 'esthiō',       pron: 'es-THEE-o',       glosses: ['I eat'], freq: 158, lesson: 8 },
  { id: 76, greek: 'καρδία',     translit: 'kardia',       pron: 'kar-DEE-a',       glosses: ['heart'], freq: 156, lesson: 8 },
  { id: 77, greek: 'χάρις',      translit: 'charis',       pron: 'KHA-ris',         glosses: ['grace'], freq: 155, lesson: 8 },
  { id: 78, greek: 'καλέω',      translit: 'kaleō',        pron: 'ka-LEH-o',        glosses: ['I call', 'I name'], freq: 148, lesson: 8 },
  { id: 79, greek: 'σάρξ',       translit: 'sarx',         pron: 'SARX',            glosses: ['flesh'], freq: 147, lesson: 8 },
  { id: 80, greek: 'ἀγαπάω',     translit: 'agapaō',       pron: 'a-ga-PA-o',       glosses: ['I love'], freq: 143, lesson: 8 },

  { id: 81, greek: 'φωνή',       translit: 'phōnē',        pron: 'fo-NAY',          glosses: ['voice', 'sound'], freq: 139, lesson: 9 },
  { id: 82, greek: 'βλέπω',      translit: 'blepō',        pron: 'BLEH-po',         glosses: ['I see', 'I look at'], freq: 133, lesson: 9 },
  { id: 83, greek: 'βάλλω',      translit: 'ballō',        pron: 'BA-lo',           glosses: ['I throw', 'I cast'], freq: 122, lesson: 9 },
  { id: 84, greek: 'θάνατος',    translit: 'thanatos',     pron: 'THA-na-tos',      glosses: ['death'], freq: 120, lesson: 9 },
  { id: 85, greek: 'μένω',       translit: 'menō',         pron: 'MEH-no',          glosses: ['I remain', 'I abide'], freq: 118, lesson: 9 },
  { id: 86, greek: 'ζητέω',      translit: 'zēteō',        pron: 'dzay-TEH-o',      glosses: ['I seek', 'I look for'], freq: 117, lesson: 9 },
  { id: 87, greek: 'ἀγάπη',      translit: 'agapē',        pron: 'a-GA-pay',        glosses: ['love'], freq: 116, lesson: 9 },
  { id: 88, greek: 'οἶκος',      translit: 'oikos',        pron: 'OY-kos',          glosses: ['house', 'household'], freq: 114, lesson: 9 },
  { id: 89, greek: 'ἐκκλησία',   translit: 'ekklēsia',     pron: 'ek-klay-SEE-a',   glosses: ['church', 'assembly'], freq: 114, lesson: 9 },
  { id: 90, greek: 'ἀποθνῄσκω',  translit: 'apothnēskō',   pron: 'a-po-THNAY-sko',  glosses: ['I die'], freq: 111, lesson: 9 },

  { id: 91,  greek: 'ἀλήθεια',   translit: 'alētheia',     pron: 'a-LAY-thay-a',    glosses: ['truth'], freq: 109, lesson: 10 },
  { id: 92,  greek: 'σῴζω',      translit: 'sōzō',         pron: 'SO-dzo',          glosses: ['I save', 'I heal'], freq: 106, lesson: 10 },
  { id: 93,  greek: 'ψυχή',      translit: 'psychē',       pron: 'psü-KHAY',        glosses: ['soul', 'life'], freq: 103, lesson: 10 },
  { id: 94,  greek: 'δεῖ',       translit: 'dei',          pron: 'DAY',             glosses: ['it is necessary'], freq: 101, lesson: 10 },
  { id: 95,  greek: 'πίπτω',     translit: 'piptō',        pron: 'PEEP-to',         glosses: ['I fall'], freq: 101, lesson: 10 },
  { id: 96,  greek: 'φοβέομαι',  translit: 'phobeomai',    pron: 'fo-BEH-o-mai',    glosses: ['I fear', 'I am afraid'], freq: 95, lesson: 10 },
  { id: 97,  greek: 'αἴρω',      translit: 'airō',         pron: 'AI-ro',           glosses: ['I take up', 'I lift'], freq: 90, lesson: 10 },
  { id: 98,  greek: 'τηρέω',     translit: 'tēreō',        pron: 'tay-REH-o',       glosses: ['I keep', 'I observe'], freq: 70, lesson: 10 },
  { id: 99,  greek: 'ἄγω',       translit: 'agō',          pron: 'A-go',            glosses: ['I lead', 'I bring'], freq: 67, lesson: 10 },
  { id: 100, greek: 'φέρω',      translit: 'pherō',        pron: 'FEH-ro',          glosses: ['I carry', 'I bring'], freq: 66, lesson: 10 },
];

// Module unlock order. M1 and M3 have no vocab of their own; M2 is lesson 1; M4 is lessons 2-10.
const MODULES = ['M1', 'M2', 'M3', 'M4'];
const M4_LESSON_COUNT = 10; // lesson 1 = M2, but M4 progress is tracked as lessons 2..10

if (typeof module !== 'undefined') {
  module.exports = { ALPHABET, BREATHING_MARKS, ACCENTS_INFO, DIPHTHONGS, INLINE_DIPHTHONG_NOTES, VOCAB, MODULES };
}
