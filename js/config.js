/*
 * config.js -- demo configuration.
 * Paste the team's Gemini API key between the quotes for the demo video.
 * NOTE: don't commit a real key to a public repo — paste it right before
 * recording, or set it once in the browser console instead:
 *   localStorage.setItem('GEMINI_API_KEY', 'YOUR-KEY')
 */
// Prefer js/secrets.js (gitignored). This fallback only applies if it's absent.
window.GEMINI_API_KEY = window.GEMINI_API_KEY || '';
