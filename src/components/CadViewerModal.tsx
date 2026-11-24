import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Layers, RotateCw, X, Eye, Sparkles, Info, ZoomIn, ZoomOut } from 'lucide-react';

interface CadViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  spk: string | null;
  projectName?: string;
  customerName?: string;
}

export const CadViewerModal: React.FC<CadViewerModalProps> = ({
  isOpen,
  onClose,
  spk,
  projectName = 'Mechanical Assembly Jig Fixture',
  customerName = 'PT. Engineering Industry'
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const zoomFnRef = useRef<((delta: number) => void) | null>(null);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedPart, setSelectedPart] = useState<string>('Base Plate S45C (Main Chassis)');

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 300;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.025);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(16, 14, 22);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x60a5fa, 1.8);
    dirLight1.position.set(20, 30, 20);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.9);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x38bdf8, 1.2, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(30, 30, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -3.5;
    scene.add(gridHelper);

    // Assembly Group
    const assemblyGroup = new THREE.Group();
    scene.add(assemblyGroup);

    // Materials
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: isWireframe
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.15,
      wireframe: isWireframe
    });

    const brassMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: isWireframe
    });

    const cyanAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.7,
      roughness: 0.35,
      wireframe: isWireframe
    });

    // 1. Base Plate
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 10), steelMaterial);
    basePlate.position.set(0, -2.5, 0);
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    basePlate.userData = { name: 'Base Plate S45C (Main Chassis)' };
    assemblyGroup.add(basePlate);

    // 2. Guide Columns (4 Pillars)
    const pillarPositions = [
      [-5.5, 1.5, -3.8],
      [5.5, 1.5, -3.8],
      [-5.5, 1.5, 3.8],
      [5.5, 1.5, 3.8]
    ];
    pillarPositions.forEach((pos) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7.5, 32), chromeMaterial);
      pillar.position.set(pos[0], pos[1], pos[2]);
      pillar.castShadow = true;
      pillar.userData = { name: 'Hardened Linear Guide Column Ø30mm' };
      assemblyGroup.add(pillar);
    });

    // 3. Middle Sliding Crosshead Block
    const crosshead = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 8), cyanAccentMaterial);
    crosshead.position.set(0, 1.8, 0);
    crosshead.castShadow = true;
    crosshead.userData = { name: 'Sliding Crosshead Carriage (ADC12 Aluminum)' };
    assemblyGroup.add(crosshead);

    // 4. Central Pneumatic/Hydraulic Cylinder
    const cylinderBody = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 32), steelMaterial);
    cylinderBody.position.set(0, 5.5, 0);
    cylinderBody.castShadow = true;
    cylinderBody.userData = { name: 'Pneumatic Actuator ISO 15552 Ø80mm' };
    assemblyGroup.add(cylinderBody);

    // 5. Cylinder Piston Rod
    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 5, 32), chromeMaterial);
    pistonRod.position.set(0, 1.5, 0);
    pistonRod.castShadow = true;
    pistonRod.userData = { name: 'Chromed Piston Rod Hardened Steel' };
    assemblyGroup.add(pistonRod);

    // 6. Rotary Chuck & Tool Flange
    const chuck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 24), brassMaterial);
    chuck.position.set(0, -0.6, 0);
    chuck.castShadow = true;
    chuck.userData = { name: 'Precision Collet Chuck & Fixture Flange' };
    assemblyGroup.add(chuck);

    // Interactive mouse + touch orbit & pinch zoom
    let isDragging = false;
    let prevPos = { x: 0, y: 0 };
    let prevPinchDist: number | null = null;
    const spherical = { radius: 26, theta: 0.8, phi: 1.1 };

    const updateCameraPos = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 1.5, 0);
    };
    updateCameraPos();

    zoomFnRef.current = (delta: number) => {
      spherical.radius = Math.max(10, Math.min(50, spherical.radius + delta));
      updateCameraPos();
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevPos.x;
      const deltaY = e.clientY - prevPos.y;
      prevPos = { x: e.clientX, y: e.clientY };

      spherical.theta -= deltaX * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 + 0.3, spherical.phi - deltaY * 0.008));
      updateCameraPos();
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(10, Math.min(50, spherical.radius + e.deltaY * 0.02));
      updateCameraPos();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickPartAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(assemblyGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.name) {
          setSelectedPart(hit.userData.name);
        }
      }
    };

    let touchStartPos = { x: 0, y: 0 };
    let touchMoved = false;

    const getPinchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        touchMoved = false;
        prevPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartPos = { ...prevPos };
        prevPinchDist = null;
      } else if (e.touches.length === 2) {
        isDragging = false;
        prevPinchDist = getPinchDist(e.touches[0], e.touches[1]);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        if (Math.hypot(curX - touchStartPos.x, curY - touchStartPos.y) > 8) {
          touchMoved = true;
        }
        const deltaX = curX - prevPos.x;
        const deltaY = curY - prevPos.y;
        prevPos = { x: curX, y: curY };

        spherical.theta -= deltaX * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 + 0.3, spherical.phi - deltaY * 0.01));
        updateCameraPos();
      } else if (e.touches.length === 2 && prevPinchDist !== null) {
        const newDist = getPinchDist(e.touches[0], e.touches[1]);
        const diff = prevPinchDist - newDist;
        prevPinchDist = newDist;
        spherical.radius = Math.max(10, Math.min(50, spherical.radius + diff * 0.08));
        updateCameraPos();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchMoved && e.changedTouches.length === 1 && e.touches.length === 0) {
        pickPartAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      isDragging = false;
      prevPinchDist = null;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    const handleCanvasClick = (e: MouseEvent) => {
      pickPartAt(e.clientX, e.clientY);
    };
    canvas.addEventListener('click', handleCanvasClick);

    // Animation Loop
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        assemblyGroup.rotation.y += 0.006;
      }

      // Exploded View dynamic positioning
      if (isExploded) {
        basePlate.position.y = THREE.MathUtils.lerp(basePlate.position.y, -5.5, 0.08);
        crosshead.position.y = THREE.MathUtils.lerp(crosshead.position.y, 2.5, 0.08);
        cylinderBody.position.y = THREE.MathUtils.lerp(cylinderBody.position.y, 9.5, 0.08);
        chuck.position.y = THREE.MathUtils.lerp(chuck.position.y, -2.5, 0.08);
      } else {
        basePlate.position.y = THREE.MathUtils.lerp(basePlate.position.y, -2.5, 0.08);
        crosshead.position.y = THREE.MathUtils.lerp(crosshead.position.y, 1.8, 0.08);
        cylinderBody.position.y = THREE.MathUtils.lerp(cylinderBody.position.y, 5.5, 0.08);
        chuck.position.y = THREE.MathUtils.lerp(chuck.position.y, -0.6, 0.08);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      zoomFnRef.current = null;
      renderer.dispose();
    };
  }, [isOpen, isWireframe, isExploded, autoRotate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="bg-slate-800 text-white px-4 sm:px-5 py-3 flex justify-between items-center border-b border-slate-700 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs sm:text-base font-bold truncate">3D CAD & .STEP Interactive Viewer</h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  WebGL 3D Engine
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                <strong className="text-blue-400">{projectName}</strong> • {customerName} {spk ? `• ${spk}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Viewport */}
        <div className="relative w-full h-[300px] sm:h-[460px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center select-none overflow-hidden">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

          {/* Quick HUD Controls */}
          <div className="absolute top-3 left-3 right-14 sm:right-auto flex flex-wrap gap-1.5 sm:gap-2 z-10">
            <button
              type="button"
              onClick={() => setIsWireframe(!isWireframe)}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                isWireframe ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isWireframe ? 'Solid' : 'Wireframe'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExploded(!isExploded)}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                isExploded ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isExploded ? 'Collapse' : 'Explode'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                autoRotate ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Putar: {autoRotate ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Mobile & Desktop Quick Zoom Buttons */}
          <div className="absolute top-3 right-3 sm:top-auto sm:bottom-4 sm:right-4 flex flex-col sm:flex-row gap-1.5 z-10">
            <button
              type="button"
              onClick={() => zoomFnRef.current?.(-4)}
              title="Zoom In"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/60 text-white flex items-center justify-center shadow-lg active:scale-95"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomFnRef.current?.(4)}
              title="Zoom Out"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/60 text-white flex items-center justify-center shadow-lg active:scale-95"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Part Inspector Tooltip */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3 py-2 rounded-xl text-xs text-slate-300 shadow-xl sm:max-w-sm">
            <div className="flex items-center space-x-1.5 text-white font-semibold mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[11px] sm:text-xs">Komponen Terpilih:</span>
            </div>
            <p className="text-blue-400 font-mono text-[11px] truncate">{selectedPart}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
              Klik komponen untuk inspeksi. Klik & geser mouse untuk rotasi 360°. Scroll untuk zoom in/out.
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 sm:hidden">
              Geser 1 jari untuk putar 360° • Cubit 2 jari untuk zoom
            </p>
          </div>

          {/* Model Specs Overlay */}
          <div className="absolute top-4 right-4 bg-slate-900/80 border border-slate-800 backdrop-blur-md p-3 rounded-xl text-[11px] text-slate-300 space-y-1 hidden sm:block">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">File Type:</span>
              <span className="text-white font-mono">STEP / STP Solid</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Units:</span>
              <span className="text-white font-mono">Millimeters (mm)</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Standard:</span>
              <span className="text-emerald-400 font-mono">ISO 2768-m</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-800 px-4 sm:px-5 py-3 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 border-t border-slate-700 shrink-0 pb-safe">
          <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-slate-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Format CAD: <strong>.step, .stp, .iges, .sldprt, .dwg, .stl</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition"
          >
            Tutup Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
