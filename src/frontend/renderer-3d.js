import * as THREE from 'three';
import { CameraController } from './camera-controller.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function disposeGroup(group) {
  group.children.forEach(child => {
    if (child.geometry && !child.geometry.isShared) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
  group.clear();
}

export class Renderer3D {
  constructor(canvas, sceneElement, frames, progressFill, sceneLabel, sceneIndex) {
    this.canvas = canvas;
    this.sceneElement = sceneElement;
    this.frames = frames;
    this.progressFill = progressFill;
    this.sceneLabel = sceneLabel;
    this.sceneIndex = sceneIndex;
    this.names = ['scan', 'reason', 'verify', 'enter'];

    this.sceneData = null;
    this.selectedNodeId = null;

    this.cameraController = new CameraController();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    
    this.nodeGroup = new THREE.Group();
    this.edgeGroup = new THREE.Group();
    this.orbitGroup = new THREE.Group();
    this.scene.add(this.nodeGroup);
    this.scene.add(this.edgeGroup);
    this.scene.add(this.orbitGroup);

    this.nodeMeshes = new Map();
  }

  setSceneData(sceneData) {
    this.sceneData = sceneData;
    this.cameraController.setSceneData(sceneData);
    
    disposeGroup(this.nodeGroup);
    disposeGroup(this.orbitGroup);
    disposeGroup(this.edgeGroup);
    this.nodeMeshes.clear();
    this.edgeMesh = null;

    if (!sceneData || !sceneData.nodes) return;

    if (!this.sharedGeometries) {
      this.sharedGeometries = {
        sphere: Object.assign(new THREE.SphereGeometry(1, 32, 32), { isShared: true }),
        box: Object.assign(new THREE.BoxGeometry(1.5, 1.5, 1.5), { isShared: true }),
        diamond: Object.assign(new THREE.OctahedronGeometry(1.2, 0), { isShared: true }),
        ring: Object.assign(new THREE.RingGeometry(1.0, 1.05, 32), { isShared: true })
      };
    }
    
    for (const node of sceneData.nodes) {
      const type = (node.visualSignals && node.visualSignals.geometryType) ? node.visualSignals.geometryType : 'sphere';
      const geometry = this.sharedGeometries[type] || this.sharedGeometries.sphere;
      
      let color = 0x8de4e2;
      let opacity = 0.8;
      
      if (node.visualTier === 'back') {
        color = 0x8b9aa5;
        opacity = 0.5;
      } else if (node.visualTier === 'fore') {
        color = 0x8de4e2;
        opacity = 1.0;
      }

      const signal = (node.visualSignals && node.visualSignals.signalStrength !== undefined)
        ? node.visualSignals.signalStrength
        : (node.signalStrength || 0);

      // Map confidence (signal) to visual intensity via opacity and emissive brightness
      opacity = opacity * (0.4 + signal * 0.6);
      const emissive = new THREE.Color(color).multiplyScalar(signal);

      const material = new THREE.MeshLambertMaterial({ 
        color, 
        emissive,
        transparent: true,
        opacity
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { id: node.id };
      
      const scale = node.stages[0].scale * 0.2;
      mesh.scale.set(scale, scale, scale);
      
      if (node.spatialPosition) {
        mesh.position.set(node.spatialPosition.x, node.spatialPosition.y, node.spatialPosition.z);
      }

      this.nodeGroup.add(mesh);
      this.nodeMeshes.set(node.id, mesh);

      // Render capped provenance rings (max 3)
      if (node.visualSignals && node.visualSignals.provenanceCount > 0) {
         const count = Math.min(3, node.visualSignals.provenanceCount);
         const isExt = node.visualSignals.hasExternalProvenance;
         const orbitColor = isExt ? 0xf39c12 : 0x8de4e2; // Distinguish external provenance
         const orbitOpacity = isExt ? 0.4 : 0.2;
         
         for(let i=0; i<count; i++) {
           const rad = scale * 1.5 + (i * scale * 0.4);
           const orbitMat = new THREE.MeshBasicMaterial({ color: orbitColor, side: THREE.DoubleSide, transparent: true, opacity: orbitOpacity });
           const orbit = new THREE.Mesh(this.sharedGeometries.ring, orbitMat);
           orbit.scale.set(rad, rad, rad);
           orbit.userData = { nodeId: node.id, speed: 1.0 + (i * 0.2) };
           if (node.spatialPosition) {
             orbit.position.set(node.spatialPosition.x, node.spatialPosition.y, node.spatialPosition.z);
           }
           this.orbitGroup.add(orbit);
         }
      }
    }

    if (sceneData.isReal && sceneData.edges && sceneData.edges.length > 0) {
       const lineMat = new THREE.LineBasicMaterial({ color: 0x8de4e2, transparent: true, opacity: 0.15 });
       const lineGeo = new THREE.BufferGeometry();
       const positions = new Float32Array(sceneData.edges.length * 6);
       lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
       this.edgeMesh = new THREE.LineSegments(lineGeo, lineMat);
       this.edgeGroup.add(this.edgeMesh);

       let i = 0;
       for (const edge of sceneData.edges) {
           const sourceMesh = this.nodeMeshes.get(edge.sourceId);
           const targetMesh = this.nodeMeshes.get(edge.targetId);
           if (sourceMesh && targetMesh) {
               positions[i++] = sourceMesh.position.x;
               positions[i++] = sourceMesh.position.y;
               positions[i++] = sourceMesh.position.z;
               positions[i++] = targetMesh.position.x;
               positions[i++] = targetMesh.position.y;
               positions[i++] = targetMesh.position.z;
           } else {
               i += 6;
           }
       }
    }
  }

  setSelectedNode(id) {
    this.selectedNodeId = id;
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  hitTest(clickX, clickY, progress, pointerX, pointerY) {
    if (!this.sceneData) return null;
    
    this.mouse.x = (clickX / this.canvas.clientWidth) * 2 - 1;
    this.mouse.y = -(clickY / this.canvas.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.nodeGroup.children);
    
    if (intersects.length > 0) {
      return intersects[0].object.userData.id;
    }
    return null;
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
  }

  draw(time, interaction) {
    interaction.updateProgress(0.09);
    const progress = interaction.progress; console.log("draw progress:", progress, "scrollY:", window.scrollY);
    this.updateNarrative(progress);

    if (!this.sceneData || !this.sceneData.nodes) {
       window.requestAnimationFrame((t) => this.draw(t, interaction));
       return;
    }

    // Obtain deterministic CameraState from the controller
    const cameraState = this.cameraController.getCameraState(
      progress,
      interaction.pointerX,
      interaction.pointerY
    );

    // Apply CameraState to the Three.js camera
    this.camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
    this.camera.lookAt(cameraState.lookAt.x, cameraState.lookAt.y, cameraState.lookAt.z);

    if (this.camera.fov !== cameraState.fov) {
      this.camera.fov = cameraState.fov;
      this.camera.updateProjectionMatrix();
    }

    // Node visual updates (world positions remain stable)
    for (const node of this.sceneData.nodes) {
       const mesh = this.nodeMeshes.get(node.id);
       if (mesh) {
          let targetScale = node.stages[0].scale * 0.2;
          let targetOpacity = node.visualTier === 'back' ? 0.5 : (node.visualTier === 'fore' ? 1.0 : 0.8);
          
          if (this.selectedNodeId === node.id) {
             targetScale *= 1.5;
             targetOpacity = 1.0;
          } else if (this.selectedNodeId) {
             targetOpacity *= 0.2;
          }
          
          mesh.scale.set(targetScale, targetScale, targetScale);
          mesh.material.opacity = targetOpacity;
       }
    }

    this.orbitGroup.children.forEach(orbit => {
        const mesh = this.nodeMeshes.get(orbit.userData.nodeId);
        if (mesh) {
            orbit.rotation.z = time * 0.001 * orbit.userData.speed;
            orbit.scale.copy(mesh.scale);
            orbit.scale.multiplyScalar(2.0);
        }
    });

    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame((t) => this.draw(t, interaction));
  }
}
