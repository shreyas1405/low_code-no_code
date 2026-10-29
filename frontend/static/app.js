const state = {
    currentView: 'dashboard',
    apiBase: '/api',
    workflow: { nodes: [], edges: [], name: '', description: '' },
    claims: [],
    tasks: [],
    selectedClaim: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    draggingNode: null,
    connecting: false,
    connectSource: null,
    nodeTypeLabels: {
        start: 'Start',
        service_task: 'Service Task',
        user_task: 'User Task',
        gateway: 'Gateway',
        end: 'End',
    },
};

function init() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });
    navigateTo('dashboard');
}

function navigateTo(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(view + '-view').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    loadView(view);
}

function loadView(view) {
    if (view === 'dashboard') loadDashboard();
    else if (view === 'claims') loadClaims();
    else if (view === 'designer') initDesigner();
    else if (view === 'tasks') loadTasks();
}

async function api(path, options = {}) {
    const opts = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };
    if (opts.body && typeof opts.body === 'object') {
        opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(state.apiBase + path, opts);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || res.statusText);
    }
    return res.json();
}

/* ===== Dashboard ===== */
async function loadDashboard() {
    try {
        const stats = await api('/dashboard/stats');
        renderDashboard(stats);
    } catch (e) {
        document.getElementById('dashboard-content').innerHTML =
            '<div class="section"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + e.message + '</p></div></div>';
    }
}

function renderDashboard(stats) {
    const totalClaims = stats.total_claims || 0;
    const pendingTasks = stats.pending_tasks || 0;
    const activeWf = stats.active_workflows || 0;
    const completedWf = stats.completed_workflows || 0;

    const byStatus = stats.claims_by_status || {};
    const statusEntries = Object.entries(byStatus);
    const statusRows = statusEntries.length > 0
        ? statusEntries.map(([s, count]) => `
            <tr>
                <td><span class="status-dot" style="background:${getStatusColor(s)}"></span>${formatStatusLabel(s)}</td>
                <td>${count}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="2" style="padding:16px;text-align:center;color:#64748b;">No claims yet</td></tr>';

    const recentClaims = stats.recent_claims || [];
    const claimRows = recentClaims.length > 0
        ? recentClaims.map(c => `
            <tr ondblclick="viewClaim('${c.id}')" style="cursor:pointer;">
                <td>${c.claim_number}</td>
                <td>${c.claim_type}</td>
                <td>$${(c.amount || 0).toLocaleString()}</td>
                <td><span class="status-badge ${escapeStatusClass(c.status)}">${formatStatusLabel(c.status)}</span></td>
                <td><button class="btn btn-sm" onclick="viewClaim('${c.id}'); navigateTo('claims')">View</button></td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">No claims yet</td></tr>';

    document.getElementById('dashboard-content').innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-label">Total Claims</div>
                <div class="stat-value blue">${totalClaims}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pending Tasks</div>
                <div class="stat-value orange">${pendingTasks}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Workflows</div>
                <div class="stat-value purple">${activeWf}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completed Workflows</div>
                <div class="stat-value green">${completedWf}</div>
            </div>
        </div>
        <div class="recent-claims-section">
            <h2>Claims by Status</h2>
            <table class="claims-table" style="width:100%;">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>${statusRows}</tbody>
            </table>
        </div>
        <div class="recent-claims-section">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h2 style="margin-bottom:0;">Recent Claims</h2>
                <button class="btn btn-primary btn-sm" onclick="showCreateModal()">+ New Claim</button>
            </div>
            <div style="overflow-x:auto;margin-top:12px;">
                <table class="claims-table">
                    <thead><tr><th>Claim #</th><th>Type</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                    <tbody>${claimRows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/* ===== Claims ===== */
async function loadClaims() {
    try {
        state.claims = await api('/claims');
        renderClaims();
    } catch (e) {
        document.getElementById('claims-content').innerHTML =
            '<div class="section"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + e.message + '</p></div></div>';
    }
}

function renderClaims() {
    document.getElementById('claims-content').innerHTML = `
        <div class="page-header">
            <h1>Claims Management</h1>
            <div class="actions">
                <button class="btn btn-primary" onclick="showCreateModal()">+ New Claim</button>
            </div>
        </div>
        <div class="section">
            ${state.claims.length === 0
                ? '<div class="empty-state"><div class="empty-icon">📂</div><p>No claims found. Create your first claim to start the workflow.</p></div>'
                : `<div class="table-wrap">
                    <table class="claims-table">
                        <thead><tr><th>Claim #</th><th>Type</th><th>Insured</th><th>Amount</th><th>Status</th><th>Priority</th><th>Created</th><th>Action</th></tr></thead>
                        <tbody>${state.claims.map(c => `
                            <tr>
                                <td>${c.claim_number}</td>
                                <td>${c.claim_type}</td>
                                <td>${c.insured_name}</td>
                                <td>$${(c.amount || 0).toLocaleString()}</td>
                                <td><span class="status-badge ${escapeStatusClass(c.status)}">${formatStatusLabel(c.status)}</span></td>
                                <td>${c.priority}</td>
                                <td>${formatDate(c.created_at)}</td>
                                <td><button class="btn btn-sm" onclick="viewClaim('${c.id}')">View</button></td>
                            </tr>
                        `).join('')}</tbody>
                    </table>
                 </div>`
            }
        </div>
    `;
}

function showCreateModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <h2>Submit New Claim</h2>
            <form id="claim-form" onsubmit="submitClaim(event)">
                <div style="margin-bottom:16px;">
                    <div class="prop-label">Claim Type</div>
                    <div class="claim-type-grid">
                        <div class="claim-type-option" data-type="fire" onclick="selectClaimType(this,'fire')">
                            <div class="type-icon">🔥</div><div class="type-name">Fire</div>
                        </div>
                        <div class="claim-type-option" data-type="flood" onclick="selectClaimType(this,'flood')">
                            <div class="type-icon">🌊</div><div class="type-name">Flood</div>
                        </div>
                        <div class="claim-type-option" data-type="theft" onclick="selectClaimType(this,'theft')">
                            <div class="type-icon">🚨</div><div class="type-name">Theft</div>
                        </div>
                        <div class="claim-type-option" data-type="accident" onclick="selectClaimType(this,'accident')">
                            <div class="type-icon">🚗</div><div class="type-name">Accident</div>
                        </div>
                        <div class="claim-type-option" data-type="windstorm" onclick="selectClaimType(this,'windstorm')">
                            <div class="type-icon">💨</div><div class="type-name">Windstorm</div>
                        </div>
                        <div class="claim-type-option" data-type="water_damage" onclick="selectClaimType(this,'water_damage')">
                            <div class="type-icon">💧</div><div class="type-name">Water Damage</div>
                        </div>
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-row"><label>Insured Name</label><input type="text" name="insured_name" required></div>
                    <div class="form-row"><label>Email</label><input type="email" name="insured_email"></div>
                    <div class="form-row"><label>Policy Number</label><input type="text" name="policy_number" required></div>
                    <div class="form-row"><label>Incident Date</label><input type="date" name="incident_date" required></div>
                    <div class="form-row"><label>Amount ($)</label><input type="number" name="amount" min="0" step="1000" required></div>
                    <div class="form-row"><label>Priority</label>
                        <select name="priority">
                            <option value="low">Low</option>
                            <option value="normal" selected>Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" style="margin-top:16px;">
                    <label>Description</label>
                    <textarea name="description" placeholder="Describe the incident..." required></textarea>
                </div>
                <input type="hidden" name="claim_type" value="fire">
                <div class="form-actions">
                    <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit Claim</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);
    document.querySelector('.claim-type-option[data-type="water_damage"]').classList.add('selected');
}

function selectClaimType(element, type) {
    document.querySelectorAll('.claim-type-option').forEach(o => o.classList.remove('selected'));
    element.classList.add('selected');
    document.querySelector('input[name="claim_type"]').value = type;
}

async function submitClaim(event) {
    event.preventDefault();
    const form = event.target;
    const fd = new FormData(form);
    const payload = {
        claim_type: fd.get('claim_type'),
        description: fd.get('description'),
        amount: parseInt(fd.get('amount')),
        insured_name: fd.get('insured_name'),
        insured_email: fd.get('insured_email'),
        incident_date: fd.get('incident_date'),
        policy_number: fd.get('policy_number'),
        priority: fd.get('priority'),
    };
    try {
        const result = await api('/claims', { method: 'POST', body: payload });
        closeModal();
        if (result.claim.status.includes('Rejected')) {
            alert(`Claim ${result.claim.claim_number} was ${formatStatusLabel(result.claim.status)} via automated workflow.`);
        } else {
            alert(`Claim ${result.claim.claim_number} submitted! Workflow is now ${result.workflow_status} at "${result.current_node || 'task'}".`);
        }
        loadClaims();
        if (state.currentView === 'dashboard') loadDashboard();
        if (state.currentView === 'tasks') loadTasks();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
}

async function viewClaim(claimId) {
    state.selectedClaim = claimId;
    state.currentView = 'claims';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('claims-view').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'claims'));
    try {
        const data = await api('/claims/' + claimId);
        renderClaimDetail(data.claim, data.workflow);
    } catch (e) {
        document.getElementById('claims-content').innerHTML =
            '<div class="section"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + e.message + '</p></div></div>';
    }
}

function renderClaimDetail(claim, workflow) {
    const statusClass = escapeStatusClass(claim.status);
    const statusLabel = formatStatusLabel(claim.status);
    const currentTasks = (workflow.tasks || []).filter(t => t.status === 'pending');
    const taskList = currentTasks.length > 0
        ? currentTasks.map(t => `
            <div class="task-card">
                <div class="task-header">
                    <span class="task-title">${t.node_name}</span>
                    <span style="font-size:12px;color:#94a3b8;">${formatDate(t.created_at)}</span>
                </div>
                <div class="task-meta">
                    <span>Type: ${t.task_type}</span>
                    <span>Assignee: ${t.assignee}</span>
                </div>
                ${t.variables && Object.keys(t.variables).length > 0
                    ? `<div class="task-variables">${JSON.stringify(t.variables, null, 2)}</div>`
                    : ''}
                <div class="task-actions">
                    <button class="btn btn-sm btn-primary" onclick="executeTaskAction('${t.id}', 'approve')">✓ Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="executeTaskAction('${t.id}', 'reject')">✗ Reject</button>
                </div>
            </div>
        `).join('')
        : '<div class="empty-state" style="padding:12px;text-align:center;"><p>No pending tasks</p></div>';

    const history = workflow.history || [];
    const historyList = history.slice().reverse().map(h => {
        let color = '#94a3b8', label = h.action;
        if (h.action === 'task_completed') { color = '#4ade80'; label = 'Task Completed'; }
        else if (h.action.startsWith('entered_')) { color = '#0ea5e9'; label = 'Node Entered'; }
        else if (h.action === 'executed') { color = '#38bdf8'; label = 'Automated Task'; }
        else if (h.action === 'task_created') { color = '#f59e0b'; label = 'Task Created'; }
        else if (h.action === 'completed') { color = '#4ade80'; label = 'Workflow Completed'; }
        return `
            <div class="history-item">
                <span class="history-time">${h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : '—'}</span>
                <span class="history-action"><span class="action-label" style="color:${color}">${label}</span>: ${h.node_name}</span>
                ${h.result ? `<span class="history-result">${h.result}</span>` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('claims-content').innerHTML = `
        <div class="page-header">
            <h1>Claim: ${claim.claim_number}</h1>
            <div class="actions">
                <button class="btn" onclick="navigateTo('claims')">&#8592; Back to Claims</button>
                <button class="btn" onclick="navigateTo('dashboard')">📊 Dashboard</button>
            </div>
        </div>
        <div class="section">
            <div class="claim-detail-grid">
                <div>
                    <div class="detail-section">
                        <h2>Claim Details</h2>
                        <div class="claim-info-card">
                            <div class="info-row"><span class="info-label">Claim Number</span><span class="info-value">${claim.claim_number}</span></div>
                            <div class="info-row"><span class="info-label">Type</span><span class="info-value">${claim.claim_type}</span></div>
                            <div class="info-row"><span class="info-label">Insured Name</span><span class="info-value">${claim.insured_name}</span></div>
                            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${claim.insured_email || 'N/A'}</span></div>
                            <div class="info-row"><span class="info-label">Policy #</span><span class="info-value">${claim.policy_number}</span></div>
                            <div class="info-row"><span class="info-label">Incident Date</span><span class="info-value">${claim.incident_date}</span></div>
                            <div class="info-row"><span class="info-label">Amount</span><span class="info-value">$${(claim.amount || 0).toLocaleString()}</span></div>
                            <div class="info-row"><span class="info-label">Priority</span><span class="info-value">${claim.priority}</span></div>
                            <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="status-badge ${statusClass}">${statusLabel}</span></span></div>
                            <div class="info-row"><span class="info-label">Created</span><span class="info-value">${formatDate(claim.created_at)}</span></div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h2>Description</h2>
                        <div class="claim-info-card">
                            <p style="font-size:14px;color:#cbd5e1;padding:8px 0;">${claim.description || 'No description provided.'}</p>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="detail-section">
                        <h2>Workflow Execution</h2>
                        <div class="workflow-viz">
                            <div class="viz-canvas">${renderWorkflowViz(workflow)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="detail-section">
                <h2>Pending Tasks (${currentTasks.length})</h2>
                ${taskList}
            </div>
            <div class="detail-section">
                <h2>Execution History (${history.length})</h2>
                <div class="history-list">
                    ${historyList || '<p style="color:#64748b;">No history yet.</p>'}
                </div>
            </div>
        </div>
    `;
}

/* ===== Workflow Designer ===== */
function initDesigner() {
    api('/workflow').then(workflows => {
        renderDesigner();
    }).catch(() => renderDesigner());
}

function renderDesigner() {
    const wf = state.workflow;
    const canvasWidth = Math.max(900, Math.max(...wf.nodes.map(n => (n.x || 0) + (n.width || 140))) + 120);
    const canvasHeight = Math.max(500, Math.max(...wf.nodes.map(n => (n.y || 0) + (n.height || 60))) + 120);

    document.getElementById('designer-content').innerHTML = `
        <div class="designer-container">
            <div class="palette">
                <h3>Node Library</h3>
                <div class="palette-node start" data-type="start">
                    <span class="palette-node-icon">🟢</span> Start Event
                </div>
                <div class="palette-node service_task" data-type="service_task">
                    <span class="palette-node-icon">⚙️</span> Service Task
                </div>
                <div class="palette-node user_task" data-type="user_task">
                    <span class="palette-node-icon">👤</span> User Task
                </div>
                <div class="palette-node gateway" data-type="gateway">
                    <span class="palette-node-icon">🔀</span> Gateway
                </div>
                <div class="palette-node end" data-type="end">
                    <span class="palette-node-icon">⏹</span> End Event
                </div>
            </div>
            <div class="canvas-container" id="designer-canvas">
                <div class="canvas-wrap" id="canvas-wrap">
                <div class="canvas-grid" id="canvas-grid" style="width:${canvasWidth}px;height:${canvasHeight}px;"></div>
                <svg class="wf-edge" id="edges-svg" width="${canvasWidth}" height="${canvasHeight}">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3" orient="auto">
                                <polygon points="0 0, 10 3, 0 6" fill="#475569"/>
                            </marker>
                        </defs>
                    </svg>
                    <div class="workflow-canvas" id="workflow-canvas" style="width:${canvasWidth}px;height:${canvasHeight}px;"></div>
                </div>
            </div>
            <div class="properties-panel" id="properties-panel">
                <h3>Properties</h3>
                <div class="no-selection">Select a node to edit its properties, or drag one from the library.</div>
            </div>
        </div>
        <div class="designer-toolbar">
            <div class="left">
                <input type="text" class="workflow-name" id="workflow-name" value="${wf.name || 'Zurich Claims Processing'}" placeholder="Workflow name">
                <input type="text" class="workflow-name" id="workflow-desc" value="${wf.description || ''}" placeholder="Description">
            </div>
            <div class="spacer"></div>
            <div class="right">
                <button class="connect-mode-btn" id="connect-btn" onclick="toggleConnectMode()">🔗 Connect Mode</button>
                <button class="btn btn-primary" onclick="saveWorkflow()">💾 Save Workflow</button>
                <button class="btn" onclick="exportWorkflow()">📤 Export</button>
                <button class="btn" onclick="resetDesigner()">🔄 Reset</button>
            </div>
        </div>
    `;
    setupPaletteEvents();
    renderCanvasNodes();
    renderCanvasEdges();
    setupNodeDragging();
}

function setupPaletteEvents() {
    document.querySelectorAll('.palette-node').forEach(node => {
        const type = node.dataset.type;
        node.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            const clone = node.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '9999';
            clone.style.opacity = '0.6';
            clone.style.transform = 'scale(1.1)';
            clone.style.width = node.offsetWidth + 'px';
            clone.style.height = node.offsetHeight + 'px';
            clone.style.left = (e.clientX - node.offsetWidth / 2) + 'px';
            clone.style.top = (e.clientY - node.offsetHeight / 2) + 'px';
            document.body.appendChild(clone);

            const handleMove = me => {
                clone.style.left = (me.clientX - node.offsetWidth / 2) + 'px';
                clone.style.top = (me.clientY - node.offsetHeight / 2) + 'px';
            };
            const handleUp = me => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
                clone.remove();
                const canvas = document.getElementById('workflow-canvas');
                if (!canvas) return;
                const canvasRect = canvas.getBoundingClientRect();
                const canvasContainer = document.getElementById('canvas-wrap');
                const containerRect = canvasContainer.getBoundingClientRect();
                if (me.clientX >= containerRect.left && me.clientX <= containerRect.right &&
                    me.clientY >= containerRect.top && me.clientY <= containerRect.bottom) {
                    const scrollX = canvasContainer.scrollLeft || 0;
                    const scrollY = canvasContainer.scrollTop || 0;
                    const localX = me.clientX - containerRect.left + scrollX;
                    const localY = me.clientY - containerRect.top + scrollY;
                    addNodeFromPalette(type, localX, localY);
                }
            };
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
        });
    });
}

function renderCanvasNodes() {
    const canvas = document.getElementById('workflow-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    state.workflow.nodes.forEach(node => {
        if (!node.id) node.id = 'node_' + Math.random().toString(36).slice(2, 8);
        const div = document.createElement('div');
        div.className = `wf-node ${node.type}`;
        div.style.left = (node.x || 100) + 'px';
        div.style.top = (node.y || 100) + 'px';
        div.style.width = (node.width || 140) + 'px';
        div.style.minWidth = (node.width || 140) + 'px';
        div.style.height = (node.height || 60) + 'px';
        div.dataset.nodeId = node.id;
        if (node.id === state.selectedNodeId) div.classList.add('selected');

        div.innerHTML = `
            <div class="node-header">
                <span>${state.nodeTypeLabels[node.type] || node.type}</span>
                <div class="node-actions">
                    <button class="node-btn" onclick="deleteNode('${node.id}')" title="Delete">✕</button>
                </div>
            </div>
            <div class="node-body" ondblclick="startEditingNode('${node.id}')">${node.name || ''}</div>
            <input type="text" class="node-name-edit" data-node-id="${node.id}"
                   style="display:none;width:100%;padding:4px 8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;border-radius:4px;box-sizing:border-box;"
                   value="${node.name || ''}"
                   onblur="saveNodeName(this)"
                   onkeypress="if(event.key==='Enter')saveNodeName(this)">
        `;

        div.addEventListener('mousedown', e => {
            e.stopPropagation();
            if (state.connecting) {
                e.preventDefault();
                if (!state.connectSource) {
                    state.connectSource = node.id;
                    div.style.outline = '2px solid #0ea5e9';
                } else if (state.connectSource !== node.id) {
                    createEdge(state.connectSource, node.id);
                    state.connectSource = null;
                    state.connecting = false;
                    const btn = document.getElementById('connect-btn');
                    if (btn) btn.classList.remove('active');
                    renderCanvasEdges();
                } else {
                    state.connectSource = null;
                }
                if (!state.connectSource) {
                    state.connecting = false;
                    const btn = document.getElementById('connect-btn');
                    if (btn) btn.classList.remove('active');
                }
                return;
            }
            state.selectedNodeId = node.id;
            state.selectedEdgeId = null;
            state.draggingNode = { id: node.id, x: node.x || 100, y: node.y || 100, width: node.width || 140, height: node.height || 60 };
            div.classList.add('selected');
            updatePropertiesPanel();
        });

        canvas.appendChild(div);
    });
}

function setupNodeDragging() {
    const canvas = document.getElementById('workflow-canvas');
    if (!canvas) return;

    const handleMove = e => {
        if (!state.draggingNode) return;
        e.preventDefault();
        const canvasContainer = document.getElementById('canvas-wrap');
        const containerRect = canvasContainer.getBoundingClientRect();
        const scrollX = canvasContainer.scrollLeft || 0;
        const scrollY = canvasContainer.scrollTop || 0;
        const localX = e.clientX - containerRect.left + scrollX;
        const localY = e.clientY - containerRect.top + scrollY;

        state.draggingNode.x = localX;
        state.draggingNode.y = localY;

        const nodeEl = canvas.querySelector(`.wf-node[data-node-id="${state.draggingNode.id}"]`);
        if (nodeEl) {
            nodeEl.style.left = localX + 'px';
            nodeEl.style.top = localY + 'px';
        }
        renderCanvasEdges();
    };

    const handleUp = () => {
        if (state.draggingNode) {
            const node = state.workflow.nodes.find(n => n.id === state.draggingNode.id);
            if (node) {
                node.x = state.draggingNode.x;
                node.y = state.draggingNode.y;
            }
            state.draggingNode = null;
            updatePropertiesPanel();
        }
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleUp);
}

function renderCanvasEdges() {
    const svg = document.getElementById('edges-svg');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#475569"/></marker>';
    svg.appendChild(defs);

    const wfWidth = Math.max(900, Math.max(...state.workflow.nodes.map(n => (n.x || 0) + (n.width || 140))) + 120);
    const wfHeight = Math.max(500, Math.max(...state.workflow.nodes.map(n => (n.y || 0) + (n.height || 60))) + 120);
    svg.setAttribute('width', wfWidth);
    svg.setAttribute('height', wfHeight);

    state.workflow.edges.forEach(edge => {
        const source = state.workflow.nodes.find(n => n.id === edge.source);
        const target = state.workflow.nodes.find(n => n.id === edge.target);
        if (!source || !target) return;

        const sx = (source.x || 0) + (source.width || 140) / 2;
        const sy = (source.y || 0) + (source.height || 60) / 2;
        const tx = (target.x || 0) + (target.width || 140) / 2;
        const ty = (target.y || 0) + (target.height || 60) / 2;

        const cp = getConnectionPoints(sx, sy, tx, ty, source.width || 140, source.height || 60, target.width || 140, target.height || 60);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${cp.start.x} ${cp.start.y} C ${cp.start.x + (cp.end.x - cp.start.x) * 0.5} ${cp.start.y}, ${cp.end.x} ${cp.end.y}, ${cp.end.x} ${cp.end.y}`);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.style.stroke = edge.condition ? '#a78bea' : '#475569';
        path.style.strokeWidth = edge.id === state.selectedEdgeId ? '3' : '2';
        path.style.cursor = 'pointer';
        path.style.fill = 'none';
        path.setAttribute('data-edge-id', edge.id);
        path.addEventListener('click', e => {
            e.stopPropagation();
            state.selectedEdgeId = edge.id;
            state.selectedNodeId = null;
            updatePropertiesPanel();
            renderCanvasEdges();
            renderCanvasNodes();
        });
        svg.appendChild(path);

        if (edge.condition) {
            const midX = (cp.start.x + cp.end.x) / 2;
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', midX);
            label.setAttribute('y', (cp.start.y + cp.end.y) / 2 - 8);
            label.setAttribute('fill', '#a78bea');
            label.setAttribute('font-size', '11');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = edge.condition.replace(/{/g, '').replace(/}/g, '');
            svg.appendChild(label);
        }
    });

    const grid = document.getElementById('canvas-grid');
    if (grid) {
        grid.style.width = wfWidth + 'px';
        grid.style.height = wfHeight + 'px';
    }
    const canvasEl = document.getElementById('workflow-canvas');
    if (canvasEl) {
        canvasEl.style.width = wfWidth + 'px';
        canvasEl.style.height = wfHeight + 'px';
    }
}

function getConnectionPoints(sx, sy, tx, ty, sw, sh, tw, th) {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { start: { x: sx, y: sy }, end: { x: tx, y: ty } };
    const ux = dx / dist;
    const uy = dy / dist;
    return {
        start: { x: sx + ux * (sw / 2), y: sy + uy * (sh / 2) },
        end: { x: tx - ux * (tw / 2), y: ty - uy * (th / 2) }
    };
}

function toggleConnectMode() {
    state.connecting = !state.connecting;
    state.connectSource = null;
    const btn = document.getElementById('connect-btn');
    if (btn) btn.classList.toggle('active', state.connecting);
}

function addNodeFromPalette(type, x, y) {
    const newNode = {
        id: 'node_' + Math.random().toString(36).slice(2, 8),
        type: type,
        name: getDefaultNodeName(type),
        x: x || 100,
        y: y || 100,
        width: 140,
        height: 60,
        task_type: type === 'service_task' ? 'validate_claim' : (type === 'user_task' ? 'approve_claim' : ''),
        assignee: type === 'user_task' ? 'claims.analyst' : '',
    };
    state.workflow.nodes.push(newNode);
    state.selectedNodeId = newNode.id;
    renderCanvasNodes();
    renderCanvasEdges();
    updatePropertiesPanel();
}

function getDefaultNodeName(type) {
    const defaults = {
        start: 'Business Request',
        service_task: 'Automated Task',
        user_task: 'Human Review',
        gateway: 'Decision',
        end: 'Outcome / Close',
    };
    return defaults[type] || type;
}

function createEdge(sourceId, targetId) {
    if (state.workflow.edges.some(e => e.source === sourceId && e.target === targetId)) return;
    const newEdge = {
        id: 'edge_' + Math.random().toString(36).slice(2, 8),
        source: sourceId,
        target: targetId,
        condition: '',
    };
    state.workflow.edges.push(newEdge);
    renderCanvasEdges();
}

function deleteNode(nodeId) {
    if (!confirm('Delete this node? All connected edges will also be removed.')) return;
    state.workflow.nodes = state.workflow.nodes.filter(n => n.id !== nodeId);
    state.workflow.edges = state.workflow.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    state.selectedNodeId = null;
    updatePropertiesPanel();
    renderCanvasNodes();
    renderCanvasEdges();
}

function startEditingNode(nodeId) {
    const node = state.workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    state.selectedNodeId = nodeId;
    const body = document.querySelector(`.wf-node[data-node-id="${nodeId}"] .node-body`);
    const edit = document.querySelector(`.wf-node[data-node-id="${nodeId}"] .node-name-edit`);
    if (body && edit) {
        body.style.display = 'none';
        edit.style.display = 'block';
        edit.focus();
        edit.select();
    }
    updatePropertiesPanel();
}

function saveNodeName(input) {
    const nodeId = input.dataset.nodeId;
    const node = state.workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.name = input.value || getDefaultNodeName(node.type);
    state.selectedNodeId = nodeId;
    renderCanvasNodes();
    renderCanvasEdges();
    updatePropertiesPanel();
}

function updatePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    const edge = state.workflow.edges.find(e => e.id === state.selectedEdgeId);
    if (edge && !state.selectedNodeId) {
        const sourceNode = state.workflow.nodes.find(n => n.id === edge.source);
        const targetNode = state.workflow.nodes.find(n => n.id === edge.target);
        panel.innerHTML = `
            <h3>Edge Properties</h3>
            <div class="prop-group">
                <div class="prop-label">From</div>
                <div style="font-size:14px;color:#e2e8f0;">${sourceNode ? sourceNode.name : edge.source}</div>
            </div>
            <div class="prop-group">
                <div class="prop-label">To</div>
                <div style="font-size:14px;color:#e2e8f0;">${targetNode ? targetNode.name : edge.target}</div>
            </div>
            <div class="prop-group">
                <div class="prop-label">Condition</div>
                <input type="text" value="${edge.condition || ''}" onchange="updateEdgeProp('${edge.id}', 'condition', this.value)" placeholder="{variable} == value">
                <div style="font-size:11px;color:#64748b;margin-top:4px;">e.g. {risk} == 'high' or {approved} == True</div>
            </div>
            <button class="btn btn-sm btn-danger" style="width:100%;margin-top:8px;" onclick="deleteSelectedEdge()">Delete Edge</button>
        `;
        return;
    }

    const node = state.workflow.nodes.find(n => n.id === state.selectedNodeId);
    if (!node) {
        panel.innerHTML = '<h3>Properties</h3><div class="no-selection">Select a node or edge to edit its properties, or drag one from the library.</div>';
        return;
    }

    const taskTypeOptions = node.type === 'service_task'
        ? `<option value="validate_claim" ${node.task_type === 'validate_claim' ? 'selected' : ''}>validate_claim</option>
           <option value="fraud_check" ${node.task_type === 'fraud_check' ? 'selected' : ''}>fraud_check</option>
           <option value="calculate_payout" ${node.task_type === 'calculate_payout' ? 'selected' : ''}>calculate_payout</option>
           <option value="generate_payout" ${node.task_type === 'generate_payout' ? 'selected' : ''}>generate_payout</option>`
        : '<option value="">—</option>';

    const taskTypeRow = node.type === 'service_task'
        ? `<div class="prop-group"><div class="prop-label">Task Type</div><select onchange="updateNodeProp('${node.id}', 'task_type', this.value)">${taskTypeOptions}</select></div>`
        : '';

    const assigneeRow = node.type === 'user_task'
        ? `<div class="prop-group"><div class="prop-label">Assignee</div><input type="text" value="${node.assignee || ''}" onchange="updateNodeProp('${node.id}', 'assignee', this.value)" placeholder="e.g. claims.analyst"></div>`
        : '';

    panel.innerHTML = `
        <h3>Node Properties</h3>
        <div class="prop-group">
            <div class="prop-label">Node Type</div>
            <div style="font-size:14px;color:#e2e8f0;">${state.nodeTypeLabels[node.type] || node.type}</div>
        </div>
        <div class="prop-group">
            <div class="prop-label">Name</div>
            <input type="text" value="${node.name || ''}" onchange="updateNodeProp('${node.id}', 'name', this.value)">
        </div>
        ${taskTypeRow}
        ${assigneeRow}
        <div class="prop-group">
            <div class="prop-label">Position</div>
            <div style="font-size:12px;color:#94a3b8;">X: ${Math.round(node.x || 0)}, Y: ${Math.round(node.y || 0)}</div>
        </div>
        ${node.type === 'service_task' || node.type === 'user_task' || node.type === 'gateway' ? '<button class="btn btn-sm btn-danger" style="width:100%;margin-top:8px;" onclick="deleteSelectedNode()">Delete Node</button>' : ''}
    `;
}

function updateNodeProp(nodeId, prop, value) {
    const node = state.workflow.nodes.find(n => n.id === nodeId);
    if (node) {
        node[prop] = value;
        renderCanvasNodes();
        renderCanvasEdges();
        updatePropertiesPanel();
    }
}

function deleteSelectedNode() {
    if (state.selectedNodeId) {
        deleteNode(state.selectedNodeId);
    }
}

function updateEdgeProp(edgeId, prop, value) {
    const edge = state.workflow.edges.find(e => e.id === edgeId);
    if (edge) {
        edge[prop] = value;
        renderCanvasEdges();
        updatePropertiesPanel();
    }
}

function deleteSelectedEdge() {
    if (!state.selectedEdgeId) return;
    if (!confirm('Delete this edge?')) return;
    state.workflow.edges = state.workflow.edges.filter(e => e.id !== state.selectedEdgeId);
    state.selectedEdgeId = null;
    renderCanvasEdges();
    updatePropertiesPanel();
}

async function saveWorkflow() {
    const nameInput = document.getElementById('workflow-name');
    const descInput = document.getElementById('workflow-desc');
    if (nameInput) state.workflow.name = nameInput.value;
    if (descInput) state.workflow.description = descInput.value;
    if (!state.workflow.id) state.workflow.id = 'wf_' + Math.random().toString(36).slice(2, 8);

    try {
        await api('/workflow/' + state.workflow.id, {
            method: 'POST',
            body: {
                name: state.workflow.name,
                description: state.workflow.description,
                definition: state.workflow,
            }
        });
        alert('Workflow saved successfully!');
    } catch (e) {
        alert('Error saving: ' + e.message);
    }
}

function exportWorkflow() {
    const nameInput = document.getElementById('workflow-name');
    if (nameInput) state.workflow.name = nameInput.value;
    const blob = new Blob([JSON.stringify(state.workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.workflow.name || 'workflow') + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

async function resetDesigner() {
    if (!confirm('Reset the workflow designer to the default Zurich Claims Processing workflow? Unsaved changes will be lost.')) return;
    try {
        const wf = await api('/workflow/zurich-claims-v1');
        state.workflow = { ...wf };
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.connecting = false;
        state.connectSource = null;
        renderCanvasNodes();
        renderCanvasEdges();
        updatePropertiesPanel();
        const nameInput = document.getElementById('workflow-name');
        if (nameInput) nameInput.value = wf.name || '';
        const descInput = document.getElementById('workflow-desc');
        if (descInput) descInput.value = wf.description || '';
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

/* ===== Tasks ===== */
async function loadTasks() {
    try {
        state.tasks = await api('/tasks');
        renderTasks();
    } catch (e) {
        document.getElementById('tasks-content').innerHTML =
            '<div class="section"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Error: ' + e.message + '</p></div></div>';
    }
}

function renderTasks() {
    let inner = '<div class="page-header"><h1>Task Work Queue</h1><div class="actions"><button class="btn" onclick="loadTasks()">🔄 Refresh</button></div></div><div class="section">';
    if (!state.tasks || state.tasks.length === 0) {
        inner += '<div class="empty-state"><div class="empty-icon">📋</div><p>No pending tasks. Submit a claim to generate tasks.</p></div>';
    } else {
        inner += state.tasks.map(t => `
            <div class="task-card">
                <div class="task-header">
                    <span class="task-title">${t.node_name}</span>
                    <span style="font-size:12px;color:#64748b;">${formatDate(t.created_at)}</span>
                </div>
                <div class="task-meta">
                    <span>Type: ${t.task_type}</span>
                    <span>Assignee: ${t.assignee}</span>
                    <span>Status: <span class="status-badge status-submitted">${t.status}</span></span>
                </div>
                ${t.variables && Object.keys(t.variables).length > 0
                    ? `<div class="task-variables">${JSON.stringify(t.variables, null, 2)}</div>`
                    : ''}
                <div class="task-actions">
                    <button class="btn btn-sm btn-primary" onclick="executeTaskAction('${t.id}', 'approve')">✓ Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="executeTaskAction('${t.id}', 'reject')">✗ Reject</button>
                    <button class="btn btn-sm" onclick="viewClaimFromTask('${t.claim_id || t.instance_id}')">🔍 View Claim</button>
                </div>
            </div>
        `).join('');
    }
    inner += '</div>';
    document.getElementById('tasks-content').innerHTML = inner;
}

function viewClaimFromTask(claimId) {
    if (claimId) viewClaim(claimId);
}

async function executeTaskAction(taskId, action) {
    if (!confirm(`Are you sure you want to ${action} this task?`)) return;
    try {
        const result = await api('/tasks/' + taskId + '/action', {
            method: 'POST',
            body: { action, user: 'claims.analyst' }
        });
        if (result.status === 'completed') {
            alert(`Task ${action}ed. Workflow ${action === 'approve' ? 'completed successfully' : 'rejected'}.`);
            loadTasks();
            if (state.currentView === 'claims' && state.selectedClaim) {
                viewClaim(state.selectedClaim);
            }
        } else {
            alert(`Task ${action}ed. Workflow continues...`);
            loadTasks();
            if (state.currentView === 'claims' && state.selectedClaim) {
                viewClaim(state.selectedClaim);
            }
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

/* ===== Workflow Visualization (Claim Detail) ===== */
function renderWorkflowViz(workflow) {
    const nodes = workflow.nodes || state.workflow.nodes;
    const instance = workflow;
    const completed = new Set();
    const visited = new Set();
    const history = workflow.history || [];

    history.forEach(h => {
        if (h.node_id) visited.add(h.node_id);
        if (h.action === 'completed' || h.action === 'executed' || h.action === 'task_completed') {
            completed.add(h.node_id);
        }
    });

    const currentNode = workflow.current_node;
    const maxWidth = 760;
    const maxHeight = 280;
    const minX = Math.min(0, ...nodes.map(n => n.x || 0));
    const maxX = Math.max(...nodes.map(n => (n.x || 0) + (n.width || 140)));
    const minY = Math.min(0, ...nodes.map(n => n.y || 0));
    const maxY = Math.max(...nodes.map(n => (n.y || 0) + (n.height || 60)));
    const scale = Math.min(maxWidth / (maxX - minX + 50), maxHeight / (maxY - minY + 50), 1);

    const scaledNodes = nodes.map(n => ({
        ...n,
        x: (n.x - minX + 25) * scale,
        y: (n.y - minY + 20) * scale,
        width: (n.width || 140) * scale,
        height: (n.height || 60) * scale,
    }));

    const canvasW = (maxX - minX + 50) * scale;
    const canvasH = (maxY - minY + 40) * scale;

    let paths = '';
    workflow.edges.forEach(edge => {
        const s = scaledNodes.find(n => n.id === edge.source);
        const t = scaledNodes.find(n => n.id === edge.target);
        if (!s || !t) return;
        const sx = s.x + s.width / 2;
        const sy = s.y + s.height / 2;
        const tx = t.x + t.width / 2;
        const ty = t.y + t.height / 2;
        const done = completed.has(edge.source);
        const color = done ? '#4ade80' : (currentNode && (edge.source === currentNode || edge.target === currentNode) ? '#0ea5e9' : '#475569');
        paths += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="${scale * 2}" marker-end="url(#arrowhead-viz)"/>`;
    });

    let nodeEls = scaledNodes.map(n => {
        let statusClass = 'pending';
        if (completed.has(n.id)) statusClass = 'completed';
        if (n.id === currentNode) statusClass = 'current';
        return `<div class="viz-node ${statusClass}" style="left:${n.x}px;top:${n.y}px;width:${n.width}px;">
            <div class="node-name" style="font-size:${Math.max(8, 12 * scale)}px;">${n.name || n.type}</div>
            <div class="node-status" style="font-size:${Math.max(7, 10 * scale)}px;">${statusClass}</div>
        </div>`;
    }).join('');

    return `
        <svg width="${canvasW}" height="${canvasH}" style="position:absolute;top:0;left:0;z-index:1;">
            <defs>
                <marker id="arrowhead-viz" markerWidth="10" markerHeight="7" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#475569"/>
                </marker>
                <marker id="arrowhead-viz-active" markerWidth="10" markerHeight="7" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#0ea5e9"/>
                </marker>
                <marker id="arrowhead-viz-completed" markerWidth="10" markerHeight="7" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#4ade80"/>
                </marker>
            </defs>
            ${paths}
        </svg>
        <div style="position:relative;width:${canvasW}px;height:${canvasH}px;z-index:2;">
            ${nodeEls}
        </div>
    `;
}

/* ===== Helpers ===== */
function formatStatusLabel(status) {
    const map = {
        submitted: 'Submitted',
        in_progress: 'In Progress',
        paid: 'Paid',
        'Closed - Paid': 'Closed - Paid',
        closed_paid: 'Closed - Paid',
        'Rejected - Fraud': 'Rejected (Fraud)',
        rejected_fraud: 'Rejected (Fraud)',
        'Rejected - Not Approved': 'Rejected',
        rejected_not_approved: 'Rejected',
        'Rejected - Incomplete': 'Rejected (Incomplete)',
        rejected_incomplete: 'Rejected (Incomplete)',
    };
    return map[status] || status;
}

function escapeStatusClass(status) {
    if (status === 'submitted') return 'status-submitted';
    if (status === 'paid' || status === 'closed_paid' || status === 'Closed - Paid') return 'status-paid';
    if (status && status.includes('Rejected')) return 'status-rejected';
    if (status === 'in_progress') return 'status-in_progress';
    return 'status-submitted';
}

function getStatusColor(status) {
    if (status === 'submitted') return '#38bdf8';
    if (status === 'paid' || status === 'closed_paid') return '#4ade80';
    if (status && status.includes('Rejected')) return '#ef4444';
    if (status === 'in_progress') return '#f59e0b';
    return '#64748b';
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch { return iso; }
}

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', init);

window.navigateTo = navigateTo;
window.showCreateModal = showCreateModal;
window.closeModal = closeModal;
window.selectClaimType = selectClaimType;
window.submitClaim = submitClaim;
window.viewClaim = viewClaim;
window.deleteNode = deleteNode;
window.startEditingNode = startEditingNode;
window.saveNodeName = saveNodeName;
window.updateNodeProp = updateNodeProp;
window.deleteSelectedNode = deleteSelectedNode;
window.saveWorkflow = saveWorkflow;
window.exportWorkflow = exportWorkflow;
window.executeTaskAction = executeTaskAction;
window.loadTasks = loadTasks;
window.toggleConnectMode = toggleConnectMode;
window.addNodeFromPalette = addNodeFromPalette;
window.updateEdgeProp = updateEdgeProp;
window.deleteSelectedEdge = deleteSelectedEdge;
window.resetDesigner = resetDesigner;
