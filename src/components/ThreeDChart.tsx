import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCw, Compass, Eye, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

export interface ThreeDSeries {
  name: string;
  color: string;
  data: number[];
}

export interface ThreeDChartProps {
  title?: string;
  labels: string[];
  series: ThreeDSeries[];
  unit?: string;
  height?: number;
  enableAutoRotateDefault?: boolean;
}

export const ThreeDChart: React.FC<ThreeDChartProps> = ({
  title,
  labels,
  series,
  unit = '',
  height = 360,
  enableAutoRotateDefault = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(enableAutoRotateDefault);
  const [hoveredData, setHoveredData] = useState<{
    label: string;
    seriesName: string;
    value: number;
    color: string;
    x: number;
    y: number;
  } | null>(null);

  // References for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const barsGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number>(0);
  const isAutoRotateRef = useRef<boolean>(enableAutoRotateDefault);

  useEffect(() => {
    isAutoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect software WebGL to adapt performance settings
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch (e) {
        return true;
      }
    })();

    const width = container.clientWidth || 600;
    const chartHeight = height;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Slate-50 background matching UI
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / chartHeight, 0.1, 1000);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true
    });
    renderer.setSize(width, chartHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.autoRotate = isAutoRotateRef.current;
    controls.autoRotateSpeed = 1.2;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't go below ground
    controls.minDistance = 6;
    controls.maxDistance = 60;
    controlsRef.current = controls;

    // 5. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xf1f5f9, 0.6);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(16, 26, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 70;
      const d = 25;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0004;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    fillLight.position.set(-18, 14, -14);
    scene.add(fillLight);

    // 6. Build 3D Chart Data Models
    const barsGroup = new THREE.Group();
    barsGroupRef.current = barsGroup;
    scene.add(barsGroup);

    // Calculate maximum value across all series
    let maxVal = 1;
    series.forEach((s) => {
      s.data.forEach((val) => {
        if (val > maxVal) maxVal = val;
      });
    });

    const numCategories = Math.max(labels.length, 1);
    const numSeries = Math.max(series.length, 1);
    const barWidth = 0.85;
    const barDepth = 0.85;
    const categorySpacing = Math.max(numSeries * 1.3, 2.5);
    const seriesSpacing = 1.05;
    const maxBarHeight = 9.0;

    const totalWidth = numCategories * categorySpacing;
    const totalDepth = numSeries * seriesSpacing;

    // Ground Platform (Beveled Base Stage)
    const stageWidth = totalWidth + 4;
    const stageDepth = totalDepth + 4;
    const stageGeo = new THREE.BoxGeometry(stageWidth, 0.4, stageDepth);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.05
    });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.set(0, -0.2, 0);
    stageMesh.receiveShadow = !isSoftwareGl;
    scene.add(stageMesh);

    // Subtle Grid Helper on Stage
    const grid = new THREE.GridHelper(Math.max(stageWidth, stageDepth), Math.round(Math.max(stageWidth, stageDepth)), 0x94a3b8, 0xe2e8f0);
    grid.position.set(0, 0.01, 0);
    scene.add(grid);

    // Reusable text texture generator
    const createTextTexture = (text: string, bgColor?: string, fgColor = '#0f172a', fontSize = 34) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (bgColor) {
          ctx.fillStyle = bgColor;
          ctx.roundRect ? ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 16) : ctx.rect(4, 4, canvas.width - 8, canvas.height - 8);
          ctx.fill();
        }
        ctx.fillStyle = fgColor;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Truncate text if too long
        const display = text.length > 20 ? text.substring(0, 18) + '...' : text;
        ctx.fillText(display, canvas.width / 2, canvas.height / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      return texture;
    };

    // Store interactive meshes for raycasting
    const interactiveMeshes: THREE.Mesh[] = [];

    // Build bars for each category and series
    labels.forEach((label, catIdx) => {
      const catX = (catIdx - (numCategories - 1) / 2) * categorySpacing;

      // Category Floor Label
      const labelTex = createTextTexture(label, undefined, '#334155', 30);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        depthWrite: false
      });
      const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(categorySpacing * 0.9, 0.7), labelMat);
      labelPlane.rotation.x = -Math.PI / 2;
      labelPlane.position.set(catX, 0.02, totalDepth / 2 + 1.2);
      barsGroup.add(labelPlane);

      series.forEach((s, sIdx) => {
        const val = s.data[catIdx] ?? 0;
        const barH = Math.max((val / maxVal) * maxBarHeight, 0.15);
        const sZ = (sIdx - (numSeries - 1) / 2) * seriesSpacing;

        // 3D Pillar Geometry (Chamfered Box)
        const geo = new THREE.BoxGeometry(barWidth, barH, barDepth);
        // Base color parsed
        const baseColor = new THREE.Color(s.color || '#3b82f6');
        const mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.15,
          roughness: 0.25
        });

        const barMesh = new THREE.Mesh(geo, mat);
        barMesh.position.set(catX, barH / 2, sZ);
        barMesh.castShadow = !isSoftwareGl;
        barMesh.receiveShadow = !isSoftwareGl;

        // Custom metadata on mesh for raycaster
        (barMesh as any).userData = {
          label,
          seriesName: s.name,
          value: val,
          color: s.color,
          baseColor: baseColor.clone()
        };

        barsGroup.add(barMesh);
        interactiveMeshes.push(barMesh);

        // Value Floating Badge on Top of Bar
        if (val > 0) {
          const valTex = createTextTexture(`${val}`, s.color, '#ffffff', 38);
          const valMat = new THREE.SpriteMaterial({
            map: valTex,
            transparent: true,
            depthTest: true
          });
          const sprite = new THREE.Sprite(valMat);
          sprite.position.set(catX, barH + 0.65, sZ);
          sprite.scale.set(1.4, 0.42, 1);
          barsGroup.add(sprite);
        }
      });
    });

    // 7. Initial Camera Position (Dynamic angle based on scene width)
    const camDist = Math.max(totalWidth * 1.3, 14);
    camera.position.set(camDist * 0.75, camDist * 0.8, camDist * 1.05);
    camera.lookAt(0, maxBarHeight * 0.35, 0);
    controls.target.set(0, maxBarHeight * 0.35, 0);
    controls.update();

    // 8. Raycaster & Mouse Hover Handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentHoveredMesh: THREE.Mesh | null = null;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const data = (hit as any).userData;
        if (data) {
          if (currentHoveredMesh !== hit) {
            // Reset previous
            if (currentHoveredMesh) {
              const prevMat = currentHoveredMesh.material as THREE.MeshStandardMaterial;
              prevMat.color.copy((currentHoveredMesh as any).userData.baseColor);
              currentHoveredMesh.scale.set(1, 1, 1);
            }
            currentHoveredMesh = hit;
            const curMat = hit.material as THREE.MeshStandardMaterial;
            curMat.color.setHex(0xf59e0b); // Highlight golden amber
            hit.scale.set(1.08, 1.02, 1.08);
          }

          setHoveredData({
            label: data.label,
            seriesName: data.seriesName,
            value: data.value,
            color: data.color,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          });
        }
      } else {
        if (currentHoveredMesh) {
          const prevMat = currentHoveredMesh.material as THREE.MeshStandardMaterial;
          prevMat.color.copy((currentHoveredMesh as any).userData.baseColor);
          currentHoveredMesh.scale.set(1, 1, 1);
          currentHoveredMesh = null;
        }
        setHoveredData(null);
      }
    };

    const handlePointerLeave = () => {
      if (currentHoveredMesh) {
        const prevMat = currentHoveredMesh.material as THREE.MeshStandardMaterial;
        prevMat.color.copy((currentHoveredMesh as any).userData.baseColor);
        currentHoveredMesh.scale.set(1, 1, 1);
        currentHoveredMesh = null;
      }
      setHoveredData(null);
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('mouseleave', handlePointerLeave);

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        if (newW > 0) {
          camera.aspect = newW / chartHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, chartHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // 10. Animation Loop
    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      isRunning = false;
      cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('mouseleave', handlePointerLeave);

      // Clean up geometries and materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [labels, series, height]);

  // Camera Presets
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const numCategories = Math.max(labels.length, 1);
    const categorySpacing = Math.max(series.length * 1.3, 2.5);
    const totalWidth = numCategories * categorySpacing;
    const camDist = Math.max(totalWidth * 1.3, 14);

    cameraRef.current.position.set(camDist * 0.75, camDist * 0.8, camDist * 1.05);
    controlsRef.current.target.set(0, 3, 0);
    controlsRef.current.update();
  };

  const handleSetView = (view: 'iso' | 'front' | 'top') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const numCategories = Math.max(labels.length, 1);
    const categorySpacing = Math.max(series.length * 1.3, 2.5);
    const totalWidth = numCategories * categorySpacing;
    const camDist = Math.max(totalWidth * 1.3, 15);

    if (view === 'iso') {
      cameraRef.current.position.set(camDist * 0.75, camDist * 0.8, camDist * 1.05);
    } else if (view === 'front') {
      cameraRef.current.position.set(0, 4, camDist * 1.2);
    } else if (view === 'top') {
      cameraRef.current.position.set(0, camDist * 1.3, 0.1);
    }
    controlsRef.current.target.set(0, 3, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner group">
      {/* 3D Canvas Mounting Container */}
      <div
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="w-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip */}
      {hoveredData && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 border border-slate-700/80 rounded-xl px-3 py-2 text-white shadow-2xl backdrop-blur-sm animate-in fade-in duration-150"
          style={{
            left: `${hoveredData.x}px`,
            top: `${hoveredData.y}px`
          }}
        >
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: hoveredData.color }}
            />
            <span className="text-[11px] font-bold text-slate-300 truncate max-w-[170px]">
              {hoveredData.seriesName}
            </span>
          </div>
          <div className="text-xs font-semibold text-white truncate max-w-[200px]">
            {hoveredData.label}
          </div>
          <div className="text-sm font-black text-amber-400 mt-0.5">
            {hoveredData.value.toLocaleString()} {unit}
          </div>
        </div>
      )}

      {/* Top Floating Badge & Controls */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white shadow-md">
          <Compass className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-bold text-slate-200">
            {title || 'Grafik 3D Interaktif'}
          </span>
          <span className="text-[10px] bg-blue-500/30 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-400/30">
            WebGL 3D
          </span>
        </div>

        {/* Camera Preset Quick Buttons */}
        <div className="pointer-events-auto flex items-center space-x-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-md">
          <button
            type="button"
            onClick={() => handleSetView('iso')}
            title="Tampak Isometrik"
            className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Iso
          </button>
          <button
            type="button"
            onClick={() => handleSetView('front')}
            title="Tampak Depan"
            className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Depan
          </button>
          <button
            type="button"
            onClick={() => handleSetView('top')}
            title="Tampak Atas"
            className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Atas
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset Sudut Pandang"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Interactive Dock & Legend */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Series Legend */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-md max-w-full overflow-x-auto">
          {series.map((s) => (
            <div key={s.name} className="flex items-center space-x-1.5 text-xs text-slate-200">
              <span className="w-2.5 h-2.5 rounded-md shrink-0 shadow-sm" style={{ backgroundColor: s.color }} />
              <span className="font-semibold text-[11px] whitespace-nowrap">{s.name}</span>
            </div>
          ))}
        </div>

        {/* Interactive Guide & Auto Rotate Toggle */}
        <div className="pointer-events-auto flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-md border ${
              autoRotate
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
            <span>{autoRotate ? 'Auto Putar: ON' : 'Auto Putar: OFF'}</span>
          </button>

          <span className="hidden sm:inline-block text-[10px] bg-slate-900/80 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-xl">
            🖱️ Klik & geser untuk memutar • Scroll zoom
          </span>
        </div>
      </div>
    </div>
  );
};
