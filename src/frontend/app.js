import { analyzeRepository } from './api-client.js';
import { GraphModel } from './graph-model.js';
import { buildSceneDescription } from './spatial-layout.js';
import { Renderer2D } from './renderer-2d.js';
import { InteractionController } from './interaction.js';
import { UILens } from './ui-lens.js';

(async () => {
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

  const params = new URLSearchParams(window.location.search);
  const use3D = params.get('renderer') === '3d';
  let renderer;
  if (use3D) {
    const { Renderer3D } = await import('./renderer-3d.js');
    renderer = new Renderer3D(canvas, scene, frames, progressFill, sceneLabel, sceneIndex);
  } else {
    renderer = new Renderer2D(canvas, scene, frames, progressFill, sceneLabel, sceneIndex);
  }

  const interaction = new InteractionController(canvas);

  interaction.getHitTargets = (x, y) => renderer.hitTest(x, y, interaction.progress, interaction.pointerX, interaction.pointerY);

  interaction.onNodeClick = (nodeId) => {
    renderer.setSelectedNode(nodeId);
    if (nodeId) {
       const node = graphModel.getNode(nodeId);
       if (node) uiLens.populateLens(node, graphModel);
    }
  };

  interaction.onEmptyClick = () => {
    renderer.setSelectedNode(null);
    uiLens.hideLens();
  };

  function rebuildLayout() {
    let sceneData = null;

    if (graphModel.realGraph) {
      sceneData = buildSceneDescription(graphModel.realGraph.nodes, graphModel.realGraph.edges, true);
    } else {
      sceneData = buildSceneDescription([], [], false, 58);
    }

    renderer.setSceneData(sceneData);
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
