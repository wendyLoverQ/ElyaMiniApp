const VIEWPORT = Object.freeze({ width: 480, height: 360 })
const SPEED_MIN = 0
const SPEED_MAX = 160
const MOTION_SLICE_MS = 1200

const pet = document.querySelector('#pet')
if (!(pet instanceof HTMLElement)) throw new Error('Pelican Mini APP root is missing')

let rideSpeed = 72
let autoRide = true
let direction = 1
let active = true
let motionRevision = 0

// 车速同时控制宿主位移和 SVG 踩踏周期，避免角色动作与真实移动脱节。
// 开发：Codex / GPT / gpt-5
function applyVisualSpeed() {
  const moving = active && autoRide && rideSpeed > 0
  const duration = moving ? Math.max(0.32, Math.min(1.6, 72 / rideSpeed)) : 1
  pet.style.setProperty('--cycle-duration', `${duration}s`)
  pet.style.setProperty('--direction', String(direction))
  pet.classList.toggle('stopped', !moving)
}

function setRuntimeFailure(failed) {
  pet.classList.toggle('has-error', failed)
}

function isPlacementUnavailable(error) {
  return error instanceof Error && (
    error.code === 'WEB_PET_PLACEMENT_DENIED' ||
    error.code === 'WEB_PET_PLACEMENT_TIMEOUT' ||
    error.code === 'WEB_PET_PLACEMENT_INVALID'
  )
}

async function stopHostMotion(runtime) {
  if (!runtime.placement) return
  try {
    await runtime.placement.stopMotion()
  } catch (error) {
    setRuntimeFailure(true)
    console.error('[pelican-bike] failed to stop host motion', error)
  }
}

// 每段移动都由 C# PlatformPort 的宿主位置能力解析和裁剪；APP 只提交相对位移，
// 并依据返回的 Win32 edgeDistances 掉头，不读取 DOM 或 Electron 绝对坐标。
// 开发：Codex / GPT / gpt-5
async function runMotion(runtime, revision) {
  while (active && autoRide && rideSpeed > 0 && revision === motionRevision) {
    if (!runtime.placement) {
      setRuntimeFailure(true)
      return
    }

    const duration = MOTION_SLICE_MS
    const distance = direction * rideSpeed * duration / 1000
    try {
      const state = await runtime.placement.animateBy({
        x: distance,
        y: 0,
        duration,
        easing: 'linear'
      })
      setRuntimeFailure(false)
      const edgeDistance = direction > 0 ? state.edgeDistances.right : state.edgeDistances.left
      if (edgeDistance <= 1) {
        direction *= -1
        applyVisualSpeed()
      }
    } catch (error) {
      if (revision !== motionRevision) return
      setRuntimeFailure(true)
      console.error('[pelican-bike] host-managed ride failed', error)
      if (isPlacementUnavailable(error)) return
      return
    }
  }
}

function restartMotion(runtime) {
  motionRevision += 1
  const revision = motionRevision
  applyVisualSpeed()
  void stopHostMotion(runtime).finally(() => {
    if (revision === motionRevision) void runMotion(runtime, revision)
  })
}

const runtime = window.elyaPet
if (runtime) {
  // 多个椭圆和多边形近似可见 SVG 轮廓，避免整个 480×360 viewport 拦截透明区域。
  // 开发：Codex / GPT / gpt-5
  runtime.setInteractionSurface({
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    regions: [
      { shape: 'ellipse', action: 'drag', x: 73, y: 187, width: 132, height: 132, hostGestures: ['move', 'scale-wheel', 'scale-hold'] },
      { shape: 'ellipse', action: 'drag', x: 281, y: 187, width: 132, height: 132, hostGestures: ['move', 'scale-wheel', 'scale-hold'] },
      { shape: 'ellipse', action: 'drag', x: 102, y: 99, width: 165, height: 101, hostGestures: ['move', 'scale-wheel', 'scale-hold'] },
      { shape: 'ellipse', action: 'drag', x: 217, y: 16, width: 108, height: 158, hostGestures: ['move', 'scale-wheel', 'scale-hold'] },
      { shape: 'polygon', action: 'drag', points: [
        { x: 298, y: 50 }, { x: 466, y: 64 }, { x: 451, y: 82 }, { x: 415, y: 101 }, { x: 343, y: 116 }, { x: 306, y: 95 }
      ], hostGestures: ['move', 'scale-wheel', 'scale-hold'] }
    ]
  })
  runtime.setBubbleAnchor({ x: 281, y: 27 })

  runtime.onSettingsChange((settings) => {
    let changed = false
    if (typeof settings.rideSpeed === 'number' && Number.isFinite(settings.rideSpeed) && settings.rideSpeed >= SPEED_MIN && settings.rideSpeed <= SPEED_MAX) {
      changed ||= settings.rideSpeed !== rideSpeed
      rideSpeed = settings.rideSpeed
    }
    if (typeof settings.autoRide === 'boolean') {
      changed ||= settings.autoRide !== autoRide
      autoRide = settings.autoRide
    }
    if (changed) restartMotion(runtime)
  })

  runtime.onLifecycle((state) => {
    if (state.type === 'hidden' || state.type === 'paused') {
      active = false
      motionRevision += 1
      applyVisualSpeed()
      void stopHostMotion(runtime)
    } else if (state.type === 'shown' || state.type === 'resumed') {
      active = true
      restartMotion(runtime)
    }
  })

  runtime.onDispose(() => {
    active = false
    motionRevision += 1
    void stopHostMotion(runtime)
  })

  restartMotion(runtime)
} else {
  applyVisualSpeed()
}
