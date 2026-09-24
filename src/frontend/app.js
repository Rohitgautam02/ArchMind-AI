import { analyzeRepository } from './api-client.js';
import { GraphModel } from './graph-model.js';
import { computeTopology, makeRealLayoutStages, makeProceduralLayout } from './spatial-layout.js';
import { Renderer2D } from './renderer-2d.js';
import { InteractionController } from './interaction.js';
import { UILens } from './ui-lens.js';

(() => {
  const canvas = document.getElementById('architecture-field');
  const scene = document.querySelector('.scene');
  const frames = Array.from(document.querySelectorAll('.story-frame'));
  const sceneLabel = document.getElementById('scene-label');
  const sceneIndex = document.getElementById('scene-index');
  const progressFill = document.getElementById('progress-fill');

  const analysisEntry = document.getElementById('analysis-entry');
  const form = document.getElementById('analysis-form');
  const pathInput = document.getElementById('repository-path');
  const state = document.getElementById('analysis-state');
  const result = document.getElementById('analysis-result');
  const resultMeta = document.getElementById('analysis-result-meta');

  const graphModel = new GraphModel();
  const uiLens = new UILens();
  const renderer = new Renderer2D(canvas, scene, frames, progressFill, sceneLabel, sceneIndex);
  const interaction = new InteractionController(canvas);

  interaction.getHitTargets = (x, y) => renderer.hitTest(x, y, interaction.progress, interaction.pointerX, interaction.pointerY);
  interaction.onNodeClick = (node) => {
    renderer.setSelectedNode(node.id);
    uiLens.populateLens(node, graphModel);
  };
  interaction.onEmptyClick = () => {
    renderer.setSelectedNode(null);
    uiLens.hideLens();
  };

  function rebuildLayout() {
    const layouts = [];
    let count = 0;
    let hasRealGraph = false;

    if (graphModel.realGraph) {
      count = graphModel.realGraph.nodes.length;
      hasRealGraph = true;
      const topo = computeTopology(graphModel.realGraph.nodes, graphModel.realGraph.edges);
      const stages = makeRealLayoutStages(graphModel.realGraph.nodes, topo);
      stages.forEach(stage => layouts.push(stage));
    } else {
      count = 58;
      for (let index = 0; index < 4; index += 1) {
        layouts.push(makeProceduralLayout(count, index));
      }
    }
    
    renderer.setLayouts(layouts, count, hasRealGraph, graphModel);
  }

  function handleResize() {
    renderer.resize();
    rebuildLayout();
  }

  window.addEventListener('resize', handleResize);
  
  handleResize();
  interaction.updateScrollTarget();
  renderer.draw(0, interaction);

  function setAnalysisState(value, message) {
    state.dataset.state = value;
    state.textContent = `${value} / ${message}`;
  }

  function showAnalysisEntry() {
    analysisEntry.hidden = false;
    window.setTimeout(() => pathInput.focus(), 450);
  }

  document.querySelectorAll('a[href="#analysis-entry"]').forEach((link) => {
    link.addEventListener('click', showAnalysisEntry);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const repositoryPath = pathInput.value.trim();
    if (!repositoryPath) return;

    const button = form.querySelector('button');
    button.disabled = true;
    result.hidden = true;
    uiLens.hideLens();
    renderer.setSelectedNode(null);
    graphModel.clearIndex();
    
    await analyzeRepository(repositoryPath, {
      onStateChange: (status, message) => setAnalysisState(status, message),
      onComplete: (graph, runId) => {
        graphModel.setGraph(graph);
        handleResize();
        uiLens.updateGraphStatus(graphModel);
        setAnalysisState('COMPLETE', `rendered ${graph.nodes.length} nodes from ${runId}`);
        resultMeta.textContent = `RUN ${runId} / ${graph.nodes.length} NODES / ${graph.edges.length} EDGES`;
        result.hidden = false;
        button.disabled = false;
      },
      onError: (message) => {
        setAnalysisState('ERROR', message);
        button.disabled = false;
      }
    });
  });
})();
