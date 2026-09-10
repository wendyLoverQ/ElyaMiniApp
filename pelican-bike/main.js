const SPEED_MIN = 0
const SPEED_MAX = 160
const MOTION_SLICE_MS = 1200

const pet = document.querySelector('#pet')
if (!(pet instanceof HTMLElement)) throw new Error('Pelican Mini APP root is missing')

let rideSpeed = 72
let autoRide = true
let direction = 1
let active = true
let dragging = false
let motionRevision = 0

// 车速同时控制宿主位移和 SVG 踩踏周期，避免角色动作与真实移动脱节。
// 开发：Codex / GPT / gpt-5
function applyVisualSpeed() {
  const moving = active && !dragging && autoRide && rideSpeed > 0
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
  while (active && !dragging && autoRide && rideSpeed > 0 && revision === motionRevision) {
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
  // SVG 可见部件使用 data-elya-hit 交给 Runtime 自动采集，命中面与真实 DOM 保持一致。
  // 开发：Codex / GPT / gpt-5
  runtime.setInteractionSurface(null)
  runtime.invalidateInteractionSurface()
  runtime.setBubbleAnchor({ x: 281, y: 27 })

  // 宿主拖动时暂停自动骑行，避免 placement 动画在拖动过程中抢回窗口位置；松手后续骑。
  // 开发：Codex / GPT / gpt-5
  runtime.onDragGesture((event) => {
    if (event.phase === 'start') {
      dragging = true
      motionRevision += 1
      applyVisualSpeed()
      void stopHostMotion(runtime)
      return
    }
    if (event.phase === 'end') {
      dragging = false
      restartMotion(runtime)
    }
  })

  runtime.onSettingsChange((settings) => {
    let hasRuntimeSettings = false
    if (typeof settings.rideSpeed === 'number' && Number.isFinite(settings.rideSpeed) && settings.rideSpeed >= SPEED_MIN && settings.rideSpeed <= SPEED_MAX) {
      rideSpeed = settings.rideSpeed
      hasRuntimeSettings = true
    }
    if (typeof settings.autoRide === 'boolean') {
      autoRide = settings.autoRide
      hasRuntimeSettings = true
    }
    // 握手后的完整 settings 快照即使等于 manifest 默认值，也必须启动首次移动；
    // 握手前的空快照不触发 placement。开发：Codex / GPT / gpt-5
    if (hasRuntimeSettings) restartMotion(runtime)
  })

  runtime.onLifecycle((state) => {
    if (state.type === 'hidden' || state.type === 'paused') {
      active = false
      dragging = false
      motionRevision += 1
      applyVisualSpeed()
      void stopHostMotion(runtime)
    } else if (state.type === 'shown' || state.type === 'resumed') {
      active = true
      dragging = false
      restartMotion(runtime)
    }
  })

  runtime.onDispose(() => {
    active = false
    dragging = false
    motionRevision += 1
    void stopHostMotion(runtime)
  })
} else {
  applyVisualSpeed()
}
