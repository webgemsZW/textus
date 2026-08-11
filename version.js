// Single source of truth for the app version.
// Loaded by index.html (for the UI badge) and imported by sw.js (for the cache name),
// so bumping this one value both relabels the UI and invalidates the offline cache.
const APP_VERSION = '1.6.0';

if (typeof module !== 'undefined') {
  module.exports = { APP_VERSION };
}
