(() => {
  'use strict';

  const STORAGE_KEY = 'worksite-tracker:v1';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const NODE_R = 26;
  const PALETTE = ['#111827', '#2563eb', '#e0457b', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#dc2626'];

  let state = null;
  let mode = 'select'; // 'select' | 'connect' | 'delete'
  let pendingConnectFrom = null;
  let openNodeId = null;

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

  // ---------- state ----------
  function createEmptyProject(name) {
    return {
      id: uid(),
      name,
      updatedAt: new Date().toISOString(),
      categories: [],
      nodes: [],
      connections: [],
      punchList: [],
    };
  }

  function seedDemoProject() {
    const project = createEmptyProject('Exemple — Parc éolien (câblage inter-array)');
    const cats = [
      { name: 'Cable Cleats', color: '#111827' },
      { name: 'PIM Gate', color: '#2563eb' },
      { name: 'Scotch Kote', color: '#e0457b' },
      { name: 'Gearing Repair', color: '#16a34a' },
    ];
    project.categories = cats.map((c) => ({ id: uid(), ...c }));
    const grid = ['A1', 'A2', 'A3', 'A4', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4'];
    grid.forEach((label, i) => {
      const node = {
        id: uid(),
        label,
        x: 140 + (i % 5) * 150,
        y: 120 + Math.floor(i / 5) * 170,
        status: {},
        issue: i === 3,
        note: i === 3 ? 'Loquet portillon mal aligné' : '',
      };
      project.categories.forEach((cat, ci) => {
        node.status[cat.id] = (i + ci) % 3 !== 0;
      });
      project.nodes.push(node);
    });
    for (let i = 0; i < project.nodes.length - 1; i++) {
      project.connections.push({ id: uid(), a: project.nodes[i].id, b: project.nodes[i + 1].id });
    }
    project.punchList = [
      { id: uid(), text: 'A04 — manque vis SREW sur tower cabinets', done: false },
      { id: uid(), text: 'B03 — chercher 1 caillebotis bois sous grating', done: false },
      { id: uid(), text: 'C04 — fixation cable tray désolidarisée (sol + pion)', done: false },
    ];
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
    const demo = seedDemoProject();
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

  function updateConnectionsFor(nodeId) {
    const project = getActiveProject();
    project.connections.forEach((conn) => {
      if (conn.a !== nodeId && conn.b !== nodeId) return;
      const line = document.querySelector(`[data-conn-id="${conn.id}"]`);
      if (!line) return;
      const a = project.nodes.find((n) => n.id === conn.a);
      const b = project.nodes.find((n) => n.id === conn.b);
      if (!a || !b) return;
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    });
  }

  // ---------- node interaction ----------
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
    }
  }

  function attachNodeHandlers(g, node) {
    let startX; let startY; let origX; let origY; let dragging = false; let kind = 'body';

    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      kind = e.target.dataset.kind || 'body';
      startX = e.clientX; startY = e.clientY;
      origX = node.x; origY = node.y;
      dragging = false;
      g.setPointerCapture(e.pointerId);
    });

    g.addEventListener('pointermove', (e) => {
      if (startX === undefined) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 4) dragging = true;
      if (dragging) {
        node.x = origX + dx;
        node.y = origY + dy;
        g.setAttribute('transform', `translate(${node.x},${node.y})`);
        updateConnectionsFor(node.id);
      }
    });

    g.addEventListener('pointerup', (e) => {
      if (startX === undefined) return;
      try { g.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (dragging) {
        touchAndSave();
      } else {
        handleNodeClick(node, kind);
      }
      startX = undefined;
      dragging = false;
    });
  }

  // ---------- rendering ----------
  function render() {
    renderProjectSelect();
    renderHeader();
    renderCategories();
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

  function renderCategories() {
    const project = getActiveProject();
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    if (!project) return;
    project.categories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = 'category-row';

      const color = document.createElement('input');
      color.type = 'color';
      color.value = cat.color;
      color.addEventListener('input', () => {
        cat.color = color.value;
        touchAndSave();
        renderCanvas();
        renderProgress();
      });

      const name = document.createElement('input');
      name.type = 'text';
      name.value = cat.name;
      name.addEventListener('change', () => {
        cat.name = name.value.trim() || cat.name;
        touchAndSave();
        renderProgress();
      });

      const del = document.createElement('button');
      del.className = 'btn btn-ghost btn-danger';
      del.textContent = '✕';
      del.title = 'Supprimer la catégorie';
      del.addEventListener('click', () => {
        if (!confirm(`Supprimer la catégorie "${cat.name}" ?`)) return;
        project.categories = project.categories.filter((c) => c.id !== cat.id);
        project.nodes.forEach((n) => { delete n.status[cat.id]; });
        touchAndSave();
        render();
      });

      li.append(color, name, del);
      list.appendChild(li);
    });
  }

  function renderCanvas() {
    const project = getActiveProject();
    const svg = document.getElementById('canvas');
    svg.innerHTML = '';
    if (!project) return;
    const catCount = project.categories.length;

    project.connections.forEach((conn) => {
      const a = project.nodes.find((n) => n.id === conn.a);
      const b = project.nodes.find((n) => n.id === conn.b);
      if (!a || !b) return;
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('data-conn-id', conn.id);
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', `connection-line${mode === 'delete' ? ' deletable' : ''}`);
      line.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mode === 'delete') deleteConnection(conn.id);
      });
      svg.appendChild(line);
    });

    project.nodes.forEach((node) => {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `node-group${pendingConnectFrom === node.id ? ' selected' : ''}`);
      g.setAttribute('data-node-id', node.id);
      g.setAttribute('transform', `translate(${node.x},${node.y})`);

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

      const outline = document.createElementNS(SVGNS, 'circle');
      outline.setAttribute('r', String(NODE_R));
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke', 'var(--line)');
      outline.setAttribute('stroke-width', '1.5');
      outline.style.pointerEvents = 'none';
      g.appendChild(outline);

      const hub = document.createElementNS(SVGNS, 'circle');
      hub.setAttribute('r', '8');
      hub.setAttribute('class', 'node-hub node-hub-ring');
      hub.setAttribute('data-kind', 'hub');
      g.appendChild(hub);

      if (node.issue) {
        const x = document.createElementNS(SVGNS, 'text');
        x.setAttribute('x', String(NODE_R * 0.55));
        x.setAttribute('y', String(-NODE_R * 0.55));
        x.setAttribute('class', 'node-issue-x');
        x.textContent = '✕';
        g.appendChild(x);
      }

      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', String(NODE_R + 16));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'node-label');
      label.textContent = node.label;
      g.appendChild(label);

      attachNodeHandlers(g, node);
      svg.appendChild(g);
    });
  }

  function renderProgress() {
    const project = getActiveProject();
    const overall = document.getElementById('progress-overall');
    const list = document.getElementById('progress-list');
    overall.innerHTML = '';
    list.innerHTML = '';
    if (!project) return;
    const nodeCount = project.nodes.length;
    let totalDone = 0;
    const totalSlots = nodeCount * project.categories.length;

    project.categories.forEach((cat) => {
      const done = project.nodes.filter((n) => n.status[cat.id]).length;
      totalDone += done;
      const pct = nodeCount ? Math.round((done / nodeCount) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'progress-row';
      row.innerHTML = `
        <div class="progress-row-label"><span>${escapeHtml(cat.name)}</span><span class="pct">${done}/${nodeCount} · ${pct}%</span></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%; background:${cat.color}"></div></div>
      `;
      list.appendChild(row);
    });

    const overallPct = totalSlots ? Math.round((totalDone / totalSlots) * 100) : 0;
    overall.innerHTML = `
      <div class="progress-row-label"><span><strong>Avancement global</strong></span><span class="pct">${overallPct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${overallPct}%; background:var(--accent)"></div></div>
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

  function openNodeModal(nodeId) {
    openNodeId = nodeId;
    const node = currentModalNode();
    if (!node) return;
    const project = getActiveProject();

    document.getElementById('modal-label').value = node.label;
    document.getElementById('modal-issue').checked = !!node.issue;
    document.getElementById('modal-note').value = node.note || '';

    const catList = document.getElementById('modal-categories');
    catList.innerHTML = '';
    project.categories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = 'modal-category-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!node.status[cat.id];
      cb.addEventListener('change', () => {
        node.status[cat.id] = cb.checked;
        touchAndSave();
        renderCanvas();
        renderProgress();
      });

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = cat.color;

      const label = document.createElement('span');
      label.textContent = cat.name;

      li.append(cb, dot, label);
      catList.appendChild(li);
    });

    document.getElementById('node-modal').classList.remove('hidden');
  }

  function closeModalAndRender() {
    document.getElementById('node-modal').classList.add('hidden');
    openNodeId = null;
    render();
  }

  // ---------- static listeners ----------
  function attachStaticListeners() {
    document.getElementById('project-select').addEventListener('change', (e) => {
      state.activeProjectId = e.target.value;
      pendingConnectFrom = null;
      saveState();
      render();
    });

    document.getElementById('btn-new-project').addEventListener('click', () => {
      const name = prompt('Nom du nouveau projet', 'Nouveau projet');
      if (name === null) return;
      const project = createEmptyProject(name.trim() || 'Nouveau projet');
      state.projects[project.id] = project;
      state.activeProjectId = project.id;
      saveState();
      render();
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
    });

    document.getElementById('btn-add-category').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      const color = PALETTE[project.categories.length % PALETTE.length];
      const name = prompt('Nom de la catégorie', 'Nouvelle catégorie');
      if (name === null) return;
      const cat = { id: uid(), name: name.trim() || 'Catégorie', color };
      project.categories.push(cat);
      project.nodes.forEach((n) => { n.status[cat.id] = false; });
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-node').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      const count = project.nodes.length;
      const col = count % 12;
      const row = Math.floor(count / 12);
      const node = {
        id: uid(),
        label: `P${count + 1}`,
        x: 100 + col * 130,
        y: 100 + row * 130,
        status: {},
        issue: false,
        note: '',
      };
      project.categories.forEach((cat) => { node.status[cat.id] = false; });
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

    document.getElementById('canvas').addEventListener('click', (e) => {
      if (e.target.id === 'canvas' && mode === 'connect' && pendingConnectFrom) {
        pendingConnectFrom = null;
        renderCanvas();
      }
    });

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
          state.projects[imported.id] = imported;
          state.activeProjectId = imported.id;
          saveState();
          render();
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
      } else if (pendingConnectFrom) {
        pendingConnectFrom = null;
        renderCanvas();
      }
    });
  }

  function updateCanvasHint() {
    const hints = {
      select: 'Cliquez une part pour cocher/décocher. Cliquez le centre pour ouvrir les détails. Glissez pour déplacer.',
      connect: 'Cliquez un premier point puis un second pour créer une liaison.',
      delete: 'Cliquez un point ou une liaison pour la supprimer.',
    };
    document.getElementById('canvas-hint').textContent = hints[mode] || '';
  }

  // ---------- init ----------
  function init() {
    state = loadState();
    attachStaticListeners();
    updateCanvasHint();
    render();
  }

  init();
})();
