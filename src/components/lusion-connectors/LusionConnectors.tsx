import * as THREE from 'three'
import { useRef, useReducer, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, useGLTF, MeshTransmissionMaterial, OrbitControls } from '@react-three/drei'
import { CuboidCollider, BallCollider, Physics, RigidBody } from '@react-three/rapier'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { easing } from 'maath'

// Import GLTF model URL
import cModel from './c-transformed.glb?url'

const accents = ['#4060ff', '#20ffa0', '#ff4060', '#ffcc00']

interface ConnectorProps {
  position?: [number, number, number]
  color?: string
  roughness?: number
  accent?: boolean
  children?: React.ReactNode
}

const shuffle = (accentIndex = 0) => [
  { color: '#444', roughness: 0.1 },
  { color: '#444', roughness: 0.75 },
  { color: '#444', roughness: 0.75 },
  { color: 'white', roughness: 0.1 },
  { color: 'white', roughness: 0.75 },
  { color: 'white', roughness: 0.1 },
  { color: accents[accentIndex], roughness: 0.1, accent: true },
  { color: accents[accentIndex], roughness: 0.75, accent: true },
  { color: accents[accentIndex], roughness: 0.1, accent: true }
]

const translations = {
  en: {
    title: "Lusion Connectors",
    tech: "Rapier + N8AO + Drei",
    desc: "Inspired by Lusion LTD. Tap/click anywhere in the canvas to cycle the accent color theme. Move your cursor to interact with the connectors.",
    colorTheme: "Color Theme",
    themeNum: "Theme #",
    objects: "Objects count",
    objectsVal: "10 rigidbodies",
    cycle: "Cycle Color",
    back: "Back to Portal"
  },
  zh: {
    title: "Lusion 连接体",
    tech: "Rapier + N8AO + Drei",
    desc: "灵感来自 Lusion LTD。点击画布任意位置以循环切换强调色主题。移动光标可与连接体互动。",
    colorTheme: "色彩主题",
    themeNum: "主题 #",
    objects: "物体数量",
    objectsVal: "10 个物理刚体",
    cycle: "切换色彩",
    back: "返回主门户"
  }
}

export default function LusionConnectors({
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
  const connectors = useMemo(() => shuffle(accent), [accent])

  return (
    <div className="demo-canvas-container">
      <Canvas
        onClick={cycleAccent}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: false }}
        camera={{ position: [0, 0, 24], fov: 17.5, near: 1, far: 40 }}
      >
        <color attach="background" args={['#0b0c16']} />
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        
        {/* Enable mouse wheel zoom */}
        <OrbitControls enableRotate={false} enablePan={false} minDistance={10} maxDistance={40} />
        
        <Physics gravity={[0, gravityEnabled ? -9.81 : 0, 0]}>
          <Pointer />
          {connectors.map((props, i) => (
            <Connector key={i} {...props} />
          ))}
          <Connector position={[3, 3, 2]}>
            <Model>
              <MeshTransmissionMaterial 
                clearcoat={1} 
                thickness={0.2} 
                anisotropicBlur={0.1} 
                chromaticAberration={0.15} 
                samples={8} 
                resolution={512} 
              />
            </Model>
          </Connector>
        </Physics>

        <EffectComposer disableNormalPass multisampling={8}>
          <N8AO distanceFalloff={1} aoRadius={1} intensity={4} />
        </EffectComposer>

        <Environment resolution={256}>
          <group rotation={[-Math.PI / 3, 0, 1]}>
            <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
            <Lightformer form="circle" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          </group>
        </Environment>
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
              <span className="m-label">{translations[lang].objects}</span>
              <span className="m-val">{translations[lang].objectsVal}</span>
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

function Connector({
  position,
  children,
  vec = new THREE.Vector3(),
  accent,
  ...props
}: ConnectorProps & { vec?: THREE.Vector3 }) {
  const api = useRef<any>(null)
  const pos = useMemo(() => position || [THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10)], [position])
  
  useFrame((state, delta) => {
    delta = Math.min(0.1, delta)
    if (api.current) {
      // Attract objects to the center when no gravity is applied
      const translation = api.current.translation()
      vec.set(translation.x, translation.y, translation.z)
      api.current.applyImpulse(vec.negate().multiplyScalar(0.2), true)
    }
  })

  return (
    <RigidBody linearDamping={4} angularDamping={1} friction={0.1} position={pos} ref={api} colliders={false}>
      {/* 3 intersecting cuboids to form a 3D connector shape */}
      <CuboidCollider args={[0.38, 1.27, 0.38]} />
      <CuboidCollider args={[1.27, 0.38, 0.38]} />
      <CuboidCollider args={[0.38, 0.38, 1.27]} />
      {children ? children : <Model {...props} />}
      {accent && <pointLight intensity={5} distance={3} color={props.color} />}
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

function Model({ children, color = 'white', roughness = 0 }: { children?: React.ReactNode; color?: string; roughness?: number }) {
  const ref = useRef<any>(null)
  const { nodes, materials } = useGLTF(cModel) as any
  
  useFrame((state, delta) => {
    if (ref.current && ref.current.material) {
      easing.dampC(ref.current.material.color, color, 0.2, delta)
    }
  })
  
  return (
    <mesh ref={ref} castShadow receiveShadow scale={10} geometry={nodes.connector.geometry}>
      <meshStandardMaterial metalness={0.2} roughness={roughness} map={materials.base.map} />
      {children}
    </mesh>
  )
}

// Pre-preload model
useGLTF.preload(cModel)
