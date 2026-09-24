export class GraphModel {
  constructor() {
    this.realGraph = null;
    this.graphIndex = null;
  }

  setGraph(graph) {
    this.realGraph = graph;
    this.graphIndex = this.buildGraphIndex(graph);
  }

  buildGraphIndex(graph) {
    const nodeMap = new Map();
    const edgesByNode = new Map();
    for (const node of graph.nodes) {
      nodeMap.set(node.id, node);
      edgesByNode.set(node.id, []);
    }
    for (const edge of graph.edges) {
      if (edgesByNode.has(edge.from)) edgesByNode.get(edge.from).push(edge);
      if (edgesByNode.has(edge.to)) edgesByNode.get(edge.to).push(edge);
    }
    return { nodeMap, edgesByNode };
  }

  clearIndex() {
    this.graphIndex = null;
  }

  getNode(id) {
    return this.graphIndex ? this.graphIndex.nodeMap.get(id) : null;
  }

  getNodeEdges(id) {
    return this.graphIndex ? (this.graphIndex.edgesByNode.get(id) || []) : [];
  }
}
