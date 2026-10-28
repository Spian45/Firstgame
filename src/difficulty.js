// Difficulty presets. Picked on the title menu and remembered between visits.
//   bossHp      boss max health multiplier
//   damage      multiplier on all damage Ren takes
//   pace        boss downtime between attacks (lower = attacks come faster)
//   regen       health Ren regains per second once she has gone `regenDelay` seconds without being hit
//   hardMoves   unlocks the extra boss attacks (blight rain, spiral, claw clap)
export const DIFFICULTIES = {
    easy: { label: 'EASY', color: '#7ee08a', bossHp: 0.75, damage: 0.6, pace: 1.35, regen: 5, regenDelay: 2.5, hardMoves: false },
    normal: { label: 'NORMAL', color: '#f0b84a', bossHp: 1, damage: 1, pace: 1, regen: 2, regenDelay: 4, hardMoves: false },
    hard: { label: 'HARD', color: '#ff5a5a', bossHp: 1.3, damage: 1.35, pace: 0.75, regen: 0.8, regenDelay: 6, hardMoves: true }
};

export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

export function loadDifficulty() {
    try {
        const saved = localStorage.getItem('ren.difficulty');
        if (DIFFICULTIES[saved]) return saved;
    } catch (e) { /* storage unavailable: use the default */ }
    return 'normal';
}

export function saveDifficulty(key) {
    try {
        localStorage.setItem('ren.difficulty', key);
    } catch (e) { /* storage unavailable: setting lasts this session */ }
}
