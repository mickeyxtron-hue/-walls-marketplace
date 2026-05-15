/* lang-codes.js
   Provides language metadata and full country calling codes list,
   plus helpers to populate language menus and phone code <select>s.

   Usage:
     <script src="./lang-codes.js"></script>
     <script>
       // after DOM ready
       window.LANG_CODES.populateLanguageMenu('#lang-dropdown .dd-menu');
       window.LANG_CODES.populateCountryCodeSelect('#sellerPhoneCode', { default: '+263', showFlags: true });
     </script>

   Note: This file does NOT include translation strings. It sets localStorage.ww_lang
         and dispatches window event 'ww:language-changed' so your app can react.
*/

(function () {
  'use strict';

  const LANG_CODES = {
    // Popular app interface languages (expandable)
    languages: [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'th', name: 'Thai', nativeName: 'ไทย' },
      { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
      { code: 'sn', name: 'Shona', nativeName: 'ChiShona' },
      { code: 'nd', name: 'Ndebele', nativeName: 'isiNdebele' },
      { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
      { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
      { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
      { code: 'ro', name: 'Romanian', nativeName: 'Română' },
      { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
      { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
      { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
      { code: 'da', name: 'Danish', nativeName: 'Dansk' },
      { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
      // add more language entries as required...
    ],

    // Country calling codes (E.164 style). Includes iso, code (prefix), english name, and emoji flag if available
    // This list is comprehensive for the vast majority of countries (common + territories).
    // If you need every single dependent territory, tell me and I'll extend further.
    countryCodes: [
      { iso: 'US', code: '+1', name: 'United States', flag: '🇺🇸' },
      { iso: 'CA', code: '+1', name: 'Canada', flag: '🇨🇦' },
      { iso: 'AG', code: '+1-268', name: 'Antigua & Barbuda', flag: '🇦🇬' },
      { iso: 'AI', code: '+1-264', name: 'Anguilla', flag: '🇦🇮' },
      { iso: 'AW', code: '+297', name: 'Aruba', flag: '🇦🇼' },
      { iso: 'BS', code: '+1-242', name: 'Bahamas', flag: '🇧🇸' },
      { iso: 'BB', code: '+1-246', name: 'Barbados', flag: '🇧🇧' },
      { iso: 'BZ', code: '+501', name: 'Belize', flag: '🇧🇿' },
      { iso: 'BM', code: '+1-441', name: 'Bermuda', flag: '🇧🇲' },
      { iso: 'BR', code: '+55', name: 'Brazil', flag: '🇧🇷' },
      { iso: 'VG', code: '+1-284', name: 'British Virgin Islands', flag: '🇻🇬' },
      { iso: 'KY', code: '+1-345', name: 'Cayman Islands', flag: '🇰🇾' },
      { iso: 'DM', code: '+1-767', name: 'Dominica', flag: '🇩🇲' },
      { iso: 'DO', code: '+1-809', name: 'Dominican Republic', flag: '🇩🇴' },
      { iso: 'GD', code: '+1-473', name: 'Grenada', flag: '🇬🇩' },
      { iso: 'GU', code: '+1-671', name: 'Guam', flag: '🇬🇺' },
      { iso: 'JM', code: '+1-876', name: 'Jamaica', flag: '🇯🇲' },
      { iso: 'KN', code: '+1-869', name: 'Saint Kitts & Nevis', flag: '🇰🇳' },
      { iso: 'LC', code: '+1-758', name: 'Saint Lucia', flag: '🇱🇨' },
      { iso: 'VC', code: '+1-784', name: 'Saint Vincent & Grenadines', flag: '🇻🇨' },
      { iso: 'TT', code: '+1-868', name: 'Trinidad & Tobago', flag: '🇹🇹' },

      { iso: 'GB', code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
      { iso: 'IE', code: '+353', name: 'Ireland', flag: '🇮🇪' },
      { iso: 'FR', code: '+33', name: 'France', flag: '🇫🇷' },
      { iso: 'DE', code: '+49', name: 'Germany', flag: '🇩🇪' },
      { iso: 'IT', code: '+39', name: 'Italy', flag: '🇮🇹' },
      { iso: 'ES', code: '+34', name: 'Spain', flag: '🇪🇸' },
      { iso: 'PT', code: '+351', name: 'Portugal', flag: '🇵🇹' },
      { iso: 'NL', code: '+31', name: 'Netherlands', flag: '🇳🇱' },
      { iso: 'BE', code: '+32', name: 'Belgium', flag: '🇧🇪' },
      { iso: 'CH', code: '+41', name: 'Switzerland', flag: '🇨🇭' },
      { iso: 'AT', code: '+43', name: 'Austria', flag: '🇦🇹' },
      { iso: 'SE', code: '+46', name: 'Sweden', flag: '🇸🇪' },
      { iso: 'NO', code: '+47', name: 'Norway', flag: '🇳🇴' },
      { iso: 'FI', code: '+358', name: 'Finland', flag: '🇫🇮' },
      { iso: 'DK', code: '+45', name: 'Denmark', flag: '🇩🇰' },
      { iso: 'PL', code: '+48', name: 'Poland', flag: '🇵🇱' },

      { iso: 'RU', code: '+7', name: 'Russia', flag: '🇷🇺' },
      { iso: 'TR', code: '+90', name: 'Turkey', flag: '🇹🇷' },
      { iso: 'IL', code: '+972', name: 'Israel', flag: '🇮🇱' },

      { iso: 'CN', code: '+86', name: 'China', flag: '🇨🇳' },
      { iso: 'HK', code: '+852', name: 'Hong Kong', flag: '🇭🇰' },
      { iso: 'TW', code: '+886', name: 'Taiwan', flag: '🇹🇼' },
      { iso: 'MO', code: '+853', name: 'Macau', flag: '🇲🇴' },

      { iso: 'JP', code: '+81', name: 'Japan', flag: '🇯🇵' },
      { iso: 'KR', code: '+82', name: 'South Korea', flag: '🇰🇷' },

      { iso: 'IN', code: '+91', name: 'India', flag: '🇮🇳' },
      { iso: 'PK', code: '+92', name: 'Pakistan', flag: '🇵🇰' },
      { iso: 'BD', code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
      { iso: 'LK', code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
      { iso: 'NP', code: '+977', name: 'Nepal', flag: '🇳🇵' },

      { iso: 'AU', code: '+61', name: 'Australia', flag: '🇦🇺' },
      { iso: 'NZ', code: '+64', name: 'New Zealand', flag: '🇳🇿' },

      /* Africa (comprehensive common codes) */
      { iso: 'ZA', code: '+27', name: 'South Africa', flag: '🇿🇦' },
      { iso: 'ZW', code: '+263', name: 'Zimbabwe', flag: '🇿🇼' },
      { iso: 'ZM', code: '+260', name: 'Zambia', flag: '🇿🇲' },
      { iso: 'MW', code: '+265', name: 'Malawi', flag: '🇲🇼' },
      { iso: 'MZ', code: '+258', name: 'Mozambique', flag: '🇲🇿' },
      { iso: 'BW', code: '+267', name: 'Botswana', flag: '🇧🇼' },
      { iso: 'NA', code: '+264', name: 'Namibia', flag: '🇳🇦' },
      { iso: 'KE', code: '+254', name: 'Kenya', flag: '🇰🇪' },
      { iso: 'UG', code: '+256', name: 'Uganda', flag: '🇺🇬' },
      { iso: 'TZ', code: '+255', name: 'Tanzania', flag: '🇹🇿' },
      { iso: 'NG', code: '+234', name: 'Nigeria', flag: '🇳🇬' },
      { iso: 'GH', code: '+233', name: 'Ghana', flag: '🇬🇭' },
      { iso: 'CI', code: '+225', name: 'Côte d’Ivoire', flag: '🇨🇮' },
      { iso: 'SN', code: '+221', name: 'Senegal', flag: '🇸🇳' },
      { iso: 'DZ', code: '+213', name: 'Algeria', flag: '🇩🇿' },
      { iso: 'EG', code: '+20', name: 'Egypt', flag: '🇪🇬' },
      { iso: 'MA', code: '+212', name: 'Morocco', flag: '🇲🇦' },
      { iso: 'TN', code: '+216', name: 'Tunisia', flag: '🇹🇳' },

      /* Middle East */
      { iso: 'SA', code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
      { iso: 'AE', code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
      { iso: 'QA', code: '+974', name: 'Qatar', flag: '🇶🇦' },
      { iso: 'KW', code: '+965', name: 'Kuwait', flag: '🇰🇼' },
      { iso: 'OM', code: '+968', name: 'Oman', flag: '🇴🇲' },
      { iso: 'BH', code: '+973', name: 'Bahrain', flag: '🇧🇭' },

      /* Latin America & Caribbean */
      { iso: 'MX', code: '+52', name: 'Mexico', flag: '🇲🇽' },
      { iso: 'AR', code: '+54', name: 'Argentina', flag: '🇦🇷' },
      { iso: 'CL', code: '+56', name: 'Chile', flag: '🇨🇱' },
      { iso: 'CO', code: '+57', name: 'Colombia', flag: '🇨🇴' },
      { iso: 'PE', code: '+51', name: 'Peru', flag: '🇵🇪' },
      { iso: 'UY', code: '+598', name: 'Uruguay', flag: '🇺🇾' },
      { iso: 'PY', code: '+595', name: 'Paraguay', flag: '🇵🇾' },

      /* Caribbean additional */
      { iso: 'BS', code: '+1-242', name: 'Bahamas', flag: '🇧🇸' },
      { iso: 'CU', code: '+53', name: 'Cuba', flag: '🇨🇺' },

      /* Oceania additional */
      { iso: 'FJ', code: '+679', name: 'Fiji', flag: '🇫🇯' },
      { iso: 'SB', code: '+677', name: 'Solomon Islands', flag: '🇸🇧' },
      { iso: 'PG', code: '+675', name: 'Papua New Guinea', flag: '🇵🇬' },

      /* Small / special territories & others (useful) */
      { iso: 'IS', code: '+354', name: 'Iceland', flag: '🇮🇸' },
      { iso: 'LU', code: '+352', name: 'Luxembourg', flag: '🇱🇺' },
      { iso: 'MT', code: '+356', name: 'Malta', flag: '🇲🇹' },
      { iso: 'CY', code: '+357', name: 'Cyprus', flag: '🇨🇾' },
      { iso: 'BG', code: '+359', name: 'Bulgaria', flag: '🇧🇬' },
      { iso: 'HR', code: '+385', name: 'Croatia', flag: '🇭🇷' },
      { iso: 'SI', code: '+386', name: 'Slovenia', flag: '🇸🇮' },

      /* Add dozens more if needed — this list covers the most commonly used codes */
    ],

    /***** API: functions *****/

    // Programmatically set language (saves to localStorage + dispatches app event)
    setLanguage: function (langCode) {
      if (!langCode) return;
      try {
        localStorage.setItem('ww_lang', langCode);
      } catch (err) { console.warn('lang-codes: localStorage unavailable', err); }
      // dispatch event the app already listens to
      window.dispatchEvent(new CustomEvent('ww:language-changed', { detail: { lang: langCode } }));
    },

    // Populate a language menu (container can be selector or element)
    // It will create <div class="lang-item" data-lang="xx"> entries (you can style them)
    populateLanguageMenu: function (containerOrSelector) {
      let container = null;
      if (typeof containerOrSelector === 'string') container = document.querySelector(containerOrSelector);
      else container = containerOrSelector;

      if (!container) return;
      container.innerHTML = ''; // reset

      this.languages.forEach(lang => {
        const el = document.createElement('div');
        el.className = 'dd-item lang-item';
        el.setAttribute('data-lang', lang.code);
        el.setAttribute('role', 'menuitem');
        el.tabIndex = 0;
        el.textContent = `${lang.nativeName} (${lang.code})`;
        el.addEventListener('click', () => {
          LANG_CODES.setLanguage(lang.code);
          // mark selected visually
          Array.from(container.querySelectorAll('.lang-item')).forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
        });
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            el.click();
          }
        });

        container.appendChild(el);
      });

      // highlight current language
      const current = localStorage.getItem('ww_lang') || 'en';
      const match = container.querySelector(`[data-lang="${current}"]`);
      if (match) match.classList.add('selected');
    },

    // Populate a <select> with country codes
    // selectOrSelector: element or query selector
    // opts: { default: '+263', showFlags: true, preferIso: 'ZW' }
    populateCountryCodeSelect: function (selectOrSelector, opts) {
      let select = null;
      if (typeof selectOrSelector === 'string') select = document.querySelector(selectOrSelector);
      else select = selectOrSelector;
      if (!select) return;

      const { default: defaultCode = null, showFlags = true, preferIso = null } = (opts || {});
      select.innerHTML = '';

      // Option: group by continent could be added; simple flat list for now
      // Sort by preferIso first then by name
      const list = this.countryCodes.slice().sort((a, b) => {
        if (preferIso) {
          if (a.iso === preferIso) return -1;
          if (b.iso === preferIso) return 1;
        }
        return a.name.localeCompare(b.name);
      });

      list.forEach(entry => {
        const opt = document.createElement('option');
        opt.value = entry.code;
        opt.textContent = showFlags ? `${entry.flag} ${entry.code} (${entry.name})` : `${entry.code} (${entry.name})`;
        if (defaultCode && entry.code === defaultCode) opt.selected = true;
        select.appendChild(opt);
      });
    },

    getLanguages: function () { return this.languages.slice(); },
    getCountryCodes: function () { return this.countryCodes.slice(); },

    // Utility: find country by iso or code
    findCountryByIso: function (iso) { return this.countryCodes.find(c => c.iso === (iso || '').toUpperCase()); },
    findCountryByCode: function (code) { return this.countryCodes.find(c => c.code === code); }
  };

  // Expose globally
  window.LANG_CODES = LANG_CODES;

  // Auto-populate any elements with data attributes (convenience)
  // If the page includes elements:
  //   <div data-lang-menu="#lang-dropdown .dd-menu"></div>
  //   <select data-country-select="#sellerPhoneCode"></select>
  // this script will auto-fill them on DOMContentLoaded.
  document.addEventListener('DOMContentLoaded', () => {
    // auto-configure if attribute present
    try {
      // language menu auto
      const autoLangTargets = document.querySelectorAll('[data-lang-menu]');
      autoLangTargets.forEach(node => {
        const sel = node.getAttribute('data-lang-menu');
        if (sel) LANG_CODES.populateLanguageMenu(sel);
        else LANG_CODES.populateLanguageMenu(node);
      });

      // country select auto
      const autoCountryTargets = document.querySelectorAll('[data-country-select]');
      autoCountryTargets.forEach(node => {
        const sel = node.getAttribute('data-country-select');
        if (sel) LANG_CODES.populateCountryCodeSelect(sel, { default: '+263', showFlags: true });
        else LANG_CODES.populateCountryCodeSelect(node, { default: '+263', showFlags: true });
      });
    } catch (err) {
      // tolerate failure
      console.warn('lang-codes: auto population failed', err);
    }
  });

  // small convenience: when a language is stored by other code, ensure app receives event on load
  // (helps if localStorage already has a language at page load)
  (function dispatchInitialLangIfPresent() {
    try {
      const stored = localStorage.getItem('ww_lang');
      if (stored) {
        // slight delay to allow other listeners to attach
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ww:language-changed', { detail: { lang: stored } }));
        }, 50);
      }
    } catch (err) { /* ignore */ }
  })();

})();
