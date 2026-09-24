function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function ease(value) { return value * value * (3 - 2 * value); }
function mix(left, right, amount) { return left + (right - left) * amount; }

export class Renderer2D {
  constructor(canvas, scene, frames, progressFill, sceneLabel, sceneIndex) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.scene = scene;
    this.frames = frames;
    this.progressFill = progressFill;
    this.sceneLabel = sceneLabel;
    this.sceneIndex = sceneIndex;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    this.width = 0;
    this.height = 0;
    this.lastFrame = 0;
    
    this.layouts = [];
    this.count = 58;
    this.hasRealGraph = false;
    this.graphModel = null;
    this.selectedNodeId = null;
    
    this.names = ['scan', 'reason', 'verify', 'enter'];
  }

  setLayouts(layouts, count, hasRealGraph, graphModel) {
    this.layouts = layouts;
    this.count = count;
    this.hasRealGraph = hasRealGraph;
    this.graphModel = graphModel;
  }

  setSelectedNode(id) {
    this.selectedNodeId = id;
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * ratio;
    this.canvas.height = this.height * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  samplePoint(index, progress, pointerX, pointerY) {
    const scaled = progress * 3;
    const fromIndex = Math.min(2, Math.floor(scaled));
    const local = ease(scaled - fromIndex);
    const from = this.layouts[fromIndex][index];
    const to = this.layouts[fromIndex + 1][index];
    
    const zDepth = from.zDepth || 0;
    const parallaxMultiplier = this.hasRealGraph ? (14 + zDepth * 8) : 18;
    const scrollParallax = Math.sin(this.lastFrame * .0003 + index) * (2 + progress * (this.hasRealGraph ? 4 + zDepth * 3 : 8));
    
    return {
      x: mix(from.x, to.x, local) * this.width + pointerX * parallaxMultiplier,
      y: mix(from.y, to.y, local) * this.height + pointerY * parallaxMultiplier + scrollParallax,
      scale: mix(from.scale, to.scale, local),
      opacity: mix(from.opacity, to.opacity, local),
      originalNode: from ? from.originalNode : null,
      kindGroup: from ? from.kindGroup : 'mid',
      zDepth
    };
  }

  updateNarrative(progress) {
    const scaled = progress * 3;
    const active = Math.min(3, Math.floor(scaled + .5));
    this.frames.forEach((frame, index) => {
      const distance = Math.abs(scaled - index);
      const opacity = clamp(1 - distance * 1.55, 0, 1);
      frame.style.opacity = opacity;
      frame.style.transform = `translate3d(0, ${distance * 26}px, 0) scale(${1 - distance * .035})`;
      frame.classList.toggle('is-active', index === active);
    });
    this.sceneLabel.textContent = `0${active + 1} / ${this.names[active]}`;
    this.sceneIndex.textContent = `0${active + 1} / 04`;
    this.progressFill.style.width = `${progress * 100}%`;
    
    const depthVisual = this.hasRealGraph ? progress * 150 : progress * 100;
    this.scene.style.setProperty('--world-depth', `${depthVisual}px`);
  }

  hitTest(clickX, clickY, progress, pointerX, pointerY) {
    if (!this.hasRealGraph || this.count === 0) return null;
    
    const globalScale = 1 + progress * 0.15;
    const rotation = (progress - .5) * .16;
    
    const dx = (clickX - (this.width / 2)) / globalScale;
    const dy = (clickY - (this.height / 2)) / globalScale;
    
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    
    const targetX = rx + (this.width / 2);
    const targetY = ry + (this.height / 2);
    
    let closestNode = null;
    let minDistance = 25; 
    
    const activePoints = [];
    for (let index = 0; index < this.count; index += 1) {
        activePoints.push(this.samplePoint(index, progress, pointerX, pointerY));
    }
    
    for (const point of activePoints) {
        const dist = Math.hypot(point.x - targetX, point.y - targetY);
        if (dist < minDistance) {
            minDistance = dist;
            closestNode = point.originalNode;
        }
    }
    return closestNode;
  }

  draw(time, interaction) {
    this.lastFrame = time;
    const delta = this.reduceMotion ? 1 : .09;
    interaction.updateProgress(delta);
    const progress = interaction.progress;
    
    this.updateNarrative(progress);
    this.context.clearRect(0, 0, this.width, this.height);
    
    if (this.count === 0 || this.layouts.length === 0) {
        if (!this.reduceMotion) window.requestAnimationFrame((t) => this.draw(t, interaction));
        return;
    }

    const activePoints = [];
    for (let index = 0; index < this.count; index += 1) {
      activePoints.push(this.samplePoint(index, progress, interaction.pointerX, interaction.pointerY));
    }
    
    if (this.hasRealGraph) {
        activePoints.sort((a, b) => a.zDepth - b.zDepth);
    }
    
    const links = [];
    
    if (this.hasRealGraph && this.graphModel && this.graphModel.realGraph) {
        const edgeEmergeAlpha = clamp((progress - 0.3) * 1.5, 0, 1);
        
        for (const edge of this.graphModel.realGraph.edges) {
            const sourcePoint = activePoints.find(p => p.originalNode.id === edge.from);
            const targetPoint = activePoints.find(p => p.originalNode.id === edge.to);
            
            if (sourcePoint && targetPoint) {
                const distance = Math.hypot(sourcePoint.x - targetPoint.x, sourcePoint.y - targetPoint.y);
                let isSelected = false;
                if (this.selectedNodeId && (sourcePoint.originalNode.id === this.selectedNodeId || targetPoint.originalNode.id === this.selectedNodeId)) {
                    isSelected = true;
                }
                
                const edgeDepth = (sourcePoint.zDepth + targetPoint.zDepth) / 2;
                links.push({ first: sourcePoint, second: targetPoint, distance, real: true, isSelected, edgeDepth, edgeEmergeAlpha });
            }
        }
    } else {
        const connectionLimit = 62 + Math.floor(progress * 44);
        for (let left = 0; left < activePoints.length; left += 1) {
          for (let right = left + 1; right < activePoints.length && links.length < connectionLimit; right += 1) {
            const first = activePoints[left];
            const second = activePoints[right];
            const distance = Math.hypot(first.x - second.x, first.y - second.y);
            if (distance < 140 + progress * 50) links.push({ first, second, distance, isSelected: false, edgeEmergeAlpha: 1 });
          }
        }
    }

    const globalScale = 1 + progress * 0.15;
    const rotation = (progress - .5) * .16;
    
    this.context.save();
    this.context.translate(this.width / 2, this.height / 2);
    this.context.rotate(rotation);
    this.context.scale(globalScale, globalScale);
    this.context.translate(-this.width / 2, -this.height / 2);
    
    for (const link of links) {
      let alpha = this.hasRealGraph ? (0.1 + link.edgeDepth * 0.05 + progress * 0.15) * link.edgeEmergeAlpha : (1 - link.distance / (190 + progress * 40)) * (.16 + progress * .18);
      
      if (this.selectedNodeId && this.hasRealGraph) {
         if (link.isSelected) {
             alpha = 0.7;
         } else {
             alpha *= 0.15;
         }
      }
      
      if (alpha > 0) {
          this.context.strokeStyle = `rgba(141, 228, 226, ${alpha})`;
          this.context.lineWidth = link.isSelected ? 1.5 : ((progress > .62 && link.distance < 98) || this.hasRealGraph ? 1.1 : .6);
          this.context.beginPath();
          this.context.moveTo(link.first.x, link.first.y);
          this.context.lineTo(link.second.x, link.second.y);
          this.context.stroke();
      }
    }
    
    for (let index = 0; index < activePoints.length; index += 1) {
      const point = activePoints[index];
      const isSelected = this.selectedNodeId && point.originalNode && point.originalNode.id === this.selectedNodeId;
      const isDimmed = this.selectedNodeId && !isSelected;
      
      let radius = this.hasRealGraph ? (3 * point.scale) : (1 + (index % 4) * .6) * point.scale;
      if (isSelected) radius *= 1.5;
      
      let opacity = point.opacity;
      if (isSelected) opacity = 1;
      if (isDimmed) opacity *= 0.25;

      let glowExtra = 0;
      if (this.hasRealGraph && point.originalNode && point.originalNode.confidence && progress > 0.45) {
          glowExtra = point.originalNode.confidence.score * clamp((progress - 0.45) * 2, 0, 1);
      }
      
      let fillStyle = `rgba(141, 228, 226, ${opacity})`;
      
      if (!this.hasRealGraph) {
          if (index % 7 === 0 || progress > .72 && index % 5 === 0) fillStyle = `rgba(229, 185, 107, ${opacity})`;
      } else {
          if (point.kindGroup === 'back') {
              fillStyle = `rgba(139, 154, 165, ${opacity * 0.7})`; 
          } else if (point.kindGroup === 'fore') {
              fillStyle = `rgba(141, 228, 226, ${opacity})`; 
          } else {
              fillStyle = `rgba(229, 185, 107, ${opacity})`; 
          }
          
          if (isSelected) fillStyle = `rgba(255, 255, 255, 1)`;
      }
      
      if (this.hasRealGraph && glowExtra > 0.1 && !isDimmed) {
          this.context.fillStyle = `rgba(141, 228, 226, ${glowExtra * 0.12 * opacity})`;
          this.context.beginPath();
          this.context.arc(point.x, point.y, radius + 4 + glowExtra * 6, 0, Math.PI * 2);
          this.context.fill();
      }

      this.context.fillStyle = fillStyle;
      this.context.beginPath();
      
      if (this.hasRealGraph && point.kindGroup === 'fore' && progress > 0.3) {
          this.context.moveTo(point.x, point.y - radius * 1.5);
          this.context.lineTo(point.x + radius * 1.5, point.y);
          this.context.lineTo(point.x, point.y + radius * 1.5);
          this.context.lineTo(point.x - radius * 1.5, point.y);
          this.context.fill();
      } else {
          this.context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          this.context.fill();
      }
      
      if (isSelected) {
          this.context.fillStyle = `rgba(141, 228, 226, 0.3)`;
          this.context.beginPath();
          this.context.arc(point.x, point.y, radius * 3, 0, Math.PI * 2);
          this.context.fill();

          if (point.originalNode && point.originalNode.provenance && point.originalNode.provenance.length > 0) {
              const provCount = point.originalNode.provenance.length;
              const orbitR = radius * 4.5;
              const orbitSpeed = this.lastFrame * 0.0004;
              for (let pi = 0; pi < provCount; pi++) {
                  const a = orbitSpeed + (pi / provCount) * Math.PI * 2;
                  const px = point.x + Math.cos(a) * orbitR;
                  const py = point.y + Math.sin(a) * orbitR;
                  this.context.fillStyle = `rgba(141, 228, 226, 0.6)`;
                  this.context.beginPath();
                  this.context.arc(px, py, 1.5, 0, Math.PI * 2);
                  this.context.fill();
              }
          }
      }

      if (this.hasRealGraph && point.originalNode && (progress > 0.5 || isSelected)) {
          let textAlpha = clamp((progress - 0.5) * 2, 0, 1) * opacity;
          if (isSelected) textAlpha = 1;
          if (point.kindGroup === 'back' && !isSelected) textAlpha *= 0.5; 
          
          if (textAlpha > 0) {
            this.context.fillStyle = isSelected ? `rgba(255, 255, 255, 1)` : `rgba(232, 238, 243, ${textAlpha})`;
            this.context.font = isSelected ? 'bold 11px ui-monospace, SFMono-Regular, Consolas, monospace' : '10px ui-monospace, SFMono-Regular, Consolas, monospace';
            const label = point.originalNode.label || point.originalNode.id.split(':').pop();
            this.context.fillText(label, point.x + (isSelected ? 14 : 8), point.y + 4);
          }
      }
    }
    
    this.context.restore();
    if (!this.reduceMotion) window.requestAnimationFrame((t) => this.draw(t, interaction));
  }
}
