
function determineGeometryType(kind) {
  if (!kind) return 'sphere';
  const k = kind.toLowerCase();
  if (k.includes('repository') || k.includes('package') || k.includes('docker') || k.includes('readme') || k.includes('tsconfig')) return 'box';
  if (k.includes('framework') || k.includes('architecture') || k.includes('moduleboundary') || k.includes('language')) return 'diamond';
  return 'sphere';
}
function stableHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0);
}

export function computeTopology(nodes, edges) {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: nodes[0].id, x: 0.5, y: 0.5, degree: 0 }];

  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, []));
  edges.forEach(edge => {
    if (adjacency.has(edge.from)) adjacency.get(edge.from).push(edge.to);
    if (adjacency.has(edge.to)) adjacency.get(edge.to).push(edge.from);
  });

  for (const [id, neighbors] of adjacency.entries()) {
    neighbors.sort((a, b) => a.localeCompare(b));
  }

  const visited = new Set();
  const components = [];
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  for (const node of sortedNodes) {
    if (!visited.has(node.id)) {
      const comp = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        comp.push(curr);
        for (const neighbor of adjacency.get(curr)) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  components.sort((a, b) => {
     if (b.length !== a.length) return b.length - a.length;
     return a[0].localeCompare(b[0]);
  });

  const results = [];
  const baseRadius = 0.08;

  components.forEach((comp, compIndex) => {
     let cx = 0, cy = 0;
     if (compIndex === 0) {
        cx = 0; cy = 0;
     } else {
        const ring = Math.ceil(Math.sqrt(compIndex));
        const maxInRing = 8 * ring;
        const idxInRing = compIndex - Math.pow(ring - 1, 2);
        const angle = (idxInRing / maxInRing) * Math.PI * 2;
        const dist = ring * 0.4;
        cx = Math.cos(angle) * dist;
        cy = Math.sin(angle) * dist;
     }

     if (comp.length === 1) {
         results.push({ id: comp[0], x: cx, y: cy, degree: adjacency.get(comp[0]).length });
         return;
     }

     let root = comp[0];
     let maxDegree = -1;
     for (const id of comp) {
         const deg = adjacency.get(id).length;
         if (deg > maxDegree || (deg === maxDegree && id.localeCompare(root) < 0)) {
             maxDegree = deg;
             root = id;
         }
     }

     const depthMap = new Map();
     const rings = [];
     const q = [root];
     depthMap.set(root, 0);
     rings[0] = [root];

     const compVisited = new Set([root]);

     while(q.length > 0) {
         const curr = q.shift();
         const d = depthMap.get(curr);

         for (const neighbor of adjacency.get(curr)) {
             if (!compVisited.has(neighbor) && comp.includes(neighbor)) {
                 compVisited.add(neighbor);
                 depthMap.set(neighbor, d + 1);
                 if (!rings[d + 1]) rings[d + 1] = [];
                 rings[d + 1].push(neighbor);
                 q.push(neighbor);
             }
         }
     }

     for (const id of comp) {
         if (!compVisited.has(id)) {
             if (!rings[1]) rings[1] = [];
             rings[1].push(id);
         }
     }

     for (let d = 0; d < rings.length; d++) {
         const ringNodes = rings[d];
         if (d === 0) {
             results.push({ id: ringNodes[0], x: cx, y: cy, degree: adjacency.get(ringNodes[0]).length });
         } else {
             ringNodes.sort((a, b) => stableHash(a) - stableHash(b));
             const r = d * baseRadius * (1 + (ringNodes.length / 20));
             const count = ringNodes.length;
             const angleOffset = (stableHash(root) % 360) * (Math.PI / 180);
             for (let i = 0; i < count; i++) {
                 const angle = angleOffset + (i / count) * Math.PI * 2;
                 results.push({
                     id: ringNodes[i],
                     x: cx + Math.cos(angle) * r,
                     y: cy + Math.sin(angle) * r,
                     degree: adjacency.get(ringNodes[i]).length
                 });
             }
         }
     }
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  results.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const w = maxX - minX;
  const h = maxY - minY;
  const scale = Math.max(w, h) > 0 ? 0.7 / Math.max(w, h) : 1;

  results.forEach(p => {
      p.x = 0.5 + (p.x - (minX + w / 2)) * scale;
      p.y = 0.5 + (p.y - (minY + h / 2)) * scale;
  });

  return results;
}

export function compute3DTopology(nodes, edges) {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: nodes[0].id, x: 0, y: 0, z: 0, depth: 0, degree: 0 }];

  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, []));
  edges.forEach(edge => {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) {
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
    }
  });

  for (const neighbors of adjacency.values()) {
    neighbors.sort((a, b) => a.localeCompare(b));
  }

  const visited = new Set();
  const components = [];
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  for (const node of sortedNodes) {
    if (!visited.has(node.id)) {
      const comp = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        comp.push(curr);
        for (const neighbor of adjacency.get(curr)) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
  }

  components.sort((a, b) => {
     if (b.length !== a.length) return b.length - a.length;
     return a[0].localeCompare(b[0]);
  });

  const results = [];

  components.forEach((comp, compIndex) => {
     let cx = 0, cy = 0, cz = 0;
     if (compIndex > 0) {
        const ringRadius = 15 + compIndex * 4;
        const angle = compIndex * 2.39996;
        cx = Math.cos(angle) * ringRadius;
        cz = Math.sin(angle) * ringRadius;
        cy = -5 - compIndex;
     }

     let maxDegree = -1;
     let root = comp[0];
     for (const id of comp) {
         const deg = adjacency.get(id).length;
         if (deg > maxDegree || (deg === maxDegree && id.localeCompare(root) < 0)) {
             maxDegree = deg;
             root = id;
         }
     }

     const depthMap = new Map();
     const layers = [];
     const q = [root];
     depthMap.set(root, 0);
     layers[0] = [root];

     while(q.length > 0) {
         const curr = q.shift();
         const d = depthMap.get(curr);

         for (const neighbor of adjacency.get(curr)) {
             if (!depthMap.has(neighbor)) {
                 depthMap.set(neighbor, d + 1);
                 if (!layers[d + 1]) layers[d + 1] = [];
                 layers[d + 1].push(neighbor);
                 q.push(neighbor);
             }
         }
     }

     for (let d = 0; d < layers.length; d++) {
         const layerNodes = layers[d];
         if (d === 0) {
             results.push({ id: layerNodes[0], x: cx, y: cy, z: cz, depth: 0, degree: adjacency.get(layerNodes[0]).length });
         } else {
             layerNodes.sort((a, b) => stableHash(a) - stableHash(b));
             const r = d * 5 + (layerNodes.length * 0.2);
             const count = layerNodes.length;
             const angleOffset = (stableHash(root) % 360) * (Math.PI / 180);
             
             for (let i = 0; i < count; i++) {
                 const angle = angleOffset + (i / count) * Math.PI * 2;
                 results.push({
                     id: layerNodes[i],
                     x: cx + Math.cos(angle) * r,
                     y: cy - d * 4,
                     z: cz + Math.sin(angle) * r,
                     depth: d,
                     degree: adjacency.get(layerNodes[i]).length
                 });
             }
         }
     }
  });

  return results;
}

export function makeRealLayoutStages(nodes, topology) {
  const stages = [[], [], [], []];
  const n = nodes.length;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const topo = topology.find(t => t.id === node.id);
    const kind = (node.kind || '').toLowerCase();

    let semanticScale = 1;
    let semanticOpacity = 0.8;
    let isForeground = false;
    let isBackground = false;

    if (kind.startsWith('metadata')) {
      semanticScale = 0.5;
      semanticOpacity = 0.4;
      isBackground = true;
    } else if (kind.includes('component') || kind.includes('framework') || kind.includes('server')) {
      semanticScale = 1.3;
      semanticOpacity = 1;
      isForeground = true;
    } else if (kind.includes('module') || kind.includes('ast')) {
      semanticScale = 0.9;
      semanticOpacity = 0.7;
    }

    if (topo.degree > 3) {
      semanticScale *= 1.15;
      isForeground = true;
    }

    const zDepth = isForeground ? 1.2 : (isBackground ? -0.5 : 0);

    for (let stageIndex = 0; stageIndex < 4; stageIndex++) {
      let x = topo.x;
      let y = topo.y;
      let scale = semanticScale;
      let opacity = semanticOpacity;

      if (stageIndex === 0) {
        x = 0.5 + (x - 0.5) * 0.7;
        y = 0.5 + (y - 0.5) * 0.7;
        scale *= 0.6;
        opacity *= 0.3;
      } else if (stageIndex === 1) {
        x = 0.5 + (x - 0.5) * 0.9;
        y = 0.5 + (y - 0.5) * 0.9;
        scale *= 0.85;
        opacity *= 0.6;
      } else if (stageIndex === 2) {
        if (node.confidence && node.confidence.score !== undefined) {
          scale *= 0.5 + (node.confidence.score * 0.5);
          opacity *= 0.6 + (node.confidence.score * 0.4);
        }
      }

      stages[stageIndex].push({
        x, y, scale, opacity,
        originalNode: node,
        zDepth,
        kindGroup: isForeground ? 'fore' : (isBackground ? 'back' : 'mid')
      });
    }
  }
  return stages;
}

export function makeProceduralLayout(count, stageIndex) {
  const layout = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const ring = index % 3;
    let x = 0;
    let y = 0;
    if (stageIndex === 0) {
      x = (index * 137) % 1000 / 1000;
      y = (index * 71 + ring * 83) % 840 / 840;
    } else if (stageIndex === 1) {
      x = .5 + Math.cos(angle) * (.16 + ring * .11);
      y = .49 + Math.sin(angle) * (.16 + ring * .13);
    } else if (stageIndex === 2) {
      x = .5 + Math.cos(angle) * (.12 + ring * .12);
      y = .52 + Math.sin(angle) * (.12 + ring * .13);
    } else {
      x = .5 + Math.cos(angle) * (.09 + ring * .17);
      y = .5 + Math.sin(angle) * (.09 + ring * .17);
    }
    layout.push({ x, y, scale: stageIndex === 0 ? .72 + (index % 4) * .08 : 1 + ring * .12, opacity: stageIndex === 0 ? .35 + (index % 5) * .1 : stageIndex === 2 && index % 4 === 0 ? 1 : .62 + ring * .1 });
  }
  return layout;
}

export function buildSceneDescription(nodes, edges, isReal, proceduralCount = 58) {
  const scene = {
    isReal,
    nodes: [],
    edges: [],
    anchors: []
  };

  if (isReal) {
    const topo = computeTopology(nodes, edges);
    const stages = makeRealLayoutStages(nodes, topo);
    const topo3D = compute3DTopology(nodes, edges);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const kindGroup = stages[0][i].kindGroup;
      const t3 = topo3D.find(t => t.id === node.id) || { x: 0, y: 0, z: 0 };

      scene.nodes.push({
        id: node.id,
        label: node.label || node.id.split(':').pop(),
        visualTier: kindGroup,
        signalStrength: (node.confidence && node.confidence.score !== undefined) ? node.confidence.score : 0,
        orbitCount: (node.provenance && node.provenance.length > 0) ? node.provenance.length : 0,
        isEmphasized: false,
        spatialPosition: { x: t3.x, y: t3.y, z: t3.z },
        stages: [
          { x: stages[0][i].x, y: stages[0][i].y, scale: stages[0][i].scale, opacity: stages[0][i].opacity, zDepth: stages[0][i].zDepth },
          { x: stages[1][i].x, y: stages[1][i].y, scale: stages[1][i].scale, opacity: stages[1][i].opacity, zDepth: stages[1][i].zDepth },
          { x: stages[2][i].x, y: stages[2][i].y, scale: stages[2][i].scale, opacity: stages[2][i].opacity, zDepth: stages[2][i].zDepth },
          { x: stages[3][i].x, y: stages[3][i].y, scale: stages[3][i].scale, opacity: stages[3][i].opacity, zDepth: stages[3][i].zDepth }
        ]
      });
    }

    for (const edge of edges) {
      scene.edges.push({
        id: edge.id || `${edge.from}-${edge.to}`,
        sourceId: edge.from,
        targetId: edge.to,
        signalStrength: (edge.confidence && edge.confidence.score !== undefined) ? edge.confidence.score : 1
      });
    }
  
    const posMap = new Map();
    for (const n of scene.nodes) posMap.set(n.id, n.spatialPosition);
    for (const e of scene.edges) {
      const sPos = posMap.get(e.sourceId);
      const tPos = posMap.get(e.targetId);
      if (sPos && tPos) {
        posMap.set(e.id, { x: (sPos.x + tPos.x)/2, y: (sPos.y + tPos.y)/2, z: (sPos.z + tPos.z)/2 });
      }
    }
    for (const obj of [...nodes, ...edges]) {
      if (obj.provenance && obj.provenance.length > 0) {
        const oId = obj.id || (obj.from && obj.to ? `${obj.from}-${obj.to}` : null);
        const sPos = posMap.get(oId);
        if (!sPos) continue;
        for (const p of obj.provenance) {
          if (p.supportingEvidenceIds && p.supportingEvidenceIds.length > 0) {
            for (const tgtId of p.supportingEvidenceIds) {
              const tPos = posMap.get(tgtId);
              if (tPos) {
                scene.anchors.push({
                  id: `anchor-${oId}-${tgtId}`,
                  sourcePos: sPos,
                  targetPos: tPos,
                  isExternal: !!p.external
                });
              }
            }
          }
        }
      }
    }
  } else {
    const stages = [
      makeProceduralLayout(proceduralCount, 0),
      makeProceduralLayout(proceduralCount, 1),
      makeProceduralLayout(proceduralCount, 2),
      makeProceduralLayout(proceduralCount, 3)
    ];

    for (let i = 0; i < proceduralCount; i++) {
      scene.nodes.push({
        id: `proc-${i}`,
        label: '',
        visualTier: 'mid',
        signalStrength: 0,
        orbitCount: 0,
        isEmphasized: false,
        spatialPosition: { x: (stages[0][i].x - 0.5) * 40, y: (0.5 - stages[0][i].y) * 40, z: (i % 3) * -5 },
        stages: [
          { x: stages[0][i].x, y: stages[0][i].y, scale: stages[0][i].scale, opacity: stages[0][i].opacity, zDepth: 0 },
          { x: stages[1][i].x, y: stages[1][i].y, scale: stages[1][i].scale, opacity: stages[1][i].opacity, zDepth: 0 },
          { x: stages[2][i].x, y: stages[2][i].y, scale: stages[2][i].scale, opacity: stages[2][i].opacity, zDepth: 0 },
          { x: stages[3][i].x, y: stages[3][i].y, scale: stages[3][i].scale, opacity: stages[3][i].opacity, zDepth: 0 }
        ]
      });
    }
  }

  return scene;
}
