export class InteractionController {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointerX = 0;
    this.pointerY = 0;
    this.progress = 0;
    this.targetProgress = 0;
    
    this.onNodeClick = null;
    this.onEmptyClick = null;
    this.getHitTargets = null; 
    
    window.addEventListener('pointermove', (event) => {
      this.pointerX = event.clientX / window.innerWidth - .5;
      this.pointerY = event.clientY / window.innerHeight - .5;
    }, { passive: true });
    
    window.addEventListener('scroll', () => this.updateScrollTarget(), { passive: true });

    this.canvas.addEventListener('click', (event) => {
      if (!this.getHitTargets) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      const closestNode = this.getHitTargets(clickX, clickY);
      if (closestNode) {
         if (this.onNodeClick) this.onNodeClick(closestNode);
      } else {
         if (this.onEmptyClick) this.onEmptyClick();
      }
    });
  }
  
  updateScrollTarget() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.targetProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
  }

  updateProgress(delta) {
    this.progress += (this.targetProgress - this.progress) * delta;
  }
}
