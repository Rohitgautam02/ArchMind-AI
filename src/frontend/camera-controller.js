/**
 * CameraController — deterministic camera choreography for 3D spatial scenes.
 *
 * Input:  normalized scroll progress [0, 1] + SpatialSceneDescription
 * Output: CameraState { position: {x,y,z}, lookAt: {x,y,z}, fov: number }
 *
 * The controller is renderer-neutral. It does not reference Three.js, GraphSnapshot,
 * EvidenceNode, confidence objects, or any domain-specific runtime contracts.
 *
 * Camera poses are derived deterministically from projected scene data:
 *   - scene bounds (AABB of all spatialPosition values)
 *   - primary component center (average of connected nodes via edges)
 *   - verification focus target (highest signalStrength, ID tie-break)
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  };
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Compute the axis-aligned bounding box of all spatialPositions in the scene.
 * Returns { min: {x,y,z}, max: {x,y,z}, center: {x,y,z}, extent: number }
 */
function computeSceneBounds(nodes) {
  if (!nodes || nodes.length === 0) {
    return {
      min: { x: -5, y: -5, z: -5 },
      max: { x: 5, y: 5, z: 5 },
      center: { x: 0, y: 0, z: 0 },
      extent: 10
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const node of nodes) {
    const p = node.spatialPosition;
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  // Guard against degenerate cases (all nodes at same position)
  if (!isFinite(minX)) {
    return {
      min: { x: -5, y: -5, z: -5 },
      max: { x: 5, y: 5, z: 5 },
      center: { x: 0, y: 0, z: 0 },
      extent: 10
    };
  }

  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const dz = maxZ - minZ || 1;
  const extent = Math.max(dx, dy, dz);

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    },
    extent
  };
}

/**
 * Compute the center of the primary connected component.
 * Uses edges to identify which nodes are connected.
 * The primary component is the largest set of mutually reachable nodes.
 * Falls back to scene center if no edges exist.
 */
function computePrimaryComponentCenter(nodes, edges) {
  if (!edges || edges.length === 0 || !nodes || nodes.length === 0) {
    return computeSceneBounds(nodes).center;
  }

  // Build adjacency from scene edges (sourceId/targetId)
  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    if (adj.has(edge.sourceId) && adj.has(edge.targetId)) {
      adj.get(edge.sourceId).push(edge.targetId);
      adj.get(edge.targetId).push(edge.sourceId);
    }
  }

  // Find connected components via BFS
  const visited = new Set();
  let largestComp = [];

  // Sort node IDs for deterministic iteration
  const sortedIds = [...adj.keys()].sort((a, b) => a.localeCompare(b));

  for (const startId of sortedIds) {
    if (visited.has(startId)) continue;
    const comp = [];
    const queue = [startId];
    visited.add(startId);
    while (queue.length > 0) {
      const curr = queue.shift();
      comp.push(curr);
      for (const neighbor of adj.get(curr)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (comp.length > largestComp.length) {
      largestComp = comp;
    } else if (comp.length === largestComp.length && comp[0].localeCompare(largestComp[0]) < 0) {
      largestComp = comp;
    }
  }

  if (largestComp.length === 0) {
    return computeSceneBounds(nodes).center;
  }

  // Build position lookup
  const posMap = new Map();
  for (const node of nodes) {
    if (node.spatialPosition) posMap.set(node.id, node.spatialPosition);
  }

  let sumX = 0, sumY = 0, sumZ = 0;
  let count = 0;
  for (const id of largestComp) {
    const p = posMap.get(id);
    if (p) {
      sumX += p.x;
      sumY += p.y;
      sumZ += p.z;
      count++;
    }
  }

  if (count === 0) return computeSceneBounds(nodes).center;

  return {
    x: sumX / count,
    y: sumY / count,
    z: sumZ / count
  };
}

/**
 * Deterministic verification focus target.
 * Rule: highest signalStrength among scene nodes.
 * Tie-break: lowest node ID (lexicographic).
 * Falls back to primary component center if no real nodes.
 */
function computeVerifyFocus(nodes) {
  if (!nodes || nodes.length === 0) return { x: 0, y: 0, z: 0 };

  let bestNode = null;
  for (const node of nodes) {
    if (!node.spatialPosition) continue;
    // Skip procedural placeholder nodes
    if (node.id.startsWith('proc-')) continue;

    if (!bestNode) {
      bestNode = node;
      continue;
    }

    if (node.signalStrength > bestNode.signalStrength) {
      bestNode = node;
    } else if (node.signalStrength === bestNode.signalStrength && node.id.localeCompare(bestNode.id) < 0) {
      bestNode = node;
    }
  }

  if (!bestNode || !bestNode.spatialPosition) return { x: 0, y: 0, z: 0 };
  return { x: bestNode.spatialPosition.x, y: bestNode.spatialPosition.y, z: bestNode.spatialPosition.z };
}

/**
 * Build four deterministic camera stage poses from scene data.
 *
 * Each pose: { position: {x,y,z}, lookAt: {x,y,z}, fov: number }
 *
 * SCAN  — wide elevated overview of the entire scene
 * REASON — closer, entering the primary component's topology
 * VERIFY — focused on the highest-signal node
 * ENTER  — close architectural shot
 */
function buildStagePoses(sceneData) {
  const nodes = (sceneData && sceneData.nodes) || [];
  const edges = (sceneData && sceneData.edges) || [];

  const bounds = computeSceneBounds(nodes);
  const primaryCenter = computePrimaryComponentCenter(nodes, edges);
  const verifyFocus = computeVerifyFocus(nodes);

  // Derive distances from scene extent so camera adapts to world size
  const e = Math.max(bounds.extent, 5);

  // SCAN: wide elevated establishing shot
  const scanPose = {
    position: {
      x: bounds.center.x,
      y: bounds.center.y + e * 0.6,
      z: bounds.center.z + e * 1.4
    },
    lookAt: { ...bounds.center },
    fov: 50
  };

  // REASON: move toward primary component, lower altitude
  const reasonPose = {
    position: {
      x: primaryCenter.x + e * 0.15,
      y: primaryCenter.y + e * 0.25,
      z: primaryCenter.z + e * 0.8
    },
    lookAt: { ...primaryCenter },
    fov: 45
  };

  // VERIFY: focus on verification target, closer
  const verifyPose = {
    position: {
      x: verifyFocus.x + e * 0.1,
      y: verifyFocus.y + e * 0.12,
      z: verifyFocus.z + e * 0.4
    },
    lookAt: { ...verifyFocus },
    fov: 40
  };

  // ENTER: closest meaningful architectural shot
  const enterPose = {
    position: {
      x: verifyFocus.x + e * 0.05,
      y: verifyFocus.y + e * 0.06,
      z: verifyFocus.z + e * 0.2
    },
    lookAt: { ...verifyFocus },
    fov: 35
  };

  return [scanPose, reasonPose, verifyPose, enterPose];
}

/**
 * CameraController
 *
 * Usage:
 *   const controller = new CameraController();
 *   controller.setSceneData(sceneData);
 *   const cameraState = controller.getCameraState(progress, pointerX, pointerY);
 */
export class CameraController {
  constructor() {
    this.poses = null;
    this.sceneData = null;
  }

  /**
   * Recompute camera stage poses from the current scene data.
   * Called whenever sceneData changes (new analysis, resize, etc.)
   */
  setSceneData(sceneData) {
    this.sceneData = sceneData;
    this.poses = buildStagePoses(sceneData);
  }

  /**
   * Compute CameraState for a given scroll progress.
   *
   * @param {number} progress - normalized scroll [0, 1]
   * @param {number} pointerX - normalized pointer X [-0.5, 0.5]
   * @param {number} pointerY - normalized pointer Y [-0.5, 0.5]
   * @returns {{ position: {x,y,z}, lookAt: {x,y,z}, fov: number }}
   */
  getCameraState(progress, pointerX, pointerY) {
    if (!this.poses) {
      return {
        position: { x: 0, y: 0, z: 20 },
        lookAt: { x: 0, y: 0, z: 0 },
        fov: 45
      };
    }

    // Map progress [0,1] across four stages [0..3]
    const scaled = progress * 3;
    const fromIndex = Math.min(2, Math.floor(scaled));
    const local = ease(Math.max(0, Math.min(1, scaled - fromIndex)));

    const from = this.poses[fromIndex];
    const to = this.poses[fromIndex + 1];

    const position = lerpVec(from.position, to.position, local);
    const lookAt = lerpVec(from.lookAt, to.lookAt, local);
    const fov = lerp(from.fov, to.fov, local);

    // Apply bounded pointer parallax
    // Parallax magnitude scales with the extent so it stays proportional
    const extent = (this.sceneData && this.sceneData.nodes && this.sceneData.nodes.length > 0)
      ? computeSceneBounds(this.sceneData.nodes).extent
      : 10;
    const parallaxStrength = Math.min(extent * 0.06, 3.0);

    position.x += pointerX * parallaxStrength;
    position.y -= pointerY * parallaxStrength;

    return { position, lookAt, fov };
  }
}
