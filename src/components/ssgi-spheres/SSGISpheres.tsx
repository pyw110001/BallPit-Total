import * as THREE from 'three'
import { useRef, useReducer, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { BallCollider, Physics, RigidBody } from '@react-three/rapier'
import { easing } from 'maath'
import { Effects } from './Effects'

const accents = ['#ff4060', '#ffcc00', '#20ffa0', '#4060ff']

interface SphereProps {
  position?: [number, number, number]
  color?: string
  roughness?: number
  metalness?: number
  accent?: boolean
  transparent?: boolean
  opacity?: number
  children?: React.ReactNode
}

const shuffle = (accentIndex = 0) => [
  { color: '#444', roughness: 0.1, metalness: 0.5 },
  { color: '#444', roughness: 0.1, metalness: 0.5 },
  { color: '#444', roughness: 0.1, metalness: 0.5 },
  { color: 'white', roughness: 0.1, metalness: 0.1 },
  { color: 'white', roughness: 0.1, metalness: 0.1 },
  { color: 'white', roughness: 0.1, metalness: 0.1 },
  { color: accents[accentIndex], roughness: 0.1, accent: true },
  { color: accents[accentIndex], roughness: 0.1, accent: true },
  { color: accents[accentIndex], roughness: 0.1, accent: true },
  { color: '#444', roughness: 0.1 },
  { color: '#444', roughness: 0.3 },
  { color: '#444', roughness: 0.3 },
  { color: 'white', roughness: 0.1 },
  { color: 'white', roughness: 0.2 },
  { color: 'white', roughness: 0.1 },
  { color: accents[accentIndex], roughness: 0.1, accent: true, transparent: true, opacity: 0.5 },
  { color: accents[accentIndex], roughness: 0.3, accent: true },
  { color: accents[accentIndex], roughness: 0.1, accent: true }
]

const translations = {
  en: {
    title: "SSGI Spheres",
    tech: "Rapier + SSGI + postprocessing",
    desc: "High-performance Screen Space Global Illumination (SSGI). Dynamic reflections and diffuse bounce lighting are simulated in real-time. Click to change color theme.",
    colorTheme: "Color Theme",
    themeNum: "Theme #",
    renderer: "Renderer",
    rendererVal: "SSGI Pass (V2)",
    cycle: "Cycle Color",
    back: "Back to Portal"
  },
  zh: {
    title: "SSGI 物理球",
    tech: "Rapier + SSGI + 后处理",
    desc: "高性能屏幕空间全局光照 (SSGI)。实时模拟动态反射和漫反射光弹跳。点击画布以改变颜色主题。",
    colorTheme: "色彩主题",
    themeNum: "主题 #",
    renderer: "渲染器",
    rendererVal: "SSGI 渲染通道 (V2)",
    cycle: "切换色彩",
    back: "返回主门户"
  }
}

export default function SSGISpheres({
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
  const [accent, cycleAccent] = useReducer((state: number) => ++state % accents.length, 0)
  const spheres = useMemo(() => shuffle(accent), [accent])

  return (
    <div className="demo-canvas-container">
      <Canvas
        flat
        shadows
        onClick={cycleAccent}
        dpr={[1, 1.5]}
        gl={{ antialias: false }}
        camera={{ position: [0, 0, 30], fov: 17.5, near: 10, far: 50 }}
      >
        
        {/* Enable mouse wheel zoom */}
        <OrbitControls enableRotate={false} enablePan={false} minDistance={15} maxDistance={50} />
        <color attach="background" args={['#0b0c16']} />
        
        <Physics timeStep="vary" gravity={[0, gravityEnabled ? -9.81 : 0, 0]}>
          <Pointer />
          {spheres.map((props, i) => (
            <Sphere key={i} {...props} />
          ))}
        </Physics>

        <Environment resolution={256}>
          <group rotation={[-Math.PI / 3, 0, 1]}>
            <Lightformer form="circle" intensity={100} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
            <Lightformer 
              form="ring" 
              color="#4060ff" 
              intensity={80} 
              onUpdate={(self: any) => self.lookAt(0, 0, 0)} 
              position={[10, 10, 0]} 
              scale={10} 
            />
          </group>
        </Environment>
        
        <Effects />
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
              <span className="m-val" style={{ color: accents[accent], textShadow: `0 0 8px ${accents[accent]}` }}>
                {translations[lang].themeNum}{accent + 1}
              </span>
            </div>
            <div className="metric">
              <span className="m-label">{translations[lang].renderer}</span>
              <span className="m-val text-glow">{translations[lang].rendererVal}</span>
            </div>
          </div>
          <div className="hud-actions">
            <button className="btn btn-secondary btn-sm" onClick={cycleAccent}>
              {translations[lang].cycle}
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
  children,
  vec = new THREE.Vector3(),
  color = 'white',
  ...props
}: SphereProps & { vec?: THREE.Vector3 }) {
  const api = useRef<any>(null)
  const ref = useRef<any>(null)
  const pos = useMemo(() => position || [THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10)], [position])
  
  useFrame((state, delta) => {
    delta = Math.min(0.1, delta)
    if (api.current) {
      // Attract objects to the center
      const translation = api.current.translation()
      vec.set(translation.x, translation.y, translation.z)
      api.current.applyImpulse(vec.negate().multiplyScalar(0.2), true)
    }
    if (ref.current && ref.current.material) {
      easing.dampC(ref.current.material.color, color, 0.2, delta)
    }
  })

  return (
    <RigidBody linearDamping={4} angularDamping={1} friction={0.1} position={pos} ref={api} colliders={false}>
      <BallCollider args={[1]} />
      <mesh ref={ref} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial {...props} />
        {children}
      </mesh>
    </RigidBody>
  )
}

function Pointer({ vec = new THREE.Vector3() }: { vec?: THREE.Vector3 }) {
  const ref = useRef<any>(null)
  useFrame(({ mouse, viewport }) => {
    if (ref.current) {
      ref.current.setNextKinematicTranslation(
        vec.set((mouse.x * viewport.width) / 2, (mouse.y * viewport.height) / 2, 0)
      )
    }
  })
  return (
    <RigidBody position={[0, 0, 0]} type="kinematicPosition" colliders={false} ref={ref}>
      <BallCollider args={[1]} />
    </RigidBody>
  )
}
