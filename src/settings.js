// Player settings from the SETTINGS menu, remembered between visits. Display mode is stored separately
// (ren.display) because it predates this file.
const DEFAULTS = { music: 7, sfx: 7, shake: true };

export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('ren.settings') || '{}');
        return { ...DEFAULTS, ...saved };
    } catch (e) {
        return { ...DEFAULTS };
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem('ren.settings', JSON.stringify(settings));
    } catch (e) { /* storage unavailable: settings last this session */ }
}
