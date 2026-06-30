import { useRef, useMemo, useState, useReducer } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, useTexture, OrbitControls } from '@react-three/drei'
import { Physics, RigidBody, BallCollider } from '@react-three/rapier'
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'
import { Outlines } from './Outlines'

const rfs = THREE.MathUtils.randFloatSpread
const count = 40

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
  const [accent, cycleAccent] = useReducer((state: number) => ++state % colorThemes.length, 0)
  const [outlineIndex, setOutlineIndex] = useState(2) // Default to "Medium" outline

  const baubleMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: colorThemes[accent],
      roughness: 0,
      envMapIntensity: 1.2
    })
  }, [accent])

  // Generate initial random scattered positions for the 40 spheres
  const spheres = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push({
        position: [rfs(10), rfs(10), rfs(10)] as [number, number, number]
      })
    }
    return arr
  }, [])

  return (
    <div className="demo-canvas-container">
      <Canvas
        onClick={cycleAccent}
        shadows
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 24], fov: 17.5, near: 1, far: 40 }}
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
        
        {/* Enable mouse wheel zoom */}
        <OrbitControls enableRotate={false} enablePan={false} minDistance={10} maxDistance={40} />
        
        {/* Render ClumpScene inside Canvas context so useTexture hook resolves correctly */}
        <ClumpScene
          spheres={spheres}
          material={baubleMaterial}
          outlinesThickness={outlineThicknesses[outlineIndex]}
          gravityEnabled={gravityEnabled}
        />

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

function Sphere({
  position,
  material,
  texture,
  outlinesThickness
}: {
  position: [number, number, number]
  material: THREE.Material
  texture: THREE.Texture
  outlinesThickness: number
}) {
  const api = useRef<any>(null)
  const vec = useMemo(() => new THREE.Vector3(), [])

  // Consistently attract spheres to origin using applyImpulse (exactly like Lusion Connectors & SSGI Spheres)
  useFrame(() => {
    if (api.current) {
      const translation = api.current.translation()
      vec.set(translation.x, translation.y, translation.z)
      api.current.applyImpulse(vec.negate().multiplyScalar(0.2), true)
    }
  })

  return (
    <RigidBody
      ref={api}
      linearDamping={4}
      angularDamping={1}
      friction={0.1}
      position={position}
      colliders={false}
    >
      <BallCollider args={[1]} />
      <mesh castShadow receiveShadow material={material} material-map={texture}>
        <sphereGeometry args={[1, 32, 32]} />
        <Outlines thickness={outlinesThickness} color="black" />
      </mesh>
    </RigidBody>
  )
}

function Pointer() {
  const ref = useRef<any>(null)
  const vec = useMemo(() => new THREE.Vector3(), [])
  
  useFrame(({ mouse, viewport }) => {
    if (ref.current) {
      ref.current.setNextKinematicTranslation(
        vec.set((mouse.x * viewport.width) / 2, (mouse.y * viewport.height) / 2, 0)
      )
    }
  })

  return (
    <RigidBody position={[0, 0, 0]} type="kinematicPosition" colliders={false} ref={ref}>
      <BallCollider args={[1.5]} /> {/* Small pointer collision radius (similar to other effects) */}
    </RigidBody>
  )
}

function ClumpScene({
  spheres,
  material,
  outlinesThickness,
  gravityEnabled
}: {
  spheres: { position: [number, number, number] }[]
  material: THREE.Material
  outlinesThickness: number
  gravityEnabled: boolean
}) {
  const texture = useTexture("/textures/cross.jpg")
  return (
    <Physics gravity={[0, gravityEnabled ? -9.81 : 0, 0]}>
      <Pointer />
      {spheres.map((props, i) => (
        <Sphere
          key={i}
          position={props.position}
          material={material}
          texture={texture}
          outlinesThickness={outlinesThickness}
        />
      ))}
    </Physics>
  )
}
