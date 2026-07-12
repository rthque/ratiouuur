(() => {
  'use strict';

  const STORAGE_KEY = 'worksite-tracker:v5';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const NODE_R = 24;       // inner pie radius (8 main categories)
  const HUB_R = 7;         // center hub (open details)
  const RING_IN = 26;      // second ring (16 secondary variables), inner radius
  const RING_OUT = 36;     // second ring, outer radius
  const GRID_UNIT = 120;   // world-space spacing between adjacent grid cells

  const MAX_CATEGORIES = 8;
  const MAX_MICRO = 16;

  // Grid reconstructed from the paper punch-list poster (letter column A–M, no I,
  // numeric row 1–7). This is a best-effort reading of the photo — positions and
  // labels can be corrected afterwards by dragging / renaming any point.
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
    J: [1, 2, 4, 5, 6, 7],
    K: [3, 4, 5, 6, 7],
    L: [1, 2, 4, 5, 6, 7],
    M: [1, 2, 3, 4, 5, 6, 7],
  };

  // Inter-array cable strings, read segment by segment off the reference site
  // map ("Dieppe Le Tréport"): each cable there is labelled with its endpoint
  // pair — e.g. WT62 (G4-E4), WT72 (H4-E3), WT12 (K4-J4) — and the WT
  // numbering walks each string outward from the OSS, which pins the feeder
  // of every string. 8 strings radiate from the OSS (which sits on the empty
  // L3 grid slot).
  const STRING_EDGES = [
    // String rangée 7 : OSS→K7→J7→…→D7 (WT31-37)
    ['OSS', 'K7'], ['K7', 'J7'], ['J7', 'H7'], ['H7', 'G7'], ['G7', 'F7'], ['F7', 'E7'], ['E7', 'D7'],
    // String rangée 6, feeder en K5 (WT41-48)
    ['OSS', 'K5'], ['K5', 'K6'], ['K6', 'J6'], ['J6', 'H6'], ['H6', 'G6'], ['G6', 'F6'], ['F6', 'E6'], ['E6', 'D6'],
    // String rangée 5, feeder en K4 via J4 (WT11-18)
    ['OSS', 'K4'], ['K4', 'J4'], ['J4', 'J5'], ['J5', 'H5'], ['H5', 'G5'], ['G5', 'F5'], ['F5', 'E5'], ['E5', 'D5'],
    // String rangée 4 puis colonne A (WT61-68)
    ['OSS', 'G4'], ['G4', 'E4'], ['E4', 'D4'], ['D4', 'C4'], ['C4', 'B4'], ['B4', 'A4'], ['A4', 'A3'], ['A3', 'A2'],
    // String H4 → rangée 3, avec antennes C2 et E2 (WT71-78)
    ['OSS', 'H4'], ['H4', 'E3'], ['E3', 'D3'], ['D3', 'C3'], ['C3', 'B3'], ['B3', 'B2'], ['C3', 'C2'], ['E3', 'E2'],
    // String sud : J1 puis rangées 1 et 2 (WT81-88)
    ['OSS', 'J1'], ['J1', 'J2'], ['J1', 'H1'], ['H1', 'H2'], ['H2', 'G2'], ['G2', 'F2'], ['H1', 'G1'], ['G1', 'F1'], ['F1', 'E1'],
    // String L4→L7 en peigne avec les antennes M4→M7 (WT121-128)
    ['OSS', 'L4'], ['L4', 'L5'], ['L5', 'L6'], ['L6', 'L7'], ['L7', 'M7'], ['L4', 'M4'], ['L5', 'M5'], ['L6', 'M6'],
    // String cluster sud-est : K3, L2, L1, M1-M3 (WT151-157)
    ['OSS', 'K3'], ['K3', 'L2'], ['L2', 'L1'], ['L1', 'M1'], ['L2', 'M2'], ['M2', 'M3'],
  ];

  let state = null;
  let mode = 'select'; // 'select' | 'connect' | 'delete'
  let pendingConnectFrom = null;
  let openNodeId = null;
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

  // ---------- grid -> world position (keeps the poster's orientation) ----------
  function gridToWorld(colIndex, row) {
    return {
      x: (colIndex - row) * GRID_UNIT,
      y: -(colIndex + row) * GRID_UNIT,
    };
  }

  // ---------- state ----------
  function createEmptyProject(name) {
    return {
      id: uid(),
      name,
      updatedAt: new Date().toISOString(),
      categories: [],
      microVars: [],
      nodes: [],
      connections: [],
      punchList: [],
    };
  }

  function seedWindFarmProject() {
    const project = createEmptyProject('Parc éolien — 62 fondations');

    const catDefs = [
      { name: 'Cable Cleats', color: '#111827' },
      { name: 'PIM Gate', color: '#2563eb' },
      { name: 'Scotch Kote', color: '#db2777' },
      { name: 'Gearing Repair', color: '#16a34a' },
      { name: 'Boulonnage', color: '#f59e0b' },
      { name: 'Peinture / Revêtement', color: '#7c3aed' },
      { name: 'Anodes sacrificielles', color: '#0891b2' },
      { name: 'Éclairage', color: '#dc2626' },
    ];
    project.categories = catDefs.map((c) => ({ id: uid(), ...c }));

    const microNames = [
      'Échelle', 'Plaque signalétique', 'Caillebotis', 'Fixation cable tray',
      'Portillon', 'Boulon manquant', 'Anode', 'Retouche peinture',
      'Éclairage niveau', 'J-tube', 'Ancrage', 'Garde-corps',
      'Capuchons boulons', 'Mise à la terre', 'Marquage', 'Photo inspection',
    ];
    project.microVars = microNames.map((name, i) => ({ id: uid(), name, color: microPaletteColor(i) }));

    COLS.forEach((col, colIndex) => {
      (COLUMN_ROWS[col] || []).forEach((row) => {
        const pos = gridToWorld(colIndex, row);
        const node = {
          id: uid(),
          label: `${col}${row}`,
          x: pos.x,
          y: pos.y,
          status: {},
          micro: {},
          issue: false,
          note: '',
        };
        project.categories.forEach((cat) => { node.status[cat.id] = false; });
        project.microVars.forEach((mv) => { node.micro[mv.id] = false; });
        project.nodes.push(node);
      });
    });

    // offshore substation (OSS) — sits on the empty L3 grid slot on the
    // reference map, not one of the 62 foundations.
    const lIndex = COLS.indexOf('L');
    const ossPos = gridToWorld(lIndex, 3);
    const oss = {
      id: uid(),
      label: 'OSS',
      x: ossPos.x,
      y: ossPos.y,
      status: {},
      micro: {},
      issue: false,
      note: 'Sous-station électrique (offshore substation)',
      substation: true,
    };
    project.nodes.push(oss);

    // inter-array cable strings, read off the reference site map
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
        if (parsed && parsed.projects && parsed.activeProjectId) return parsed;
      } catch (e) { /* corrupt, fall through to seed */ }
    }
    const demo = seedWindFarmProject();
    return { activeProjectId: demo.id, projects: { [demo.id]: demo } };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function touchAndSave() {
    const project = getActiveProject();
    if (project) project.updatedAt = new Date().toISOString();
    saveState();
  }

  function getActiveProject() {
    return state.projects[state.activeProjectId];
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
        gesture = {
          type: 'pinch',
          startDist: dist(pts[0], pts[1]) || 1,
          startScale: camera.scale,
          startMid: mid(pts[0], pts[1]),
          startCamera: { x: camera.x, y: camera.y },
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
        const worldBefore = screenToWorld(gesture.startMid.x, gesture.startMid.y);
        camera.scale = clampScale(gesture.startScale * (newDist / gesture.startDist));
        const rect = svgRect();
        camera.x = worldBefore.x - (newMid.x - rect.left - rect.width / 2) / camera.scale;
        camera.y = worldBefore.y - (newMid.y - rect.top - rect.height / 2) / camera.scale;
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
      if (mode === 'delete') deleteConnection(lineEl.dataset.connId);
      return;
    }
    const groupEl = target.closest && target.closest('.node-group');
    if (groupEl) {
      const node = project.nodes.find((n) => n.id === groupEl.dataset.nodeId);
      if (node) handleNodeClick(node, (target.dataset && target.dataset.kind) || 'body');
      return;
    }
    // tap on empty canvas
    if (mode === 'connect' && pendingConnectFrom) {
      pendingConnectFrom = null;
      renderCanvas();
    }
  }

  function handleNodeClick(node, kind) {
    if (mode === 'delete') {
      deleteNode(node.id);
      return;
    }
    if (mode === 'connect') {
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
    if (kind === 'hub' || kind === 'body') {
      openNodeModal(node.id);
    } else if (kind.startsWith('wedge-')) {
      const catId = kind.slice(6);
      node.status[catId] = !node.status[catId];
      touchAndSave();
      renderCanvas();
      renderProgress();
    } else if (kind.startsWith('micro-')) {
      const varId = kind.slice(6);
      node.micro[varId] = !node.micro[varId];
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
  }

  function renderHeader() {
    const project = getActiveProject();
    const el = document.getElementById('updated-at');
    if (!project) { el.textContent = ''; return; }
    const d = new Date(project.updatedAt);
    el.textContent = `Mis à jour : ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
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

  function renderEditableList(listEl, items, max, onColor, onName, onDelete) {
    listEl.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'category-row';

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHex(item.color);
      color.addEventListener('input', () => onColor(item, color.value));

      const name = document.createElement('input');
      name.type = 'text';
      name.value = item.name;
      name.addEventListener('change', () => onName(item, name.value));

      const del = document.createElement('button');
      del.className = 'btn btn-ghost btn-danger';
      del.textContent = '✕';
      del.addEventListener('click', () => onDelete(item));

      li.append(color, name, del);
      listEl.appendChild(li);
    });
  }

  function toHex(color) {
    // color inputs require #rrggbb; convert hsl(...) strings via canvas-less parse
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

  function renderCategories() {
    const project = getActiveProject();
    const list = document.getElementById('category-list');
    const badge = document.getElementById('cat-count-badge');
    const addBtn = document.getElementById('btn-add-category');
    list.innerHTML = '';
    if (!project) return;
    badge.textContent = `${project.categories.length}/${MAX_CATEGORIES}`;
    addBtn.disabled = project.categories.length >= MAX_CATEGORIES;
    addBtn.style.opacity = addBtn.disabled ? 0.5 : 1;

    renderEditableList(
      list, project.categories, MAX_CATEGORIES,
      (cat, val) => { cat.color = val; touchAndSave(); renderCanvas(); renderProgress(); },
      (cat, val) => { cat.name = val.trim() || cat.name; touchAndSave(); renderProgress(); },
      (cat) => {
        if (!confirm(`Supprimer la catégorie "${cat.name}" ?`)) return;
        project.categories = project.categories.filter((c) => c.id !== cat.id);
        project.nodes.forEach((n) => { delete n.status[cat.id]; });
        touchAndSave();
        render();
      },
    );
  }

  function renderMicroList() {
    const project = getActiveProject();
    const list = document.getElementById('micro-list');
    const badge = document.getElementById('micro-count-badge');
    const addBtn = document.getElementById('btn-add-micro');
    list.innerHTML = '';
    if (!project) return;
    badge.textContent = `${project.microVars.length}/${MAX_MICRO}`;
    addBtn.disabled = project.microVars.length >= MAX_MICRO;
    addBtn.style.opacity = addBtn.disabled ? 0.5 : 1;

    renderEditableList(
      list, project.microVars, MAX_MICRO,
      (mv, val) => { mv.color = val; touchAndSave(); renderCanvas(); renderProgress(); },
      (mv, val) => { mv.name = val.trim() || mv.name; touchAndSave(); renderProgress(); },
      (mv) => {
        if (!confirm(`Supprimer la variable "${mv.name}" ?`)) return;
        project.microVars = project.microVars.filter((m) => m.id !== mv.id);
        project.nodes.forEach((n) => { delete n.micro[mv.id]; });
        touchAndSave();
        render();
      },
    );
  }

  function renderCanvas() {
    const project = getActiveProject();
    svgEl.innerHTML = '';
    if (!project) return;
    const catCount = project.categories.length;
    const microCount = project.microVars.length;

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
        const size = NODE_R * 2.7;
        const rect = document.createElementNS(SVGNS, 'rect');
        rect.setAttribute('x', String(-size / 2));
        rect.setAttribute('y', String(-size / 2));
        rect.setAttribute('width', String(size));
        rect.setAttribute('height', String(size));
        rect.setAttribute('rx', '7');
        rect.setAttribute('class', 'substation-marker');
        rect.setAttribute('data-kind', 'hub');
        g.appendChild(rect);

        const bolt = document.createElementNS(SVGNS, 'text');
        bolt.setAttribute('x', '0');
        bolt.setAttribute('y', '6');
        bolt.setAttribute('text-anchor', 'middle');
        bolt.setAttribute('class', 'substation-icon');
        bolt.style.pointerEvents = 'none';
        bolt.textContent = '⚡';
        g.appendChild(bolt);

        const ossLabel = document.createElementNS(SVGNS, 'text');
        ossLabel.setAttribute('x', '0');
        ossLabel.setAttribute('y', String(size / 2 + 16));
        ossLabel.setAttribute('text-anchor', 'middle');
        ossLabel.setAttribute('class', 'node-label substation-label');
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
        circle.style.fill = node.status[cat.id] ? cat.color : 'var(--panel)';
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
          path.style.fill = node.status[cat.id] ? cat.color : 'var(--panel)';
          g.appendChild(path);
        });
      }

      const innerOutline = document.createElementNS(SVGNS, 'circle');
      innerOutline.setAttribute('r', String(NODE_R));
      innerOutline.setAttribute('fill', 'none');
      innerOutline.setAttribute('stroke', 'var(--line)');
      innerOutline.setAttribute('stroke-width', '1');
      innerOutline.style.pointerEvents = 'none';
      g.appendChild(innerOutline);

      if (microCount > 0) {
        // second ring: one annular cell per secondary variable, with the same
        // dark dividers as the central pie
        const microSlice = (2 * Math.PI) / microCount;
        project.microVars.forEach((mv, i) => {
          // a lone variable still renders as a full ring (two half-cells)
          const spans = microCount === 1
            ? [[-Math.PI / 2, Math.PI / 2], [Math.PI / 2, (3 * Math.PI) / 2]]
            : [[-Math.PI / 2 + i * microSlice, -Math.PI / 2 + (i + 1) * microSlice]];
          spans.forEach(([a0, a1]) => {
            const cell = document.createElementNS(SVGNS, 'path');
            cell.setAttribute('d', ringSegmentPath(RING_IN, RING_OUT, a0, a1));
            cell.setAttribute('class', 'node-ring-cell');
            cell.setAttribute('data-kind', `micro-${mv.id}`);
            cell.style.fill = node.micro[mv.id] ? mv.color : 'var(--panel)';
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
        const done = foundationNodes.filter((n) => n[statusKey][item.id]).length;
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

    addGroup('Catégories principales', project.categories, 'status');
    addGroup('Variables secondaires', project.microVars, 'micro');

    const overallPct = totalSlots ? Math.round((totalDone / totalSlots) * 100) : 0;
    overallEl.innerHTML = `
      <div class="progress-row-label"><span><strong>Avancement global</strong></span><span class="pct">${overallPct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${overallPct}%; background:var(--accent)"></div></div>
      <div class="hint" style="margin:6px 0 0;">${nodeCount} fondations</div>
    `;
  }

  function renderPunchList() {
    const project = getActiveProject();
    const ul = document.getElementById('punch-list');
    ul.innerHTML = '';
    if (!project) return;
    project.punchList.forEach((item) => {
      const li = document.createElement('li');
      li.className = `punch-item${item.done ? ' done' : ''}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.addEventListener('change', () => {
        item.done = cb.checked;
        touchAndSave();
        renderPunchList();
      });

      const span = document.createElement('span');
      span.textContent = item.text;

      const del = document.createElement('button');
      del.className = 'btn btn-ghost';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        project.punchList = project.punchList.filter((p) => p.id !== item.id);
        touchAndSave();
        renderPunchList();
      });

      li.append(cb, span, del);
      ul.appendChild(li);
    });
  }

  // ---------- node modal ----------
  function currentModalNode() {
    const project = getActiveProject();
    return project && project.nodes.find((n) => n.id === openNodeId);
  }

  function renderModalChecklist(listEl, items, node, statusKey) {
    listEl.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'modal-category-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!node[statusKey][item.id];
      cb.addEventListener('change', () => {
        node[statusKey][item.id] = cb.checked;
        touchAndSave();
        renderCanvas();
        renderProgress();
      });

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;

      const label = document.createElement('span');
      label.textContent = item.name;

      li.append(cb, dot, label);
      listEl.appendChild(li);
    });
  }

  function openNodeModal(nodeId) {
    openNodeId = nodeId;
    const node = currentModalNode();
    if (!node) return;
    const project = getActiveProject();

    document.getElementById('modal-label').value = node.label;
    document.getElementById('modal-issue').checked = !!node.issue;
    document.getElementById('modal-note').value = node.note || '';
    document.getElementById('modal-title').textContent = node.substation ? 'Détails de la sous-station' : 'Détails de la fondation';

    const catListEl = document.getElementById('modal-categories');
    const microListEl = document.getElementById('modal-micro');
    if (node.substation) {
      catListEl.innerHTML = '<li class="hint">Non applicable à la sous-station.</li>';
      microListEl.innerHTML = '';
    } else {
      renderModalChecklist(catListEl, project.categories, node, 'status');
      renderModalChecklist(microListEl, project.microVars, node, 'micro');
    }

    document.getElementById('node-modal').classList.remove('hidden');
  }

  function closeModalAndRender() {
    document.getElementById('node-modal').classList.add('hidden');
    openNodeId = null;
    render();
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
    document.getElementById('project-select').addEventListener('change', (e) => {
      state.activeProjectId = e.target.value;
      pendingConnectFrom = null;
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-new-project').addEventListener('click', () => {
      const name = prompt('Nom du nouveau projet', 'Nouveau projet');
      if (name === null) return;
      const project = createEmptyProject(name.trim() || 'Nouveau projet');
      state.projects[project.id] = project;
      state.activeProjectId = project.id;
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-rename-project').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      const name = prompt('Renommer le projet', project.name);
      if (name === null) return;
      project.name = name.trim() || project.name;
      touchAndSave();
      render();
    });

    document.getElementById('btn-delete-project').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      if (Object.keys(state.projects).length <= 1) {
        alert('Impossible de supprimer le dernier projet.');
        return;
      }
      if (!confirm(`Supprimer le projet "${project.name}" ? Cette action est irréversible.`)) return;
      delete state.projects[project.id];
      state.activeProjectId = Object.keys(state.projects)[0];
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-add-category').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      if (project.categories.length >= MAX_CATEGORIES) {
        alert(`Maximum ${MAX_CATEGORIES} catégories principales (une part du camembert central).`);
        return;
      }
      const name = prompt('Nom de la catégorie', 'Nouvelle catégorie');
      if (name === null) return;
      const color = microPaletteColor(project.categories.length * 2);
      const cat = { id: uid(), name: name.trim() || 'Catégorie', color };
      project.categories.push(cat);
      project.nodes.forEach((n) => { n.status[cat.id] = false; });
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-micro').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      if (project.microVars.length >= MAX_MICRO) {
        alert(`Maximum ${MAX_MICRO} variables secondaires (anneau extérieur).`);
        return;
      }
      const name = prompt('Nom de la variable', 'Nouvelle variable');
      if (name === null) return;
      const color = microPaletteColor(project.microVars.length);
      const mv = { id: uid(), name: name.trim() || 'Variable', color };
      project.microVars.push(mv);
      project.nodes.forEach((n) => { n.micro[mv.id] = false; });
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-node').addEventListener('click', () => {
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
        issue: false,
        note: '',
      };
      project.categories.forEach((cat) => { node.status[cat.id] = false; });
      project.microVars.forEach((mv) => { node.micro[mv.id] = false; });
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
      const project = getActiveProject();
      if (!project) return;
      const input = document.getElementById('punch-input');
      const text = input.value.trim();
      if (!text) return;
      project.punchList.unshift({ id: uid(), text, done: false });
      input.value = '';
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-close').addEventListener('click', closeModalAndRender);
    document.getElementById('modal-save').addEventListener('click', closeModalAndRender);

    document.getElementById('modal-label').addEventListener('input', (e) => {
      const node = currentModalNode();
      if (!node) return;
      node.label = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-issue').addEventListener('change', (e) => {
      const node = currentModalNode();
      if (!node) return;
      node.issue = e.target.checked;
      touchAndSave();
    });

    document.getElementById('modal-note').addEventListener('input', (e) => {
      const node = currentModalNode();
      if (!node) return;
      node.note = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-add-punch').addEventListener('click', () => {
      const node = currentModalNode();
      const project = getActiveProject();
      if (!node || !project) return;
      const value = prompt('Texte de la punch list', `${node.label} — `);
      if (value === null) return;
      project.punchList.unshift({ id: uid(), text: value, done: false });
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-delete').addEventListener('click', () => {
      if (!openNodeId) return;
      if (!confirm('Supprimer ce point et ses liaisons ?')) return;
      const idToDelete = openNodeId;
      document.getElementById('node-modal').classList.add('hidden');
      openNodeId = null;
      deleteNode(idToDelete);
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
    });

    document.getElementById('btn-import').addEventListener('click', () => {
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
            throw new Error('format de projet invalide');
          }
          imported.id = uid();
          imported.name = imported.name ? `${imported.name} (importé)` : 'Projet importé';
          imported.updatedAt = new Date().toISOString();
          imported.connections = imported.connections || [];
          imported.punchList = imported.punchList || [];
          imported.microVars = imported.microVars || [];
          imported.nodes.forEach((n) => { n.micro = n.micro || {}; });
          state.projects[imported.id] = imported;
          state.activeProjectId = imported.id;
          saveState();
          render();
          safeFitToContent();
        } catch (err) {
          alert(`Fichier invalide : ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('node-modal').classList.contains('hidden')) {
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
      select: 'Touchez une part ou une cellule pour cocher/décocher. Centre = détails. Glissez pour naviguer.',
      connect: 'Touchez un premier point puis un second pour créer une liaison.',
      delete: 'Touchez un point ou une liaison pour la supprimer.',
    };
    document.getElementById('canvas-hint').textContent = hints[mode] || '';
  }

  // ---------- init ----------
  function init() {
    state = loadState();
    svgEl = document.getElementById('canvas');
    attachStaticListeners();
    setupCameraGestures();
    updateCanvasHint();
    render();
    safeFitToContent();
  }

  init();
})();
