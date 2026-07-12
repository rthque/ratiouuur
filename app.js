(() => {
  'use strict';

  const STORAGE_KEY = 'worksite-tracker:v6';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const NODE_R = 30;       // inner pie radius (8 main categories)
  const HUB_R = 8;         // center hub (open details)
  const RING_IN = 33;      // second ring (16 secondary categories), inner radius
  const RING_OUT = 46;     // second ring, outer radius
  const GRID_UNIT = 140;   // world-space spacing between adjacent grid cells

  const MAX_CATEGORIES = 8;
  const MAX_MICRO = 16;

  // Foundation grid (letter column A–M, no I, numeric row 1–7), validated
  // against the reference cable map: K03 does not exist; K01 does (cable
  // WT154 L1-K1). Labels are zero-padded (A02, K01…).
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
    K: [1, 4, 5, 6, 7],
    L: [1, 2, 4, 5, 6, 7],
    M: [1, 2, 3, 4, 5, 6, 7],
  };

  function fouLabel(col, row) {
    return `${col}0${row}`;
  }

  // Inter-array cable strings, read segment by segment off the reference site
  // map ("Dieppe Le Tréport"): each cable there is labelled with its endpoint
  // pair — e.g. WT62 (G4-E4), WT72 (H4-E3), WT12 (K4-J4) — and the WT
  // numbering walks each string outward from the OSS, which pins the feeder
  // of every string. 8 strings radiate from the OSS (which sits on the empty
  // L3 grid slot).
  const STRING_EDGES = [
    // String rangée 7 : OSS→K07→J07→…→D07 (WT31-37)
    ['OSS', 'K07'], ['K07', 'J07'], ['J07', 'H07'], ['H07', 'G07'], ['G07', 'F07'], ['F07', 'E07'], ['E07', 'D07'],
    // String rangée 6, feeder en K05 (WT41-48)
    ['OSS', 'K05'], ['K05', 'K06'], ['K06', 'J06'], ['J06', 'H06'], ['H06', 'G06'], ['G06', 'F06'], ['F06', 'E06'], ['E06', 'D06'],
    // String rangée 5, feeder en K04 via J04 (WT11-18)
    ['OSS', 'K04'], ['K04', 'J04'], ['J04', 'J05'], ['J05', 'H05'], ['H05', 'G05'], ['G05', 'F05'], ['F05', 'E05'], ['E05', 'D05'],
    // String rangée 4 puis colonne A (WT61-68)
    ['OSS', 'G04'], ['G04', 'E04'], ['E04', 'D04'], ['D04', 'C04'], ['C04', 'B04'], ['B04', 'A04'], ['A04', 'A03'], ['A03', 'A02'],
    // String H04 → rangée 3, avec antennes C02 et E02 (WT71-78)
    ['OSS', 'H04'], ['H04', 'E03'], ['E03', 'D03'], ['D03', 'C03'], ['C03', 'B03'], ['B03', 'B02'], ['C03', 'C02'], ['E03', 'E02'],
    // String sud : J01 puis rangées 1 et 2 (WT81-88)
    ['OSS', 'J01'], ['J01', 'J02'], ['J01', 'H01'], ['H01', 'H02'], ['H02', 'G02'], ['G02', 'F02'], ['H01', 'G01'], ['G01', 'F01'], ['F01', 'E01'],
    // String L04→L07 en peigne avec les antennes M04→M07 (WT121-128)
    ['OSS', 'L04'], ['L04', 'L05'], ['L05', 'L06'], ['L06', 'L07'], ['L07', 'M07'], ['L04', 'M04'], ['L05', 'M05'], ['L06', 'M06'],
    // String cluster sud-est : L02, L01, K01, M01-M03 (WT151-157, dont WT154 L1-K1)
    ['OSS', 'L02'], ['L02', 'L01'], ['L01', 'K01'], ['L01', 'M01'], ['L02', 'M02'], ['M02', 'M03'],
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

  // A checked task is stored as { at: ISO date, by: name|null } (null = unchecked),
  // so the details panel can show when (and later by whom) it was validated.
  function checkStamp() {
    return { at: new Date().toISOString(), by: null };
  }

  function formatStamp(stamp) {
    if (!stamp || !stamp.at) return '';
    const d = new Date(stamp.at);
    const datePart = `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return stamp.by ? `${datePart} — ${stamp.by}` : datePart;
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
    const project = createEmptyProject('Dieppe Le Tréport — 62 FOU');

    const catDefs = [
      { name: 'Tower cabinet rust treatment & rubber placement', color: '#111827' },
      { name: 'ScotchKoat on earthing cable', color: '#db2777' },
      { name: 'Grating repair with G8 resin', color: '#16a34a' },
      { name: 'Installed cable tray brackets', color: '#2563eb' },
    ];
    project.categories = catDefs.map((c) => ({ id: uid(), ...c }));

    const microDefs = [
      { name: 'Safety pin gate', color: '#f59e0b' },
      { name: 'Hang off platform: caution sign', color: '#7c3aed' },
      { name: 'Pick up keys', color: '#0891b2' },
      { name: 'Water ingress check', color: '#dc2626' },
    ];
    project.microVars = microDefs.map((c) => ({ id: uid(), ...c }));

    COLS.forEach((col, colIndex) => {
      (COLUMN_ROWS[col] || []).forEach((row) => {
        const pos = gridToWorld(colIndex, row);
        const node = {
          id: uid(),
          label: fouLabel(col, row),
          x: pos.x,
          y: pos.y,
          status: {},
          micro: {},
          issue: false,
          note: '',
        };
        project.categories.forEach((cat) => { node.status[cat.id] = null; });
        project.microVars.forEach((mv) => { node.micro[mv.id] = null; });
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
      node.status[catId] = node.status[catId] ? null : checkStamp();
      touchAndSave();
      renderCanvas();
      renderProgress();
    } else if (kind.startsWith('micro-')) {
      const varId = kind.slice(6);
      node.micro[varId] = node.micro[varId] ? null : checkStamp();
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
        // discreet marker: small outlined square with the OSS label inside
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

        const ossLabel = document.createElementNS(SVGNS, 'text');
        ossLabel.setAttribute('x', '0');
        ossLabel.setAttribute('y', '4');
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
    addGroup('Catégories secondaires', project.microVars, 'micro');

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

    if (items.length > 1) {
      const li = document.createElement('li');
      li.className = 'modal-check-all';
      const allDone = items.every((item) => !!node[statusKey][item.id]);
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.textContent = allDone ? 'Tout décocher' : 'Tout cocher';
      btn.addEventListener('click', () => {
        items.forEach((item) => {
          if (allDone) {
            node[statusKey][item.id] = null;
          } else if (!node[statusKey][item.id]) {
            node[statusKey][item.id] = checkStamp();
          }
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

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!node[statusKey][item.id];
      cb.addEventListener('change', () => {
        node[statusKey][item.id] = cb.checked ? checkStamp() : null;
        touchAndSave();
        renderCanvas();
        renderProgress();
        renderModalChecklist(listEl, items, node, statusKey);
      });

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;

      const label = document.createElement('span');
      label.textContent = item.name;
      label.className = 'modal-category-name';

      li.append(cb, dot, label);

      const stampText = formatStamp(node[statusKey][item.id]);
      if (stampText) {
        const meta = document.createElement('span');
        meta.className = 'check-meta';
        meta.textContent = stampText;
        li.appendChild(meta);
      }

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
      project.nodes.forEach((n) => { n.status[cat.id] = null; });
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
      project.nodes.forEach((n) => { n.micro[mv.id] = null; });
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
          imported.nodes.forEach((n) => {
            n.micro = n.micro || {};
            n.status = n.status || {};
            // older exports stored plain booleans; convert to stamp objects
            [n.status, n.micro].forEach((map) => {
              Object.keys(map).forEach((k) => {
                if (map[k] === true) map[k] = { at: null, by: null };
                else if (map[k] === false) map[k] = null;
              });
            });
          });
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
    saveState();
    svgEl = document.getElementById('canvas');
    attachStaticListeners();
    setupCameraGestures();
    updateCanvasHint();
    render();
    safeFitToContent();
  }

  init();
})();
