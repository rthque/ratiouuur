(() => {
  'use strict';

  const STORAGE_KEY = 'worksite-tracker:v7';
  const USER_KEY = 'worksite-tracker:user';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LOCALE = 'en-GB';

  const NODE_R = 34;       // inner pie radius (8 main categories)
  const HUB_R = 9;         // center hub (open details)
  const RING_IN = 37;      // second ring (16 secondary categories), inner radius
  const RING_OUT = 52;     // second ring, outer radius
  const GRID_UNIT = 140;   // world-space spacing between adjacent grid cells

  const MAX_CATEGORIES = 8;
  const MAX_MICRO = 16;

  // ---------- team ----------
  const PASSWORD = 'BOP';
  const ADMIN_NAMES = ['Antonin', 'Yohan', 'Etienne', 'Quentin'];
  const LOGIN_ROWS = [
    { names: ['Antonin', 'Yohan'], style: 'sky' },
    { split: true, left: ['Quentin', 'Yoan', 'LP', 'Benoît'], right: ['Etienne', 'Baptiste', 'Greg', 'Seb'], style: 'orange' },
    { names: ['Silvio', 'Stan'], style: 'sky' },
    { names: ['Guilhem', 'Angel', 'Mika', 'Max', 'Erwan', 'Luc', 'Mathieu'], style: 'sky' },
  ];

  // ---------- farm layout ----------
  // Foundation grid (letter column A–M, no I, numeric row 1–7), validated
  // against the official coordinates spreadsheet (Fondations_OWF.xlsx):
  // no J02 nor K03; K01 and L03 exist. Labels are zero-padded (A02, K01…).
  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M'];
  const COLUMN_ROWS = {
    A: [2, 3, 4],
    B: [2, 3, 4],
    C: [2, 3, 4],
    D: [3, 4, 5, 6, 7],
    E: [1, 2, 3, 4, 5, 6, 7],
    F: [1, 2, 5, 6, 7],
    G: [1, 2, 4, 5, 6, 7],
    H: [1, 2, 4, 5, 6, 7],
    J: [1, 4, 5, 6, 7],
    K: [1, 4, 5, 6, 7],
    L: [1, 2, 3, 4, 5, 6, 7],
    M: [1, 2, 3, 4, 5, 6, 7],
  };

  function fouLabel(col, row) {
    return `${col}0${row}`;
  }

  // Inter-array cable strings, read segment by segment off the reference site
  // map ("Dieppe Le Tréport"): each cable there is labelled with its endpoint
  // pair — e.g. WT62 (G4-E4), WT72 (H4-E3), WT12 (K4-J4) — and the WT
  // numbering walks each string outward from the OSS, which pins the feeder
  // of every string. 8 strings radiate from the OSS (empty L3 grid slot).
  const STRING_EDGES = [
    ['OSS', 'K07'], ['K07', 'J07'], ['J07', 'H07'], ['H07', 'G07'], ['G07', 'F07'], ['F07', 'E07'], ['E07', 'D07'],
    ['OSS', 'K05'], ['K05', 'K06'], ['K06', 'J06'], ['J06', 'H06'], ['H06', 'G06'], ['G06', 'F06'], ['F06', 'E06'], ['E06', 'D06'],
    ['OSS', 'K04'], ['K04', 'J04'], ['J04', 'J05'], ['J05', 'H05'], ['H05', 'G05'], ['G05', 'F05'], ['F05', 'E05'], ['E05', 'D05'],
    ['OSS', 'G04'], ['G04', 'E04'], ['E04', 'D04'], ['D04', 'C04'], ['C04', 'B04'], ['B04', 'A04'], ['A04', 'A03'], ['A03', 'A02'],
    ['OSS', 'H04'], ['H04', 'E03'], ['E03', 'D03'], ['D03', 'C03'], ['C03', 'B03'], ['B03', 'B02'], ['C03', 'C02'], ['E03', 'E02'],
    ['OSS', 'J01'], ['J01', 'H01'], ['H01', 'H02'], ['H02', 'G02'], ['G02', 'F02'], ['H01', 'G01'], ['G01', 'F01'], ['F01', 'E01'],
    ['OSS', 'L04'], ['L04', 'L05'], ['L05', 'L06'], ['L06', 'L07'], ['L07', 'M07'], ['L04', 'M04'], ['L05', 'M05'], ['L06', 'M06'],
    ['OSS', 'L03'], ['L03', 'L02'], ['L02', 'L01'], ['L01', 'K01'], ['L03', 'M03'], ['L02', 'M02'], ['L01', 'M01'],
  ];

  const LAYOUT_VERSION = 2;

  // Real WGS84 positions of every foundation and the OSS, from the official
  // coordinates spreadsheet: label -> [lat, lon, DMS string].
  const COORDS = {
    "A02": [50.088528, 1.06775, "50\u00b005'18.7\"N 1\u00b004'03.9\"E"],
    "A03": [50.095778, 1.056861, "50\u00b005'44.8\"N 1\u00b003'24.7\"E"],
    "A04": [50.103194, 1.046222, "50\u00b006'11.5\"N 1\u00b002'46.4\"E"],
    "B02": [50.096639, 1.080972, "50\u00b005'47.9\"N 1\u00b004'51.5\"E"],
    "B03": [50.104, 1.070444, "50\u00b006'14.4\"N 1\u00b004'13.6\"E"],
    "B04": [50.111056, 1.059028, "50\u00b006'39.8\"N 1\u00b003'32.5\"E"],
    "C02": [50.104694, 1.094278, "50\u00b006'16.9\"N 1\u00b005'39.4\"E"],
    "C03": [50.112306, 1.083417, "50\u00b006'44.3\"N 1\u00b005'00.3\"E"],
    "C04": [50.1194, 1.07288, "50\u00b007'09.8\"N 1\u00b004'22.4\"E"],
    "D03": [50.120083, 1.096889, "50\u00b007'12.3\"N 1\u00b005'48.8\"E"],
    "D04": [50.1275, 1.086028, "50\u00b007'39.0\"N 1\u00b005'09.7\"E"],
    "D05": [50.135028, 1.074472, "50\u00b008'06.1\"N 1\u00b004'28.1\"E"],
    "D06": [50.1421, 1.06344, "50\u00b008'31.6\"N 1\u00b003'48.4\"E"],
    "D07": [50.149528, 1.053667, "50\u00b008'58.3\"N 1\u00b003'13.2\"E"],
    "E01": [50.113472, 1.131139, "50\u00b006'48.5\"N 1\u00b007'52.1\"E"],
    "E02": [50.1207, 1.12086, "50\u00b007'14.5\"N 1\u00b007'15.1\"E"],
    "E03": [50.128861, 1.110028, "50\u00b007'43.9\"N 1\u00b006'36.1\"E"],
    "E04": [50.1355, 1.099278, "50\u00b008'07.8\"N 1\u00b005'57.4\"E"],
    "E05": [50.142778, 1.088611, "50\u00b008'34.0\"N 1\u00b005'19.0\"E"],
    "E06": [50.150267, 1.077806, "50\u00b009'01.0\"N 1\u00b004'40.1\"E"],
    "E07": [50.157206, 1.067481, "50\u00b009'25.9\"N 1\u00b004'02.9\"E"],
    "F01": [50.121306, 1.144861, "50\u00b007'16.7\"N 1\u00b008'41.5\"E"],
    "F02": [50.128806, 1.134194, "50\u00b007'43.7\"N 1\u00b008'03.1\"E"],
    "F05": [50.150972, 1.102194, "50\u00b009'03.5\"N 1\u00b006'07.9\"E"],
    "F06": [50.157991, 1.091016, "50\u00b009'28.8\"N 1\u00b005'27.7\"E"],
    "F07": [50.165639, 1.080278, "50\u00b009'56.3\"N 1\u00b004'49.0\"E"],
    "G01": [50.129611, 1.158028, "50\u00b007'46.6\"N 1\u00b009'28.9\"E"],
    "G02": [50.136806, 1.147417, "50\u00b008'12.5\"N 1\u00b008'50.7\"E"],
    "G04": [50.1516, 1.12598, "50\u00b009'05.8\"N 1\u00b007'33.5\"E"],
    "G05": [50.159033, 1.115131, "50\u00b009'32.5\"N 1\u00b006'54.5\"E"],
    "G06": [50.166556, 1.1045, "50\u00b009'59.6\"N 1\u00b006'16.2\"E"],
    "G07": [50.173446, 1.093942, "50\u00b010'24.4\"N 1\u00b005'38.2\"E"],
    "H01": [50.1375, 1.171417, "50\u00b008'15.0\"N 1\u00b010'17.1\"E"],
    "H02": [50.144861, 1.160639, "50\u00b008'41.5\"N 1\u00b009'38.3\"E"],
    "H04": [50.159628, 1.139278, "50\u00b009'34.7\"N 1\u00b008'21.4\"E"],
    "H05": [50.166861, 1.128278, "50\u00b010'00.7\"N 1\u00b007'41.8\"E"],
    "H06": [50.1737, 1.11691, "50\u00b010'25.3\"N 1\u00b007'00.9\"E"],
    "H07": [50.181694, 1.106778, "50\u00b010'54.1\"N 1\u00b006'24.4\"E"],
    "J01": [50.145806, 1.185167, "50\u00b008'44.9\"N 1\u00b011'06.6\"E"],
    "J04": [50.167667, 1.1525, "50\u00b010'03.6\"N 1\u00b009'09.0\"E"],
    "J05": [50.174972, 1.141667, "50\u00b010'29.9\"N 1\u00b008'30.0\"E"],
    "J06": [50.182661, 1.13106, "50\u00b010'57.6\"N 1\u00b007'51.8\"E"],
    "J07": [50.189694, 1.119972, "50\u00b011'22.9\"N 1\u00b007'11.9\"E"],
    "K01": [50.1536, 1.19796, "50\u00b009'13.0\"N 1\u00b011'52.7\"E"],
    "K04": [50.175694, 1.165917, "50\u00b010'32.5\"N 1\u00b009'57.3\"E"],
    "K05": [50.1831, 1.15509, "50\u00b010'59.2\"N 1\u00b009'18.3\"E"],
    "K06": [50.190362, 1.144129, "50\u00b011'25.3\"N 1\u00b008'38.9\"E"],
    "K07": [50.197806, 1.133361, "50\u00b011'52.1\"N 1\u00b008'00.1\"E"],
    "L01": [50.161925, 1.211712, "50\u00b009'42.9\"N 1\u00b012'42.2\"E"],
    "L02": [50.1691, 1.20074, "50\u00b010'08.8\"N 1\u00b012'02.7\"E"],
    "L03": [50.175988, 1.19026, "50\u00b010'33.6\"N 1\u00b011'24.9\"E"],
    "L04": [50.183694, 1.179139, "50\u00b011'01.3\"N 1\u00b010'44.9\"E"],
    "L05": [50.191139, 1.168056, "50\u00b011'28.1\"N 1\u00b010'05.0\"E"],
    "L06": [50.197917, 1.15725, "50\u00b011'52.5\"N 1\u00b009'26.1\"E"],
    "L07": [50.205833, 1.146889, "50\u00b012'21.0\"N 1\u00b008'48.8\"E"],
    "M01": [50.169639, 1.224556, "50\u00b010'10.7\"N 1\u00b013'28.4\"E"],
    "M02": [50.177, 1.21392, "50\u00b010'37.2\"N 1\u00b012'50.1\"E"],
    "M03": [50.1844, 1.20314, "50\u00b011'03.8\"N 1\u00b012'11.3\"E"],
    "M04": [50.192, 1.192333, "50\u00b011'31.2\"N 1\u00b011'32.4\"E"],
    "M05": [50.199222, 1.181528, "50\u00b011'57.2\"N 1\u00b010'53.5\"E"],
    "M06": [50.206472, 1.170722, "50\u00b012'23.3\"N 1\u00b010'14.6\"E"],
    "M07": [50.213806, 1.159722, "50\u00b012'49.7\"N 1\u00b009'35.0\"E"],
    "OSS": [50.1797, 1.17252, "50\u00b010'46.9\"N 1\u00b010'21.1\"E"],
  };

  // local equirectangular projection around the farm centre (north stays up)
  const GEO_REF = { lat: 50.15, lon: 1.12 };
  const M_PER_DEG_LAT = 111200;
  const M_PER_DEG_LON = 111320 * Math.cos((GEO_REF.lat * Math.PI) / 180);
  const WORLD_PER_M = 0.18;

  function geoToWorld(lat, lon) {
    return {
      x: (lon - GEO_REF.lon) * M_PER_DEG_LON * WORLD_PER_M,
      y: -(lat - GEO_REF.lat) * M_PER_DEG_LAT * WORLD_PER_M,
    };
  }

  function nodePosition(label, colIndex, row) {
    const c = COORDS[label];
    if (c) return geoToWorld(c[0], c[1]);
    return gridToWorld(colIndex, row);
  }

  let state = null;
  let user = null; // { name, role: 'tech'|'visitor', admin: bool }
  let mode = 'select'; // 'select' | 'connect' | 'delete'
  let pendingConnectFrom = null;
  let openNodeId = null;
  let pendingLoginName = null;
  let procLang = 'en';
  let svgEl = null;
  let camera = { x: 0, y: 0, scale: 1, minScale: 0.1, maxScale: 8 };

  // ---------- utils ----------
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function wedgePath(cx, cy, r, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
  }

  function polar(radius, angle) {
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }

  function ringSegmentPath(rIn, rOut, a0, a1) {
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const pt = (r, a) => `${r * Math.cos(a)},${r * Math.sin(a)}`;
    return `M${pt(rIn, a0)} L${pt(rOut, a0)} A${rOut},${rOut} 0 ${large} 1 ${pt(rOut, a1)} L${pt(rIn, a1)} A${rIn},${rIn} 0 ${large} 0 ${pt(rIn, a0)} Z`;
  }

  function microPaletteColor(i) {
    const hue = Math.round((360 / MAX_MICRO) * i);
    return `hsl(${hue}, 60%, 45%)`;
  }

  // A checked task is stored as { at: ISO date, by: name|null, partial?: true }
  // (null = not done) so details can show when and by whom it was validated.
  function checkStamp(partial) {
    const stamp = { at: new Date().toISOString(), by: user ? user.name : null };
    if (partial) stamp.partial = true;
    return stamp;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString(LOCALE)} ${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatStamp(stamp) {
    if (!stamp || !stamp.at) return '';
    const datePart = formatDate(stamp.at);
    return stamp.by ? `${datePart} — ${stamp.by}` : datePart;
  }

  function showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  function copyText(text, doneMessage) {
    const finish = () => showToast(doneMessage || 'Copied to clipboard.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(() => fallbackCopy(text, finish));
    } else {
      fallbackCopy(text, finish);
    }
  }

  function fallbackCopy(text, finish) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    finish();
  }

  // ---------- permissions ----------
  function canEdit() {
    return !!user && user.role !== 'visitor';
  }

  function isAdminName() {
    return !!user && ADMIN_NAMES.includes(user.name);
  }

  function isAdmin() {
    return canEdit() && isAdminName() && !!user.admin;
  }

  function applyPermissionClasses() {
    document.body.classList.toggle('can-edit', canEdit());
    document.body.classList.toggle('is-admin', isAdmin());
    const adminSection = document.getElementById('admin-section');
    adminSection.classList.toggle('hidden', !isAdminName());
    const toggleBtn = document.getElementById('btn-admin-toggle');
    toggleBtn.textContent = `🔧 Admin mode: ${isAdmin() ? 'ON' : 'OFF'}`;
    toggleBtn.classList.toggle('active', isAdmin());
    const chip = document.getElementById('user-chip');
    if (user) {
      chip.textContent = user.role === 'visitor' ? '👁 Visitor' : `👤 ${user.name}${isAdmin() ? ' ⚙' : ''}`;
    } else {
      chip.textContent = '';
    }
  }

  // ---------- auth ----------
  function loadUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name && parsed.role) return parsed;
    } catch (e) { /* noop */ }
    return null;
  }

  function saveUser() {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function loginAs(name, role) {
    user = { name, role, admin: false };
    saveUser();
    document.getElementById('login-overlay').classList.add('hidden');
    applyPermissionClasses();
    render();
    safeFitToContent();
    maybeRemindBackup();
  }

  function logout() {
    user = null;
    saveUser();
    applyPermissionClasses();
    showLogin();
  }

  function showLogin() {
    pendingLoginName = null;
    document.getElementById('login-password').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-password-input').value = '';
    document.getElementById('login-overlay').classList.remove('hidden');
  }

  function renderLogin() {
    const rows = document.getElementById('login-rows');
    rows.innerHTML = '';
    LOGIN_ROWS.forEach((row) => {
      const div = document.createElement('div');
      div.className = 'login-row';
      const addBtn = (parent, name, style) => {
        const btn = document.createElement('button');
        btn.className = `btn login-name login-name--${style}`;
        btn.textContent = name;
        btn.addEventListener('click', () => {
          pendingLoginName = name;
          document.getElementById('login-password-label').textContent = `Password for ${name}:`;
          document.getElementById('login-password').classList.remove('hidden');
          document.getElementById('login-error').classList.add('hidden');
          const input = document.getElementById('login-password-input');
          input.value = '';
          input.focus();
        });
        parent.appendChild(btn);
      };
      if (row.split) {
        const left = document.createElement('div');
        left.className = 'login-group';
        row.left.forEach((n) => addBtn(left, n, row.style));
        const right = document.createElement('div');
        right.className = 'login-group';
        row.right.forEach((n) => addBtn(right, n, row.style));
        div.classList.add('login-row--split');
        div.append(left, right);
      } else {
        row.names.forEach((n) => addBtn(div, n, row.style));
      }
      rows.appendChild(div);
    });
  }

  // ---------- state ----------
  function createEmptyProject(name) {
    return {
      id: uid(),
      name,
      updatedAt: new Date().toISOString(),
      categories: [],
      microVars: [],
      reportTypes: [],
      procedures: {},
      nodes: [],
      connections: [],
      punchList: [],
    };
  }

  function defaultReportTypes() {
    return [
      'Survey In/OUT',
      'Ferry daily check inspection',
      'Control if all Aconex inspections are 100%',
      'SRL load indicator report',
      'Guano on all platforms & smells report',
      'Boatlanding tracking on SharePoint',
      'Cable cleats report',
      'Punch',
    ].map((name) => ({ id: uid(), name }));
  }

  function normalizeNode(node, project) {
    node.status = node.status || {};
    node.micro = node.micro || {};
    node.taskComments = node.taskComments || {};
    node.reports = node.reports || {};
    [node.status, node.micro].forEach((map) => {
      Object.keys(map).forEach((k) => {
        if (map[k] === true) map[k] = { at: null, by: null };
        else if (map[k] === false) map[k] = null;
      });
    });
    project.categories.concat(project.microVars).forEach((item) => {
      if (!(item.id in node.status) && !(item.id in node.micro)) {
        (project.categories.includes(item) ? node.status : node.micro)[item.id] = null;
      }
    });
  }

  function normalizeProject(project) {
    project.categories = project.categories || [];
    project.microVars = project.microVars || [];
    project.connections = project.connections || [];
    project.punchList = project.punchList || [];
    project.procedures = project.procedures || {};
    if (!Array.isArray(project.reportTypes) || !project.reportTypes.length) {
      project.reportTypes = defaultReportTypes();
    }
    // purge punch tombstones older than 30 days
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    project.punchList = project.punchList.filter(
      (p) => !p.deleted || new Date(p.updatedAt || 0).getTime() > cutoff,
    );
    (project.nodes || []).forEach((n) => normalizeNode(n, project));

    // one-shot layout migration: grid corrected against the official
    // spreadsheet (J02 removed, L03 added), cables rebuilt, brand colors
    if ((project.layoutVersion || 0) < LAYOUT_VERSION) {
      project.nodes = project.nodes.filter((n) => n.label !== 'J02');
      if (!project.nodes.some((n) => n.label === 'L03')) {
        const l03 = {
          id: uid(),
          label: 'L03',
          x: 0,
          y: 0,
          status: {},
          micro: {},
          taskComments: {},
          reports: {},
          issue: false,
          note: '',
        };
        normalizeNode(l03, project);
        project.nodes.push(l03);
      }
      const byLabel = {};
      project.nodes.forEach((n) => { byLabel[n.label] = n; });
      project.connections = [];
      STRING_EDGES.forEach(([a, b]) => {
        if (byLabel[a] && byLabel[b]) project.connections.push({ id: uid(), a: byLabel[a].id, b: byLabel[b].id });
      });
      const brandColors = {
        'Tower cabinet rust treatment & rubber placement': '#274A72',
        'ScotchKoat on earthing cable': '#0085AD',
        'Grating repair with G8 resin': '#6BA539',
        'Installed cable tray brackets': '#AECB54',
        'Safety pin gate': '#F59E0B',
        'Hang off platform: caution sign': '#8A5CB8',
        'Pick up keys': '#51B2D1',
        'Water ingress check': '#C4453C',
      };
      project.categories.concat(project.microVars).forEach((item) => {
        if (brandColors[item.name]) item.color = brandColors[item.name];
      });
      project.layoutVersion = LAYOUT_VERSION;
    }

    // positions are derived data: pin every known point to its real
    // geographic location (north up)
    (project.nodes || []).forEach((n) => {
      const c = COORDS[n.label];
      if (c) {
        const pos = geoToWorld(c[0], c[1]);
        n.x = pos.x;
        n.y = pos.y;
      }
    });
    return project;
  }

  function seedWindFarmProject() {
    const project = createEmptyProject('Dieppe Le Tréport — 62 FOU');

    project.layoutVersion = LAYOUT_VERSION;

    const catDefs = [
      { name: 'Tower cabinet rust treatment & rubber placement', color: '#274A72' },
      { name: 'ScotchKoat on earthing cable', color: '#0085AD' },
      { name: 'Grating repair with G8 resin', color: '#6BA539' },
      { name: 'Installed cable tray brackets', color: '#AECB54' },
    ];
    project.categories = catDefs.map((c) => ({ id: uid(), ...c }));

    const microDefs = [
      { name: 'Safety pin gate', color: '#F59E0B' },
      { name: 'Hang off platform: caution sign', color: '#8A5CB8' },
      { name: 'Pick up keys', color: '#51B2D1' },
      { name: 'Water ingress check', color: '#C4453C' },
    ];
    project.microVars = microDefs.map((c) => ({ id: uid(), ...c }));

    project.reportTypes = defaultReportTypes();

    COLS.forEach((col, colIndex) => {
      (COLUMN_ROWS[col] || []).forEach((row) => {
        const label = fouLabel(col, row);
        const pos = nodePosition(label, colIndex, row);
        const node = {
          id: uid(),
          label,
          x: pos.x,
          y: pos.y,
          status: {},
          micro: {},
          taskComments: {},
          reports: {},
          issue: false,
          note: '',
        };
        project.categories.forEach((cat) => { node.status[cat.id] = null; });
        project.microVars.forEach((mv) => { node.micro[mv.id] = null; });
        project.nodes.push(node);
      });
    });

    // offshore substation (OSS) — real position, not one of the 62 foundations
    const ossPos = geoToWorld(COORDS.OSS[0], COORDS.OSS[1]);
    project.nodes.push({
      id: uid(),
      label: 'OSS',
      x: ossPos.x,
      y: ossPos.y,
      status: {},
      micro: {},
      taskComments: {},
      reports: {},
      issue: false,
      note: 'Offshore substation',
      substation: true,
    });

    STRING_EDGES.forEach(([labelA, labelB]) => {
      const a = project.nodes.find((n) => n.label === labelA);
      const b = project.nodes.find((n) => n.label === labelB);
      if (a && b) project.connections.push({ id: uid(), a: a.id, b: b.id });
    });

    return project;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.projects && parsed.activeProjectId) {
          Object.values(parsed.projects).forEach(normalizeProject);
          return parsed;
        }
      } catch (e) { /* corrupt, fall through to seed */ }
    }
    const demo = seedWindFarmProject();
    return { activeProjectId: demo.id, projects: { [demo.id]: demo } };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- data safety ----------
  const SNAP_PREFIX = 'worksite-tracker:snap:';

  // one automatic local snapshot per day (last 5 kept) to recover from mistakes
  function dailySnapshot() {
    try {
      const key = SNAP_PREFIX + new Date().toISOString().slice(0, 10);
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(SNAP_PREFIX)).sort();
      while (keys.length > 5) localStorage.removeItem(keys.shift());
    } catch (e) { /* storage full — never block the app */ }
  }

  function maybeRemindBackup() {
    if (!canEdit()) return;
    const project = getActiveProject();
    if (!project) return;
    const hasData = project.nodes.some((n) => Object.values(n.status).some(Boolean)
      || Object.values(n.micro).some(Boolean)
      || Object.keys(n.reports || {}).some((k) => (n.reports[k] || []).length));
    if (!hasData) return;
    const last = state.lastExportAt ? new Date(state.lastExportAt).getTime() : 0;
    if (Date.now() - last > 24 * 3600 * 1000) {
      setTimeout(() => showToast('💾 Tip: export a backup (right panel) — data lives only on this device.'), 1800);
    }
  }

  function markExported() {
    state.lastExportAt = new Date().toISOString();
    saveState();
  }

  // Merge a project exported from another phone into the local one:
  // categories/reports are matched by name, each task keeps the most recent
  // stamp, report occurrences are unioned — nothing is ever deleted.
  function mergeProjects(target, incoming) {
    const mapByName = (fromList, toList, maxLen) => {
      const map = {};
      (fromList || []).forEach((item) => {
        let match = toList.find((t) => t.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (!match && toList.length < maxLen) {
          match = { id: uid(), name: item.name, color: item.color };
          toList.push(match);
        }
        if (match) map[item.id] = match.id;
      });
      return map;
    };
    const catMap = mapByName(incoming.categories, target.categories, MAX_CATEGORIES);
    const microMap = mapByName(incoming.microVars, target.microVars, MAX_MICRO);
    const reportMap = mapByName(incoming.reportTypes, target.reportTypes, 99);
    target.nodes.forEach((n) => normalizeNode(n, target));

    const newer = (a, b) => {
      if (!a) return b || null;
      if (!b) return a;
      return new Date(b.at || 0).getTime() > new Date(a.at || 0).getTime() ? b : a;
    };

    (incoming.nodes || []).forEach((inNode) => {
      const tNode = target.nodes.find((n) => n.label === inNode.label);
      if (!tNode) return;
      const mergeStampMap = (map) => {
        Object.entries(map || {}).forEach(([id, stamp]) => {
          const tid = catMap[id] || microMap[id];
          if (!tid) return;
          const bucket = (tid in tNode.status) ? tNode.status : tNode.micro;
          bucket[tid] = newer(bucket[tid], stamp);
        });
      };
      mergeStampMap(inNode.status);
      mergeStampMap(inNode.micro);
      Object.entries(inNode.taskComments || {}).forEach(([id, comment]) => {
        const tid = catMap[id] || microMap[id];
        if (!tid || !comment) return;
        const merged = pickText(tNode.taskComments[tid], comment);
        if (merged) tNode.taskComments[tid] = merged;
      });
      Object.entries(inNode.reports || {}).forEach(([id, entries]) => {
        const tid = reportMap[id];
        if (!tid) return;
        const existing = tNode.reports[tid] || [];
        const seen = new Set(existing.map((en) => `${en.at}|${en.by}`));
        (entries || []).forEach((en) => {
          const key = `${en.at}|${en.by}`;
          if (!seen.has(key)) { existing.push(en); seen.add(key); }
        });
        existing.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
        tNode.reports[tid] = existing;
      });
      if (inNode.issue) tNode.issue = true;
      tNode.note = pickText(tNode.note, inNode.note);
    });

    const byId = new Map(target.punchList.map((p) => [p.id, p]));
    const byText = new Map(target.punchList.map((p) => [p.text, p]));
    (incoming.punchList || []).forEach((p) => {
      const existing = byId.get(p.id) || byText.get(p.text);
      if (!existing) {
        target.punchList.push(p);
        byId.set(p.id, p);
        byText.set(p.text, p);
        return;
      }
      const tExisting = new Date(existing.updatedAt || existing.at || 0).getTime();
      const tIncoming = new Date(p.updatedAt || p.at || 0).getTime();
      if (tIncoming > tExisting) {
        existing.done = !!p.done;
        existing.deleted = !!p.deleted;
        existing.doneBy = p.doneBy || null;
        existing.updatedAt = p.updatedAt;
      }
    });

    Object.entries(incoming.procedures || {}).forEach(([id, proc]) => {
      const tid = catMap[id] || microMap[id];
      if (!tid) return;
      const tProc = getProcedure(target, tid);
      ['en', 'fr', 'tools', 'ppe'].forEach((k) => {
        tProc[k] = pickText(tProc[k], proc && proc[k]);
      });
    });
  }

  // Deterministic text merge (both devices converge to the same value):
  // longer text wins, ties broken lexicographically.
  function pickText(a, b) {
    const ta = (a || '').trim();
    const tb = (b || '').trim();
    if (!tb) return ta;
    if (!ta) return tb;
    if (ta.length !== tb.length) return ta.length > tb.length ? ta : tb;
    return ta > tb ? ta : tb;
  }

  // ---------- team sync (Firebase Realtime Database, REST + SSE) ----------
  // Set SYNC_DB_URL to the team database URL, e.g.
  // 'https://trefou-default-rtdb.europe-west1.firebasedatabase.app'
  // Empty string = sync disabled, the app works purely locally.
  const SYNC_DB_URL = '';
  const SYNC_URL_OVERRIDE_KEY = 'worksite-tracker:syncUrl';

  const sync = {
    status: 'off', // 'off' | 'live' | 'syncing' | 'offline'
    dirty: false,
    es: null,
    url: null,
    pullTimer: null,
    pushTimer: null,
    retryTimer: null,
    pollTimer: null,
    busy: false,
  };

  function syncBaseUrl() {
    return (localStorage.getItem(SYNC_URL_OVERRIDE_KEY) || SYNC_DB_URL || '').replace(/\/+$/, '');
  }

  function projectSlug(name) {
    return String(name || 'project')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project';
  }

  function syncProjectUrl() {
    const base = syncBaseUrl();
    const project = getActiveProject();
    if (!base || !project) return null;
    return `${base}/projects/${projectSlug(project.name)}.json`;
  }

  function setSyncStatus(status) {
    sync.status = status;
    const chip = document.getElementById('sync-chip');
    if (!chip) return;
    if (status === 'off') { chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    chip.classList.remove('sync-live', 'sync-syncing', 'sync-offline');
    if (status === 'live') { chip.classList.add('sync-live'); chip.textContent = '● live'; chip.title = 'Synced with the team in real time'; }
    else if (status === 'syncing') { chip.classList.add('sync-syncing'); chip.textContent = '● sync'; chip.title = 'Syncing…'; }
    else { chip.classList.add('sync-offline'); chip.textContent = '○ offline'; chip.title = 'No connection — working locally, will sync when back online'; }
  }

  // Order-independent digest of the data that matters, so two devices can
  // tell whether they hold the same information (colors/positions excluded).
  function projectDigest(project) {
    const lines = [];
    const itemName = {};
    project.categories.concat(project.microVars).forEach((i) => { itemName[i.id] = i.name; });
    const reportName = {};
    (project.reportTypes || []).forEach((r) => { reportName[r.id] = r.name; });
    project.categories.concat(project.microVars).forEach((i) => lines.push(`C|${i.name}`));
    (project.nodes || []).forEach((n) => {
      [n.status || {}, n.micro || {}].forEach((map) => {
        Object.entries(map).forEach(([id, st]) => {
          if (st) lines.push(`S|${n.label}|${itemName[id] || id}|${st.partial ? 'p' : 'd'}|${st.at || ''}|${st.by || ''}`);
        });
      });
      Object.entries(n.taskComments || {}).forEach(([id, c]) => {
        if (c) lines.push(`K|${n.label}|${itemName[id] || id}|${c}`);
      });
      Object.entries(n.reports || {}).forEach(([id, entries]) => {
        (entries || []).forEach((e) => lines.push(`R|${n.label}|${reportName[id] || id}|${e.at || ''}|${e.by || ''}`));
      });
      if (n.note) lines.push(`N|${n.label}|${n.note}`);
      if (n.issue) lines.push(`X|${n.label}`);
    });
    (project.punchList || []).forEach((p) => {
      lines.push(`P|${p.text}|${p.done ? 1 : 0}|${p.deleted ? 1 : 0}|${p.updatedAt || ''}`);
    });
    Object.entries(project.procedures || {}).forEach(([id, proc]) => {
      if (!proc) return;
      const body = ['en', 'fr', 'tools', 'ppe'].map((k) => proc[k] || '').join('|');
      if (body.replace(/\|/g, '')) lines.push(`M|${itemName[id] || id}|${body}`);
    });
    return lines.sort().join('\n');
  }

  function markSyncDirty() {
    if (sync.status === 'off' || !canEdit()) return;
    sync.dirty = true;
    clearTimeout(sync.pushTimer);
    sync.pushTimer = setTimeout(syncPush, 1500);
  }

  async function syncFetchRemote() {
    const res = await fetch(sync.url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${res.status}`);
    return res.json();
  }

  // pull remote state and merge it into the local project (nothing is lost:
  // per-task most recent wins, reports/punch are unioned)
  async function syncPull() {
    if (!sync.url || sync.busy) return;
    sync.busy = true;
    try {
      setSyncStatus('syncing');
      const remote = await syncFetchRemote();
      const project = getActiveProject();
      if (remote && Array.isArray(remote.nodes)) {
        normalizeProject(remote);
        const digestBefore = projectDigest(project);
        mergeProjects(project, remote);
        normalizeProject(project);
        const digestAfter = projectDigest(project);
        if (digestAfter !== digestBefore) {
          saveState();
          refreshAfterRemoteChange();
          showToast('🔄 Updated from the team');
        }
        // local holds info the server lacks → push it
        if (canEdit() && digestAfter !== projectDigest(remote)) {
          sync.dirty = true;
        }
      } else if (canEdit()) {
        sync.dirty = true; // empty space: we are the first device, seed it
      }
      if (sync.dirty && canEdit()) {
        clearTimeout(sync.pushTimer);
        sync.pushTimer = setTimeout(syncPush, 400);
      }
      setSyncStatus('live');
    } catch (e) {
      setSyncStatus('offline');
      scheduleSyncRetry();
    } finally {
      sync.busy = false;
    }
  }

  async function syncPush() {
    if (!sync.url || !canEdit()) return;
    if (sync.busy) { clearTimeout(sync.pushTimer); sync.pushTimer = setTimeout(syncPush, 800); return; }
    sync.busy = true;
    try {
      setSyncStatus('syncing');
      const project = getActiveProject();
      // merge latest remote first so a PUT never erases teammates' work
      try {
        const remote = await syncFetchRemote();
        if (remote && Array.isArray(remote.nodes)) {
          normalizeProject(remote);
          mergeProjects(project, remote);
          normalizeProject(project);
          saveState();
        }
      } catch (e) { /* remote unreachable — try the PUT anyway */ }
      const res = await fetch(sync.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!res.ok) throw new Error(`PUT ${res.status}`);
      sync.dirty = false;
      setSyncStatus('live');
    } catch (e) {
      setSyncStatus('offline');
      scheduleSyncRetry();
    } finally {
      sync.busy = false;
    }
  }

  function scheduleSyncRetry() {
    clearTimeout(sync.retryTimer);
    sync.retryTimer = setTimeout(() => {
      if (sync.status === 'offline') startSync();
    }, 10000);
  }

  function schedulePull(delay) {
    clearTimeout(sync.pullTimer);
    sync.pullTimer = setTimeout(syncPull, delay);
  }

  // lightweight refresh that leaves any text field the user is typing in alone
  function refreshAfterRemoteChange() {
    renderCanvas();
    renderProgress();
    renderPunchList();
    renderHeader();
    const modalOpen = !document.getElementById('node-modal').classList.contains('hidden');
    if (modalOpen && openNodeId) {
      const node = currentModalNode();
      const project = getActiveProject();
      if (node && !node.substation) {
        renderModalChecklist(document.getElementById('modal-categories'), project.categories, node, 'status');
        renderModalChecklist(document.getElementById('modal-micro'), project.microVars, node, 'micro');
        renderModalReports(node);
      }
    }
  }

  function stopSync() {
    if (sync.es) { try { sync.es.close(); } catch (e) { /* noop */ } sync.es = null; }
    clearTimeout(sync.pullTimer);
    clearTimeout(sync.pushTimer);
    clearTimeout(sync.retryTimer);
    clearInterval(sync.pollTimer);
  }

  function startSync() {
    stopSync();
    sync.url = syncProjectUrl();
    if (!sync.url) { setSyncStatus('off'); return; }
    setSyncStatus('syncing');
    syncPull();
    // Firebase RTDB streams changes over SSE on the same REST URL
    try {
      sync.es = new EventSource(sync.url);
      const onRemoteEvent = () => schedulePull(600);
      sync.es.addEventListener('put', onRemoteEvent);
      sync.es.addEventListener('patch', onRemoteEvent);
      sync.es.onerror = () => {
        // EventSource retries by itself; if it gave up, fall back to retry loop
        if (sync.es && sync.es.readyState === 2) {
          setSyncStatus('offline');
          scheduleSyncRetry();
        }
      };
    } catch (e) { /* SSE unavailable — polling below still covers us */ }
    // safety-net poll in case an SSE event is missed
    sync.pollTimer = setInterval(() => syncPull(), 60000);
  }

  function touchAndSave() {
    const project = getActiveProject();
    if (project) project.updatedAt = new Date().toISOString();
    saveState();
    markSyncDirty();
  }

  function getActiveProject() {
    return state.projects[state.activeProjectId];
  }

  // ---------- grid -> world position (keeps the map orientation) ----------
  function gridToWorld(colIndex, row) {
    return {
      x: (colIndex - row) * GRID_UNIT,
      y: -(colIndex + row) * GRID_UNIT,
    };
  }

  // ---------- mutations ----------
  function deleteNode(nodeId) {
    const project = getActiveProject();
    project.nodes = project.nodes.filter((n) => n.id !== nodeId);
    project.connections = project.connections.filter((c) => c.a !== nodeId && c.b !== nodeId);
    touchAndSave();
    render();
  }

  function deleteConnection(connId) {
    const project = getActiveProject();
    project.connections = project.connections.filter((c) => c.id !== connId);
    touchAndSave();
    render();
  }

  function addConnection(aId, bId) {
    const project = getActiveProject();
    if (aId === bId) return;
    const exists = project.connections.some(
      (c) => (c.a === aId && c.b === bId) || (c.a === bId && c.b === aId),
    );
    if (exists) return;
    project.connections.push({ id: uid(), a: aId, b: bId });
    touchAndSave();
  }

  // ---------- camera (pan / zoom) ----------
  function svgRect() {
    return svgEl.getBoundingClientRect();
  }

  function applyViewBox() {
    const rect = svgRect();
    if (!rect.width || !rect.height) return;
    const w = rect.width / camera.scale;
    const h = rect.height / camera.scale;
    svgEl.setAttribute('viewBox', `${camera.x - w / 2} ${camera.y - h / 2} ${w} ${h}`);
  }

  function clampScale(s) {
    return Math.min(camera.maxScale, Math.max(camera.minScale, s));
  }

  function screenToWorld(px, py) {
    const rect = svgRect();
    return {
      x: camera.x + (px - rect.left - rect.width / 2) / camera.scale,
      y: camera.y + (py - rect.top - rect.height / 2) / camera.scale,
    };
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = svgRect();
    if (!rect.width) return;
    const worldBefore = screenToWorld(clientX, clientY);
    camera.scale = clampScale(camera.scale * factor);
    camera.x = worldBefore.x - (clientX - rect.left - rect.width / 2) / camera.scale;
    camera.y = worldBefore.y - (clientY - rect.top - rect.height / 2) / camera.scale;
    applyViewBox();
  }

  function fitToContent() {
    const project = getActiveProject();
    const rect = svgRect();
    if (!project || !project.nodes.length || !rect.width || !rect.height) {
      camera = { x: 0, y: 0, scale: 1, minScale: 0.1, maxScale: 8 };
      applyViewBox();
      return;
    }
    const pad = RING_OUT + 40;
    const xs = project.nodes.map((n) => n.x);
    const ys = project.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const scale = Math.min(rect.width / w, rect.height / h);
    camera = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale,
      minScale: scale * 0.4,
      maxScale: Math.max(10, scale * 14),
    };
    applyViewBox();
  }

  function safeFitToContent() {
    const rect = svgRect();
    if (rect.width < 5 || rect.height < 5) {
      requestAnimationFrame(safeFitToContent);
      return;
    }
    fitToContent();
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function setupCameraGestures() {
    const activePointers = new Map();
    let gesture = null;

    svgEl.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { svgEl.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (activePointers.size === 1) {
        gesture = { type: 'pan', lastX: e.clientX, lastY: e.clientY, moved: false, downTarget: e.target };
      } else if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const m = mid(pts[0], pts[1]);
        // anchor the world point under the pinch midpoint ONCE, while the
        // camera is still untouched — recomputing it against an already
        // mutated camera makes the anchor drift and the map "fly away"
        gesture = {
          type: 'pinch',
          startDist: dist(pts[0], pts[1]) || 1,
          startScale: camera.scale,
          anchorWorld: screenToWorld(m.x, m.y),
          moved: false,
        };
      }
    });

    svgEl.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!gesture) return;
      if (gesture.type === 'pan' && activePointers.size === 1) {
        const dx = e.clientX - gesture.lastX;
        const dy = e.clientY - gesture.lastY;
        if (gesture.startX === undefined) { gesture.startX = gesture.lastX; gesture.startY = gesture.lastY; }
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 6) gesture.moved = true;
        camera.x -= dx / camera.scale;
        camera.y -= dy / camera.scale;
        gesture.lastX = e.clientX;
        gesture.lastY = e.clientY;
        applyViewBox();
      } else if (gesture.type === 'pinch' && activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const newDist = dist(pts[0], pts[1]) || 1;
        const newMid = mid(pts[0], pts[1]);
        camera.scale = clampScale(gesture.startScale * (newDist / gesture.startDist));
        const rect = svgRect();
        camera.x = gesture.anchorWorld.x - (newMid.x - rect.left - rect.width / 2) / camera.scale;
        camera.y = gesture.anchorWorld.y - (newMid.y - rect.top - rect.height / 2) / camera.scale;
        gesture.moved = true;
        applyViewBox();
      }
    });

    function endPointer(e, isTapCandidate) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);
      try { svgEl.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (activePointers.size === 0) {
        if (isTapCandidate && gesture && gesture.type === 'pan' && !gesture.moved) {
          handleTap(gesture.downTarget);
        }
        gesture = null;
      } else if (activePointers.size === 1) {
        const remaining = [...activePointers.values()][0];
        gesture = { type: 'pan', lastX: remaining.x, lastY: remaining.y, moved: true };
      }
    }
    svgEl.addEventListener('pointerup', (e) => endPointer(e, true));
    svgEl.addEventListener('pointercancel', (e) => endPointer(e, false));

    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    window.addEventListener('resize', () => applyViewBox());
  }

  // ---------- node interaction ----------
  // Nodes and cables are fixed on the map: a tap (finger or mouse, without
  // movement) toggles/opens things, any movement pans the camera instead.
  function handleTap(target) {
    const project = getActiveProject();
    if (!project || !target) return;
    const lineEl = target.closest && target.closest('.connection-line');
    if (lineEl) {
      if (mode === 'delete' && isAdmin()) deleteConnection(lineEl.dataset.connId);
      return;
    }
    const groupEl = target.closest && target.closest('.node-group');
    if (groupEl) {
      const node = project.nodes.find((n) => n.id === groupEl.dataset.nodeId);
      if (node) handleNodeClick(node, (target.dataset && target.dataset.kind) || 'body');
      return;
    }
    if (mode === 'connect' && pendingConnectFrom) {
      pendingConnectFrom = null;
      renderCanvas();
    }
  }

  function handleNodeClick(node, kind) {
    if (mode === 'delete' && isAdmin()) {
      deleteNode(node.id);
      return;
    }
    if (mode === 'connect' && isAdmin()) {
      if (!pendingConnectFrom) {
        pendingConnectFrom = node.id;
        renderCanvas();
      } else if (pendingConnectFrom === node.id) {
        pendingConnectFrom = null;
        renderCanvas();
      } else {
        addConnection(pendingConnectFrom, node.id);
        pendingConnectFrom = null;
        render();
      }
      return;
    }
    // select mode
    if (kind === 'hub' || kind === 'body' || !canEdit()) {
      openNodeModal(node.id);
    } else if (kind.startsWith('wedge-')) {
      const catId = kind.slice(6);
      node.status[catId] = node.status[catId] && !node.status[catId].partial ? null : checkStamp();
      touchAndSave();
      renderCanvas();
      renderProgress();
    } else if (kind.startsWith('micro-')) {
      const varId = kind.slice(6);
      node.micro[varId] = node.micro[varId] && !node.micro[varId].partial ? null : checkStamp();
      touchAndSave();
      renderCanvas();
      renderProgress();
    }
  }

  // ---------- rendering ----------
  function render() {
    renderProjectSelect();
    renderHeader();
    renderCategories();
    renderMicroList();
    renderCanvas();
    renderProgress();
    renderPunchList();
    applyPermissionClasses();
  }

  function renderHeader() {
    const project = getActiveProject();
    const el = document.getElementById('updated-at');
    el.textContent = project ? `Updated: ${formatDate(project.updatedAt)}` : '';
  }

  function renderProjectSelect() {
    const sel = document.getElementById('project-select');
    sel.innerHTML = '';
    Object.values(state.projects)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === state.activeProjectId) opt.selected = true;
        sel.appendChild(opt);
      });
  }

  function toHex(color) {
    if (color.startsWith('#')) return color;
    const m = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!m) return '#888888';
    const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r; let g; let b;
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toH = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toH(r)}${toH(g)}${toH(b)}`;
  }

  function renderCategoryGroup(listEl, items, groupKey) {
    const project = getActiveProject();
    listEl.innerHTML = '';
    const admin = isAdmin();

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'category-row';

      if (admin) {
        const color = document.createElement('input');
        color.type = 'color';
        color.value = toHex(item.color);
        color.addEventListener('input', () => {
          item.color = color.value;
          touchAndSave();
          renderCanvas();
          renderProgress();
        });

        const name = document.createElement('input');
        name.type = 'text';
        name.value = item.name;
        name.addEventListener('change', () => {
          item.name = name.value.trim() || item.name;
          touchAndSave();
          renderProgress();
        });

        const move = document.createElement('button');
        move.className = 'btn btn-ghost';
        move.textContent = '⇄';
        move.title = groupKey === 'categories' ? 'Move to secondary' : 'Move to main';
        move.addEventListener('click', () => {
          const from = groupKey === 'categories' ? project.categories : project.microVars;
          const to = groupKey === 'categories' ? project.microVars : project.categories;
          const max = groupKey === 'categories' ? MAX_MICRO : MAX_CATEGORIES;
          if (to.length >= max) { showToast('Target group is full.'); return; }
          const idx = from.findIndex((c) => c.id === item.id);
          from.splice(idx, 1);
          to.push(item);
          const fromMap = groupKey === 'categories' ? 'status' : 'micro';
          const toMap = groupKey === 'categories' ? 'micro' : 'status';
          project.nodes.forEach((n) => {
            n[toMap][item.id] = n[fromMap][item.id] || null;
            delete n[fromMap][item.id];
          });
          touchAndSave();
          render();
        });

        const del = document.createElement('button');
        del.className = 'btn btn-ghost btn-danger';
        del.textContent = '✕';
        del.title = 'Delete category';
        del.addEventListener('click', () => {
          if (!confirm(`Delete category "${item.name}"?`)) return;
          if (groupKey === 'categories') {
            project.categories = project.categories.filter((c) => c.id !== item.id);
            project.nodes.forEach((n) => { delete n.status[item.id]; });
          } else {
            project.microVars = project.microVars.filter((c) => c.id !== item.id);
            project.nodes.forEach((n) => { delete n.micro[item.id]; });
          }
          touchAndSave();
          render();
        });

        li.append(color, name, move, del);
      } else {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = item.color;
        const name = document.createElement('span');
        name.className = 'category-name';
        name.textContent = item.name;
        li.append(dot, name);
      }
      listEl.appendChild(li);
    });
  }

  function renderCategories() {
    const project = getActiveProject();
    if (!project) return;
    const badge = document.getElementById('cat-count-badge');
    badge.textContent = `${project.categories.length}/${MAX_CATEGORIES}`;
    const addBtn = document.getElementById('btn-add-category');
    addBtn.disabled = project.categories.length >= MAX_CATEGORIES;
    renderCategoryGroup(document.getElementById('category-list'), project.categories, 'categories');
  }

  function renderMicroList() {
    const project = getActiveProject();
    if (!project) return;
    const badge = document.getElementById('micro-count-badge');
    badge.textContent = `${project.microVars.length}/${MAX_MICRO}`;
    const addBtn = document.getElementById('btn-add-micro');
    addBtn.disabled = project.microVars.length >= MAX_MICRO;
    renderCategoryGroup(document.getElementById('micro-list'), project.microVars, 'microVars');
  }

  function statusFill(stamp, item) {
    if (!stamp) return 'var(--panel)';
    if (stamp.partial) return `url(#hatch-${item.id})`;
    return item.color;
  }

  function renderCanvas() {
    const project = getActiveProject();
    svgEl.innerHTML = '';
    if (!project) return;
    const catCount = project.categories.length;
    const microCount = project.microVars.length;

    // hatch patterns (one per category) for "partially done"
    const defs = document.createElementNS(SVGNS, 'defs');
    project.categories.concat(project.microVars).forEach((item) => {
      const pattern = document.createElementNS(SVGNS, 'pattern');
      pattern.setAttribute('id', `hatch-${item.id}`);
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('width', '7');
      pattern.setAttribute('height', '7');
      pattern.setAttribute('patternTransform', 'rotate(45)');
      const bgRect = document.createElementNS(SVGNS, 'rect');
      bgRect.setAttribute('width', '7');
      bgRect.setAttribute('height', '7');
      bgRect.setAttribute('fill', 'var(--panel)');
      const stripe = document.createElementNS(SVGNS, 'rect');
      stripe.setAttribute('width', '3.5');
      stripe.setAttribute('height', '7');
      stripe.setAttribute('fill', item.color);
      pattern.append(bgRect, stripe);
      defs.appendChild(pattern);
    });
    svgEl.appendChild(defs);

    project.connections.forEach((conn) => {
      const a = project.nodes.find((n) => n.id === conn.a);
      const b = project.nodes.find((n) => n.id === conn.b);
      if (!a || !b) return;
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('data-conn-id', conn.id);
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', `connection-line${mode === 'delete' ? ' deletable' : ''}`);
      svgEl.appendChild(line);
    });

    project.nodes.forEach((node) => {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `node-group${pendingConnectFrom === node.id ? ' selected' : ''}`);
      g.setAttribute('data-node-id', node.id);
      g.setAttribute('transform', `translate(${node.x},${node.y})`);

      if (node.substation) {
        const size = NODE_R * 1.5;
        const rect = document.createElementNS(SVGNS, 'rect');
        rect.setAttribute('x', String(-size / 2));
        rect.setAttribute('y', String(-size / 2));
        rect.setAttribute('width', String(size));
        rect.setAttribute('height', String(size));
        rect.setAttribute('rx', '5');
        rect.setAttribute('class', 'substation-marker');
        rect.setAttribute('data-kind', 'hub');
        g.appendChild(rect);

        const bolt = document.createElementNS(SVGNS, 'image');
        bolt.setAttribute('href', 'assets/pictos/picto_eclair.png');
        bolt.setAttribute('x', String(-size * 0.22));
        bolt.setAttribute('y', String(-size * 0.42));
        bolt.setAttribute('width', String(size * 0.44));
        bolt.setAttribute('height', String(size * 0.62));
        bolt.setAttribute('class', 'substation-icon-img');
        bolt.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        g.appendChild(bolt);

        const ossLabel = document.createElementNS(SVGNS, 'text');
        ossLabel.setAttribute('x', '0');
        ossLabel.setAttribute('y', String(size / 2 - 5));
        ossLabel.setAttribute('text-anchor', 'middle');
        ossLabel.setAttribute('class', 'substation-label');
        ossLabel.textContent = node.label;
        g.appendChild(ossLabel);

        svgEl.appendChild(g);
        return;
      }

      if (catCount === 0) {
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('r', String(NODE_R));
        circle.setAttribute('class', 'node-wedge');
        circle.setAttribute('data-kind', 'body');
        circle.style.fill = 'var(--panel)';
        g.appendChild(circle);
      } else if (catCount === 1) {
        const cat = project.categories[0];
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('r', String(NODE_R));
        circle.setAttribute('class', 'node-wedge');
        circle.setAttribute('data-kind', `wedge-${cat.id}`);
        circle.style.fill = statusFill(node.status[cat.id], cat);
        g.appendChild(circle);
      } else {
        const slice = (2 * Math.PI) / catCount;
        project.categories.forEach((cat, i) => {
          const start = -Math.PI / 2 + i * slice;
          const end = start + slice;
          const path = document.createElementNS(SVGNS, 'path');
          path.setAttribute('d', wedgePath(0, 0, NODE_R, start, end));
          path.setAttribute('class', 'node-wedge');
          path.setAttribute('data-kind', `wedge-${cat.id}`);
          path.style.fill = statusFill(node.status[cat.id], cat);
          g.appendChild(path);
        });
      }

      if (microCount > 0) {
        const microSlice = (2 * Math.PI) / microCount;
        project.microVars.forEach((mv, i) => {
          const spans = microCount === 1
            ? [[-Math.PI / 2, Math.PI / 2], [Math.PI / 2, (3 * Math.PI) / 2]]
            : [[-Math.PI / 2 + i * microSlice, -Math.PI / 2 + (i + 1) * microSlice]];
          spans.forEach(([a0, a1]) => {
            const cell = document.createElementNS(SVGNS, 'path');
            cell.setAttribute('d', ringSegmentPath(RING_IN, RING_OUT, a0, a1));
            cell.setAttribute('class', 'node-ring-cell');
            cell.setAttribute('data-kind', `micro-${mv.id}`);
            cell.style.fill = statusFill(node.micro[mv.id], mv);
            g.appendChild(cell);
          });
        });
      }

      const hub = document.createElementNS(SVGNS, 'circle');
      hub.setAttribute('r', String(HUB_R));
      hub.setAttribute('class', 'node-hub node-hub-ring');
      hub.setAttribute('data-kind', 'hub');
      g.appendChild(hub);

      if (node.issue) {
        const x = document.createElementNS(SVGNS, 'text');
        const xPos = polar(RING_OUT + 10, -Math.PI / 4);
        x.setAttribute('x', String(xPos.x));
        x.setAttribute('y', String(xPos.y));
        x.setAttribute('class', 'node-issue-x');
        x.setAttribute('font-size', '14');
        x.textContent = '✕';
        g.appendChild(x);
      }

      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', String(RING_OUT + 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'node-label');
      label.textContent = node.label;
      g.appendChild(label);

      svgEl.appendChild(g);
    });
  }

  function renderProgress() {
    const project = getActiveProject();
    const overallEl = document.getElementById('progress-overall');
    const listEl = document.getElementById('progress-list');
    overallEl.innerHTML = '';
    listEl.innerHTML = '';
    if (!project) return;
    const foundationNodes = project.nodes.filter((n) => !n.substation);
    const nodeCount = foundationNodes.length;
    let totalDone = 0;
    let totalSlots = 0;

    function addGroup(title, items, statusKey) {
      if (!items.length) return;
      const header = document.createElement('div');
      header.className = 'hint';
      header.style.margin = '2px 0';
      header.innerHTML = `<strong>${escapeHtml(title)}</strong>`;
      listEl.appendChild(header);
      items.forEach((item) => {
        const done = foundationNodes.filter((n) => n[statusKey][item.id] && !n[statusKey][item.id].partial).length;
        totalDone += done;
        totalSlots += nodeCount;
        const pct = nodeCount ? Math.round((done / nodeCount) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
          <div class="progress-row-label"><span>${escapeHtml(item.name)}</span><span class="pct">${done}/${nodeCount} · ${pct}%</span></div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%; background:${item.color}"></div></div>
        `;
        listEl.appendChild(row);
      });
    }

    addGroup('Main categories', project.categories, 'status');
    addGroup('Secondary categories', project.microVars, 'micro');

    const overallPct = totalSlots ? Math.round((totalDone / totalSlots) * 100) : 0;
    overallEl.innerHTML = `
      <div class="progress-row-label"><span><strong>Overall progress</strong></span><span class="pct">${overallPct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${overallPct}%; background:var(--accent)"></div></div>
      <div class="hint" style="margin:6px 0 0;">${nodeCount} foundations</div>
    `;
  }

  function renderPunchList() {
    const project = getActiveProject();
    const ul = document.getElementById('punch-list');
    ul.innerHTML = '';
    if (!project) return;
    project.punchList.filter((item) => !item.deleted).forEach((item) => {
      const li = document.createElement('li');
      li.className = `punch-item${item.done ? ' done' : ''}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.disabled = !canEdit();
      cb.addEventListener('change', () => {
        item.done = cb.checked;
        item.doneBy = cb.checked && user ? user.name : null;
        item.updatedAt = new Date().toISOString();
        touchAndSave();
        renderPunchList();
      });

      const span = document.createElement('span');
      span.textContent = item.text;
      li.append(cb, span);

      if (item.done && item.doneBy) {
        const by = document.createElement('span');
        by.className = 'check-meta';
        by.textContent = item.doneBy;
        li.appendChild(by);
      }

      if (canEdit()) {
        const del = document.createElement('button');
        del.className = 'btn btn-ghost';
        del.textContent = '✕';
        del.addEventListener('click', () => {
          // tombstone instead of removal so the deletion syncs to teammates
          item.deleted = true;
          item.updatedAt = new Date().toISOString();
          touchAndSave();
          renderPunchList();
        });
        li.appendChild(del);
      }

      ul.appendChild(li);
    });
  }

  // ---------- node modal ----------
  function currentModalNode() {
    const project = getActiveProject();
    return project && project.nodes.find((n) => n.id === openNodeId);
  }

  function stampState(stamp) {
    if (!stamp) return 'none';
    return stamp.partial ? 'partial' : 'done';
  }

  function renderModalChecklist(listEl, items, node, statusKey) {
    listEl.innerHTML = '';
    const editable = canEdit();

    if (editable && items.length > 1) {
      const li = document.createElement('li');
      li.className = 'modal-check-all';
      const allDone = items.every((item) => stampState(node[statusKey][item.id]) === 'done');
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.textContent = allDone ? 'Uncheck all' : 'Check all';
      btn.addEventListener('click', () => {
        items.forEach((item) => {
          if (allDone) node[statusKey][item.id] = null;
          else if (stampState(node[statusKey][item.id]) !== 'done') node[statusKey][item.id] = checkStamp();
        });
        touchAndSave();
        renderCanvas();
        renderProgress();
        renderModalChecklist(listEl, items, node, statusKey);
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'modal-category-row';

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;

      const label = document.createElement('span');
      label.textContent = item.name;
      label.className = 'modal-category-name';

      li.append(dot, label);

      const stamp = node[statusKey][item.id];
      const stateNow = stampState(stamp);

      if (editable) {
        const seg = document.createElement('span');
        seg.className = 'segmented';
        [
          { key: 'none', text: '—', title: 'Not done' },
          { key: 'partial', text: '◧', title: 'Partially done' },
          { key: 'done', text: '✓', title: 'Done' },
        ].forEach((opt) => {
          const b = document.createElement('button');
          b.className = `seg-btn${stateNow === opt.key ? ' active' : ''}`;
          b.textContent = opt.text;
          b.title = opt.title;
          b.addEventListener('click', () => {
            if (opt.key === 'none') node[statusKey][item.id] = null;
            else node[statusKey][item.id] = checkStamp(opt.key === 'partial');
            touchAndSave();
            renderCanvas();
            renderProgress();
            renderModalChecklist(listEl, items, node, statusKey);
          });
          seg.appendChild(b);
        });
        li.appendChild(seg);

        const commentBtn = document.createElement('button');
        commentBtn.className = 'btn btn-ghost btn-comment';
        commentBtn.textContent = '💬';
        commentBtn.title = 'Task comment';
        commentBtn.addEventListener('click', () => {
          const current = node.taskComments[item.id] || '';
          const next = prompt(`Comment for "${item.name}" on ${node.label}:`, current);
          if (next === null) return;
          if (next.trim()) node.taskComments[item.id] = next.trim();
          else delete node.taskComments[item.id];
          touchAndSave();
          renderModalChecklist(listEl, items, node, statusKey);
        });
        li.appendChild(commentBtn);
      } else if (stateNow !== 'none') {
        const badge = document.createElement('span');
        badge.className = 'state-badge';
        badge.textContent = stateNow === 'done' ? '✓ done' : '◧ partial';
        li.appendChild(badge);
      }

      const metaText = formatStamp(stamp);
      if (metaText) {
        const meta = document.createElement('span');
        meta.className = 'check-meta';
        meta.textContent = stateNow === 'partial' ? `partial · ${metaText}` : metaText;
        li.appendChild(meta);
      }

      const comment = node.taskComments[item.id];
      if (comment) {
        const c = document.createElement('div');
        c.className = 'task-comment';
        c.textContent = `💬 ${comment}`;
        li.appendChild(c);
      }

      listEl.appendChild(li);
    });
  }

  function renderModalReports(node) {
    const project = getActiveProject();
    const listEl = document.getElementById('modal-reports');
    listEl.innerHTML = '';
    const editable = canEdit();

    project.reportTypes.forEach((rt) => {
      const entries = node.reports[rt.id] || [];
      const li = document.createElement('li');
      li.className = 'modal-category-row report-row';

      const label = document.createElement('span');
      label.className = 'modal-category-name';
      label.textContent = rt.name;
      li.appendChild(label);

      const count = document.createElement('span');
      count.className = 'report-count';
      count.textContent = `×${entries.length}`;
      li.appendChild(count);

      if (editable) {
        const add = document.createElement('button');
        add.className = 'btn btn-ghost';
        add.textContent = '+1';
        add.title = 'Add one occurrence (now)';
        add.addEventListener('click', () => {
          node.reports[rt.id] = entries.concat([checkStamp()]);
          touchAndSave();
          renderModalReports(node);
        });
        li.appendChild(add);

        if (entries.length) {
          const undo = document.createElement('button');
          undo.className = 'btn btn-ghost';
          undo.textContent = '↺';
          undo.title = 'Remove last occurrence';
          undo.addEventListener('click', () => {
            node.reports[rt.id] = entries.slice(0, -1);
            touchAndSave();
            renderModalReports(node);
          });
          li.appendChild(undo);
        }
      }

      if (entries.length) {
        const details = document.createElement('details');
        details.className = 'report-dates';
        const summary = document.createElement('summary');
        summary.textContent = `last: ${formatStamp(entries[entries.length - 1])}`;
        details.appendChild(summary);
        const ul = document.createElement('ul');
        entries.slice().reverse().forEach((e) => {
          const d = document.createElement('li');
          d.textContent = formatStamp(e);
          ul.appendChild(d);
        });
        details.appendChild(ul);
        li.appendChild(details);
      }

      listEl.appendChild(li);
    });
  }

  function openNodeModal(nodeId) {
    openNodeId = nodeId;
    const node = currentModalNode();
    if (!node) return;
    const project = getActiveProject();

    const labelInput = document.getElementById('modal-label');
    labelInput.value = node.label;
    labelInput.disabled = !isAdmin();

    // discreet geographic coordinates + Google Maps link
    const geoEl = document.getElementById('modal-geo');
    const coords = COORDS[node.label];
    if (coords) {
      geoEl.innerHTML = `<span>${escapeHtml(coords[2])}</span>`
        + ` · <a href="https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}" target="_blank" rel="noopener">📍 Google Maps</a>`;
      geoEl.classList.remove('hidden');
    } else {
      geoEl.classList.add('hidden');
    }
    document.getElementById('modal-issue').checked = !!node.issue;
    const noteEl = document.getElementById('modal-note');
    noteEl.value = node.note || '';
    noteEl.disabled = !canEdit();
    document.getElementById('modal-title').textContent = node.substation ? 'Substation details' : `Foundation ${node.label}`;

    const catListEl = document.getElementById('modal-categories');
    const microListEl = document.getElementById('modal-micro');
    const reportsEl = document.getElementById('modal-reports');
    if (node.substation) {
      catListEl.innerHTML = '<li class="hint">Not applicable to the substation.</li>';
      microListEl.innerHTML = '';
      reportsEl.innerHTML = '';
    } else {
      renderModalChecklist(catListEl, project.categories, node, 'status');
      renderModalChecklist(microListEl, project.microVars, node, 'micro');
      renderModalReports(node);
    }

    document.getElementById('node-modal').classList.remove('hidden');
  }

  function closeModalAndRender() {
    document.getElementById('node-modal').classList.add('hidden');
    openNodeId = null;
    render();
  }

  // ---------- 24h recap & CSV backup ----------
  function recapLinesForNode(node, project, sinceMs) {
    const lines = [];
    const isRecent = (stamp) => stamp && stamp.at && (Date.now() - new Date(stamp.at).getTime()) <= sinceMs;

    project.categories.forEach((cat) => {
      const st = node.status[cat.id];
      if (isRecent(st)) lines.push(`- ${cat.name} → ${st.partial ? '◧ partial' : '✅'}`);
    });
    project.microVars.forEach((mv) => {
      const st = node.micro[mv.id];
      if (isRecent(st)) lines.push(`- ${mv.name} → ${st.partial ? '◧ partial' : '✅'}`);
    });
    project.reportTypes.forEach((rt) => {
      const recent = (node.reports[rt.id] || []).filter(isRecent);
      if (recent.length) lines.push(`- ${rt.name} ×${recent.length} → ✅`);
    });
    return lines;
  }

  function copyRecap(nodesToScan) {
    const project = getActiveProject();
    const dayMs = 24 * 3600 * 1000;
    const blocks = [];
    nodesToScan.filter((n) => !n.substation).forEach((node) => {
      const lines = recapLinesForNode(node, project, dayMs);
      if (lines.length) blocks.push([`■ FOU → ${node.label}`, ...lines].join('\n'));
    });
    if (!blocks.length) {
      showToast('No completed task in the last 24h.');
      return;
    }
    copyText(blocks.join('\n\n'), 'Recap copied — paste it in WhatsApp.');
  }

  function exportCsv() {
    const project = getActiveProject();
    const sep = ';';
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = [['Foundation', 'Group', 'Task', 'State', 'Date', 'By', 'Comment'].join(sep)];

    project.nodes.filter((n) => !n.substation).forEach((node) => {
      const pushRow = (group, name, stamp, comment) => {
        const stateTxt = stamp ? (stamp.partial ? 'Partial' : 'Done') : 'Not done';
        rows.push([
          q(node.label), q(group), q(name), q(stateTxt),
          q(stamp && stamp.at ? formatDate(stamp.at) : ''),
          q(stamp && stamp.by ? stamp.by : ''),
          q(comment || ''),
        ].join(sep));
      };
      project.categories.forEach((cat) => pushRow('Main', cat.name, node.status[cat.id], node.taskComments[cat.id]));
      project.microVars.forEach((mv) => pushRow('Secondary', mv.name, node.micro[mv.id], node.taskComments[mv.id]));
      project.reportTypes.forEach((rt) => {
        (node.reports[rt.id] || []).forEach((entry) => {
          rows.push([q(node.label), q('Report'), q(rt.name), q('Occurrence'), q(formatDate(entry.at)), q(entry.by || ''), q('')].join(sep));
        });
      });
      if (node.note) rows.push([q(node.label), q('Note'), q('Free note'), q(''), q(''), q(''), q(node.note)].join(sep));
    });

    const dateTag = new Date().toISOString().slice(0, 10);
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treFOU_backup_${dateTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
    showToast('CSV backup downloaded.');
  }

  // ---------- method statements ----------
  function getProcedure(project, itemId) {
    if (!project.procedures[itemId]) {
      project.procedures[itemId] = { en: '', fr: '', tools: '', ppe: '' };
    }
    return project.procedures[itemId];
  }

  function renderProcedures() {
    const project = getActiveProject();
    const body = document.getElementById('proc-body');
    body.innerHTML = '';
    const admin = isAdmin();
    const items = project.categories.concat(project.microVars);

    document.getElementById('proc-lang').textContent = procLang === 'en' ? '🇫🇷 FR' : '🇬🇧 EN';

    items.forEach((item) => {
      const proc = getProcedure(project, item.id);
      const details = document.createElement('details');
      details.className = 'proc-item';

      const summary = document.createElement('summary');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      summary.append(dot, document.createTextNode(` ${item.name}`));
      details.appendChild(summary);

      const sections = [
        { key: procLang, label: procLang === 'en' ? 'Method statement (EN)' : 'Mode opératoire (FR)' },
        { key: 'tools', label: 'Tools & consumables' },
        { key: 'ppe', label: 'PPE & required trainings' },
      ];

      sections.forEach((section) => {
        const wrap = document.createElement('div');
        wrap.className = 'proc-section';
        const h = document.createElement('h4');
        h.textContent = section.label;
        wrap.appendChild(h);
        if (admin) {
          const ta = document.createElement('textarea');
          ta.rows = 4;
          ta.value = proc[section.key] || '';
          ta.placeholder = 'To be completed…';
          ta.addEventListener('change', () => {
            proc[section.key] = ta.value;
            touchAndSave();
          });
          wrap.appendChild(ta);
        } else {
          const p = document.createElement('p');
          p.className = proc[section.key] ? 'proc-text' : 'proc-text proc-empty';
          p.textContent = proc[section.key] || 'To be completed…';
          wrap.appendChild(p);
        }
        details.appendChild(wrap);
      });

      body.appendChild(details);
    });
  }

  // ---------- drawers (mobile) ----------
  function closeDrawers() {
    document.getElementById('panel-left').classList.remove('open');
    document.getElementById('panel-right').classList.remove('open');
    document.getElementById('drawer-backdrop').classList.remove('visible');
  }

  function toggleDrawer(side) {
    const el = document.getElementById(`panel-${side}`);
    const isOpen = el.classList.contains('open');
    closeDrawers();
    if (!isOpen) {
      el.classList.add('open');
      document.getElementById('drawer-backdrop').classList.add('visible');
    }
  }

  // ---------- static listeners ----------
  function attachStaticListeners() {
    // login
    document.getElementById('login-visitor').addEventListener('click', () => loginAs('Visitor', 'visitor'));
    document.getElementById('login-cancel').addEventListener('click', () => {
      pendingLoginName = null;
      document.getElementById('login-password').classList.add('hidden');
    });
    document.getElementById('login-password-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const value = document.getElementById('login-password-input').value.trim();
      if (pendingLoginName && value.toUpperCase() === PASSWORD) {
        loginAs(pendingLoginName, 'tech');
      } else {
        document.getElementById('login-error').classList.remove('hidden');
      }
    });
    document.getElementById('btn-logout').addEventListener('click', logout);

    document.getElementById('btn-admin-toggle').addEventListener('click', () => {
      if (!isAdminName()) return;
      user.admin = !user.admin;
      saveUser();
      render();
    });

    document.getElementById('project-select').addEventListener('change', (e) => {
      state.activeProjectId = e.target.value;
      pendingConnectFrom = null;
      saveState();
      render();
      safeFitToContent();
      startSync();
    });

    document.getElementById('btn-new-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const name = prompt('New project name', 'New project');
      if (name === null) return;
      const project = createEmptyProject(name.trim() || 'New project');
      project.reportTypes = defaultReportTypes();
      state.projects[project.id] = project;
      state.activeProjectId = project.id;
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-rename-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      const name = prompt('Rename project', project.name);
      if (name === null) return;
      project.name = name.trim() || project.name;
      touchAndSave();
      render();
      startSync(); // the sync path follows the project name
    });

    document.getElementById('btn-delete-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      if (Object.keys(state.projects).length <= 1) {
        alert('Cannot delete the last project.');
        return;
      }
      if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
      delete state.projects[project.id];
      state.activeProjectId = Object.keys(state.projects)[0];
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-add-category').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project || project.categories.length >= MAX_CATEGORIES) return;
      const name = prompt('Category name', 'New category');
      if (name === null) return;
      const cat = { id: uid(), name: name.trim() || 'Category', color: microPaletteColor(project.categories.length * 2) };
      project.categories.push(cat);
      project.nodes.forEach((n) => { n.status[cat.id] = null; });
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-micro').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project || project.microVars.length >= MAX_MICRO) return;
      const name = prompt('Category name', 'New category');
      if (name === null) return;
      const mv = { id: uid(), name: name.trim() || 'Category', color: microPaletteColor(project.microVars.length) };
      project.microVars.push(mv);
      project.nodes.forEach((n) => { n.micro[mv.id] = null; });
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-node').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      const world = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      const node = {
        id: uid(),
        label: `P${project.nodes.length + 1}`,
        x: world.x,
        y: world.y,
        status: {},
        micro: {},
        taskComments: {},
        reports: {},
        issue: false,
        note: '',
      };
      project.categories.forEach((cat) => { node.status[cat.id] = null; });
      project.microVars.forEach((mv) => { node.micro[mv.id] = null; });
      project.nodes.push(node);
      touchAndSave();
      render();
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        pendingConnectFrom = null;
        document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
        updateCanvasHint();
        renderCanvas();
      });
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      const rect = svgRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.4);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      const rect = svgRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.4);
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', fitToContent);

    document.getElementById('btn-drawer-left').addEventListener('click', () => toggleDrawer('left'));
    document.getElementById('btn-drawer-right').addEventListener('click', () => toggleDrawer('right'));
    document.getElementById('drawer-backdrop').addEventListener('click', closeDrawers);

    document.getElementById('punch-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!canEdit()) return;
      const project = getActiveProject();
      if (!project) return;
      const input = document.getElementById('punch-input');
      const text = input.value.trim();
      if (!text) return;
      project.punchList.unshift({ id: uid(), text, done: false, by: user.name, at: new Date().toISOString() });
      input.value = '';
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-close').addEventListener('click', closeModalAndRender);
    document.getElementById('modal-save').addEventListener('click', closeModalAndRender);

    document.getElementById('modal-label').addEventListener('input', (e) => {
      if (!isAdmin()) return;
      const node = currentModalNode();
      if (!node) return;
      node.label = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-issue').addEventListener('change', (e) => {
      if (!canEdit()) { e.target.checked = !e.target.checked; return; }
      const node = currentModalNode();
      if (!node) return;
      node.issue = e.target.checked;
      touchAndSave();
    });

    document.getElementById('modal-note').addEventListener('input', (e) => {
      if (!canEdit()) return;
      const node = currentModalNode();
      if (!node) return;
      node.note = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-recap').addEventListener('click', () => {
      const node = currentModalNode();
      if (node) copyRecap([node]);
    });

    document.getElementById('modal-add-punch').addEventListener('click', () => {
      if (!canEdit()) return;
      const node = currentModalNode();
      const project = getActiveProject();
      if (!node || !project) return;
      const value = prompt('Punch list entry', `${node.label} — `);
      if (value === null) return;
      project.punchList.unshift({ id: uid(), text: value, done: false, by: user.name, at: new Date().toISOString() });
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-delete').addEventListener('click', () => {
      if (!isAdmin() || !openNodeId) return;
      if (!confirm('Delete this point and its cables?')) return;
      const idToDelete = openNodeId;
      document.getElementById('node-modal').classList.add('hidden');
      openNodeId = null;
      deleteNode(idToDelete);
    });

    document.getElementById('btn-recap-all').addEventListener('click', () => {
      const project = getActiveProject();
      if (project) copyRecap(project.nodes);
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportCsv);

    document.getElementById('btn-procedures').addEventListener('click', () => {
      renderProcedures();
      document.getElementById('proc-modal').classList.remove('hidden');
    });
    document.getElementById('proc-close').addEventListener('click', () => {
      document.getElementById('proc-modal').classList.add('hidden');
    });
    document.getElementById('proc-lang').addEventListener('click', () => {
      procLang = procLang === 'en' ? 'fr' : 'en';
      renderProcedures();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^a-z0-9]+/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      markExported();
      showToast('Project exported — share the file to sync another phone.');
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      if (!canEdit()) return;
      document.getElementById('file-import').click();
    });

    document.getElementById('file-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!imported || !Array.isArray(imported.categories) || !Array.isArray(imported.nodes)) {
            throw new Error('invalid project format');
          }
          normalizeProject(imported);
          const targetProject = Object.values(state.projects).find((p) => p.name === imported.name);
          if (targetProject && confirm(
            `A project named "${imported.name}" already exists.\n\n`
            + 'OK = MERGE the imported data into it (most recent state per task wins, nothing is deleted).\n'
            + 'Cancel = keep it as a separate copy.',
          )) {
            mergeProjects(targetProject, imported);
            state.activeProjectId = targetProject.id;
            touchAndSave();
            render();
            safeFitToContent();
            showToast('Merged — most recent state kept for every task.');
          } else {
            imported.id = uid();
            if (targetProject) imported.name = `${imported.name} (imported)`;
            imported.updatedAt = new Date().toISOString();
            state.projects[imported.id] = imported;
            state.activeProjectId = imported.id;
            saveState();
            render();
            safeFitToContent();
          }
        } catch (err) {
          alert(`Invalid file: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('proc-modal').classList.contains('hidden')) {
        document.getElementById('proc-modal').classList.add('hidden');
      } else if (!document.getElementById('node-modal').classList.contains('hidden')) {
        closeModalAndRender();
      } else if (document.getElementById('panel-left').classList.contains('open')
        || document.getElementById('panel-right').classList.contains('open')) {
        closeDrawers();
      } else if (pendingConnectFrom) {
        pendingConnectFrom = null;
        renderCanvas();
      }
    });
  }

  function updateCanvasHint() {
    const hints = {
      select: 'Tap a slice or ring cell to check it. Centre = details. Drag to navigate.',
      connect: 'Tap a first point then a second one to add a cable.',
      delete: 'Tap a point or a cable to delete it.',
    };
    document.getElementById('canvas-hint').textContent = hints[mode] || '';
  }

  // ---------- init ----------
  function init() {
    state = loadState();
    saveState();
    dailySnapshot();
    user = loadUser();
    svgEl = document.getElementById('canvas');
    renderLogin();
    attachStaticListeners();
    setupCameraGestures();
    updateCanvasHint();
    applyPermissionClasses();
    render();
    safeFitToContent();
    startSync();
    if (!user) showLogin();
    else maybeRemindBackup();
  }

  init();
})();
