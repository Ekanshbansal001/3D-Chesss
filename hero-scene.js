// ==========================================================================
// MONARCH — Landing hero 3D piece
// ==========================================================================

import * as THREE from "three";

function init() {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.1, 4.2);
  camera.lookAt(0, 0.55, 0);

  const key = new THREE.DirectionalLight(0xfff3da, 1.4);
  key.position.set(3, 5, 3);
  scene.add(key);
  const rim = new THREE.PointLight(0xe8c77c, 1.1, 10);
  rim.position.set(-2, 1.5, -2);
  scene.add(rim);
  const ambient = new THREE.AmbientLight(0x554a3a, 0.6);
  scene.add(ambient);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd9b269, metalness: 0.85, roughness: 0.25,
    clearcoat: 0.5, clearcoatRoughness: 0.2
  });

  const king = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.22, 32), mat); base.position.y = 0.11; king.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 1.2, 32), mat); body.position.y = 0.85; king.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 12, 32), mat); collar.position.y = 1.48; collar.rotation.x = Math.PI / 2; king.add(collar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), mat); head.position.y = 1.76; king.add(head);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.1), mat); crossV.position.y = 2.15; king.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), mat); crossH.position.y = 2.08; king.add(crossH);
  king.position.y = -1.15;
  scene.add(king);

  let raf;
  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animate(t) {
    raf = requestAnimationFrame(animate);
    if (!reduceMotion) {
      king.rotation.y = t * 0.00035;
      king.position.y = -1.15 + Math.sin(t * 0.0006) * 0.06;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
