/*
 * R-panelen i R-workshopparna (Workshop_1 till Workshop_4).
 *
 * Bilderna (Quarto revealjs) visas till vänster och en R-panel som liknar RStudio till höger.
 * R körs i webbläsaren med webR 0.6.0, som hämtas från webR:s egen server. Inget R ligger här.
 * Panelen kopplas in av raden i varje workshops YAML-huvud:
 *     include-after-body:
 *       text: <script src="../shared/rpanel.js"></script>
 *
 * Det du kan behöva ändra står direkt nedanför:
 *   DATA_FILES  CSV-filer i shared/data som läggs i R:s arbetsmapp när R startar.
 *   PACKAGES    R-paket som installeras när R startar.
 * Kodrutor på bilderna (```r) får en Run-knapp. En kodruta som inte ska kunna köras skrivs
 * ```{.r .norun}. En kodruta som med flit ger ett fel skrivs ```{.r .fel}; den kan köras men
 * hoppas över av "Run earlier slides". All text i panelen är på engelska, som i RStudio och i
 * inlämningsspelet.
 */
(function () {
  'use strict';

  var WEBR_URL = 'https://webr.r-wasm.org/v0.6.0/webr.mjs';
  var DATA_FILES = ['survey.csv', 'municipalities.csv'];
  var PACKAGES = ['stargazer'];

  var search = location.search || '';
  // Talarvyns förhandsbilder (?receiver) och pdf-utskrift (?print-pdf) får ingen panel.
  if (/[?&]receiver\b/.test(search) || /print-pdf/.test(search)) return;

  var HOME = '/home/web_user/';
  var here = document.currentScript && document.currentScript.src;
  var BASE = here ? here.slice(0, here.lastIndexOf('/') + 1) : '../shared/';
  var pageName = (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  var wsNum = /W(\d+)/i.exec(pageName);
  var SCRIPT_FILE = wsNum ? 'workshop' + wsNum[1] + '.R' : 'script.R';
  var SCRIPT_KEY = 'script:' + location.pathname;
  var root = document.documentElement;
  var narrowMq = window.matchMedia('(max-width: 799px)');

  // ------------------------------------------------------------------
  // Små hjälpfunktioner
  // ------------------------------------------------------------------
  function getPref(key) {
    try { var v = localStorage.getItem('rpanel.' + key); return v == null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function setPref(key, value) {
    try { localStorage.setItem('rpanel.' + key, JSON.stringify(value)); } catch (e) { /* ingen lagring */ }
  }
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function errText(e) { return e && e.message ? e.message : String(e); }
  function rName(name) {
    return /^([A-Za-z]|[.][A-Za-z._])[A-Za-z0-9._]*$/.test(name) ? name : '`' + name.replace(/`/g, '\\`') + '`';
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtSize(n) {
    if (n < 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function isEditable(t) {
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
  // webR:s toJs()-format till vanliga JavaScript-värden (vektorer blir listor).
  function plain(o) {
    if (!o || o.type === 'null') return null;
    if (o.type === 'list') {
      var vals = o.values.map(plain);
      if (!o.names) return vals;
      var obj = {};
      o.names.forEach(function (n, i) { obj[n] = vals[i]; });
      return obj;
    }
    return o.values;
  }
  function first(x, d) { return x && x.length ? x[0] : d; }

  // ------------------------------------------------------------------
  // Ikoner (enkla SVG-bilder i RStudios stil)
  // ------------------------------------------------------------------
  var ICON = {
    rfile: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5" fill="#fff" stroke="#8fa6bf"/><text x="8" y="11.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="8.5" fill="#276dc3">R</text></svg>',
    run: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 6.3h7.8V2.8L15 8l-5.7 5.2V9.7H1.5z" fill="#3a9d48"/></svg>',
    source: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="8" height="13" rx="1" fill="#fff" stroke="#8fa6bf"/><path d="M5 6.6h5.2V3.6L15 8l-4.8 4.4v-3H5z" fill="#3b78c3"/></svg>',
    save: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h9.5L14 4.5V14H2z" fill="#4f7fc0"/><rect x="4.5" y="2" width="6" height="4" fill="#fff"/><rect x="4" y="9" width="8" height="5" rx=".5" fill="#e6eef9"/></svg>',
    broom: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.6 1.4 8.7 7.7" stroke="#8a5a2b" stroke-width="1.6" stroke-linecap="round"/><path d="M6.3 6.6 10 9.3 7.8 14.5C5.6 14 3.2 12.5 1.5 10.6z" fill="#e0a84a"/><path d="M4.4 9.9 3 12M6.6 11.3 5.6 13.6" stroke="#b07a25" stroke-width=".9"/></svg>',
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 5.5 8l5 5" fill="none" stroke="#3b78c3" stroke-width="2"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3 5 5-5 5" fill="none" stroke="#3b78c3" stroke-width="2"/></svg>',
    zoom: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="#eaf2fb" stroke="#3b78c3" stroke-width="1.5"/><path d="m10 10 4.5 4.5" stroke="#3b78c3" stroke-width="2"/></svg>',
    export: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="10" height="9" fill="#fff" stroke="#7a8aa0"/><path d="M3 11l3-4 2 2.5 1.5-1.5 2 3z" fill="#57a05b"/><path d="M9.3 6.4h3.9V4L16 7.1l-2.8 3V8H9.3z" fill="#3b78c3"/></svg>',
    remove: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#d9534f"/><path d="m5.5 5.5 5 5m0-5-5 5" stroke="#fff" stroke-width="1.6"/></svg>',
    upload: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 3.5 6h3v5h3V6h3z" fill="#3b78c3"/><path d="M2 12v2.5h12V12" fill="none" stroke="#7a8aa0" stroke-width="1.5"/></svg>',
    refresh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8.2a5 5 0 1 1-1.6-3.7" fill="none" stroke="#3b78c3" stroke-width="1.8"/><path d="M13.2 1.3v4.4H8.8z" fill="#3b78c3"/></svg>',
    grid: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#7a8aa0"/><rect x="1.5" y="2.5" width="13" height="3.2" fill="#cfe0f3" stroke="#7a8aa0"/><path d="M1.5 9.4h13M6 5.7v7.8M10.5 5.7v7.8" stroke="#7a8aa0"/></svg>',
    expand: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#3b78c3"/><path d="m6.6 5 3.2 3-3.2 3" fill="none" stroke="#fff" stroke-width="1.7"/></svg>',
    collapse: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#3b78c3"/><path d="m5 6.6 3 3.2 3-3.2" fill="none" stroke="#fff" stroke-width="1.7"/></svg>',
    file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h6.5L13 5v9.5H3z" fill="#fff" stroke="#8fa6bf"/><path d="M9.5 1.5V5H13" fill="none" stroke="#8fa6bf"/></svg>',
    download: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11.5 3.5 7h3V2h3v5h3z" fill="#3b78c3"/><path d="M2 12v2.5h12V12" fill="none" stroke="#7a8aa0" stroke-width="1.5"/></svg>',
    hide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 3 5 5-5 5M8.5 3l5 5-5 5" fill="none" stroke="#555" stroke-width="1.6"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" stroke="#777" stroke-width="1.6"/></svg>',
    home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8 8 2.5 14 8h-2v6H9.5v-4h-3v4H4V8z" fill="#7a8aa0"/></svg>'
  };
  function tbtn(icon, label, onClick, title) {
    var b = h('button', { type: 'button', class: 'rp-tb', title: title || label });
    b.innerHTML = (icon || '') + (label ? '<span>' + esc(label) + '</span>' : '');
    if (!label) b.setAttribute('aria-label', title);
    b.addEventListener('click', onClick);
    return b;
  }

  // ------------------------------------------------------------------
  // Panelens delar
  // ------------------------------------------------------------------
  var ui = {};
  function build() {
    ui.status = h('span', { class: 'rp-status loading', role: 'status' }, 'Starting R …');
    ui.rerun = tbtn(ICON.run, 'Run earlier slides', rerunEarlier,
      'Run the code boxes on all slides before this one (use it if you jumped ahead or reloaded the page)');
    ui.hide = tbtn(ICON.hide, '', function () { setOpen(false); }, 'Hide the R panel');
    var top = h('div', { class: 'rp-top' }, h('span', { class: 'rp-logo', 'aria-hidden': 'true' }, 'R'),
      ui.status, h('span', { class: 'rp-fill' }), ui.rerun, ui.hide);

    // Source: skriptet och dataflikar
    ui.srcTabs = h('div', { class: 'rp-tabs', role: 'tablist' });
    ui.scriptTab = h('button', { type: 'button', class: 'rp-tab active', title: SCRIPT_FILE });
    ui.scriptTab.innerHTML = ICON.rfile + '<span>Script</span>';
    ui.scriptTab.addEventListener('click', function () { showSourceTab(null); });
    ui.srcTabs.appendChild(ui.scriptTab);
    ui.srcBar = h('div', { class: 'rp-bar' },
      tbtn(ICON.save, '', saveScript, 'Save the script to your computer (Ctrl+S)'),
      h('span', { class: 'rp-fill' }),
      tbtn(ICON.run, 'Run', function () { runFromEditor(); }, 'Run the current line or selection (Ctrl+Enter)'),
      tbtn(ICON.source, 'Source', function () { runAll(); }, 'Run the whole script (Ctrl+Shift+Enter)'));
    ui.gutter = h('div', { class: 'rp-gutter', 'aria-hidden': 'true' });
    ui.hl = h('pre', { class: 'rp-hl', 'aria-hidden': 'true' });
    ui.ta = h('textarea', {
      class: 'rp-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
      wrap: 'off', 'aria-label': 'Script',
      placeholder: '# Write your R code here. Run the current line or selection with Ctrl+Enter.'
    });
    ui.editor = h('div', { class: 'rp-editor' }, ui.gutter, h('div', { class: 'rp-codewrap' }, ui.hl, ui.ta));
    ui.viewerBox = h('div', { class: 'rp-viewerbox', hidden: true });
    ui.source = h('section', { class: 'rp-pane rp-source', 'aria-label': 'Source' },
      ui.srcTabs, ui.srcBar, ui.editor, ui.viewerBox);

    // Console
    ui.out = h('div', { class: 'rp-out', 'aria-live': 'polite' });
    ui.prompt = h('span', { class: 'rp-prompt', 'aria-hidden': 'true' }, '>');
    ui.inp = h('textarea', {
      class: 'rp-in', rows: '1', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      autocorrect: 'off', 'aria-label': 'Console input'
    });
    var inRun = h('button', { type: 'button', class: 'rp-inrun', title: 'Run (Enter)' }, 'Run');
    inRun.addEventListener('click', submitConsole);
    ui.rinfo = h('span', { class: 'rp-rinfo' }, 'R');
    ui.console = h('section', { class: 'rp-pane rp-console', 'aria-label': 'Console' },
      h('div', { class: 'rp-tabs' }, h('span', { class: 'rp-tab active' }, 'Console'), ui.rinfo,
        h('span', { class: 'rp-fill' }),
        tbtn(ICON.broom, '', clearConsole, 'Clear console output (Ctrl+L)')),
      h('div', { class: 'rp-conbox' }, ui.out, h('div', { class: 'rp-inrow' }, ui.prompt, ui.inp, inRun)));

    // Environment, Plots, Files, Help
    ui.toolTabs = h('div', { class: 'rp-tabs', role: 'tablist' });
    ui.toolBtn = {};
    ui.body = {};
    [['env', 'Environment'], ['plots', 'Plots'], ['files', 'Files'], ['help', 'Help']].forEach(function (t) {
      var b = h('button', { type: 'button', class: 'rp-tab', role: 'tab' }, t[1]);
      b.addEventListener('click', function () { showTool(t[0]); });
      ui.toolBtn[t[0]] = b;
      ui.toolTabs.appendChild(b);
    });

    ui.envList = h('div', { class: 'rp-scroll' });
    ui.body.env = h('div', { class: 'rp-tbody' },
      h('div', { class: 'rp-bar' },
        tbtn(ICON.broom, '', clearEnv, 'Remove all objects from the environment'),
        h('span', { class: 'rp-crumb' }, 'Global Environment')),
      ui.envList);

    ui.plotArea = h('div', { class: 'rp-plotarea' }, h('div', { class: 'rp-empty' }, 'Plots you make appear here.'));
    ui.plotPrev = tbtn(ICON.prev, '', function () { stepPlot(-1); }, 'Previous plot');
    ui.plotNext = tbtn(ICON.next, '', function () { stepPlot(1); }, 'Next plot');
    ui.body.plots = h('div', { class: 'rp-tbody' },
      h('div', { class: 'rp-bar' }, ui.plotPrev, ui.plotNext,
        tbtn(ICON.zoom, 'Zoom', zoomPlot, 'View the plot in a larger window'),
        tbtn(ICON.export, 'Export', exportPlot, 'Save the plot as a PNG image'),
        tbtn(ICON.remove, '', removePlot, 'Remove the current plot'),
        tbtn(ICON.broom, '', clearPlots, 'Remove all plots')),
      ui.plotArea);

    ui.fileBody = h('tbody');
    ui.upload = h('input', { type: 'file', multiple: true, hidden: true });
    ui.upload.addEventListener('change', uploadFiles);
    ui.body.files = h('div', { class: 'rp-tbody' },
      h('div', { class: 'rp-bar' },
        tbtn(ICON.upload, 'Upload', function () { ui.upload.click(); }, 'Upload files from your computer to the working directory'),
        tbtn(ICON.refresh, '', function () { enqueue(afterRun); }, 'Refresh the file listing'),
        ui.upload),
      h('div', { class: 'rp-crumb rp-crumb-row', html: ICON.home + '<span>Home</span>' }),
      h('div', { class: 'rp-scroll' },
        h('table', { class: 'rp-ftable' },
          h('thead', null, h('tr', null, h('th', { class: 'ic' }), h('th', null, 'Name'), h('th', null, 'Size'),
            h('th', null, 'Modified'), h('th', { class: 'act' }))),
          ui.fileBody)));

    ui.helpBody = h('div', { class: 'rp-scroll rp-help' },
      h('div', { class: 'rp-empty' }, 'Type ?mean in the console, or search for a function above.'));
    ui.helpInput = h('input', { type: 'search', class: 'rp-helpsearch', placeholder: 'Search help', 'aria-label': 'Search help' });
    ui.helpInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && ui.helpInput.value.trim()) { e.preventDefault(); helpSearch(ui.helpInput.value.trim()); }
    });
    ui.body.help = h('div', { class: 'rp-tbody' }, h('div', { class: 'rp-bar' }, h('span', { class: 'rp-fill' }), ui.helpInput), ui.helpBody);

    ui.tools = h('section', { class: 'rp-pane rp-tools', 'aria-label': 'Environment, Plots, Files and Help' }, ui.toolTabs);
    Object.keys(ui.body).forEach(function (k) { ui.tools.appendChild(ui.body[k]); });

    ui.split1 = h('div', { class: 'rp-split', title: 'Drag to resize' });
    ui.split2 = h('div', { class: 'rp-split', title: 'Drag to resize' });
    ui.grip = h('div', { class: 'rp-grip', title: 'Drag to resize the R panel' });
    ui.root = h('aside', { class: 'rp tex2jax_ignore mathjax_ignore', id: 'rpanel', 'aria-label': 'R' },
      ui.grip, top,
      h('div', { class: 'rp-body' }, ui.source, ui.split1, ui.console, ui.split2, ui.tools));
    ui.open = h('button', { type: 'button', class: 'rp-openbtn', title: 'Show the R panel' }, 'R');
    ui.open.addEventListener('click', function () { setOpen(true); });
    document.body.appendChild(ui.root);
    document.body.appendChild(ui.open);
  }

  // ------------------------------------------------------------------
  // Storlek, visa och dölja, och bildernas storlek
  // ------------------------------------------------------------------
  var sizes = getPref('sizes');
  if (!Array.isArray(sizes) || sizes.length !== 3) sizes = [0.28, 0.36, 0.36];
  var panelW = getPref('width') || Math.round(window.innerWidth * 0.42);
  var isOpen = narrowMq.matches ? false : getPref('open') !== false;

  function applySizes() {
    ui.source.style.flex = sizes[0] + ' 1 0';
    ui.console.style.flex = sizes[1] + ' 1 0';
    ui.tools.style.flex = sizes[2] + ' 1 0';
  }
  function curWidth() { return clamp(panelW, 320, Math.max(320, Math.round(window.innerWidth * 0.7))); }
  function applyOpen() {
    root.classList.toggle('rp-open', isOpen);
    root.classList.toggle('rp-narrow', narrowMq.matches);
    root.style.setProperty('--rp-w', curWidth() + 'px');
    fitSlides();
  }
  function setOpen(open) {
    isOpen = open;
    if (!narrowMq.matches) setPref('open', open);
    applyOpen();
  }
  // Utan panel har bilderna Quartos vanliga storlek (1050 x 700 punkter). Med panelen bredvid
  // blir de 900 punkter breda och lika höga som ytan tillåter (700–1000 punkter), så att texten
  // blir större och bilderna fyller ytan i stället för att få tomma band ovanför och under.
  var baseSize = null;
  function fitSlides() {
    var R = window.Reveal;
    if (!R || !R.isReady || !R.isReady()) return;
    var cfg = R.getConfig();
    if (!baseSize) {
      baseSize = [typeof cfg.width === 'number' ? cfg.width : 1050, typeof cfg.height === 'number' ? cfg.height : 700];
    }
    var side = isOpen && !narrowMq.matches;
    var avail = window.innerWidth - (side ? curWidth() : 0);
    var w = side ? 900 : baseSize[0];
    var hgt = side ? Math.round(clamp(w * window.innerHeight / Math.max(avail, 1), 700, 1000)) : baseSize[1];
    if (cfg.width !== w || cfg.height !== hgt) R.configure({ width: w, height: hgt });
    else R.layout();
  }
  var layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () {
      layoutQueued = false;
      if (window.Reveal && window.Reveal.isReady && window.Reveal.isReady()) window.Reveal.layout();
    });
  }
  function dragWidth(ev) {
    if (narrowMq.matches) return;
    ev.preventDefault();
    var el = ev.currentTarget;
    el.setPointerCapture(ev.pointerId);
    root.classList.add('rp-dragging');
    function move(e) {
      panelW = clamp(window.innerWidth - e.clientX, 320, Math.round(window.innerWidth * 0.7));
      root.style.setProperty('--rp-w', panelW + 'px');
      queueLayout();
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      root.classList.remove('rp-dragging');
      setPref('width', panelW);
      fitSlides();
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function dragSplit(idx, ev) {
    ev.preventDefault();
    var panes = [ui.source, ui.console, ui.tools];
    var ha = panes[idx].getBoundingClientRect().height;
    var hb = panes[idx + 1].getBoundingClientRect().height;
    var total = sizes[idx] + sizes[idx + 1];
    var y0 = ev.clientY;
    var el = ev.currentTarget;
    el.setPointerCapture(ev.pointerId);
    root.classList.add('rp-dragging');
    function move(e) {
      var na = clamp(ha + e.clientY - y0, 56, ha + hb - 56);
      sizes[idx] = total * na / (ha + hb);
      sizes[idx + 1] = total - sizes[idx];
      applySizes();
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      root.classList.remove('rp-dragging');
      setPref('sizes', sizes);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ------------------------------------------------------------------
  // Flikar
  // ------------------------------------------------------------------
  var toolNow = null;
  function showTool(id) {
    toolNow = id;
    Object.keys(ui.body).forEach(function (k) {
      ui.body[k].hidden = k !== id;
      ui.toolBtn[k].classList.toggle('active', k === id);
      ui.toolBtn[k].setAttribute('aria-selected', k === id ? 'true' : 'false');
    });
    if (id === 'plots') showPlot();
  }
  var viewers = [];   // dataflikar i Source: { title, tab, box }
  var srcNow = null;
  function showSourceTab(v) {
    srcNow = v;
    ui.scriptTab.classList.toggle('active', !v);
    ui.srcBar.hidden = !!v;
    ui.editor.hidden = !!v;
    ui.viewerBox.hidden = !v;
    viewers.forEach(function (x) {
      x.tab.classList.toggle('active', x === v);
      x.box.hidden = x !== v;
    });
  }

  // ------------------------------------------------------------------
  // Konsolens utskrift
  // ------------------------------------------------------------------
  function line(text, cls) {
    var d = h('div', { class: 'rp-l' + (cls ? ' ' + cls : '') });
    d.textContent = text;
    ui.out.appendChild(d);
    ui.out.scrollTop = ui.out.scrollHeight;
    return d;
  }
  function echo(text, skip) {
    var ls = text.split('\n'), shown = [];
    for (var i = skip || 0; i < ls.length; i++) shown.push((i === 0 ? '> ' : '+ ') + ls[i]);
    if (shown.length) line(shown.join('\n'), 'in');
  }
  function clearConsole() { ui.out.textContent = ''; }
  var charW = 0;
  function consoleWidth() {
    if (!charW) {
      var probe = h('span', { class: 'rp-l' }, '0000000000');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      ui.out.appendChild(probe);
      charW = probe.getBoundingClientRect().width / 10 || 7.2;
      probe.remove();
    }
    var w = ui.out.clientWidth - 18;
    return w > 0 ? clamp(Math.floor(w / charW), 30, 200) : 80;
  }

  // ------------------------------------------------------------------
  // R (webR)
  // ------------------------------------------------------------------
  var R_SETUP = String.raw`
local({
  e <- attach(NULL, name = "tools:rpanel")
  evalq({
    .rp <- new.env()
    .rp_status <- function(code) {
      tryCatch({ parse(text = code, keep.source = FALSE); "ok" }, error = function(err) {
        m <- conditionMessage(err)
        if (grepl("unexpected end of input|INCOMPLETE_STRING|unexpected end of line", m)) "incomplete"
        else paste0("error\t", .rp_parse_msg(m, code))
      })
    }
    .rp_parse_msg <- function(m, code) {
      first <- strsplit(m, "\n", fixed = TRUE)[[1L]][1L]
      mm <- regmatches(first, regexec("^<text>:([0-9]+):([0-9]+): (.*)$", first))[[1L]]
      if (length(mm) != 4L) return(paste0("Error: ", m))
      ln <- as.integer(mm[2L]); col <- as.integer(mm[3L])
      lines <- strsplit(code, "\n", fixed = TRUE)[[1L]]
      ctx <- c(utils::head(lines, ln - 1L), substr(lines[ln], 1L, col))
      if (length(ctx) == 1L) sprintf('Error: %s in "%s"', mm[4L], ctx)
      else sprintf('Error: %s in:\n"%s"', mm[4L], paste(ctx, collapse = "\n"))
    }
    .rp_chunks <- function(code) {
      lines <- strsplit(code, "\n", fixed = TRUE)[[1L]]
      out <- character(); buf <- character()
      for (ln in lines) {
        buf <- c(buf, ln)
        txt <- paste(buf, collapse = "\n")
        st <- .rp_status(txt)
        if (st != "incomplete") { out <- c(out, st, txt); buf <- character() }
      }
      if (length(buf)) out <- c(out, "incomplete", paste(buf, collapse = "\n"))
      out
    }
    .rp_call <- function(cl) {
      if (is.null(cl)) return("")
      s <- paste(deparse(cl, width.cutoff = 500L, nlines = 1L), collapse = "")
      if (grepl("^(eval|withVisible|withCallingHandlers|tryCatch|tryCatchList|tryCatchOne|doTryCatch)[(]", s)) "" else s
    }
    .rp_err_msg <- function(e) {
      msg <- conditionMessage(e); cl <- .rp_call(conditionCall(e))
      if (!nzchar(cl)) return(paste0("Error: ", msg))
      head <- paste0("Error in ", cl, " : ")
      if (nchar(head) + nchar(strsplit(msg, "\n", fixed = TRUE)[[1L]][1L]) > 77L) paste0(head, "\n  ", msg)
      else paste0(head, msg)
    }
    .rp_warn_msg <- function(ws) {
      n <- length(ws)
      if (!n) return("")
      one <- function(w, lead) {
        msg <- conditionMessage(w); cl <- .rp_call(conditionCall(w))
        if (!nzchar(cl)) return(paste0(lead, msg))
        if (nchar(lead) + nchar(cl) + nchar(strsplit(msg, "\n", fixed = TRUE)[[1L]][1L]) + 6L > 75L)
          paste0(lead, "In ", cl, " :\n  ", msg)
        else paste0(lead, "In ", cl, " : ", msg)
      }
      if (n == 1L) return(paste0("Warning message:\n", one(ws[[1L]], "")))
      if (n <= 10L) return(paste0("Warning messages:\n",
        paste(vapply(seq_len(n), function(i) one(ws[[i]], paste0(i, ": ")), ""), collapse = "\n")))
      sprintf("There were %d warnings (use warnings() to see them)", n)
    }
    .rp$pw <- 504; .rp$ph <- 378
    # Diagrammen ritas i samma storlek som rutan Plots (webR ritar själv i dubbel upplösning).
    options(device = function(...) webr::canvas(width = .rp$pw, height = .rp$ph, pointsize = 12, bg = "white"))
    .rp_run <- function(code, width = 80L, pw = 504, ph = 378) {
      if (is.numeric(width) && width >= 20) options(width = as.integer(width))
      .rp$pw <- pw; .rp$ph <- ph
      exprs <- tryCatch(parse(text = code, keep.source = FALSE), error = function(err) err)
      if (inherits(exprs, "error")) return(c(.rp_parse_msg(conditionMessage(exprs), code), ""))
      warns <- list(); err <- NULL
      withCallingHandlers(
        tryCatch({
          for (i in seq_along(exprs)) {
            r <- withVisible(eval(exprs[[i]], envir = globalenv()))
            if (r$visible) print(r$value)
          }
        }, error = function(e) err <<- e),
        warning = function(w) {
          if (getOption("warn", 0) >= 0) warns[[length(warns) + 1L]] <<- w
          invokeRestart("muffleWarning")
        })
      c(if (is.null(err)) "" else .rp_err_msg(err), .rp_warn_msg(warns))
    }
    .rp_desc <- function(x) {
      if (is.data.frame(x)) return(sprintf("%d obs. of %d variable%s", nrow(x), ncol(x), if (ncol(x) == 1L) "" else "s"))
      if (is.function(x)) return(paste0("function (", paste(names(formals(x)), collapse = ", "), ")"))
      if (is.atomic(x) && length(x) == 1L && is.null(dim(x)) && !is.factor(x))
        return(if (is.character(x)) encodeString(x, quote = '"') else format(x))
      s <- utils::capture.output(utils::str(x, give.attr = FALSE, vec.len = 3, nchar.max = 80, width = 120, strict.width = "cut"))
      trimws(s[1L])
    }
    .rp_env <- function() {
      nms <- ls(globalenv())
      out <- character(length(nms))
      for (i in seq_along(nms)) {
        x <- get(nms[i], envir = globalenv())
        kind <- if (is.data.frame(x) || is.matrix(x)) "D" else if (is.function(x)) "F" else "V"
        d <- tryCatch(.rp_desc(x), error = function(err) class(x)[1L])
        out[i] <- paste(kind, nms[i], gsub("[\t\n]", " ", d), sep = "\t")
      }
      out
    }
    .rp_str <- function(name) {
      x <- get(name, envir = globalenv())
      s <- utils::capture.output(utils::str(x, give.attr = FALSE, vec.len = 2, width = 100, strict.width = "cut"))
      if (is.data.frame(x)) s[-1L] else s
    }
    .rp_viewdata <- function(x, max = 1000L) {
      if (!is.data.frame(x)) x <- as.data.frame(x, stringsAsFactors = FALSE)
      y <- utils::head(x, max)
      cols <- lapply(y, function(v) {
        if (is.factor(v)) v <- as.character(v)
        if (is.numeric(v)) { r <- as.character(signif(v, 7)); r[is.na(v)] <- NA; r } else as.character(v)
      })
      list(names = names(y), rows = rownames(y), n = nrow(x), k = ncol(x),
           num = vapply(y, is.numeric, NA), cols = unname(cols))
    }
    View <- function(x, title) {
      if (missing(title)) title <- paste(deparse(substitute(x), nlines = 1L), collapse = "")
      .rp$view <- list(title = title, data = .rp_viewdata(x))
      invisible(NULL)
    }
    .rp_files <- function() {
      f <- list.files(all.files = FALSE)
      f <- f[!grepl("[.]profraw$", f)]
      if (!length(f)) return(character())
      i <- file.info(f)
      paste(f, ifelse(i$isdir, -1, i$size), format(i$mtime, "%b %d, %Y, %H:%M"), sep = "\t")
    }
    .rp_after <- function() {
      v <- .rp$view; hp <- .rp$help
      .rp$view <- NULL; .rp$help <- NULL
      list(env = .rp_env(), files = .rp_files(), view = v, help = hp)
    }
    .rp_help_print <- function(x, ...) {
      topic <- attr(x, "topic"); paths <- as.character(x)
      if (!length(paths)) {
        cat(sprintf("No documentation for %s in specified packages and libraries:\nyou could try %s\n",
                    sQuote(topic, FALSE), sQuote(paste0("??", topic), FALSE)))
        return(invisible(x))
      }
      html <- tryCatch({
        rd <- utils:::.getHelpFile(paths[1L])
        paste(utils::capture.output(tools::Rd2HTML(rd, out = "", package = basename(dirname(dirname(paths[1L]))),
                                                   no_links = TRUE)), collapse = "\n")
      }, error = function(err) paste0("<p>The help page could not be shown: ", conditionMessage(err), "</p>"))
      .rp$help <- list(topic = topic, html = html)
      invisible(x)
    }
  }, e)
  registerS3method("print", "help_files_with_topic", e$.rp_help_print, envir = baseenv())
})
`;

  var webR = null, shelter = null, ready = false, running = 0, pending = '';
  var readyResolve, readyReject;
  var readyP = new Promise(function (res, rej) { readyResolve = res; readyReject = rej; });
  readyP.catch(function () { /* visas i statusraden */ });
  var queue = Promise.resolve();
  // Allt som rör R körs i tur och ordning, och först när R har startat.
  function enqueue(fn) {
    var p = queue.then(function () { return readyP; }).then(fn);
    queue = p.catch(function () { /* felet hanteras av den som köade */ });
    return p;
  }
  function setStatus(kind, text) {
    ui.status.className = 'rp-status ' + kind;
    ui.status.textContent = text;
  }
  function setRunning(d) {
    running += d;
    if (ready) setStatus(running > 0 ? 'running' : 'ready', running > 0 ? 'Running …' : 'R ready.');
  }
  function setPending(text) {
    pending = text;
    ui.prompt.textContent = text ? '+' : '>';
  }

  async function startR() {
    setStatus('loading', 'Starting R …');
    try {
      var mod = await import(WEBR_URL);
      webR = new mod.WebR({ channelType: mod.ChannelType.PostMessage });
      await webR.init();
      readLoop();
      shelter = await new webR.Shelter();
      await webR.evalRVoid(R_SETUP);
      for (var i = 0; i < DATA_FILES.length; i++) {
        var res = await fetch(BASE + 'data/' + DATA_FILES[i]);
        if (!res.ok) throw new Error('could not fetch ' + DATA_FILES[i]);
        await webR.FS.writeFile(HOME + DATA_FILES[i], new Uint8Array(await res.arrayBuffer()));
      }
      if (PACKAGES.length) {
        setStatus('loading', 'Installing packages …');
        try { await webR.installPackages(PACKAGES, { quiet: true }); }
        catch (e) { line('Could not install ' + PACKAGES.join(', ') + ': ' + errText(e), 'err'); }
      }
      try { await webR.evalRVoid('webr::shim_install()'); } catch (e) { /* install.packages fungerar ändå i de flesta fall */ }
      var ver = await webR.evalRString('paste(R.version$major, R.version$minor, sep = ".")');
      ui.rinfo.textContent = 'R ' + ver + ' · ~/';
      var vs = await webR.evalRString('R.version.string');
      line(vs + '\nPlatform: webR (R running in your web browser)\n\n' +
        'Objects and files disappear when you reload the page; the script is kept in this browser.\n' +
        'Data files in the working directory: ' + DATA_FILES.join(', ') + '.', 'info');
      ready = true;
      setStatus('ready', 'R ready.');
      readyResolve();
      enqueue(afterRun);
    } catch (e) {
      setStatus('error', 'R could not start: ' + errText(e));
      line('R could not start: ' + errText(e) + '\nCheck your internet connection and reload the page.', 'err');
      readyReject(e);
    }
  }

  // Diagram från webR:s canvas-enhet. webR skickar bara det som ritats sedan förra bilden,
  // så det nya läggs ovanpå det gamla (som när abline() ritar i ett befintligt diagram).
  async function readLoop() {
    for (;;) {
      var msg;
      try { msg = await webR.read(); } catch (e) { return; }
      if (!msg) continue;
      if (msg.type === 'canvas') {
        if (msg.data.event === 'canvasNewPage') newPlotPage();
        else if (msg.data.event === 'canvasImage') drawPlot(msg.data.image);
      } else if (ready && (msg.type === 'stdout' || msg.type === 'stderr')) {
        line(String(msg.data), msg.type === 'stdout' ? 'out' : 'msg');
      }
    }
  }

  async function rValue(code) {
    try { return plain(await (await shelter.evalR(code)).toJs()); }
    finally { try { await shelter.purge(); } catch (e) { /* ignorera */ } }
  }

  // Delar upp koden i hela uttryck (som R gör när koden skrivs in rad för rad).
  async function chunkCode(code) {
    await webR.objs.globalEnv.bind('.rp_code', code);
    var flat = (await rValue('.rp_chunks(.rp_code)')) || [];
    var parts = [];
    for (var i = 0; i + 1 < flat.length; i += 2) {
      var st = flat[i];
      parts.push({ st: st.indexOf('error') === 0 ? 'error' : st, msg: st.slice(6), text: flat[i + 1] });
    }
    return parts;
  }

  function runCode(code, opts) {
    opts = opts || {};
    code = String(code).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
    if (!code.trim()) return Promise.resolve(true);
    setRunning(1);
    return enqueue(function () { return execute(code, opts); })
      .catch(function (e) { line(errText(e), 'err'); return false; })
      .then(function (ok) { setRunning(-1); return ok; });
  }

  async function execute(code, opts) {
    if (opts.source !== 'console' && pending) setPending('');
    var skip = pending ? pending.split('\n').length : 0;
    var full = pending ? pending + '\n' + code : code;
    setPending('');
    var parts = await chunkCode(full);
    var ok = true, seen = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], n = p.text.split('\n').length, skipHere = Math.max(0, skip - seen);
      seen += n;
      if (!p.text.trim()) continue;
      if (!opts.quiet) echo(p.text, skipHere);
      if (p.st === 'incomplete') { setPending(p.text); break; }
      if (p.st === 'error') {
        if (opts.quiet) echo(p.text, 0);
        line(p.msg, 'err');
        ok = false;
        break;
      }
      if (!/\S/.test(p.text.replace(/#.*$/gm, ''))) continue;
      ok = await evalChunk(p.text, opts);
      if (!ok) break;
    }
    await afterRun();
    return ok;
  }

  async function evalChunk(text, opts) {
    try {
      await webR.objs.globalEnv.bind('.rp_code', text);
      var ps = plotSize();
      var res = await shelter.captureR('.rp_run(.rp_code, ' + consoleWidth() + 'L, ' + ps[0] + ', ' + ps[1] + ')', {
        withAutoprint: false, captureStreams: true, captureConditions: false, captureGraphics: false
      });
      var msgs = plain(await res.result.toJs()) || ['', ''];
      var err = msgs[0] || '', warn = msgs[1] || '';
      if (!opts.quiet) flushOutput(res.output);
      if (err) {
        if (opts.quiet) echo(text, 0);
        line(warn ? err + '\nIn addition: ' + warn : err, 'err');
        return false;
      }
      if (warn && !opts.quiet) line(warn, 'msg');
      return true;
    } finally {
      try { await shelter.purge(); } catch (e) { /* ignorera */ }
    }
  }

  function flushOutput(outs) {
    var buf = [], kind = null;
    function flush() {
      if (buf.length) line(buf.join('\n'), kind === 'stderr' ? 'msg' : 'out');
      buf = [];
    }
    (outs || []).forEach(function (o) {
      if (o.type !== 'stdout' && o.type !== 'stderr') return;
      if (o.type !== kind) { flush(); kind = o.type; }
      buf.push(String(o.data));
    });
    flush();
  }

  async function afterRun() {
    var o;
    try { o = await rValue('.rp_after()'); } catch (e) { return; }
    if (!o) return;
    renderEnv(o.env || []);
    renderFiles(o.files || []);
    if (o.view) openViewer(o.view);
    if (o.help) showHelp(o.help);
  }

  // ------------------------------------------------------------------
  // Environment
  // ------------------------------------------------------------------
  var expanded = {};
  function renderEnv(rows) {
    var groups = { D: [], V: [], F: [] };
    rows.forEach(function (s) {
      var p = s.split('\t');
      (groups[p[0]] || groups.V).push({ name: p[1], desc: p.slice(2).join(' ') });
    });
    ui.envList.textContent = '';
    if (!rows.length) {
      ui.envList.appendChild(h('div', { class: 'rp-empty' }, 'Environment is empty'));
      return;
    }
    [['D', 'Data'], ['V', 'Values'], ['F', 'Functions']].forEach(function (g) {
      if (!groups[g[0]].length) return;
      ui.envList.appendChild(h('div', { class: 'rp-envsec' }, g[1]));
      groups[g[0]].forEach(function (it) {
        var row = envRow(g[0], it);
        ui.envList.appendChild(row);
        if (g[0] === 'D' && expanded[it.name]) showStr(it.name, row);
      });
    });
  }
  function envRow(kind, it) {
    var row = h('div', { class: 'rp-envrow' + (kind === 'D' ? ' data' : '') });
    var exp = h('span', { class: 'rp-exp' });
    row.appendChild(exp);
    row.appendChild(h('span', { class: 'nm', title: it.name }, it.name));
    row.appendChild(h('span', { class: 'ds', title: it.desc }, it.desc));
    if (kind === 'D') {
      exp.innerHTML = expanded[it.name] ? ICON.collapse : ICON.expand;
      exp.title = 'Show the variables';
      exp.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (expanded[it.name]) {
          delete expanded[it.name];
          exp.innerHTML = ICON.expand;
          if (row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('rp-envstr')) row.nextSibling.remove();
        } else {
          expanded[it.name] = true;
          exp.innerHTML = ICON.collapse;
          showStr(it.name, row);
        }
      });
      var g = h('span', { class: 'rp-grid', title: 'View the data' });
      g.innerHTML = ICON.grid;
      row.appendChild(g);
      row.title = 'Click to view ' + it.name;
      row.addEventListener('click', function () { runCode('View(' + rName(it.name) + ')', { source: 'env' }); });
    } else {
      row.appendChild(h('span'));
    }
    return row;
  }
  function showStr(name, row) {
    enqueue(async function () {
      await webR.objs.globalEnv.bind('.rp_name', name);
      var s = (await rValue('.rp_str(.rp_name)')) || [];
      if (!row.isConnected) return;
      var pre = h('div', { class: 'rp-envstr' });
      pre.textContent = s.join('\n');
      row.after(pre);
    }).catch(function () { /* objektet finns inte längre */ });
  }
  function clearEnv() {
    if (!window.confirm('Remove all objects from the environment?')) return;
    runCode('rm(list = ls())', { source: 'env' });
  }

  // ------------------------------------------------------------------
  // Data (View)
  // ------------------------------------------------------------------
  function openViewer(v) {
    var title = first(v.title, 'data'), d = v.data || {};
    var names = d.names || [], rows = d.rows || [], cols = d.cols || [], num = d.num || [];
    var n = first(d.n, rows.length), k = first(d.k, names.length);
    var parts = ['<table class="rp-vtable"><thead><tr><th class="rn"></th>'];
    names.forEach(function (nm, j) { parts.push('<th' + (num[j] ? ' class="num"' : '') + '>' + esc(nm) + '</th>'); });
    parts.push('</tr></thead><tbody>');
    for (var r = 0; r < rows.length; r++) {
      parts.push('<tr><td class="rn">' + esc(rows[r]) + '</td>');
      for (var c = 0; c < cols.length; c++) {
        var val = cols[c] ? cols[c][r] : null;
        parts.push(val == null ? '<td class="na">NA</td>' : '<td' + (num[c] ? ' class="num"' : '') + '>' + esc(val) + '</td>');
      }
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');
    var foot = 'Showing 1 to ' + fmtInt(rows.length) + ' of ' + fmtInt(n) + ' entries, ' + k + ' total column' + (k === 1 ? '' : 's');
    var vw = null;
    viewers.forEach(function (x) { if (x.title === title) vw = x; });
    if (!vw) {
      vw = { title: title };
      vw.tab = h('button', { type: 'button', class: 'rp-tab', title: title });
      vw.tab.innerHTML = ICON.grid + '<span>' + esc(title) + '</span>';
      var x = h('span', { class: 'rp-tabx', title: 'Close', html: ICON.close });
      x.addEventListener('click', function (ev) {
        ev.stopPropagation();
        vw.tab.remove();
        vw.box.remove();
        viewers.splice(viewers.indexOf(vw), 1);
        if (srcNow === vw) showSourceTab(null);
      });
      vw.tab.appendChild(x);
      vw.tab.addEventListener('click', function () { showSourceTab(vw); });
      vw.box = h('div', { class: 'rp-viewer' });
      ui.srcTabs.appendChild(vw.tab);
      ui.viewerBox.appendChild(vw.box);
      viewers.push(vw);
    }
    vw.box.innerHTML = '<div class="rp-vscroll">' + parts.join('') + '</div><div class="rp-vfoot">' + esc(foot) + '</div>';
    showSourceTab(vw);
  }

  // ------------------------------------------------------------------
  // Plots
  // ------------------------------------------------------------------
  var plots = [], plotIdx = -1;
  // Storleken på ett nytt diagram: ytan i rutan Plots (i skärmpunkter).
  // Är rutan låg och bred görs diagrammet smalare, så att det inte blir tillplattat.
  function plotSize() {
    var hgt = clamp(ui.tools.clientHeight - 29 - 31 - 14, 240, 800);
    var w = clamp(Math.min(ui.tools.clientWidth - 14, hgt * 1.5), 320, 1000);
    return [Math.round(w), Math.round(hgt)];
  }
  function newPlotPage() {
    var c = h('canvas', { class: 'rp-plot' });
    plots.push(c);
    if (plots.length > 30) plots.shift();
    plotIdx = plots.length - 1;
    showTool('plots');
  }
  function drawPlot(bitmap) {
    if (!plots.length) newPlotPage();
    var c = plots[plots.length - 1];
    if (c.width !== bitmap.width || c.height !== bitmap.height) { c.width = bitmap.width; c.height = bitmap.height; }
    c.getContext('2d').drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();
    if (plotIdx !== plots.length - 1) plotIdx = plots.length - 1;
    if (toolNow === 'plots') showPlot();
  }
  function showPlot() {
    ui.plotPrev.disabled = plotIdx <= 0;
    ui.plotNext.disabled = plotIdx < 0 || plotIdx >= plots.length - 1;
    if (plotIdx < 0) {
      ui.plotArea.replaceChildren(h('div', { class: 'rp-empty' }, 'Plots you make appear here.'));
      return;
    }
    if (ui.plotArea.firstChild !== plots[plotIdx]) ui.plotArea.replaceChildren(plots[plotIdx]);
  }
  function stepPlot(d) { plotIdx = clamp(plotIdx + d, 0, plots.length - 1); showPlot(); }
  function plotUrl() { return plotIdx >= 0 ? plots[plotIdx].toDataURL('image/png') : null; }
  function zoomPlot() {
    var u = plotUrl();
    if (!u) return;
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.title = 'Plot';
    w.document.body.style.cssText = 'margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh';
    var img = w.document.createElement('img');
    img.src = u;
    img.style.cssText = 'max-width:100vw;max-height:100vh';
    w.document.body.appendChild(img);
  }
  function exportPlot() {
    if (plotIdx < 0) return;
    plots[plotIdx].toBlob(function (b) { if (b) downloadBlob(b, 'Rplot.png'); }, 'image/png');
  }
  function removePlot() {
    if (plotIdx < 0) return;
    plots.splice(plotIdx, 1);
    plotIdx = Math.min(plotIdx, plots.length - 1);
    showPlot();
  }
  function clearPlots() {
    plots = [];
    plotIdx = -1;
    showPlot();
    if (ready) enqueue(function () { return webR.evalRVoid('while (grDevices::dev.cur() > 1) grDevices::dev.off()'); }).catch(function () {});
  }

  // ------------------------------------------------------------------
  // Files
  // ------------------------------------------------------------------
  var MIME = {
    html: 'text/html;charset=utf-8', htm: 'text/html;charset=utf-8', png: 'image/png', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf', csv: 'text/plain;charset=utf-8',
    txt: 'text/plain;charset=utf-8', r: 'text/plain;charset=utf-8', tex: 'text/plain;charset=utf-8',
    md: 'text/plain;charset=utf-8'
  };
  function ext(name) { var m = /\.([^.]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; }
  function renderFiles(rows) {
    ui.fileBody.textContent = '';
    if (!rows.length) {
      ui.fileBody.appendChild(h('tr', null, h('td', { colspan: '5', class: 'rp-empty' }, 'No files')));
      return;
    }
    rows.forEach(function (s) {
      var p = s.split('\t'), name = p[0], size = +p[1];
      var a = h('a', { href: '#', title: 'Open ' + name }, name);
      a.addEventListener('click', function (ev) { ev.preventDefault(); openFile(name); });
      var ic = h('td', { class: 'ic', html: ICON.file });
      ui.fileBody.appendChild(h('tr', null, ic, h('td', { class: 'fn' }, a), h('td', { class: 'sz' }, fmtSize(size)),
        h('td', { class: 'mt' }, p[2] || ''),
        h('td', { class: 'act' }, tbtn(ICON.download, '', function () { downloadFile(name); }, 'Download ' + name))));
    });
  }
  function readFile(name) {
    return enqueue(function () { return webR.FS.readFile(HOME + name); });
  }
  function downloadBlob(blob, name) {
    var u = URL.createObjectURL(blob);
    var a = h('a', { href: u, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  function downloadFile(name) {
    readFile(name).then(function (bytes) {
      downloadBlob(new Blob([bytes], { type: MIME[ext(name)] || 'application/octet-stream' }), name);
    }).catch(function (e) { line('Could not read ' + name + ': ' + errText(e), 'err'); });
  }
  function openFile(name) {
    var type = MIME[ext(name)];
    if (!type) { downloadFile(name); return; }
    var w = window.open('', '_blank');
    readFile(name).then(function (bytes) {
      var u = URL.createObjectURL(new Blob([bytes], { type: type }));
      if (w) w.location.href = u; else window.open(u, '_blank');
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    }).catch(function (e) {
      if (w) w.close();
      line('Could not read ' + name + ': ' + errText(e), 'err');
    });
  }
  function uploadFiles() {
    var files = Array.prototype.slice.call(ui.upload.files || []);
    ui.upload.value = '';
    files.forEach(function (f) {
      f.arrayBuffer().then(function (buf) {
        return enqueue(function () { return webR.FS.writeFile(HOME + f.name, new Uint8Array(buf)); });
      }).then(function () { return enqueue(afterRun); })
        .catch(function (e) { line('Could not upload ' + f.name + ': ' + errText(e), 'err'); });
    });
  }

  // ------------------------------------------------------------------
  // Help
  // ------------------------------------------------------------------
  function showHelp(hp) {
    var doc = new DOMParser().parseFromString(first(hp.html, ''), 'text/html');
    doc.querySelectorAll('script,style,link,meta,img,iframe,object,embed,form').forEach(function (n) { n.remove(); });
    doc.querySelectorAll('*').forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (at) {
        if (/^on/i.test(at.name) || at.name === 'style' || at.name === 'href' || at.name === 'src') n.removeAttribute(at.name);
      });
    });
    ui.helpBody.replaceChildren.apply(ui.helpBody, Array.prototype.slice.call(doc.body.childNodes));
    ui.helpBody.scrollTop = 0;
    showTool('help');
  }
  function helpSearch(topic) {
    enqueue(async function () {
      await webR.objs.globalEnv.bind('.rp_topic', topic);
      var res = await shelter.captureR('print(do.call(utils::help, list(.rp_topic)))', {
        withAutoprint: false, captureStreams: true, captureConditions: false, captureGraphics: false
      });
      var said = (res.output || []).map(function (o) { return String(o.data); }).join('\n');
      await shelter.purge();
      await afterRun();
      if (said.trim()) {
        ui.helpBody.replaceChildren(h('div', { class: 'rp-empty' }, said));
        showTool('help');
      }
    }).catch(function (e) { ui.helpBody.replaceChildren(h('div', { class: 'rp-empty' }, errText(e))); });
  }

  // ------------------------------------------------------------------
  // Skriptet (Source)
  // ------------------------------------------------------------------
  var KW = /^(?:if|else|repeat|while|function|for|in|next|break|TRUE|FALSE|NULL|Inf|NaN|NA|NA_integer_|NA_real_|NA_character_|return)$/;
  var TOKENS = /(#.*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?L?\b|\.\d+\b)|([A-Za-z_.][A-Za-z0-9_.]*)|(<<-|<-|->|==|!=|<=|>=|&&|\|\||[-+*\/^~!&|<>=$@:?%])/g;
  function highlight(src) {
    var out = '', last = 0, m;
    TOKENS.lastIndex = 0;
    while ((m = TOKENS.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="n">' + esc(m[3]) + '</span>';
      else if (m[4]) out += KW.test(m[4]) ? '<span class="k">' + m[4] + '</span>' : esc(m[4]);
      else out += '<span class="o">' + esc(m[5]) + '</span>';
      last = TOKENS.lastIndex;
    }
    return out + esc(src.slice(last)) + '\n';
  }
  var saveTimer = null, lastLines = -1;
  function onEdit() {
    var v = ui.ta.value;
    ui.hl.innerHTML = highlight(v);
    var n = v.split('\n').length;
    if (n !== lastLines) {
      lastLines = n;
      var s = [];
      for (var i = 1; i <= n; i++) s.push(i);
      ui.gutter.textContent = s.join('\n') + '\n';
    }
    syncScroll();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { setPref(SCRIPT_KEY, v); }, 400);
  }
  function syncScroll() {
    ui.hl.scrollTop = ui.ta.scrollTop;
    ui.hl.scrollLeft = ui.ta.scrollLeft;
    ui.gutter.scrollTop = ui.ta.scrollTop;
  }
  function insertText(text) {
    var ta = document.activeElement === ui.inp ? ui.inp : ui.ta;
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }
  function caretIntoView() {
    var ta = ui.ta, lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    var lineNo = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    var y = lineNo * lh;
    if (y < ta.scrollTop) ta.scrollTop = y;
    else if (y + 2 * lh > ta.scrollTop + ta.clientHeight) ta.scrollTop = y + 2 * lh - ta.clientHeight;
    syncScroll();
  }
  // Raderna i det uttryck som raden `cur` hör till. Ett uttryck fortsätter på nästa rad så länge
  // en parentes eller ett citattecken är öppet eller raden slutar med en operator, som i R.
  var CONT_END = /(?:[-+*\/^~&|=<>!,:$@]|%[^%\s]*%|\belse)$/;
  var CONT_HEAD = /^\s*(?:[\w.]+\s*(?:<-|=)\s*)?(?:function|if|for|while)\s*\(.*\)$/;
  function statementAt(lines, cur) {
    var depth = 0, inStr = null, start = -1;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], codeEnd = '';
      if (start < 0) {
        if (!ln.trim()) continue;
        start = i;
      }
      for (var j = 0; j < ln.length; j++) {
        var ch = ln[j];
        if (inStr) {
          if (ch === '\\') j++;
          else if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === '#') break;
        if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
        else if ('([{'.indexOf(ch) >= 0) depth++;
        else if (')]}'.indexOf(ch) >= 0) depth = Math.max(0, depth - 1);
        if (!/\s/.test(ch)) codeEnd = ln.slice(0, j + 1);
      }
      var open = inStr || depth > 0 || CONT_END.test(codeEnd) || (CONT_HEAD.test(codeEnd) && !/[{]/.test(codeEnd));
      if (!open) {
        if (i >= cur) return [start, i];
        start = -1;
      }
    }
    return start >= 0 && start <= cur ? [start, lines.length - 1] : [cur, cur];
  }
  function runFromEditor() {
    var ta = ui.ta, v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    if (b > a && v.slice(a, b).trim()) { runCode(v.slice(a, b), { source: 'script' }); return; }
    var lines = v.split('\n'), cur = v.slice(0, a).split('\n').length - 1;
    while (cur < lines.length && !lines[cur].trim()) cur++;
    if (cur >= lines.length) return;
    var range = statementAt(lines, cur);
    var code = lines.slice(range[0], range[1] + 1).join('\n');
    var next = range[1] + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    var pos = 0;
    if (next < lines.length) { for (var i = 0; i < next; i++) pos += lines[i].length + 1; }
    else pos = v.length;
    ta.setSelectionRange(pos, pos);
    caretIntoView();
    runCode(code, { source: 'script' });
  }
  function runAll() { runCode(ui.ta.value, { source: 'script' }); }
  function saveScript() {
    downloadBlob(new Blob([ui.ta.value.replace(/\n?$/, '\n')], { type: 'text/plain;charset=utf-8' }), SCRIPT_FILE);
  }
  function toggleComment() {
    var ta = ui.ta, v = ta.value;
    var s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    var eIdx = v.indexOf('\n', Math.max(ta.selectionEnd - (ta.selectionEnd > ta.selectionStart ? 1 : 0), ta.selectionStart));
    if (eIdx < 0) eIdx = v.length;
    var block = v.slice(s, eIdx).split('\n');
    var allC = block.every(function (l) { return !l.trim() || /^\s*#/.test(l); });
    var out = block.map(function (l) {
      if (!l.trim()) return l;
      return allC ? l.replace(/^(\s*)# ?/, '$1') : l.replace(/^(\s*)/, '$1# ');
    }).join('\n');
    ta.setSelectionRange(s, eIdx);
    insertText(out);
    ta.setSelectionRange(s, s + out.length);
  }
  function onEditorKey(e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) runAll(); else runFromEditor(); return; }
    if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveScript(); return; }
    if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); toggleComment(); return; }
    if (e.altKey && !mod && e.code === 'Minus') { e.preventDefault(); insertText(' <- '); return; }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      if (!e.shiftKey) insertText('  ');
      return;
    }
    if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey) {
      var v = ui.ta.value, pos = ui.ta.selectionStart;
      var before = v.slice(v.lastIndexOf('\n', pos - 1) + 1, pos);
      var indent = /^[ \t]*/.exec(before)[0];
      if (/[({[]\s*$/.test(before)) indent += '  ';
      e.preventDefault();
      insertText('\n' + indent);
    }
  }

  // ------------------------------------------------------------------
  // Kommandoraden (Console)
  // ------------------------------------------------------------------
  var hist = [], hIdx = null, hDraft = '';
  function autoGrow() {
    ui.inp.style.height = 'auto';
    ui.inp.style.height = Math.min(ui.inp.scrollHeight, 160) + 'px';
  }
  function submitConsole() {
    var text = ui.inp.value;
    ui.inp.value = '';
    autoGrow();
    hIdx = null;
    if (!text.trim()) { line(pending ? '+ ' : '> ', 'in'); return; }
    if (hist[hist.length - 1] !== text) hist.push(text);
    if (hist.length > 300) hist.shift();
    runCode(text, { source: 'console' });
  }
  function onConsoleKey(e) {
    var mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && !e.shiftKey && !mod) { e.preventDefault(); submitConsole(); return; }
    if (e.key === 'Escape') { e.preventDefault(); ui.inp.value = ''; autoGrow(); setPending(''); return; }
    if (e.ctrlKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clearConsole(); return; }
    if (e.altKey && !mod && e.code === 'Minus') { e.preventDefault(); insertText(' <- '); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !mod && !e.altKey) {
      var v = ui.inp.value, p = ui.inp.selectionStart;
      if (e.key === 'ArrowUp' && v.lastIndexOf('\n', p - 1) >= 0) return;
      if (e.key === 'ArrowDown' && v.indexOf('\n', p) >= 0) return;
      if (!hist.length) return;
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        if (hIdx === null) { hDraft = v; hIdx = hist.length; }
        if (hIdx > 0) hIdx--;
        ui.inp.value = hist[hIdx];
      } else if (hIdx !== null) {
        hIdx++;
        if (hIdx >= hist.length) { hIdx = null; ui.inp.value = hDraft; } else ui.inp.value = hist[hIdx];
      }
      autoGrow();
      var end = ui.inp.value.length;
      ui.inp.setSelectionRange(end, end);
    }
  }

  // ------------------------------------------------------------------
  // Kodrutorna på bilderna
  // ------------------------------------------------------------------
  function codeText(code) { return code.textContent.replace(/\s+$/, ''); }
  function decorateBlocks() {
    document.querySelectorAll('.reveal .slides pre.sourceCode').forEach(function (pre) {
      if (pre.dataset.rp) return;
      pre.dataset.rp = '1';
      var code = pre.querySelector('code');
      var holder = pre.closest('div.sourceCode') || pre;
      var isR = pre.classList.contains('r') || (code && code.classList.contains('r'));
      if (!isR || !code || pre.classList.contains('norun') || holder.classList.contains('norun')) return;
      pre.classList.add('rp-runnable');
      var b = h('button', { type: 'button', class: 'rp-runblock', title: 'Run in the console' });
      b.innerHTML = ICON.run + '<span>Run</span>';
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        b.blur();
        if (!isOpen) setOpen(true);
        holder.classList.add('rp-ran');
        setTimeout(function () { holder.classList.remove('rp-ran'); }, 600);
        runCode(codeText(code), { source: 'slide' });
      });
      var scaffold = holder.parentNode && holder.parentNode.classList &&
        holder.parentNode.classList.contains('code-copy-outer-scaffold') ? holder.parentNode : holder;
      scaffold.classList.add('rp-hasrun');
      scaffold.appendChild(b);
    });
  }
  function rerunEarlier() {
    var R = window.Reveal;
    if (!R || !R.getSlides) return;
    var slides = R.getSlides(), cur = slides.indexOf(R.getCurrentSlide());
    var blocks = [];
    for (var i = 0; i < cur; i++) {
      slides[i].querySelectorAll('pre.rp-runnable:not(.fel) code').forEach(function (c) { blocks.push(codeText(c)); });
    }
    if (!blocks.length) { line('# There are no code boxes on the earlier slides.', 'info'); return; }
    line('# Running the code boxes on slides 1–' + cur + ' …', 'info');
    var errors = 0, chain = Promise.resolve();
    blocks.forEach(function (code) {
      chain = chain.then(function () {
        return runCode(code, { source: 'slide', quiet: true }).then(function (ok) { if (!ok) errors++; });
      });
    });
    chain.then(function () {
      line('# Done' + (errors ? ' (' + errors + ' code box' + (errors === 1 ? '' : 'es') + ' gave an error)' : '') + '.', 'info');
    });
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  function whenReveal(cb) {
    var tries = 0, done = false, hooked = false;
    function once(R) { if (!done) { done = true; cb(R); } }
    (function wait() {
      if (done) return;
      var R = window.Reveal;
      if (R && R.isReady && R.isReady()) { once(R); return; }
      if (R && R.on && !hooked) { hooked = true; R.on('ready', function () { once(R); }); }
      if (tries++ < 400) setTimeout(wait, 50);
    })();
  }

  function init() {
    build();
    applySizes();
    showTool('env');
    renderEnv([]);
    renderFiles([]);
    ui.ta.value = getPref(SCRIPT_KEY) || '';
    onEdit();
    ui.ta.addEventListener('input', onEdit);
    ui.ta.addEventListener('scroll', syncScroll);
    ui.ta.addEventListener('keydown', onEditorKey);
    ui.inp.addEventListener('keydown', onConsoleKey);
    ui.inp.addEventListener('input', function () { hIdx = null; autoGrow(); });
    ui.grip.addEventListener('pointerdown', dragWidth);
    ui.split1.addEventListener('pointerdown', function (e) { dragSplit(0, e); });
    ui.split2.addEventListener('pointerdown', function (e) { dragSplit(1, e); });
    // Bildspelets tangenter (pilar, ?, b, c ...) ska inte reagera när man skriver i panelen.
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      ui.root.addEventListener(t, function (e) { if (isEditable(e.target)) e.stopPropagation(); });
    });
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { root.style.setProperty('--rp-w', curWidth() + 'px'); fitSlides(); }, 120);
    });
    var onMq = function () { if (narrowMq.matches) isOpen = false; else isOpen = getPref('open') !== false; applyOpen(); };
    if (narrowMq.addEventListener) narrowMq.addEventListener('change', onMq); else narrowMq.addListener(onMq);
    applyOpen();
    whenReveal(function () { decorateBlocks(); applyOpen(); });
    startR();
    window.rpanel = { run: runCode, ready: readyP, setOpen: setOpen };
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
