class ResourceAllocationGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this.selectedNode = null;
        this.edgeMode = null;
        this.deadlockDetected = false;
        this.logs = [];
        this.initCanvas();
        this.bindEvents();
        this.render();
        this.log('System initialized. Start adding nodes and edges.');
    }

    initCanvas() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    bindEvents() {
        // Node management
        document.getElementById('addNodeBtn').onclick = () => this.addNode();
        document.getElementById('nodeType').onchange = (e) => {
            document.getElementById('instancesGroup').style.display = 
                e.target.value === 'resource' ? 'block' : 'none';
        };

        // Edge management
        document.getElementById('addEdgeBtn').onclick = () => {
            this.edgeMode = 'add';
            this.log('Edge mode: Add. Select source node first.');
        };

        document.getElementById('removeEdgeBtn').onclick = () => {
            this.edgeMode = 'remove';
            this.log('Edge mode: Remove. Select an edge to remove.');
        };

        document.getElementById('detectDeadlockBtn').onclick = () => this.detectDeadlock();
        document.getElementById('clearAllBtn').onclick = () => this.clearAll();

        // Canvas click handling
        this.canvas.onclick = (e) => this.handleCanvasClick(e);
    }

    addNode() {
        const name = document.getElementById('nodeName').value.trim();
        const type = document.getElementById('nodeType').value;
        
        if (!name) {
            alert('Please enter a node name');
            return;
        }

        if (this.nodes.has(name)) {
            alert('Node with this name already exists');
            return;
        }

        let instances = 1;
        if (type === 'resource') {
            instances = parseInt(document.getElementById('resourceInstances').value);
        }

        const node = {
            id: name,
            type: type,
            instances: type === 'resource' ? instances : null,
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50,
            radius: 30
        };

        this.nodes.set(name, node);
        this.log(`${type === 'process' ? 'Process' : 'Resource'} "${name}" added`);
        this.updateUI();
        this.render();
    }

    addEdge(fromNode, toNode) {
        // Check if edge already exists
        const exists = this.edges.some(edge => 
            edge.from === fromNode.id && edge.to === toNode.id
        );

        if (exists) {
            this.log(`Edge already exists from ${fromNode.id} to ${toNode.id}`);
            return;
        }

        // Validate edge types and determine edge type
        let edgeType = '';
        if (fromNode.type === 'process' && toNode.type === 'resource') {
            edgeType = 'request';
        } else if (fromNode.type === 'resource' && toNode.type === 'process') {
            edgeType = 'allocation';
        } else {
            this.log('Invalid edge: Can only connect Process→Resource or Resource→Process');
            return;
        }

        this.edges.push({ from: fromNode.id, to: toNode.id, type: edgeType });
        this.log(`${edgeType === 'allocation' ? 'Allocation' : 'Request'} edge added: ${fromNode.id} → ${toNode.id}`);

        this.selectedNode = null;
        this.edgeMode = null;
        this.updateUI();
        this.render();
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.edgeMode === 'remove') {
            this.removeEdgeAt(x, y);
            return;
        }

        // Check if clicked on a node
        for (const node of this.nodes.values()) {
            const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (distance <= node.radius) {
                this.handleNodeClick(node);
                return;
            }
        }

        // If in edge mode and clicked empty space, cancel
        if (this.edgeMode === 'add') {
            this.selectedNode = null;
            this.log('Edge creation cancelled');
            this.render();
        }
    }

    handleNodeClick(node) {
        if (this.edgeMode === 'add') {
            if (!this.selectedNode) {
                this.selectedNode = node;
                this.log(`Selected ${node.type} "${node.id}" as source`);
                this.highlightNode(node);
            } else {
                if (this.selectedNode.id === node.id) {
                    this.log('Cannot create edge to same node');
                    return;
                }
                this.addEdge(this.selectedNode, node);
            }
        }
    }

    highlightNode(node) {
        this.render();
        this.ctx.save();
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }

    removeEdgeAt(x, y) {
        for (let i = this.edges.length - 1; i >= 0; i--) {
            const edge = this.edges[i];
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            
            if (this.isPointOnEdge(x, y, fromNode, toNode)) {
                this.log(`Removed edge: ${edge.from} → ${edge.to}`);
                this.edges.splice(i, 1);
                this.updateUI();
                this.render();
                return;
            }
        }
        this.log('No edge found at click position');
    }

    isPointOnEdge(x, y, fromNode, toNode) {
        if (!fromNode || !toNode) return false;
        
        // Calculate edge line parameters
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return false;
        
        // Calculate projection point
        const t = ((x - fromNode.x) * dx + (y - fromNode.y) * dy) / (length * length);
        
        if (t < 0 || t > 1) return false;
        
        // Calculate closest point on edge
        const closestX = fromNode.x + t * dx;
        const closestY = fromNode.y + t * dy;
        
        // Check distance
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        return distance < 8;
    }

    detectDeadlock() {
        this.log('Starting deadlock detection...');
        
        // Build adjacency list
        const nodeList = Array.from(this.nodes.keys());
        const n = nodeList.length;
        const adj = new Map();
        
        // Initialize adjacency list
        nodeList.forEach(node => adj.set(node, []));
        
        // Fill adjacency list
        for (const edge of this.edges) {
            if (adj.has(edge.from)) {
                adj.get(edge.from).push(edge.to);
            }
        }
        
        // Detect cycles using DFS
        const visited = new Map();
        const recStack = new Map();
        const cycle = [];
        
        const dfs = (node, path) => {
            if (!visited.has(node)) {
                visited.set(node, true);
                recStack.set(node, true);
                path.push(node);
                
                const neighbors = adj.get(node) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        if (dfs(neighbor, path)) {
                            return true;
                        }
                    } else if (recStack.get(neighbor)) {
                        // Cycle found
                        const cycleStart = path.indexOf(neighbor);
                        if (cycleStart !== -1) {
                            cycle.push(...path.slice(cycleStart));
                        }
                        return true;
                    }
                }
                
                path.pop();
            }
            recStack.set(node, false);
            return false;
        };
        
        for (const node of nodeList) {
            if (dfs(node, [])) {
                break;
            }
        }
        
        if (cycle.length > 0) {
            this.deadlockDetected = true;
            document.getElementById('deadlockStatus').className = 'status-value deadlock';
            document.getElementById('deadlockStatus').textContent = 'DEADLOCK DETECTED!';
            this.log(`🚨 DEADLOCK DETECTED in cycle: ${cycle.join(' → ')}`);
            
            // Highlight the cycle
            this.highlightDeadlock(cycle);
        } else {
            this.deadlockDetected = false;
            document.getElementById('deadlockStatus').className = 'status-value safe';
            document.getElementById('deadlockStatus').textContent = 'No Deadlock Detected';
            this.log('✅ System is deadlock-free');
        }
    }

    highlightDeadlock(cycle) {
        this.render();
        
        // Highlight nodes in cycle
        for (const nodeName of cycle) {
            const node = this.nodes.get(nodeName);
            if (node) {
                this.ctx.save();
                this.ctx.strokeStyle = '#e53e3e';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }
        
        // Highlight edges in cycle
        for (let i = 0; i < cycle.length; i++) {
            const fromNode = cycle[i];
            const toNode = cycle[(i + 1) % cycle.length];
            const edge = this.edges.find(e => e.from === fromNode && e.to === toNode);
            
            if (edge) {
                const from = this.nodes.get(fromNode);
                const to = this.nodes.get(toNode);
                
                if (from && to) {
                    this.drawEdge(from, to, edge.type, true);
                }
            }
        }
    }

    clearAll() {
        this.nodes.clear();
        this.edges = [];
        this.selectedNode = null;
        this.edgeMode = null;
        this.deadlockDetected = false;
        this.logs = ['System cleared.'];
        this.updateUI();
        this.render();
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.unshift(`[${timestamp}] ${message}`);
        if (this.logs.length > 10) this.logs.pop();
        
        const logContainer = document.getElementById('systemLog');
        logContainer.innerHTML = this.logs.map(log => 
            `<div class="log-entry">${log}</div>`
        ).join('');
    }

    updateUI() {
        // Update node counts
        const processes = Array.from(this.nodes.values()).filter(n => n.type === 'process');
        const resources = Array.from(this.nodes.values()).filter(n => n.type === 'resource');
        
        document.getElementById('processCount').textContent = processes.length;
        document.getElementById('resourceCount').textContent = resources.length;
        
        // Update edge counts
        const allocations = this.edges.filter(e => e.type === 'allocation').length;
        const requests = this.edges.filter(e => e.type === 'request').length;
        
        document.getElementById('allocationCount').textContent = allocations;
        document.getElementById('requestCount').textContent = requests;
        
        // Update node list
        const nodesList = document.getElementById('nodesList');
        nodesList.innerHTML = '';
        
        for (const node of this.nodes.values()) {
            const nodeDiv = document.createElement('div');
            nodeDiv.className = `node-item ${node.type}-node`;
            
            nodeDiv.innerHTML = `
                <div class="node-info">
                    <div class="node-name">${node.id}</div>
                    <div class="node-type">${node.type.toUpperCase()}${node.instances ? ` (${node.instances} instances)` : ''}</div>
                </div>
                <div class="status-indicator ${this.deadlockDetected ? 'blocked' : ''}"></div>
            `;
            
            nodesList.appendChild(nodeDiv);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw edges first (so they appear behind nodes)
        for (const edge of this.edges) {
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            
            if (fromNode && toNode) {
                this.drawEdge(fromNode, toNode, edge.type, false);
            }
        }
        
        // Draw nodes
        for (const node of this.nodes.values()) {
            this.drawNode(node);
        }
        
        // Draw edge being created
        if (this.selectedNode && this.edgeMode === 'add') {
            this.ctx.save();
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.selectedNode.x, this.selectedNode.y);
            this.ctx.lineTo(this.canvas.width/2, this.canvas.height/2);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    drawNode(node) {
        this.ctx.save();
        
        // Node background
        const gradient = this.ctx.createRadialGradient(
            node.x, node.y, 5,
            node.x, node.y, node.radius
        );
        
        if (node.type === 'process') {
            gradient.addColorStop(0, '#63b3ed');
            gradient.addColorStop(1, '#4299e1');
        } else {
            gradient.addColorStop(0, '#f6ad55');
            gradient.addColorStop(1, '#ed8936');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Node border
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Node label
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id, node.x, node.y);
        
        // Resource instances (if any)
        if (node.instances > 1) {
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`${node.instances}`, node.x, node.y + 25);
        }
        
        this.ctx.restore();
    }

    drawEdge(fromNode, toNode, type, highlight = false) {
        this.ctx.save();
        
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            this.ctx.restore();
            return;
        }
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Calculate start and end points (edge of circles)
        const startX = fromNode.x + unitX * fromNode.radius;
        const startY = fromNode.y + unitY * fromNode.radius;
        const endX = toNode.x - unitX * toNode.radius;
        const endY = toNode.y - unitY * toNode.radius;
        
        // Edge style
        if (type === 'allocation') {
            this.ctx.strokeStyle = highlight ? '#e53e3e' : '#38a169';
        } else {
            this.ctx.strokeStyle = highlight ? '#e53e3e' : '#e53e3e';
        }
        
        this.ctx.lineWidth = highlight ? 3 : 2;
        if (highlight) this.ctx.setLineDash([5, 3]);
        
        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(dy, dx);
        const arrowSize = 8;
        
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 6),
            endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 6),
            endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.graph = new ResourceAllocationGraph();
});