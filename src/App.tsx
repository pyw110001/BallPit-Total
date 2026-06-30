import { useState } from 'react'
import LusionConnectors from './components/lusion-connectors/LusionConnectors'
import SSGISpheres from './components/ssgi-spheres/SSGISpheres'
import GradientText from './components/GradientText'
import BorderGlow from './components/BorderGlow'
import ObjectClump from './components/object-clump/ObjectClump'
import { Sparkles, Activity, Layers, ArrowRight, Sun, Box, Globe, Moon, Languages } from 'lucide-react'

type ViewType = 'portal' | 'lusion' | 'ssgi' | 'clump'

const portalTranslations = {
  en: {
    brandBadge: "Z-LAB",
    title: "PHYSICS & LIGHT",
    subtitle: "A premium interactive playground comparing advanced real-time physics and post-processing lighting pipelines in WebGL.",
    gravityBtn: (enabled: boolean) => `Gravity: ${enabled ? '9.8 m/s²' : 'Zero-G'}`,
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langToggle: "中文",
    launchSim: "Launch Simulation",
    footerText: "Built using React 18, Three.js, React Three Fiber, Rapier Physics & Postprocessing.",
    credits: "Original examples by Poimandres (pmndrs) community.",
    
    lusionTitle: "Lusion Connectors",
    lusionDesc: "Interlocking 3D connector models with mouse-attraction kinematics and rigid body physics. Uses N8AO (Ambient Occlusion) for oily reflections and realistic depth shadows.",
    
    ssgiTitle: "SSGI Spheres",
    ssgiDesc: "A high-fidelity physical sphere pit featuring Screen-Space Global Illumination (SSGI). Showcases diffuse light bouncing, emissive ring reflections, and rich depth shader reflections.",

    clumpTitle: "Object Clump",
    clumpDesc: "A physics-driven cluster of glossy spheres styled with interactive outlines. Move your cursor to disperse the clump, click to switch color theme.",
    
    backBtn: "Back",
    gravityOn: "Gravity ON",
    zeroG: "Zero-G",
    immersiveHint: "Double click anywhere to exit immersive experience"
  },
  zh: {
    brandBadge: "Z-LAB",
    title: "物理与光影",
    subtitle: "一个用于对比 WebGL 中高级实时物理引擎与后处理光影渲染管线的高端交互式游乐场。",
    gravityBtn: (enabled: boolean) => `重力: ${enabled ? '9.8 m/s²' : '无重力漂浮'}`,
    themeLight: "浅色模式",
    themeDark: "深色模式",
    langToggle: "English",
    launchSim: "启动演示",
    footerText: "基于 React 18, Three.js, React Three Fiber, Rapier 物理引擎与后处理构建。",
    credits: "原始示例由 Poimandres (pmndrs) 社区提供。",
    
    lusionTitle: "Lusion 连接体",
    lusionDesc: "具有鼠标引力运动学和刚体物理的互锁 3D 连接体模型。使用 N8AO（环境光遮蔽）来实现油润的反射和逼真深度阴影。",
    
    ssgiTitle: "SSGI 物理球",
    ssgiDesc: "一个具有屏幕空间全局光照 (SSGI) 的高保真物理球体坑。展示了漫自动光线弹跳、发光环反射以及丰富的深度着色器反射。",

    clumpTitle: "物体物理簇",
    clumpDesc: "一个由物理引擎驱动的亮面球体簇，配有交互式卡通描边。移动光标可打散粒子群，点击画布以改变色彩主题。",
    
    backBtn: "返回",
    gravityOn: "重力开启",
    zeroG: "零重力",
    immersiveHint: "双击任意空白处退出沉浸体验"
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('portal')
  const [gravityEnabled, setGravityEnabled] = useState<boolean>(false)
  const [darkMode, setDarkMode] = useState<boolean>(true)
  const [isUIVisible, setIsUIVisible] = useState<boolean>(true)
  const [lang, setLang] = useState<'zh' | 'en'>('zh')

  const handleBack = () => {
    setCurrentView('portal')
    setIsUIVisible(true)
  }

  return (
    <div className={`app-root ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Background ambient glows */}
      <div className="ambient-glow bg-glow-1"></div>
      <div className="ambient-glow bg-glow-2"></div>
      <div className="ambient-glow bg-glow-3"></div>

      {currentView === 'portal' && (
        <div className="portal-container animate-fade-in">
          {/* Header */}
          <header className="portal-header">
            <div className="brand-badge">
              <Sparkles className="icon-glow" size={16} />
              <span>{portalTranslations[lang].brandBadge}</span>
            </div>
            
            <h1 className="main-title">
              <GradientText
                colors={["#ffffff", "#a5b4fc", "#6366f1", "#3b82f6", "#06b6d4", "#ffffff"]}
                animationSpeed={5}
                showBorder={false}
              >
                {portalTranslations[lang].title}
              </GradientText>
            </h1>
            
            <p className="subtitle">
              {portalTranslations[lang].subtitle}
            </p>

            {/* General Control Bar */}
            <div className="global-controls">
              <button 
                className={`btn btn-toggle ${gravityEnabled ? 'active' : ''}`}
                onClick={() => setGravityEnabled(!gravityEnabled)}
                title="Toggle Gravity"
              >
                <Globe size={16} />
                <span>{portalTranslations[lang].gravityBtn(gravityEnabled)}</span>
              </button>

              <button 
                className="btn btn-toggle"
                onClick={() => setDarkMode(!darkMode)}
                title="Toggle Theme"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                <span>{darkMode ? portalTranslations[lang].themeLight : portalTranslations[lang].themeDark}</span>
              </button>

              <button 
                className="btn btn-toggle"
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                title="Toggle Language"
              >
                <Languages size={16} />
                <span>{portalTranslations[lang].langToggle}</span>
              </button>
            </div>
          </header>

          {/* Cards Grid */}
          <main className="demo-grid">
            
            {/* Card 1: Lusion Connectors */}
            <BorderGlow
              className="demo-card card-lusion"
              onClick={() => setCurrentView('lusion')}
              backgroundColor={darkMode ? "rgba(18, 20, 38, 0.55)" : "rgba(255, 255, 255, 0.75)"}
              borderRadius={24}
              glowColor="150 80 70"
              colors={['#40ffaa', '#4079ff', '#20ffa0']}
              glowRadius={40}
              edgeSensitivity={30}
              glowIntensity={1.2}
            >
              <div className="card-media">
                <img src="/thumbnails/lusion-connectors.png" className="gradient-background" alt="Lusion Connectors" />
                <div className="mesh-overlay"></div>
                <div className="card-floating-badge">N8AO AO</div>
              </div>
              
              <div className="card-content">
                <div className="card-header-row">
                  <h2 className="card-title">{portalTranslations[lang].lusionTitle}</h2>
                  <Layers className="card-icon" size={20} />
                </div>
                
                <p className="card-description">
                  {portalTranslations[lang].lusionDesc}
                </p>

                <div className="tech-stack-row">
                  <span className="tech-tag">Rapier</span>
                  <span className="tech-tag">MeshTransmissionMaterial</span>
                  <span className="tech-tag">N8AO</span>
                  <span className="tech-tag">GLTF</span>
                </div>

                <div className="card-footer">
                  <span className="play-label">{portalTranslations[lang].launchSim}</span>
                  <ArrowRight size={16} className="arrow-icon" />
                </div>
              </div>
            </BorderGlow>

            {/* Card 2: SSGI Spheres */}
            <BorderGlow
              className="demo-card card-ssgi"
              onClick={() => setCurrentView('ssgi')}
              backgroundColor={darkMode ? "rgba(18, 20, 38, 0.55)" : "rgba(255, 255, 255, 0.75)"}
              borderRadius={24}
              glowColor="340 80 70"
              colors={['#ff4060', '#ffcc00', '#ec4899']}
              glowRadius={40}
              edgeSensitivity={30}
              glowIntensity={1.2}
            >
              <div className="card-media">
                <img src="/thumbnails/ssgi-spheres.png" className="gradient-background" alt="SSGI Spheres" />
                <div className="mesh-overlay"></div>
                <div className="card-floating-badge">SSGI V2</div>
              </div>

              <div className="card-content">
                <div className="card-header-row">
                  <h2 className="card-title">{portalTranslations[lang].ssgiTitle}</h2>
                  <Activity className="card-icon" size={20} />
                </div>

                <p className="card-description">
                  {portalTranslations[lang].ssgiDesc}
                </p>

                <div className="tech-stack-row">
                  <span className="tech-tag">SSGI Raymarching</span>
                  <span className="tech-tag">Rapier</span>
                  <span className="tech-tag">Bloom Effect</span>
                  <span className="tech-tag">ToneMapping</span>
                </div>

                <div className="card-footer">
                  <span className="play-label">{portalTranslations[lang].launchSim}</span>
                  <ArrowRight size={16} className="arrow-icon" />
                </div>
              </div>
            </BorderGlow>

            {/* Card 3: Object Clump */}
            <BorderGlow
              className="demo-card card-clump"
              onClick={() => setCurrentView('clump')}
              backgroundColor={darkMode ? "rgba(18, 20, 38, 0.55)" : "rgba(255, 255, 255, 0.75)"}
              borderRadius={24}
              glowColor="270 85 75"
              colors={['#c084fc', '#f472b6', '#38bdf8']}
              glowRadius={40}
              edgeSensitivity={30}
              glowIntensity={1.2}
            >
              <div className="card-media">
                <img src="/thumbnails/object-clump.png" className="gradient-background" alt="Object Clump" />
                <div className="mesh-overlay"></div>
                <div className="card-floating-badge">N8AO + Outlines</div>
              </div>

              <div className="card-content">
                <div className="card-header-row">
                  <h2 className="card-title">{portalTranslations[lang].clumpTitle}</h2>
                  <Box className="card-icon" size={20} />
                </div>

                <p className="card-description">
                  {portalTranslations[lang].clumpDesc}
                </p>

                <div className="tech-stack-row">
                  <span className="tech-tag">Rapier Physics</span>
                  <span className="tech-tag">Drei Outlines</span>
                  <span className="tech-tag">N8AO Ambient Occlusion</span>
                  <span className="tech-tag">HDR Environment</span>
                </div>

                <div className="card-footer">
                  <span className="play-label">{portalTranslations[lang].launchSim}</span>
                  <ArrowRight size={16} className="arrow-icon" />
                </div>
              </div>
            </BorderGlow>

          </main>

          {/* Footer Info */}
          <footer className="portal-footer">
            <p>
              {portalTranslations[lang].footerText}
            </p>
            <p className="credits">
              {portalTranslations[lang].credits}
            </p>
          </footer>
        </div>
      )}

      {/* Demo View States */}
      {currentView === 'lusion' && (
        <div 
          className="canvas-wrapper animate-fade-in"
          onDoubleClick={() => setIsUIVisible(!isUIVisible)}
          style={{ cursor: isUIVisible ? 'default' : 'none' }}
        >
          <LusionConnectors onBack={handleBack} gravityEnabled={gravityEnabled} isUIVisible={isUIVisible} lang={lang} />
          
          {/* Quick HUD controls overlay */}
          {isUIVisible ? (
            <div className="top-hud-bar">
              <button className="hud-back-btn" onClick={handleBack}>
                <ArrowRight style={{ transform: 'rotate(180deg)' }} size={16} />
                <span>{portalTranslations[lang].backBtn}</span>
              </button>
              <div className="hud-title-node">{portalTranslations[lang].lusionTitle}</div>
              <button 
                className={`hud-gravity-btn ${gravityEnabled ? 'active' : ''}`}
                onClick={() => setGravityEnabled(!gravityEnabled)}
              >
                <Globe size={14} />
                <span>{gravityEnabled ? portalTranslations[lang].gravityOn : portalTranslations[lang].zeroG}</span>
              </button>
            </div>
          ) : (
            <div className="immersive-hint">
              {portalTranslations[lang].immersiveHint}
            </div>
          )}
        </div>
      )}

      {currentView === 'ssgi' && (
        <div 
          className="canvas-wrapper animate-fade-in"
          onDoubleClick={() => setIsUIVisible(!isUIVisible)}
          style={{ cursor: isUIVisible ? 'default' : 'none' }}
        >
          <SSGISpheres onBack={handleBack} gravityEnabled={gravityEnabled} isUIVisible={isUIVisible} lang={lang} />

          {/* Quick HUD controls overlay */}
          {isUIVisible ? (
            <div className="top-hud-bar">
              <button className="hud-back-btn" onClick={handleBack}>
                <ArrowRight style={{ transform: 'rotate(180deg)' }} size={16} />
                <span>{portalTranslations[lang].backBtn}</span>
              </button>
              <div className="hud-title-node">{portalTranslations[lang].ssgiTitle}</div>
              <button 
                className={`hud-gravity-btn ${gravityEnabled ? 'active' : ''}`}
                onClick={() => setGravityEnabled(!gravityEnabled)}
              >
                <Globe size={14} />
                <span>{gravityEnabled ? portalTranslations[lang].gravityOn : portalTranslations[lang].zeroG}</span>
              </button>
            </div>
          ) : (
            <div className="immersive-hint">
              {portalTranslations[lang].immersiveHint}
            </div>
          )}
        </div>
      )}

      {currentView === 'clump' && (
        <div 
          className="canvas-wrapper animate-fade-in"
          onDoubleClick={() => setIsUIVisible(!isUIVisible)}
          style={{ cursor: isUIVisible ? 'default' : 'none' }}
        >
          <ObjectClump onBack={handleBack} gravityEnabled={gravityEnabled} isUIVisible={isUIVisible} lang={lang} />

          {/* Quick HUD controls overlay */}
          {isUIVisible ? (
            <div className="top-hud-bar">
              <button className="hud-back-btn" onClick={handleBack}>
                <ArrowRight style={{ transform: 'rotate(180deg)' }} size={16} />
                <span>{portalTranslations[lang].backBtn}</span>
              </button>
              <div className="hud-title-node">{portalTranslations[lang].clumpTitle}</div>
              <button 
                className={`hud-gravity-btn ${gravityEnabled ? 'active' : ''}`}
                onClick={() => setGravityEnabled(!gravityEnabled)}
              >
                <Globe size={14} />
                <span>{gravityEnabled ? portalTranslations[lang].gravityOn : portalTranslations[lang].zeroG}</span>
              </button>
            </div>
          ) : (
            <div className="immersive-hint">
              {portalTranslations[lang].immersiveHint}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
