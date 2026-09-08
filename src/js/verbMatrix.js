/**
 * Verb Matrix Module (Dmitry Petrov's 3x3 Matrix)
 * Future, Present, Past x Question (?), Affirmation (+), Negation (-)
 */

export const verbMatrixData = {
  verbs: [
    { id: 'love', inf: 'to love', ua: 'любити', past: 'loved', v3: 'loved', regular: true },
    { id: 'live', inf: 'to live', ua: 'жити', past: 'lived', v3: 'lived', regular: true },
    { id: 'work', inf: 'to work', ua: 'працювати', past: 'worked', v3: 'worked', regular: true },
    { id: 'open', inf: 'to open', ua: 'відкривати', past: 'opened', v3: 'opened', regular: true },
    { id: 'close', inf: 'to close', ua: 'закривати', past: 'closed', v3: 'closed', regular: true },
    { id: 'see', inf: 'to see', ua: 'бачити', past: 'saw', v3: 'seen', regular: false },
    { id: 'come', inf: 'to come', ua: 'приходити', past: 'came', v3: 'come', regular: false },
    { id: 'go', inf: 'to go', ua: 'ходити / їхати', past: 'went', v3: 'gone', regular: false },
    { id: 'know', inf: 'to know', ua: 'знати', past: 'knew', v3: 'known', regular: false },
    { id: 'think', inf: 'to think', ua: 'думати', past: 'thought', v3: 'thought', regular: false },
    { id: 'give', inf: 'to give', ua: 'давати', past: 'gave', v3: 'given', regular: false },
    { id: 'take', inf: 'to take', ua: 'брати', past: 'took', v3: 'taken', regular: false },
    { id: 'buy', inf: 'to buy', ua: 'купувати', past: 'bought', v3: 'bought', regular: false },
    { id: 'help', inf: 'to help', ua: 'допомагати', past: 'helped', v3: 'helped', regular: true }
  ],

  pronouns: [
    { id: 'I', label: 'I (Я)', is3rdPerson: false },
    { id: 'you', label: 'You (Ти / Ви)', is3rdPerson: false },
    { id: 'he', label: 'He (Він)', is3rdPerson: true },
    { id: 'she', label: 'She (Вона)', is3rdPerson: true },
    { id: 'we', label: 'We (Ми)', is3rdPerson: false },
    { id: 'they', label: 'They (Вони)', is3rdPerson: false }
  ],

  generateMatrix(verbId, pronounId) {
    const verb = this.verbs.find(v => v.id === verbId) || this.verbs[0];
    const pronoun = this.pronouns.find(p => p.id === pronounId) || this.pronouns[0];
    const base = verb.id;
    const is3rd = pronoun.is3rdPerson;
    const pLabel = pronoun.id;

    // Present forms
    const presAff = is3rd 
      ? (base.endsWith('o') || base.endsWith('sh') || base.endsWith('ch') ? `${base}es` : `${base}s`)
      : base;
    const presNeg = is3rd ? `doesn't ${base}` : `don't ${base}`;
    const presQ = is3rd ? `Does ${pLabel} ${base}?` : `Do ${pLabel} ${base}?`;

    // Past forms
    const pastAff = verb.past;
    const pastNeg = `didn't ${base}`;
    const pastQ = `Did ${pLabel} ${base}?`;

    // Future forms
    const futAff = `will ${base}`;
    const futNeg = `will not ${base}`;
    const futQ = `Will ${pLabel} ${base}?`;

    // Ukrainian approximations for pronoun
    const uaMap = {
      I: { futAff: 'буду', presAff: 'люблю/роStandard', pastAff: 'зробив(ла)' },
      you: { futAff: 'будеш / будете', presAff: 'робиш / робите', pastAff: 'зробив(ла)' },
      he: { futAff: 'буде', presAff: 'робить', pastAff: 'зробив' },
      she: { futAff: 'буде', presAff: 'робить', pastAff: 'зробила' },
      we: { futAff: 'будемо', presAff: 'робимо', pastAff: 'зробили' },
      they: { futAff: 'будуть', presAff: 'роблять', pastAff: 'зробили' }
    };

    return {
      verb,
      pronoun,
      cells: {
        // Row 1: Future
        futureQ: { en: futQ, ua: `Чи буде ${pLabel} ${verb.ua}?` },
        futureAff: { en: `${pLabel} ${futAff}`, ua: `${pLabel} буде ${verb.ua}` },
        futureNeg: { en: `${pLabel} ${futNeg}`, ua: `${pLabel} не буде ${verb.ua}` },

        // Row 2: Present
        presentQ: { en: presQ, ua: `Чи ${pLabel} ${verb.ua}?` },
        presentAff: { en: `${pLabel} ${presAff}`, ua: `${pLabel} [дія зараз/зазвичай]` },
        presentNeg: { en: `${pLabel} ${presNeg}`, ua: `${pLabel} не ${verb.ua}` },

        // Row 3: Past
        pastQ: { en: pastQ, ua: `Чи ${pLabel} ${verb.ua} (в минулому)?` },
        pastAff: { en: `${pLabel} ${pastAff}`, ua: `${pLabel} [в минулому]` },
        pastNeg: { en: `${pLabel} ${pastNeg}`, ua: `${pLabel} не [в минулому]` }
      }
    };
  }
};
