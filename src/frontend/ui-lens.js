function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

export class UILens {
  constructor() {
    this.lens = document.getElementById('evidence-lens');
    this.lensLabel = document.getElementById('lens-label');
    this.lensKind = document.getElementById('lens-kind');
    this.lensId = document.getElementById('lens-id');
    this.lensConfSection = document.getElementById('lens-confidence-section');
    this.lensConfScore = document.getElementById('lens-confidence-score');
    this.lensConfSource = document.getElementById('lens-confidence-source');
    this.lensRationaleRow = document.getElementById('lens-rationale-row');
    this.lensRationale = document.getElementById('lens-rationale');
    this.lensProvSection = document.getElementById('lens-provenance-section');
    this.lensProvList = document.getElementById('lens-provenance-list');
    this.lensRelSection = document.getElementById('lens-relationships-section');
    this.lensRelList = document.getElementById('lens-relationships-list');
    this.lensFactsSection = document.getElementById('lens-facts-section');
    this.lensFactsList = document.getElementById('lens-facts-list');
    this.lensConflictsSection = document.getElementById('lens-conflicts-section');
    this.lensConflictsList = document.getElementById('lens-conflicts-list');
    this.lensHypSection = document.getElementById('lens-hypotheses-section');
    this.lensHypList = document.getElementById('lens-hypotheses-list');
    
    this.graphStatusEl = document.getElementById('graph-status');
    this.gsNodes = document.getElementById('gs-nodes');
    this.gsEdges = document.getElementById('gs-edges');
    this.gsFacts = document.getElementById('gs-facts');
    this.gsConflicts = document.getElementById('gs-conflicts');
    this.gsHypotheses = document.getElementById('gs-hypotheses');
  }

  updateGraphStatus(graphModel) {
    if (!graphModel || !graphModel.realGraph) { this.graphStatusEl.hidden = true; return; }
    const realGraph = graphModel.realGraph;
    this.gsNodes.textContent = String(realGraph.nodes.length).padStart(2, '0');
    this.gsEdges.textContent = String(realGraph.edges.length).padStart(2, '0');
    this.gsFacts.textContent = String((realGraph.derivedFacts || []).length).padStart(2, '0');
    this.gsConflicts.textContent = String((realGraph.conflicts || []).length).padStart(2, '0');
    this.gsHypotheses.textContent = String((realGraph.hypotheses || []).length).padStart(2, '0');
    this.graphStatusEl.hidden = false;
  }

  hideLens() {
    this.lens.hidden = true;
  }

  populateLens(node, graphModel) {
    const realGraph = graphModel.realGraph;
    
    this.lensLabel.textContent = node.label || node.id;
    this.lensKind.textContent = node.kind || '';
    this.lensId.textContent = node.id;

    if (node.confidence) {
      this.lensConfScore.textContent = node.confidence.score !== undefined ? node.confidence.score.toFixed(2) : '';
      this.lensConfSource.textContent = node.confidence.source || '';
      if (node.confidence.rationale) {
        this.lensRationale.textContent = node.confidence.rationale;
        this.lensRationaleRow.hidden = false;
      } else {
        this.lensRationaleRow.hidden = true;
      }
      this.lensConfSection.hidden = false;
    } else {
      this.lensConfSection.hidden = true;
    }

    const provRecords = node.provenance || [];
    if (provRecords.length > 0) {
      this.lensProvList.innerHTML = '';
      for (const prov of provRecords) {
        const item = document.createElement('div');
        item.className = 'lens-prov-item';
        let html = '';
        html += `<div class="lens-prov-row"><span class="lens-prov-key">SOURCE</span><span class="lens-prov-val">${esc(prov.sourceType)} / ${esc(prov.sourceId)}</span></div>`;
        if (prov.sourceVersion) html += `<div class="lens-prov-row"><span class="lens-prov-key">VERSION</span><span class="lens-prov-val">${esc(prov.sourceVersion)}</span></div>`;
        html += `<div class="lens-prov-row"><span class="lens-prov-key">RUN</span><span class="lens-prov-val">${esc(prov.runId)}</span></div>`;
        html += `<div class="lens-prov-row"><span class="lens-prov-key">EXTERNAL</span><span class="lens-prov-val">${prov.external ? 'yes' : 'no'}</span></div>`;
        if (prov.supportingEvidenceIds && prov.supportingEvidenceIds.length > 0) {
          html += `<div class="lens-evidence-tag">DERIVED — supported by ${prov.supportingEvidenceIds.length} evidence ID(s)</div>`;
          for (const eid of prov.supportingEvidenceIds) {
            html += `<div class="lens-evidence-tag">↳ ${esc(eid)}</div>`;
          }
        } else {
          html += `<div class="lens-evidence-tag">SOURCE RECORD</div>`;
        }
        item.innerHTML = html;
        this.lensProvList.appendChild(item);
      }
      this.lensProvSection.hidden = false;
    } else {
      this.lensProvSection.hidden = true;
    }

    const nodeEdges = graphModel.getNodeEdges(node.id);
    this.lensRelList.innerHTML = '';
    if (nodeEdges.length > 0) {
      for (const edge of nodeEdges) {
        const otherId = edge.from === node.id ? edge.to : edge.from;
        const otherNode = graphModel.getNode(otherId);
        const otherLabel = otherNode ? (otherNode.label || otherNode.id) : otherId;
        const dir = edge.from === node.id ? '→' : '←';
        const item = document.createElement('div');
        item.className = 'lens-rel-item';
        let html = `<span class="lens-rel-relation">${esc(edge.relation)}</span> ${dir} <span class="lens-rel-target">${esc(otherLabel)}</span>`;
        if (edge.confidence && edge.confidence.score !== undefined) {
          html += ` <span class="lens-rel-conf">${edge.confidence.score.toFixed(2)}</span>`;
        }
        item.innerHTML = html;
        this.lensRelList.appendChild(item);
      }
    } else {
      this.lensRelList.innerHTML = '<div class="lens-empty">NO RECORDED RELATIONSHIPS</div>';
    }
    this.lensRelSection.hidden = false;

    const facts = (realGraph.derivedFacts || []);
    if (facts.length > 0) {
      this.lensFactsList.innerHTML = '';
      for (const f of facts) {
        const item = document.createElement('div');
        item.className = 'lens-fact-item';
        let html = `<div>${esc(f.statement)}</div>`;
        if (f.confidence) html += `<div class="lens-rel-conf">${f.confidence.score !== undefined ? f.confidence.score.toFixed(2) : ''} / ${f.confidence.source || ''}</div>`;
        if (f.evidenceIds && f.evidenceIds.length > 0) html += `<div class="lens-evidence-tag">${f.evidenceIds.length} evidence ID(s)</div>`;
        item.innerHTML = html;
        this.lensFactsList.appendChild(item);
      }
      this.lensFactsSection.hidden = false;
    } else {
      this.lensFactsSection.hidden = true;
    }

    const conflicts = (realGraph.conflicts || []);
    if (conflicts.length > 0) {
      this.lensConflictsList.innerHTML = '';
      for (const c of conflicts) {
        const item = document.createElement('div');
        item.className = 'lens-conflict-item';
        let html = `<div>${esc(c.summary)}</div>`;
        html += `<div class="lens-severity">${esc(c.severity || '')}</div>`;
        item.innerHTML = html;
        this.lensConflictsList.appendChild(item);
      }
      this.lensConflictsSection.hidden = false;
    } else {
      this.lensConflictsSection.hidden = true;
    }

    const hyps = (realGraph.hypotheses || []);
    if (hyps.length > 0) {
      this.lensHypList.innerHTML = '';
      for (const h of hyps) {
        const item = document.createElement('div');
        item.className = 'lens-hyp-item';
        let html = `<div>${esc(h.statement)}</div>`;
        if (h.confidence) html += `<div class="lens-rel-conf">${h.confidence.score !== undefined ? h.confidence.score.toFixed(2) : ''}</div>`;
        if (h.supportingEvidenceIds && h.supportingEvidenceIds.length > 0) html += `<div class="lens-evidence-tag">supporting: ${h.supportingEvidenceIds.length}</div>`;
        if (h.missingEvidenceIds && h.missingEvidenceIds.length > 0) html += `<div class="lens-severity">missing: ${h.missingEvidenceIds.length}</div>`;
        item.innerHTML = html;
        this.lensHypList.appendChild(item);
      }
      this.lensHypSection.hidden = false;
    } else {
      this.lensHypSection.hidden = true;
    }

    this.lens.hidden = false;
  }
}
