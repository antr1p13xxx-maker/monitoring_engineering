import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Layers, RotateCw, X, Eye, Sparkles, HardDrive, Info } from 'lucide-react';

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
  const [isWireframe, setIsWireframe] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedPart, setSelectedPart] = useState<string>('Base Plate S45C (Main Chassis)');

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

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
    const pillars: THREE.Mesh[] = [];
    pillarPositions.forEach((pos) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7.5, 32), chromeMaterial);
      pillar.position.set(pos[0], pos[1], pos[2]);
      pillar.castShadow = true;
      pillar.userData = { name: 'Hardened Linear Guide Column Ø30mm' };
      pillars.push(pillar);
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

    // Interactive mouse drag to orbit
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let spherical = { radius: 26, theta: 0.8, phi: 1.1 };

    const updateCameraPos = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 1.5, 0);
    };
    updateCameraPos();

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      prevMousePos = { x: e.clientX, y: e.clientY };

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

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Click raycaster to pick part
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(assemblyGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.name) {
          setSelectedPart(hit.userData.name);
        }
      }
    };
    canvas.addEventListener('click', handleCanvasClick);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

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
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isOpen, isWireframe, isExploded, autoRotate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-[150] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-800 text-white px-5 py-3.5 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold">Industrial 3D CAD & .STEP Interactive Viewer</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  WebGL 3D Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Project: <strong className="text-blue-400">{projectName}</strong> • Customer: {customerName} {spk ? `• SPK: ${spk}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Viewport */}
        <div className="relative w-full h-[460px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center select-none overflow-hidden">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Quick HUD Controls */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
            <button
              onClick={() => setIsWireframe(!isWireframe)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                isWireframe ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isWireframe ? 'Shaded Solid' : 'Wireframe'}</span>
            </button>

            <button
              onClick={() => setIsExploded(!isExploded)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                isExploded ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isExploded ? 'Collapse Model' : 'Explode Assembly'}</span>
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition ${
                autoRotate ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Auto-Rotate: {autoRotate ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Part Inspector Tooltip */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl text-xs text-slate-300 shadow-xl max-w-sm">
            <div className="flex items-center space-x-2 text-white font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Komponen Terpilih:</span>
            </div>
            <p className="text-blue-400 font-mono text-[11px] truncate">{selectedPart}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              Klik komponen untuk inspeksi. Klik & geser mouse untuk rotasi 360°. Scroll untuk zoom in/out.
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
        <div className="bg-slate-800 px-5 py-3 flex flex-wrap justify-between items-center gap-3 border-t border-slate-700">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Format CAD yang didukung: <strong>.step, .stp, .iges, .sldprt, .dwg, .stl</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition"
            >
              Tutup Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
