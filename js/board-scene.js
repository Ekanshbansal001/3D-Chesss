// ==========================================================================
// MONARCH — 3D Board Scene
// Genuine 3D geometry: every piece is a real extruded/revolved mesh, not a
// flat sprite. Materials, lighting, and shadows are tuned per quality tier.
// ==========================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const SQ = 1.0; // square size in world units

export const BOARD_THEMES = {
  obsidian: { light: 0x3a383f, dark: 0x0c0b0d, border: 0x14131a, frame: 0x1f1d24 },
  royalwood: { light: 0xb98a58, dark: 0x5a3a22, border: 0x2c1c10, frame: 0x40291a },
  marble: { light: 0xe9e4d8, dark: 0xb7ada0, border: 0x8f8779, frame: 0x726b5f }
};

export const PIECE_THEMES = {
  ivoryblack: { white: { color: 0xede6d6, metalness: 0.05, roughness: 0.45 }, black: { color: 0x1b1b1e, metalness: 0.1, roughness: 0.3 } },
  goldobsidian: { white: { color: 0xd9b269, metalness: 0.85, roughness: 0.28 }, black: { color: 0x131215, metalness: 0.4, roughness: 0.22 } },
  silverblack: { white: { color: 0xd3d6db, metalness: 0.75, roughness: 0.25 }, black: { color: 0x1b1b1e, metalness: 0.2, roughness: 0.3 } }
};

function squareToWorld(file, rank, flipped) {
  let x = file - 3.5;
  let z = 3.5 - rank;
  if (flipped) { x = -x; z = -z; }
  return new THREE.Vector3(x * SQ, 0, z * SQ);
}

export function squareName(file, rank) { return FILES[file] + (rank + 1); }
export function parseSquare(sq) { return { file: FILES.indexOf(sq[0]), rank: parseInt(sq[1], 10) - 1 }; }

function makeStandardMaterial(spec) {
  return new THREE.MeshPhysicalMaterial({
    color: spec.color, metalness: spec.metalness, roughness: spec.roughness,
    clearcoat: 0.35, clearcoatRoughness: 0.25, reflectivity: 0.5
  });
}

// ---------- Piece geometry builders (abstract, elegant, original forms) ----------

function baseDisc(radius, height, segments = 24) {
  return new THREE.CylinderGeometry(radius, radius * 1.12, height, segments);
}

function buildPawn(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.19, 0.08), mat); base.position.y = 0.04; g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.28, 20), mat); stem.position.y = 0.24; g.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), mat); head.position.y = 0.44; g.add(head);
  g.userData.height = 0.56;
  return g;
}

function buildRook(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.22, 0.09), mat); base.position.y = 0.045; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 20), mat); body.position.y = 0.31; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.08, 20), mat); top.position.y = 0.56; g.add(top);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const cren = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), mat);
    cren.position.set(Math.cos(ang) * 0.15, 0.64, Math.sin(ang) * 0.15);
    g.add(cren);
  }
  g.userData.height = 0.7;
  return g;
}

function buildKnight(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.21, 0.09), mat); base.position.y = 0.045; g.add(base);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.36, 18), mat); neck.position.y = 0.28; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.34), mat);
  head.position.set(0, 0.52, 0.06); head.rotation.x = -0.35; g.add(head);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.14), mat);
  nose.position.set(0, 0.44, 0.24); nose.rotation.x = -0.35; g.add(nose);
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), mat);
  ear.position.set(0.06, 0.68, -0.05); ear.rotation.z = 0.2; g.add(ear);
  g.userData.height = 0.72;
  return g;
}

function buildBishop(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.2, 0.09), mat); base.position.y = 0.045; g.add(base);
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 20, 1, false), mat); body.position.y = 0.4; g.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 20), mat); collar.position.y = 0.58; collar.rotation.x = Math.PI / 2; g.add(collar);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat); tip.position.y = 0.72; g.add(tip);
  g.userData.height = 0.78;
  return g;
}

function buildQueen(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.23, 0.09), mat); base.position.y = 0.045; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.19, 0.46, 22), mat); body.position.y = 0.33; g.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 24), mat); collar.position.y = 0.58; collar.rotation.x = Math.PI / 2; g.add(collar);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), mat); crown.position.y = 0.7; g.add(crown);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 8), mat);
    spike.position.set(Math.cos(ang) * 0.11, 0.79, Math.sin(ang) * 0.11);
    g.add(spike);
  }
  g.userData.height = 0.85;
  return g;
}

function buildKing(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseDisc(0.23, 0.1), mat); base.position.y = 0.05; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.52, 22), mat); body.position.y = 0.36; g.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 24), mat); collar.position.y = 0.64; collar.rotation.x = Math.PI / 2; g.add(collar);
  const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), mat); headBall.position.y = 0.76; g.add(headBall);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), mat); crossV.position.y = 0.93; g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.045), mat); crossH.position.y = 0.9; g.add(crossH);
  g.userData.height = 1.0;
  return g;
}

const BUILDERS = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen, k: buildKing };

// ==========================================================================

export class BoardScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.quality = opts.quality || "high";
    this.boardTheme = opts.boardTheme || "royalwood";
    this.pieceTheme = opts.pieceTheme || "ivoryblack";
    this.sensitivity = opts.sensitivity || 1;
    this.flipped = false;

    this.pieces = new Map();      // square -> THREE.Group
    this.highlightMeshes = [];
    this.squareMeshes = new Map(); // square -> mesh (for raycasting)
    this.animating = false;

    this._initScene();
    this._buildBoard();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initScene() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x08070a, 1);
    renderer.shadowMap.enabled = this.quality !== "low";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x08070a, 10, 22);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this._defaultCamPos = new THREE.Vector3(0, 6.4, 6.6);
    this.camera.position.copy(this._defaultCamPos);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 12;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.rotateSpeed = 0.6 * this.sensitivity;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.4;
    this.controls.enablePan = false;

    const key = new THREE.DirectionalLight(0xfff3da, 1.15);
    key.position.set(4, 7, 3);
    key.castShadow = this.quality !== "low";
    if (key.castShadow) {
      key.shadow.mapSize.set(this.quality === "high" ? 2048 : 1024, this.quality === "high" ? 2048 : 1024);
      key.shadow.camera.left = -5; key.shadow.camera.right = 5;
      key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
      key.shadow.bias = -0.0015;
    }
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc9a45c, 0.28);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xe8c77c, 0.5, 12);
    rim.position.set(0, 3, -4);
    this.scene.add(rim);

    const ambient = new THREE.AmbientLight(0x605850, 0.55);
    this.scene.add(ambient);

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
  }

  _buildBoard() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this._applyBoardTheme();

    const frameMat = new THREE.MeshStandardMaterial({ color: BOARD_THEMES[this.boardTheme].frame, metalness: 0.2, roughness: 0.6 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.3, 9.4), frameMat);
    frame.position.y = -0.2;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    const squareGeo = new THREE.BoxGeometry(SQ * 0.98, 0.1, SQ * 0.98);
    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        const isLight = (file + rank) % 2 === 1;
        const mat = isLight ? this._lightMat : this._darkMat;
        const mesh = new THREE.Mesh(squareGeo, mat);
        const pos = squareToWorld(file, rank, false);
        mesh.position.set(pos.x, 0, pos.z);
        mesh.receiveShadow = true;
        mesh.userData.square = squareName(file, rank);
        mesh.userData.baseFile = file;
        mesh.userData.baseRank = rank;
        this.boardGroup.add(mesh);
        this.squareMeshes.set(mesh.userData.square, mesh);
      }
    }
  }

  _applyBoardTheme() {
    const t = BOARD_THEMES[this.boardTheme];
    this._lightMat = new THREE.MeshStandardMaterial({ color: t.light, metalness: 0.12, roughness: 0.55 });
    this._darkMat = new THREE.MeshStandardMaterial({ color: t.dark, metalness: 0.12, roughness: 0.5 });
  }

  setBoardTheme(theme) {
    if (!BOARD_THEMES[theme]) return;
    this.boardTheme = theme;
    this._applyBoardTheme();
    this.squareMeshes.forEach((mesh) => {
      const isLight = (mesh.userData.baseFile + mesh.userData.baseRank) % 2 === 1;
      mesh.material = isLight ? this._lightMat : this._darkMat;
    });
  }

  setPieceTheme(theme) {
    if (!PIECE_THEMES[theme]) return;
    this.pieceTheme = theme;
    this.pieces.forEach((group) => {
      const color = group.userData.color;
      const mat = makeStandardMaterial(PIECE_THEMES[theme][color === "w" ? "white" : "black"]);
      group.traverse(obj => { if (obj.isMesh) obj.material = mat; });
    });
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== "low";
    this.renderer.setPixelRatio(q === "high" ? Math.min(window.devicePixelRatio, 2) : 1);
  }

  setSensitivity(v) { this.sensitivity = v; this.controls.rotateSpeed = 0.6 * v; }

  // board: chess.js .board() 8x8 array, row0 = rank8 ... row7 = rank1
  setPosition(board) {
    const seen = new Set();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        const rank = 7 - r;
        const sq = squareName(f, rank);
        if (piece) {
          seen.add(sq);
          this._placePiece(sq, piece.type, piece.color);
        }
      }
    }
    for (const [sq, group] of Array.from(this.pieces.entries())) {
      if (!seen.has(sq)) {
        this.boardGroup.remove(group);
        this.pieces.delete(sq);
      }
    }
  }

  _placePiece(sq, type, color) {
    const existing = this.pieces.get(sq);
    if (existing && existing.userData.type === type && existing.userData.color === color) return;
    if (existing) { this.boardGroup.remove(existing); this.pieces.delete(sq); }

    const themeSpec = PIECE_THEMES[this.pieceTheme][color === "w" ? "white" : "black"];
    const mat = makeStandardMaterial(themeSpec);
    const group = BUILDERS[type](mat);
    group.userData.type = type;
    group.userData.color = color;
    group.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });

    const { file, rank } = parseSquare(sq);
    const pos = squareToWorld(file, rank, this.flipped);
    group.position.set(pos.x, 0, pos.z);
    this.boardGroup.add(group);
    this.pieces.set(sq, group);
  }

  animateMove(from, to, { promotion = null, castleRookFrom = null, castleRookTo = null } = {}) {
    return new Promise(resolve => {
      const piece = this.pieces.get(from);
      if (!piece) { resolve(); return; }

      const capturedGroup = this.pieces.get(to);
      if (capturedGroup) { this.boardGroup.remove(capturedGroup); this.pieces.delete(to); }

      const { file: ff, rank: fr } = parseSquare(from);
      const { file: tf, rank: tr } = parseSquare(to);
      const start = squareToWorld(ff, fr, this.flipped);
      const end = squareToWorld(tf, tr, this.flipped);
      const duration = 380;
      const t0 = performance.now();
      this.animating = true;

      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        piece.position.x = start.x + (end.x - start.x) * ease;
        piece.position.z = start.z + (end.z - start.z) * ease;
        piece.position.y = Math.sin(Math.PI * t) * 0.35;
        if (t < 1) { requestAnimationFrame(step); return; }

        piece.position.set(end.x, 0, end.z);
        this.pieces.delete(from);
        this.pieces.set(to, piece);

        if (promotion) {
          const themeSpec = PIECE_THEMES[this.pieceTheme][piece.userData.color === "w" ? "white" : "black"];
          const mat = makeStandardMaterial(themeSpec);
          const newGroup = BUILDERS[promotion](mat);
          newGroup.userData.type = promotion;
          newGroup.userData.color = piece.userData.color;
          newGroup.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
          newGroup.position.copy(piece.position);
          this.boardGroup.remove(piece);
          this.boardGroup.add(newGroup);
          this.pieces.set(to, newGroup);
        }

        if (castleRookFrom && castleRookTo) {
          const rook = this.pieces.get(castleRookFrom);
          if (rook) {
            const { file: rff, rank: rfr } = parseSquare(castleRookFrom);
            const { file: rtf, rank: rtr } = parseSquare(castleRookTo);
            const rs = squareToWorld(rff, rfr, this.flipped);
            const re = squareToWorld(rtf, rtr, this.flipped);
            const rt0 = performance.now();
            const rookStep = (rn) => {
              const rt = Math.min(1, (rn - rt0) / duration);
              const rease = 1 - Math.pow(1 - rt, 3);
              rook.position.x = rs.x + (re.x - rs.x) * rease;
              rook.position.z = rs.z + (re.z - rs.z) * rease;
              if (rt < 1) { requestAnimationFrame(rookStep); return; }
              this.pieces.delete(castleRookFrom); this.pieces.set(castleRookTo, rook);
            };
            requestAnimationFrame(rookStep);
          }
        }

        this.animating = false;
        resolve();
      };
      requestAnimationFrame(step);
    });
  }

  highlightLegalMoves(squares, captureSquares = []) {
    this.clearHighlights();
    const dotGeo = new THREE.CircleGeometry(0.09, 24);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xe8c77c, transparent: true, opacity: 0.85 });
    const ringGeo = new THREE.RingGeometry(0.38, 0.44, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe8c77c, transparent: true, opacity: 0.7, side: THREE.DoubleSide });

    squares.forEach(sq => {
      const { file, rank } = parseSquare(sq);
      const pos = squareToWorld(file, rank, this.flipped);
      const isCapture = captureSquares.includes(sq);
      const mesh = new THREE.Mesh(isCapture ? ringGeo : dotGeo, isCapture ? ringMat : dotMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.06, pos.z);
      this.boardGroup.add(mesh);
      this.highlightMeshes.push(mesh);
    });
  }

  clearHighlights() {
    this.highlightMeshes.forEach(m => this.boardGroup.remove(m));
    this.highlightMeshes = [];
  }

  highlightSelected(sq) {
    this.clearSelected();
    if (!sq) return;
    const { file, rank } = parseSquare(sq);
    const pos = squareToWorld(file, rank, this.flipped);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8c77c, transparent: true, opacity: 0.28 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(SQ * 0.98, 0.03, SQ * 0.98), mat);
    mesh.position.set(pos.x, 0.07, pos.z);
    this.boardGroup.add(mesh);
    this._selectedMesh = mesh;
  }
  clearSelected() {
    if (this._selectedMesh) { this.boardGroup.remove(this._selectedMesh); this._selectedMesh = null; }
  }

  setCheckHighlight(sq) {
    this.clearCheckHighlight();
    if (!sq) return;
    const { file, rank } = parseSquare(sq);
    const pos = squareToWorld(file, rank, this.flipped);
    const mat = new THREE.MeshBasicMaterial({ color: 0xb06258, transparent: true, opacity: 0.4 });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.05, pos.z);
    this.boardGroup.add(mesh);
    this._checkMesh = mesh;
  }
  clearCheckHighlight() {
    if (this._checkMesh) { this.boardGroup.remove(this._checkMesh); this._checkMesh = null; }
  }

  setInteractionHandler(onSquareClick) {
    this.canvas.addEventListener("click", (ev) => {
      if (this.animating) return;
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const meshes = Array.from(this.squareMeshes.values());
      const hits = this._raycaster.intersectObjects(meshes, false);
      if (hits.length) onSquareClick(hits[0].object.userData.square);
    });
  }

  resetCamera() {
    this.controls.target.set(0, 0, 0);
    const target = this.flipped
      ? new THREE.Vector3(-this._defaultCamPos.x, this._defaultCamPos.y, -this._defaultCamPos.z)
      : this._defaultCamPos;
    this._tweenCamera(target);
  }

  _tweenCamera(target) {
    const start = this.camera.position.clone();
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 600);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(start, target, ease);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  flipBoard() {
    this.flipped = !this.flipped;
    Array.from(this.pieces.entries()).forEach(([sq, group]) => {
      const { file, rank } = parseSquare(sq);
      const pos = squareToWorld(file, rank, this.flipped);
      group.position.set(pos.x, 0, pos.z);
    });
    this.squareMeshes.forEach((mesh) => {
      const pos = squareToWorld(mesh.userData.baseFile, mesh.userData.baseRank, this.flipped);
      mesh.position.set(pos.x, 0, pos.z);
    });
    this.resetCamera();
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    this.renderer.setPixelRatio(this.quality === "high" ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
