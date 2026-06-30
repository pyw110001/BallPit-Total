import { useEffect, useRef, useState } from 'react'

interface GestureControllerProps {
  active: boolean
  enableInteraction?: boolean
  onStatusChange?: (status: string) => void
  lang?: 'zh' | 'en'
}

const dist3D = (p1: any, p2: any) => {
  if (!p1 || !p2) return 0
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  const dz = (p1.z || 0) - (p2.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export default function GestureController({
  active,
  enableInteraction = true,
  onStatusChange,
  lang = 'zh'
}: GestureControllerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusKey, setStatusKey] = useState<'initializing' | 'ready' | 'error' | 'disabled'>('initializing')
  const [frameCount, setFrameCount] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>('Booting...')
  
  const poseRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const activeRef = useRef(active)
  const enableInteractionRef = useRef(enableInteraction)
  
  // Tracking cursor coords (smoothed via LERP)
  const cursorRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const virtualCursorDom = useRef<HTMLDivElement | null>(null)
  const frameCountRef = useRef(0)
  
  // Click states
  const isPinchedRef = useRef(false)
  const lastClickTime = useRef(0)
  
  // Scroll states
  const lastLeftWristY = useRef<number | null>(null)
  const leftWristActiveCount = useRef(0)

  // Labels
  const labels = {
    zh: {
      initializing: '正在初始化手势引擎...',
      ready: '手势控制已就绪',
      error: '摄像头开启失败或浏览器不支持',
      disabled: '手势控制已关闭'
    },
    en: {
      initializing: 'Initializing gesture engine...',
      ready: 'Gesture control ready',
      error: 'Camera access failed or unsupported',
      disabled: 'Gesture control disabled'
    }
  }

  // Sync activeRef value on every render to bypass stale closure bugs in callbacks
  useEffect(() => {
    activeRef.current = active
  }, [active])

  // Sync enableInteractionRef value on every render to bypass stale closures
  useEffect(() => {
    enableInteractionRef.current = enableInteraction
  }, [enableInteraction])

  // Sync status updates when statusKey or lang changes
  useEffect(() => {
    onStatusChange?.(labels[lang][statusKey])
  }, [statusKey, lang])

  useEffect(() => {
    let activeLocal = true
    setStatusKey('initializing')
    setDebugInfo('Script checking started...')

    // Polling to wait for MediaPipe scripts (loaded statically in index.html) to be defined on window
    const checkInterval = setInterval(() => {
      const PoseClass = (window as any).Pose
      const CameraClass = (window as any).Camera
      
      setDebugInfo(`Globals: Pose=${!!PoseClass}, Camera=${!!CameraClass}`)
      
      if (PoseClass && CameraClass) {
        clearInterval(checkInterval)
        if (activeLocal) {
          setLoaded(true)
          initializePose()
        }
      }
    }, 100)

    // Timeout check after 15 seconds if scripts fail to load
    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      if (activeLocal && (!window.hasOwnProperty('Pose') || !window.hasOwnProperty('Camera'))) {
        setError('MediaPipe loading timeout')
        setStatusKey('error')
        setDebugInfo('MediaPipe script load timeout!')
      }
    }, 15000)

    return () => {
      activeLocal = false
      clearInterval(checkInterval)
      clearTimeout(timeout)
      stopCamera()
    }
  }, [])

  // Restart camera when active state changes
  useEffect(() => {
    if (loaded && poseRef.current) {
      if (active) {
        startCamera()
        setStatusKey('ready')
      } else {
        stopCamera()
        setStatusKey('disabled')
        setFrameCount(0)
        frameCountRef.current = 0
        setDebugInfo('Gesture control disabled')
        const canvas = document.getElementById('camera-canvas') as HTMLCanvasElement
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
  }, [active, loaded])

  const stopCamera = () => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop()
        setDebugInfo('Camera stopped')
      } catch (e) {
        console.warn('Camera stop error:', e)
      }
      cameraRef.current = null
    }
    const videoElement = document.getElementById('webcam') as HTMLVideoElement
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoElement.srcObject = null
    }
  }

  const startCamera = async () => {
    if (cameraRef.current) return

    // Fetch video element directly by ID (avoiding React Ref timing race conditions)
    const videoElement = document.getElementById('webcam') as HTMLVideoElement
    if (!videoElement) {
      setDebugInfo('Webcam DOM not ready, retrying...')
      // Retry slightly later if DOM element is not mounted yet
      setTimeout(startCamera, 100)
      return
    }

    // Force programmatically muting properties to bypass React's muted attribute bug and browser autoplay restrictions
    videoElement.muted = true
    videoElement.defaultMuted = true
    videoElement.playsInline = true
    videoElement.setAttribute('muted', '')
    videoElement.setAttribute('playsinline', '')

    try {
      const CameraClass = (window as any).Camera
      if (!CameraClass) {
        setStatusKey('error')
        setDebugInfo('Camera class not found')
        return
      }

      setDebugInfo('Instantiating camera...')
      // Initialize camera directly using MediaPipe's Camera helper
      cameraRef.current = new CameraClass(videoElement, {
        onFrame: async () => {
          if (poseRef.current && activeRef.current) {
            try {
              await poseRef.current.send({ image: videoElement })
            } catch (err: any) {
              setDebugInfo(`Pose.send error: ${err.message}`)
            }
          }
        },
        width: 320,
        height: 240
      })
      
      setDebugInfo('Starting Camera...')
      await cameraRef.current.start()
      setDebugInfo('Camera started successfully!')
    } catch (err: any) {
      console.error('Camera start failed:', err)
      setError(err.message || 'Webcam error')
      setStatusKey('error')
      setDebugInfo(`Camera exception: ${err.message}`)
    }
  }

  const initializePose = () => {
    const PoseClass = (window as any).Pose
    if (!PoseClass) {
      setStatusKey('error')
      setDebugInfo('Pose class not found')
      return
    }

    try {
      const pose = new PoseClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      })

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      pose.onResults(onPoseResults)
      poseRef.current = pose
      setDebugInfo('Pose initialized successfully')

      if (active) {
        startCamera()
        setStatusKey('ready')
      } else {
        setStatusKey('disabled')
      }
    } catch (err: any) {
      setDebugInfo(`Pose init error: ${err.message}`)
      setStatusKey('error')
    }
  }

  const onPoseResults = (results: any) => {
    if (!activeRef.current) return

    // Fetch canvas directly by ID dynamically to prevent react ref timing delay bugs
    const canvas = document.getElementById('camera-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas

    // Frame counter diagnostics
    frameCountRef.current++
    if (frameCountRef.current % 5 === 0) {
      setFrameCount(frameCountRef.current)
    }
    
    // Always update debug info with frame count and landmarks presence
    setDebugInfo(`Frame: ${frameCountRef.current}, Landmarks: ${!!results.poseLandmarks}`)

    // 1. Mirror draw camera feed only
    ctx.save()
    ctx.clearRect(0, 0, width, height)
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(results.image, 0, 0, width, height)
    ctx.restore() // Restore context immediately, drawing skeleton overlay on standard coordinates

    // Landmarks array
    const landmarks = results.poseLandmarks

    // 2. Render skeleton overlays and dispatch coordinates only if landmarks detected
    if (landmarks) {
      // Only process cursor motion, clicks, and scrolling if interaction is enabled (e.g. inside an effect demo)
      if (enableInteractionRef.current) {
        // Track RIGHT_WRIST (16) for cursor positioning
        const rightWrist = landmarks[16]
        if (rightWrist && rightWrist.visibility > 0.5) {
          // Mirrored coordinates mapping
          const targetX = (1 - rightWrist.x) * window.innerWidth
          const targetY = rightWrist.y * window.innerHeight

          // Smooth cursor (LERP)
          cursorRef.current.x += (targetX - cursorRef.current.x) * 0.22
          cursorRef.current.y += (targetY - cursorRef.current.y) * 0.22

          const cx = cursorRef.current.x
          const cy = cursorRef.current.y

          // Update cursor DOM element position
          if (virtualCursorDom.current) {
            virtualCursorDom.current.style.left = `${cx}px`
            virtualCursorDom.current.style.top = `${cy}px`
          }

          // Dispatch MouseMove and PointerMove events at the target element
          const targetElement = document.elementFromPoint(cx, cy)
          if (targetElement) {
            targetElement.dispatchEvent(
              new MouseEvent('mousemove', {
                clientX: cx,
                clientY: cy,
                bubbles: true,
                cancelable: true
              })
            )
            targetElement.dispatchEvent(
              new PointerEvent('pointermove', {
                clientX: cx,
                clientY: cy,
                bubbles: true,
                cancelable: true
              })
            )
          }

          // Track RIGHT_INDEX (20), RIGHT_PINKY (18), and RIGHT_WRIST (16) for right hand fist click gesture
          const rightIndex = landmarks[20]
          const rightPinky = landmarks[18]
          const leftShoulder = landmarks[11]
          const rightShoulder = landmarks[12]

          if (rightIndex && rightPinky && leftShoulder && rightShoulder &&
              rightIndex.visibility > 0.3 && rightPinky.visibility > 0.3 &&
              leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
            
            const shoulderDist = dist3D(leftShoulder, rightShoulder)
            if (shoulderDist > 0.05) {
              const wristToIndex = dist3D(rightWrist, rightIndex)
              const wristToPinky = dist3D(rightWrist, rightPinky)
              const avgHandDist = (wristToIndex + wristToPinky) / 2.0
              const handRatio = avgHandDist / shoulderDist

              // Fist (握拳) click threshold: hand ratio drops when fingers fold in
              if (handRatio < 0.115) {
                if (!isPinchedRef.current) {
                  isPinchedRef.current = true
                  triggerClick(cx, cy)
                  if (virtualCursorDom.current) {
                    virtualCursorDom.current.classList.add('pinched')
                  }
                }
              } else if (handRatio > 0.145) {
                if (isPinchedRef.current) {
                  isPinchedRef.current = false
                  if (virtualCursorDom.current) {
                    virtualCursorDom.current.classList.remove('pinched')
                  }
                }
              }

              // Draw right hand fist indicator line on camera preview (mirror coordinates manually: 1.0 - x)
              ctx.strokeStyle = isPinchedRef.current ? 'rgba(255, 64, 96, 0.8)' : 'rgba(32, 255, 160, 0.8)'
              ctx.lineWidth = 3
              ctx.beginPath()
              ctx.moveTo((1.0 - rightWrist.x) * width, rightWrist.y * height)
              ctx.lineTo((1.0 - rightIndex.x) * width, rightIndex.y * height)
              ctx.moveTo((1.0 - rightWrist.x) * width, rightWrist.y * height)
              ctx.lineTo((1.0 - rightPinky.x) * width, rightPinky.y * height)
              ctx.stroke()
            }
          }
        }

        // Track LEFT_WRIST (15) for scroll wheel mapping
        const leftWrist = landmarks[15]
        if (leftWrist && leftWrist.visibility > 0.5) {
          if (lastLeftWristY.current !== null) {
            const deltaY = leftWrist.y - lastLeftWristY.current
            
            // Hysteresis vertical motion detection
            if (Math.abs(deltaY) > 0.015) {
              leftWristActiveCount.current++
              
              if (leftWristActiveCount.current > 1) { // Debounce slightly
                const cx = cursorRef.current.x
                const cy = cursorRef.current.y
                const targetElement = document.elementFromPoint(cx, cy)
                
                if (targetElement) {
                  // Dispatch wheel scroll event (scale deltaY for zoom effect)
                  targetElement.dispatchEvent(
                    new WheelEvent('wheel', {
                      deltaY: deltaY * 2500,
                      bubbles: true,
                      cancelable: true
                    })
                  )
                }
              }
            } else {
              leftWristActiveCount.current = 0
            }
          }
          lastLeftWristY.current = leftWrist.y
        } else {
          lastLeftWristY.current = null
          leftWristActiveCount.current = 0
        }
      }

      // Draw skeletal indicators in the preview window (always draw skeleton to let user see status)
      drawSkeleton(ctx, landmarks, width, height)
    }
  }

  const triggerClick = (cx: number, cy: number) => {
    const targetElement = document.elementFromPoint(cx, cy)
    if (!targetElement) return

    // Dispatch pointerdown & mousedown
    targetElement.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }))
    targetElement.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }))

    setTimeout(() => {
      // Dispatch pointerup & mouseup
      targetElement.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }))
      targetElement.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true }))
      
      // Dispatch click
      targetElement.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }))

      // Double-click check
      const now = Date.now()
      if (now - lastClickTime.current < 350) {
        targetElement.dispatchEvent(new MouseEvent('dblclick', { clientX: cx, clientY: cy, bubbles: true }))
      }
      lastClickTime.current = now
    }, 40)
  }

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any, w: number, h: number) => {
    const drawPoint = (landmark: any, color: string, radius = 5) => {
      if (!landmark || landmark.visibility < 0.5) return
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc((1.0 - landmark.x) * w, landmark.y * h, radius, 0, 2 * Math.PI)
      ctx.fill()
    }

    const drawLine = (ptA: any, ptB: any, color: string, width = 2) => {
      if (!ptA || !ptB || ptA.visibility < 0.5 || ptB.visibility < 0.5) return
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo((1.0 - ptA.x) * w, ptA.y * h)
      ctx.lineTo((1.0 - ptB.x) * w, ptB.y * h)
      ctx.stroke()
    }

    // Connectors
    // Shoulders (11 - 12)
    drawLine(landmarks[11], landmarks[12], 'rgba(255, 255, 255, 0.4)')
    // Right arm (12 - 14 - 16)
    drawLine(landmarks[12], landmarks[14], 'rgba(99, 102, 241, 0.5)')
    drawLine(landmarks[14], landmarks[16], 'rgba(99, 102, 241, 0.8)', 3)
    // Left arm (11 - 13 - 15)
    drawLine(landmarks[11], landmarks[13], 'rgba(168, 85, 247, 0.5)')
    drawLine(landmarks[13], landmarks[15], 'rgba(168, 85, 247, 0.8)', 3)

    // Hand components (Fist tracking: wrist 16, index 20, pinky 18)
    drawPoint(landmarks[16], '#3b82f6', 6)  // Right Wrist (Blue)
    drawPoint(landmarks[20], '#10b981', 5)  // Right Index (Green)
    drawPoint(landmarks[18], '#f59e0b', 5)  // Right Pinky (Orange)

    // Left wrist
    drawPoint(landmarks[15], '#a855f7', 6)  // Left Wrist (Purple)
  }

  return (
    <>
      {/* Floating webcam skeletal preview canvas */}
      <div 
        className="gesture-camera-preview animate-fade-in" 
        style={{ 
          position: 'fixed',
          display: active ? 'flex' : 'none'
        }}
      >
        {/* Debug Overlay Panel */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#10b981',
          fontSize: '9px',
          fontFamily: 'monospace',
          padding: '6px 10px',
          borderRadius: '6px',
          pointerEvents: 'none',
          wordBreak: 'break-all',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 20
        }}>
          {debugInfo}
        </div>
        <canvas
          id="camera-canvas"
          width={200}
          height={150}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        <div className="preview-indicator">
          <span className="pulse-dot"></span>
          <span>LIVE GESTURE {frameCount > 0 ? `(${frameCount})` : '(CONNECTING)'}</span>
        </div>
      </div>

      {/* Floating gesture instructions card */}
      <div
        className="gesture-instructions-card animate-fade-in"
        style={{
          position: 'fixed',
          top: '242px',
          right: '20px',
          width: '200px',
          zIndex: 1000,
          background: 'rgba(8, 9, 20, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(12px)',
          color: '#e2e8f0',
          fontSize: '10px',
          fontFamily: 'sans-serif',
          lineHeight: '1.5',
          pointerEvents: 'none',
          display: active ? 'block' : 'none'
        }}
      >
        <div style={{ 
          fontWeight: 'bold', 
          color: '#a5b4fc', 
          marginBottom: '6px', 
          fontSize: '11px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '4px',
          letterSpacing: '0.5px'
        }}>
          {lang === 'zh' ? '手势操作指南' : 'Gesture Guide'}
        </div>
        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
          <li style={{ marginBottom: '6px' }}>
            <span style={{ color: '#6366f1', fontWeight: 'bold' }}>👉 {lang === 'zh' ? '右手腕' : 'Right Wrist'}</span>: {lang === 'zh' ? '控制光标移动' : 'Move cursor'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✊ 右手握拳</span>: {lang === 'zh' ? '鼠标左键点击' : 'Mouse Click'}
          </li>
          <li style={{ marginBottom: '6px' }}>
            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>✋ {lang === 'zh' ? '左手上下' : 'Left Up/Down'}</span>: {lang === 'zh' ? '滚轮缩放视角' : 'Scroll to Zoom'}
          </li>
        </ul>
        <div style={{ 
          marginTop: '6px', 
          fontSize: '8.5px', 
          color: '#94a3b8', 
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '4px',
          fontStyle: 'italic'
        }}>
          {lang === 'zh' ? '* 交互仅在演示场景内生效' : '* Cursor active inside simulations only'}
        </div>
      </div>

      {/* Custom Virtual Hand Cursor */}
      <div
        ref={virtualCursorDom}
        className="gesture-virtual-cursor"
        style={{
          display: (active && enableInteraction) ? 'block' : 'none'
        }}
      >
        <div className="cursor-ring"></div>
        <div className="cursor-dot"></div>
      </div>
    </>
  )
}
