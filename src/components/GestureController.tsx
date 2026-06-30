import { useEffect, useRef, useState } from 'react'

interface GestureControllerProps {
  active: boolean
  onStatusChange?: (status: string) => void
  lang?: 'zh' | 'en'
}

export default function GestureController({
  active,
  onStatusChange,
  lang = 'zh'
}: GestureControllerProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusKey, setStatusKey] = useState<'initializing' | 'ready' | 'error' | 'disabled'>('initializing')
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const poseRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  
  // Tracking cursor coords (smoothed via LERP)
  const cursorRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const virtualCursorDom = useRef<HTMLDivElement | null>(null)
  
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

  // Sync status updates when statusKey or lang changes
  useEffect(() => {
    onStatusChange?.(labels[lang][statusKey])
  }, [statusKey, lang])

  // Helper to load CDN scripts and check for global object definition (handles strict mode double mount)
  const loadScript = (src: string, globalName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any)[globalName]) {
        resolve()
        return
      }
      
      const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement
      if (existingScript) {
        // If script is already inserted, check if/when the global becomes available
        const interval = setInterval(() => {
          if ((window as any)[globalName]) {
            clearInterval(interval)
            resolve()
          }
        }, 50)
        setTimeout(() => {
          clearInterval(interval)
          if ((window as any)[globalName]) {
            resolve()
          } else {
            reject(new Error(`Timeout waiting for ${globalName}`))
          }
        }, 15000)
        return
      }
      
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.crossOrigin = 'anonymous'
      script.onload = () => {
        const interval = setInterval(() => {
          if ((window as any)[globalName]) {
            clearInterval(interval)
            resolve()
          }
        }, 20)
        setTimeout(() => {
          clearInterval(interval)
          if ((window as any)[globalName]) {
            resolve()
          } else {
            reject(new Error(`Failed to initialize global ${globalName}`))
          }
        }, 5000)
      }
      script.onerror = () => reject(new Error(`Failed to load script ${src}`))
      document.head.appendChild(script)
    })
  }

  useEffect(() => {
    let activeLocal = true
    setStatusKey('initializing')
    
    // Load MediaPipe scripts dynamically
    Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js', 'Camera'),
      loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js', 'Pose')
    ])
      .then(() => {
        if (!activeLocal) return
        setLoaded(true)
        initializePose()
      })
      .catch((err) => {
        if (!activeLocal) return
        console.error(err)
        setError(err.message)
        setStatusKey('error')
      })

    return () => {
      activeLocal = false
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
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
    }
  }, [active, loaded])

  const stopCamera = () => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop()
      } catch (e) {
        console.warn('Camera stop error:', e)
      }
      cameraRef.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const startCamera = () => {
    if (cameraRef.current) return

    const videoElement = videoRef.current
    if (!videoElement) return

    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240, frameRate: { ideal: 30 } } })
      .then((stream) => {
        videoElement.srcObject = stream
        videoElement.play().then(() => {
          const CameraClass = (window as any).Camera
          if (!CameraClass) return

          cameraRef.current = new CameraClass(videoElement, {
            onFrame: async () => {
              if (poseRef.current && active) {
                await poseRef.current.send({ image: videoElement })
              }
            },
            width: 320,
            height: 240
          })
          cameraRef.current.start()
        })
      })
      .catch((err) => {
        console.error('Webcam error:', err)
        setError(err.message || 'Webcam error')
        setStatusKey('error')
      })
  }

  const initializePose = () => {
    const PoseClass = (window as any).Pose
    if (!PoseClass) {
      setStatusKey('error')
      return
    }

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

    if (active) {
      startCamera()
      setStatusKey('ready')
    } else {
      setStatusKey('disabled')
    }
  }

  const onPoseResults = (results: any) => {
    if (!active || !canvasRef.current || !results.poseLandmarks) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas

    // 1. Draw mirrored webcam image
    ctx.save()
    ctx.clearRect(0, 0, width, height)
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(results.image, 0, 0, width, height)

    // Landmarks array
    const landmarks = results.poseLandmarks

    // 2. Track RIGHT_WRIST (16) for cursor positioning
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

      // 3. Track right index (19) and right thumb (21) for click pinch gesture
      const rightIndex = landmarks[19]
      const rightThumb = landmarks[21]

      if (rightIndex && rightThumb && rightIndex.visibility > 0.4 && rightThumb.visibility > 0.4) {
        const dx = rightIndex.x - rightThumb.x
        const dy = rightIndex.y - rightThumb.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Hysteresis click threshold
        if (dist < 0.035) {
          if (!isPinchedRef.current) {
            isPinchedRef.current = true
            triggerClick(cx, cy)
            if (virtualCursorDom.current) {
              virtualCursorDom.current.classList.add('pinched')
            }
          }
        } else if (dist > 0.055) {
          if (isPinchedRef.current) {
            isPinchedRef.current = false
            if (virtualCursorDom.current) {
              virtualCursorDom.current.classList.remove('pinched')
            }
          }
        }

        // Draw indicator line on camera preview
        ctx.strokeStyle = isPinchedRef.current ? 'rgba(255, 64, 96, 0.8)' : 'rgba(32, 255, 160, 0.8)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(rightIndex.x * width, rightIndex.y * height)
        ctx.lineTo(rightThumb.x * width, rightThumb.y * height)
        ctx.stroke()
      }
    }

    // 4. Track LEFT_WRIST (15) for scroll wheel mapping
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

    // 5. Draw skeletal indicators in the preview window (mirrored)
    drawSkeleton(ctx, landmarks, width, height)
    
    ctx.restore()
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
      ctx.arc(landmark.x * w, landmark.y * h, radius, 0, 2 * Math.PI)
      ctx.fill()
    }

    const drawLine = (ptA: any, ptB: any, color: string, width = 2) => {
      if (!ptA || !ptB || ptA.visibility < 0.5 || ptB.visibility < 0.5) return
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(ptA.x * w, ptA.y * h)
      ctx.lineTo(ptB.x * w, ptB.y * h)
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

    // Hand components
    // Right wrist & finger tips
    drawPoint(landmarks[16], '#3b82f6', 6)  // Right Wrist (Blue)
    drawPoint(landmarks[19], '#10b981', 5)  // Right Index (Green)
    drawPoint(landmarks[21], '#f59e0b', 5)  // Right Thumb (Orange)

    // Left wrist
    drawPoint(landmarks[15], '#a855f7', 6)  // Left Wrist (Purple)
  }

  return (
    <>
      {/* Hidden capturing video stream */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        autoplay
        playsinline
        muted
      />

      {/* Floating webcam skeletal preview canvas */}
      {active && (
        <div className="gesture-camera-preview animate-fade-in">
          <canvas
            ref={canvasRef}
            width={200}
            height={150}
          />
          <div className="preview-indicator">
            <span className="pulse-dot"></span>
            <span>LIVE GESTURE</span>
          </div>
        </div>
      )}

      {/* Custom Virtual Hand Cursor */}
      {active && (
        <div
          ref={virtualCursorDom}
          className="gesture-virtual-cursor"
        >
          <div className="cursor-ring"></div>
          <div className="cursor-dot"></div>
        </div>
      )}
    </>
  )
}
