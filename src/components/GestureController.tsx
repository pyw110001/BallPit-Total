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
  const [frameCount, setFrameCount] = useState(0)
  
  const poseRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  
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

  // Sync status updates when statusKey or lang changes
  useEffect(() => {
    onStatusChange?.(labels[lang][statusKey])
  }, [statusKey, lang])

  useEffect(() => {
    let activeLocal = true
    setStatusKey('initializing')

    // Polling to wait for MediaPipe scripts (loaded statically in index.html) to be defined on window
    const checkInterval = setInterval(() => {
      const PoseClass = (window as any).Pose
      const CameraClass = (window as any).Camera
      
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
      // Retry slightly later if DOM element is not mounted yet
      setTimeout(startCamera, 100)
      return
    }

    try {
      const CameraClass = (window as any).Camera
      if (!CameraClass) {
        setStatusKey('error')
        return
      }

      // Initialize camera directly using MediaPipe's Camera helper
      cameraRef.current = new CameraClass(videoElement, {
        onFrame: async () => {
          if (poseRef.current && active) {
            await poseRef.current.send({ image: videoElement })
          }
        },
        width: 320,
        height: 240
      })
      await cameraRef.current.start()
    } catch (err: any) {
      console.error('Camera start failed:', err)
      setError(err.message || 'Webcam error')
      setStatusKey('error')
    }
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
    if (!active) return

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

    // 1. Mirror draw camera feed only
    ctx.save()
    ctx.clearRect(0, 0, width, height)
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(results.image, 0, 0, width, height)
    ctx.restore() // Restore context immediately, drawing skeleton overlay on standard coordinates

    // Landmarks array
    const landmarks = results.poseLandmarks

    // 2. Render skeleton overlays on normal coordinates using manual flipped mapping (1.0 - x)
    if (landmarks) {
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

          // Draw indicator line on camera preview (mirror coordinates manually: 1.0 - x)
          ctx.strokeStyle = isPinchedRef.current ? 'rgba(255, 64, 96, 0.8)' : 'rgba(32, 255, 160, 0.8)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo((1.0 - rightIndex.x) * width, rightIndex.y * height)
          ctx.lineTo((1.0 - rightThumb.x) * width, rightThumb.y * height)
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

      // 5. Draw skeletal indicators in the preview window (mirrored coordinates manually: 1.0 - x)
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
      {/* Hidden capturing video stream styled to ensure browser always processes frames */}
      <video
        id="webcam"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        autoPlay
        playsInline
        muted
      />

      {/* Floating webcam skeletal preview canvas */}
      {active && (
        <div className="gesture-camera-preview animate-fade-in">
          <canvas
            id="camera-canvas"
            width={200}
            height={150}
          />
          <div className="preview-indicator">
            <span className="pulse-dot"></span>
            <span>LIVE GESTURE {frameCount > 0 ? `(${frameCount})` : '(CONNECTING)'}</span>
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
