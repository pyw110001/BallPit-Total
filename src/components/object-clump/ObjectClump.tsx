import { useRef, useMemo, useState, useReducer } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, useTexture } from '@react-three/drei'
import { Physics, InstancedRigidBodies, RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier'
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { Outlines } from './Outlines'

const rfs = THREE.MathUtils.randFloatSpread
const count = 40
const sphereGeometry = new THREE.SphereGeometry(1, 32, 32)

const colorThemes = ["white", "#a5b4fc", "#fbbf24", "#34d399", "#f87171"]
const colorThemeNames = {
  en: ["Classic White", "Neon Indigo", "Liquid Gold", "Emerald Green", "Coral Crimson"],
  zh: ["经典曜白", "霓虹幻蓝", "流光纯金", "翡翠凝绿", "珊瑚暖红"]
}

const outlineThicknesses = [0.0, 0.01, 0.02, 0.035]
const outlineLabels = {
  en: ["None", "Thin", "Medium", "Thick"],
  zh: ["无描边", "细描边", "中描边", "粗描边"]
}

const translations = {
  en: {
    title: "Object Clump",
    tech: "Rapier + Drei Outlines + N8AO",
    desc: "A physics-driven cluster of glossy spheres styled with interactive outlines. Move your cursor to disperse the clump, click to switch color theme.",
    outlineTheme: "Outline Style",
    colorTheme: "Color Theme",
    objects: "Objects count",
    objectsVal: "40 objects",
    cycleOutline: "Cycle Outline",
    cycleColor: "Cycle Color",
    back: "Back to Portal"
  },
  zh: {
    title: "物体物理簇",
    tech: "Rapier + Drei Outlines + N8AO",
    desc: "一个由物理引擎驱动的亮面球体簇，配有交互式卡通描边。移动光标可打散粒子群，点击画布以改变色彩主题。",
    outlineTheme: "描边风格",
    colorTheme: "色彩主题",
    objects: "物体数量",
    objectsVal: "40 个物理刚体",
    cycleOutline: "切换描边",
    cycleColor: "切换色彩",
    back: "返回主门户"
  }
}

export default function ObjectClump({
  onBack,
  gravityEnabled = true,
  isUIVisible = true,
  lang = 'zh'
}: {
  onBack: () => void
  gravityEnabled?: boolean
  isUIVisible?: boolean
  lang?: 'zh' | 'en'
}) {
  const [mouseActive, setMouseActive] = useState(false)
  const [accent, cycleAccent] = useReducer((state: number) => ++state % colorThemes.length, 0)
  const [outlineIndex, setOutlineIndex] = useState(2) // Default to "Medium" outline

  const baubleMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: colorThemes[accent],
      roughness: 0,
      envMapIntensity: 1.2
    })
  }, [accent])

  return (
    <div 
      className="demo-canvas-container"
      onPointerEnter={() => setMouseActive(true)}
      onPointerLeave={() => setMouseActive(false)}
      onPointerMove={() => {
        if (!mouseActive) setMouseActive(true)
      }}
    >
      <Canvas
        onClick={cycleAccent}
        shadows
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 20], fov: 35, near: 1, far: 40 }}
      >
        <ambientLight intensity={0.5} />
        <color attach="background" args={["#e5e7eb"]} />
        <spotLight
          intensity={1.5}
          angle={0.2}
          penumbra={1}
          position={[30, 30, 30]}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        
        {/* Setup Rapier Physics with upward gravity when enabled to match original cannon behavior */}
        <Physics gravity={[0, gravityEnabled ? 2.0 : 0.0, 0]}>
          <Pointer active={mouseActive} />
          <Clump
            material={baubleMaterial}
            outlinesThickness={outlineThicknesses[outlineIndex]}
          />
        </Physics>

        {/* Load environment and postprocessing effects */}
        <Environment files="/textures/adamsbridge.hdr" />
        <EffectComposer disableNormalPass multisampling={0}>
          <N8AO halfRes color="black" aoRadius={2} intensity={2} aoSamples={6} denoiseSamples={4} />
          <SMAA />
        </EffectComposer>
      </Canvas>

      {/* Floating control panel */}
      {isUIVisible && (
        <div className="floating-hud-panel">
          <div className="hud-header">
            <h3>{translations[lang].title}</h3>
            <span className="tech-badge">{translations[lang].tech}</span>
          </div>
          <p className="hud-desc">
            {translations[lang].desc}
          </p>
          <div className="hud-metrics">
            <div className="metric">
              <span className="m-label">{translations[lang].colorTheme}</span>
              <span className="m-val" style={{ color: colorThemes[accent] === "white" ? "#fff" : colorThemes[accent], textShadow: colorThemes[accent] === "white" ? "none" : `0 0 8px ${colorThemes[accent]}` }}>
                {colorThemeNames[lang][accent]}
              </span>
            </div>
            <div className="metric">
              <span className="m-label">{translations[lang].outlineTheme}</span>
              <span className="m-val text-glow">
                {outlineLabels[lang][outlineIndex]}
              </span>
            </div>
            <div className="metric">
              <span className="m-label">{translations[lang].objects}</span>
              <span className="m-val">{translations[lang].objectsVal}</span>
            </div>
          </div>
          <div className="hud-actions">
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={(e) => {
                e.stopPropagation()
                setOutlineIndex((prev) => (prev + 1) % outlineThicknesses.length)
              }}
            >
              {translations[lang].cycleOutline}
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={(e) => {
                e.stopPropagation()
                cycleAccent()
              }}
            >
              {translations[lang].cycleColor}
            </button>
            <button className="btn btn-primary btn-sm" onClick={onBack}>
              {translations[lang].back}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Clump({
  material,
  outlinesThickness
}: {
  material: THREE.Material
  outlinesThickness: number
}) {
  const texture = useTexture("/textures/cross.jpg")
  const apiRef = useRef<RapierRigidBody[]>([])

  const instances = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push({
        key: i,
        position: [rfs(20), rfs(20), rfs(20)] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number]
      })
    }
    return arr
  }, [])

  // Apply continuous spring force towards the center (0,0,0) to clump them gently
  useFrame(() => {
    if (!apiRef.current) return
    apiRef.current.forEach((api) => {
      if (!api) return
      const pos = api.translation()
      // Spring force F = -k * x ensures force decreases to 0 at the origin,
      // avoiding massive overlapping collisions and explosion oscillations.
      const k = 15.0
      api.addForce({
        x: -pos.x * k,
        y: -pos.y * k,
        z: -pos.z * k
      }, true)
    })
  })

  return (
    <InstancedRigidBodies
      ref={apiRef}
      instances={instances}
      colliders="ball"
      linearDamping={0.65}
      angularDamping={0.1}
    >
      <instancedMesh args={[sphereGeometry, material, count]} castShadow receiveShadow material-map={texture}>
        <Outlines thickness={outlinesThickness} color="black" />
      </instancedMesh>
    </InstancedRigidBodies>
  )
}

function Pointer({ active }: { active: boolean }) {
  const viewport = useThree((state) => state.viewport)
  const pointerRef = useRef<RapierRigidBody>(null)
  
  useFrame((state) => {
    if (pointerRef.current) {
      if (active) {
        const x = (state.mouse.x * viewport.width) / 2
        const y = (state.mouse.y * viewport.height) / 2
        pointerRef.current.setNextKinematicTranslation({ x, y, z: 0 })
      } else {
        // Place pointer far away out of bounds so it doesn't affect spheres
        pointerRef.current.setNextKinematicTranslation({ x: 0, y: 0, z: -100 })
      }
    }
  })

  return (
    <RigidBody ref={pointerRef} type="kinematicPosition" colliders={false} position={[0, 0, -100]}>
      <BallCollider args={[3]} />
    </RigidBody>
  )
}
