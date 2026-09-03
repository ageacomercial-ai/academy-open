import modern from './modern.js';
import minimal from './minimal.js';
import business from './business.js';
import editorial from './editorial.js';
import education from './education.js';
import finance from './finance.js';
import technology from './technology.js';
import luxury from './luxury.js';
import dark from './dark.js';
import personal from './personal-development.js';

export const THEMES = { modern, minimal, business, editorial, education, finance, technology, luxury, dark, 'personal-development': personal };
export const THEME_IDS = Object.keys(THEMES);
export function getTheme(id) { return THEMES[id] || THEMES.modern; }
