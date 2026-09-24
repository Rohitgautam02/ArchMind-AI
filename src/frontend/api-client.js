export async function analyzeRepository(repositoryPath, callbacks) {
  const { onStateChange, onComplete, onError } = callbacks;
  try {
    onStateChange('ANALYZING', 'initiating analysis');
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryPath }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Analysis failed to start');

    const runId = payload.runId;
    let runStatus = 'ANALYZING';
    
    while (runStatus === 'ANALYZING' || runStatus === 'CREATED') {
        onStateChange(runStatus, `run in progress...`);
        await new Promise(r => setTimeout(r, 1000));
        const runRes = await fetch(`/api/run/${runId}`);
        const runPayload = await runRes.json();
        if (runRes.ok && runPayload.success) {
            runStatus = runPayload.run.status;
        } else {
            throw new Error('Failed to get run status');
        }
    }
    
    if (runStatus === 'FAILED') throw new Error('Analysis run failed');
    
    onStateChange('FETCHING', 'retrieving architecture graph');
    
    const graphRes = await fetch(`/api/graph/${runId}`);
    const graphPayload = await graphRes.json();
    if (!graphRes.ok || !graphPayload.success) throw new Error('Failed to load graph');
    
    onComplete(graphPayload.graph, runId);
  } catch (error) {
    onError(error instanceof Error ? error.message : 'local analysis failed');
  }
}
