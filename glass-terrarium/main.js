const WIDTH = 420
const HEIGHT = 500
const STATE_KEY = 'terrarium-state-v2'
const STATE_VERSION = 2
const HOUR_MS = 60 * 60 * 1000
const SAVE_INTERVAL_MS = 30_000

const canvas = document.querySelector('#scene')
const root = document.querySelector('#terrarium')
const waterControl = document.querySelector('#water-control')

if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Terrarium canvas is missing')
if (!(root instanceof HTMLElement)) throw new Error('Terrarium root is missing')
if (!(waterControl instanceof HTMLButtonElement)) throw new Error('Terrarium water control is missing')

const context = canvas.getContext('2d')
if (!context) throw new Error('Terrarium 2D context is unavailable')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const runtime = window.elyaPet
const baseImage = new Image()
baseImage.decoding = 'async'
baseImage.src = 'terrarium-base-v2.png'

const settings = { lighting: 'auto', growthSpeed: 1, fireflies: 8, condensation: true }
const state = { version: STATE_VERSION, growth: 0.72, moisture: 0.74, wateredCount: 0, updatedAt: Date.now() }

const fireflies = [
  [244, 166, 0.2], [274, 213, 1.4], [222, 238, 2.5], [302, 269, 3.1],
  [188, 286, 4.3], [265, 316, 5.5], [320, 340, 0.8], [152, 245, 2.1],
  [238, 361, 3.7], [127, 304, 5.1], [285, 382, 1.8], [173, 196, 4.8],
  [336, 231, 2.8], [204, 330, 0.5], [145, 352, 3.3], [307, 173, 5.8]
]
const glassDrops = [
  [93, 178, 2.1], [114, 222, 1.3], [83, 286, 2.8], [103, 337, 1.7],
  [341, 198, 2.5], [356, 246, 1.5], [348, 311, 2.2], [327, 355, 1.2],
  [126, 147, 1.2], [318, 151, 1.4], [142, 265, 1], [332, 280, 1.1]
]

let active = true
let imageReady = false
let animationFrame = 0
let lastFrameAt = performance.now()
let lastSaveAt = performance.now()
let wateringStartedAt = -Infinity
let storageReady = false

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function configureCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(WIDTH * ratio)
  canvas.height = Math.round(HEIGHT * ratio)
  canvas.style.width = `${WIDTH}px`
  canvas.style.height = `${HEIGHT}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function getNightMix() {
  if (settings.lighting === 'day') return 0
  if (settings.lighting === 'night') return 1
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  if (hour >= 7 && hour <= 17) return 0
  if (hour > 17 && hour < 21) return (hour - 17) / 4
  if (hour > 5 && hour < 7) return (7 - hour) / 2
  return 1
}

function drawAmbientShadow(ctx) {
  const shadow = ctx.createRadialGradient(214, 474, 10, 214, 474, 154)
  shadow.addColorStop(0, 'rgba(8, 21, 18, 0.3)')
  shadow.addColorStop(0.58, 'rgba(8, 21, 18, 0.12)')
  shadow.addColorStop(1, 'rgba(8, 21, 18, 0)')
  ctx.save()
  ctx.fillStyle = shadow
  ctx.scale(1, 0.12)
  ctx.beginPath()
  ctx.arc(214, 3950, 154, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBase(ctx, nightMix) {
  if (!imageReady) return
  ctx.drawImage(baseImage, 0, 0, WIDTH, HEIGHT)
  if (nightMix > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    const night = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    night.addColorStop(0, `rgba(8, 31, 39, ${nightMix * 0.12})`)
    night.addColorStop(0.55, `rgba(3, 28, 35, ${nightMix * 0.22})`)
    night.addColorStop(1, `rgba(2, 18, 24, ${nightMix * 0.3})`)
    ctx.fillStyle = night
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.restore()
  }
}

function drawHumidity(ctx, time, nightMix) {
  const amount = clamp((state.moisture - 0.22) / 0.78, 0, 1)
  if (amount <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(220, 275, 153, 184, 0, 0, Math.PI * 2)
  ctx.clip()
  const drift = reducedMotion ? 0 : Math.sin(time * 0.00016) * 13
  const mist = ctx.createRadialGradient(180 + drift, 245, 8, 204 + drift, 270, 155)
  mist.addColorStop(0, `rgba(183, 230, 211, ${amount * (0.035 + nightMix * 0.018)})`)
  mist.addColorStop(0.62, `rgba(101, 171, 157, ${amount * 0.022})`)
  mist.addColorStop(1, 'rgba(80, 135, 128, 0)')
  ctx.fillStyle = mist
  ctx.fillRect(52, 92, 326, 370)
  ctx.restore()
}

function drawFireflies(ctx, time, nightMix) {
  const count = Math.round(settings.fireflies)
  const visibility = 0.26 + nightMix * 0.74
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  fireflies.slice(0, count).forEach(([originX, originY, phase], index) => {
    const travel = reducedMotion ? 0 : 7 + (index % 3) * 2
    const x = originX + Math.sin(time * 0.00031 + phase) * travel
    const y = originY + Math.cos(time * 0.00024 + phase * 1.7) * travel * 0.64
    const pulse = reducedMotion ? 0.68 : 0.28 + 0.72 * Math.pow((Math.sin(time * 0.002 + phase) + 1) / 2, 2)
    const alpha = pulse * visibility
    const radius = 9 + (index % 4) * 1.7
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(255, 249, 193, ${alpha})`)
    glow.addColorStop(0.18, `rgba(255, 215, 92, ${alpha * 0.8})`)
    glow.addColorStop(1, 'rgba(232, 177, 55, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 252, 214, ${alpha * 0.95})`
    ctx.beginPath()
    ctx.arc(x, y, 1.1, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

function drawCondensation(ctx, time) {
  if (!settings.condensation) return
  const amount = clamp((state.moisture - 0.28) / 0.72, 0, 1)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(210, 298, 143, 183, 0, 0, Math.PI * 2)
  ctx.clip()
  glassDrops.forEach(([x, originY, radius], index) => {
    const slide = reducedMotion ? 0 : ((time * (0.001 + index * 0.000014) + index * 11) % 18)
    const y = originY + slide
    const drop = ctx.createRadialGradient(x - radius * 0.45, y - radius * 0.6, 0, x, y, radius * 1.6)
    drop.addColorStop(0, `rgba(255, 255, 255, ${amount * 0.66})`)
    drop.addColorStop(0.34, `rgba(197, 238, 229, ${amount * 0.24})`)
    drop.addColorStop(1, 'rgba(72, 134, 132, 0)')
    ctx.fillStyle = drop
    ctx.beginPath()
    ctx.ellipse(x, y, radius, radius * 1.38, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

function drawNewGrowth(ctx, time) {
  const reveal = clamp((state.growth - 0.55) / 0.45, 0, 1)
  if (reveal <= 0) return
  const sway = reducedMotion ? 0 : Math.sin(time * 0.0007) * 1.8
  ctx.save()
  ctx.globalAlpha = reveal * 0.84
  ctx.strokeStyle = 'rgba(112, 164, 91, 0.9)'
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(239, 408)
  ctx.bezierCurveTo(243, 391, 248 + sway, 377, 260 + sway, 363)
  ctx.stroke()
  for (let index = 0; index < 5; index += 1) {
    const progress = (index + 1) / 6
    const x = 239 + progress * 21 + sway * progress
    const y = 408 - progress * 44
    const size = (3.5 + progress * 2.2) * reveal
    ctx.fillStyle = index % 2 === 0 ? 'rgba(126, 177, 102, 0.82)' : 'rgba(88, 145, 79, 0.86)'
    ctx.beginPath()
    ctx.ellipse(x - size * 0.8, y, size * 1.4, size * 0.68, -0.6, 0, Math.PI * 2)
    ctx.ellipse(x + size * 0.8, y - 2, size * 1.4, size * 0.68, 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWatering(ctx, time) {
  const elapsed = time - wateringStartedAt
  if (elapsed < 0 || elapsed > 2800) return
  const settle = clamp(elapsed / 2800, 0, 1)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const valvePulse = ctx.createRadialGradient(317, 104, 2, 317, 104, 28)
  valvePulse.addColorStop(0, `rgba(129, 239, 225, ${(1 - settle) * 0.72})`)
  valvePulse.addColorStop(0.32, `rgba(61, 199, 190, ${(1 - settle) * 0.35})`)
  valvePulse.addColorStop(1, 'rgba(61, 199, 190, 0)')
  ctx.fillStyle = valvePulse
  ctx.beginPath()
  ctx.arc(317, 104, 28, 0, Math.PI * 2)
  ctx.fill()
  for (let index = 0; index < 32; index += 1) {
    const delay = index * 34
    const progress = clamp((elapsed - delay) / 1050, 0, 1)
    if (progress <= 0 || progress >= 1) continue
    const originX = 170 + ((index * 47) % 145)
    const x = originX + Math.sin(index * 2.3) * 8 * progress
    const y = 126 + progress * (218 + (index % 5) * 9)
    const alpha = Math.sin(progress * Math.PI) * 0.72
    ctx.strokeStyle = `rgba(168, 232, 221, ${alpha})`
    ctx.lineWidth = 0.8 + (index % 3) * 0.35
    ctx.beginPath()
    ctx.moveTo(x, y - 7)
    ctx.quadraticCurveTo(x - 1.5, y, x, y + 4)
    ctx.stroke()
  }
  ctx.restore()
}

function render(time) {
  context.clearRect(0, 0, WIDTH, HEIGHT)
  const nightMix = getNightMix()
  drawAmbientShadow(context)
  drawBase(context, nightMix)
  drawHumidity(context, time, nightMix)
  drawNewGrowth(context, time)
  drawFireflies(context, time, nightMix)
  drawWatering(context, time)
  drawCondensation(context, time)
}

function updateState(deltaSeconds) {
  const healthy = clamp((state.moisture - 0.18) / 0.54, 0, 1)
  state.growth = clamp(state.growth + deltaSeconds * 0.0000042 * settings.growthSpeed * healthy, 0.55, 1)
  state.moisture = clamp(state.moisture - deltaSeconds * 0.0000028, 0.08, 1)
}

function frame(time) {
  if (!active) return
  const deltaSeconds = Math.min(0.1, Math.max(0, (time - lastFrameAt) / 1000))
  lastFrameAt = time
  updateState(deltaSeconds)
  render(time)
  if (runtime && storageReady && time - lastSaveAt >= SAVE_INTERVAL_MS) {
    lastSaveAt = time
    void saveState()
  }
  animationFrame = window.requestAnimationFrame(frame)
}

function applyElapsedTime(savedAt) {
  const elapsedHours = clamp((Date.now() - savedAt) / HOUR_MS, 0, 24 * 30)
  const healthy = clamp((state.moisture - 0.18) / 0.54, 0, 1)
  state.growth = clamp(state.growth + elapsedHours * 0.015 * settings.growthSpeed * healthy, 0.55, 1)
  state.moisture = clamp(state.moisture - elapsedHours * 0.018, 0.08, 1)
  state.updatedAt = Date.now()
}

function isCurrentState(value) {
  return Boolean(value && typeof value === 'object' && value.version === STATE_VERSION &&
    typeof value.growth === 'number' && Number.isFinite(value.growth) && value.growth >= 0.55 && value.growth <= 1 &&
    typeof value.moisture === 'number' && Number.isFinite(value.moisture) && value.moisture >= 0.08 && value.moisture <= 1 &&
    typeof value.wateredCount === 'number' && Number.isInteger(value.wateredCount) && value.wateredCount >= 0 &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0)
}

async function loadState() {
  if (!runtime) return
  try {
    const saved = await runtime.storage.get(STATE_KEY)
    if (saved !== undefined) {
      if (!isCurrentState(saved)) throw new Error('Stored terrarium state does not match version 2')
      state.growth = saved.growth
      state.moisture = saved.moisture
      state.wateredCount = saved.wateredCount
      state.updatedAt = saved.updatedAt
      applyElapsedTime(saved.updatedAt)
    }
    storageReady = true
    root.classList.remove('has-storage-error')
  } catch (error) {
    storageReady = false
    root.classList.add('has-storage-error')
    console.error('[glass-terrarium] failed to load state', error)
  }
}

async function saveState() {
  if (!runtime || !storageReady) return
  state.updatedAt = Date.now()
  try {
    await runtime.storage.set(STATE_KEY, { version: STATE_VERSION, growth: state.growth, moisture: state.moisture, wateredCount: state.wateredCount, updatedAt: state.updatedAt })
    root.classList.remove('has-storage-error')
  } catch (error) {
    root.classList.add('has-storage-error')
    console.error('[glass-terrarium] failed to save state', error)
  }
}

function waterTerrarium() {
  state.moisture = clamp(state.moisture + 0.28, 0.08, 1)
  state.wateredCount += 1
  wateringStartedAt = performance.now()
  waterControl.classList.add('is-watering')
  window.setTimeout(() => waterControl.classList.remove('is-watering'), 680)
  void saveState()
}

function applySettings(snapshot) {
  if (snapshot.lighting === 'auto' || snapshot.lighting === 'day' || snapshot.lighting === 'night') settings.lighting = snapshot.lighting
  if (typeof snapshot.growthSpeed === 'number' && Number.isFinite(snapshot.growthSpeed)) settings.growthSpeed = clamp(snapshot.growthSpeed, 0.25, 3)
  if (typeof snapshot.fireflies === 'number' && Number.isFinite(snapshot.fireflies)) settings.fireflies = clamp(Math.round(snapshot.fireflies), 0, 16)
  if (typeof snapshot.condensation === 'boolean') settings.condensation = snapshot.condensation
}

function startAnimation() {
  window.cancelAnimationFrame(animationFrame)
  active = true
  lastFrameAt = performance.now()
  animationFrame = window.requestAnimationFrame(frame)
}

function stopAnimation() {
  active = false
  window.cancelAnimationFrame(animationFrame)
  void saveState()
}

waterControl.addEventListener('click', waterTerrarium)
baseImage.addEventListener('load', () => { imageReady = true; render(performance.now()) })
baseImage.addEventListener('error', () => {
  root.classList.add('has-storage-error')
  console.error('[glass-terrarium] failed to load terrarium-base-v2.png')
})

configureCanvas()
render(performance.now())

if (runtime) {
  // 交互表面贴合瓶体轮廓，并把黄铜阀门单独标为 APP 内部按钮，避免透明区域阻挡桌面。
  // 开发：Codex / GPT / 模型 ID 无法确认
  runtime.setInteractionSurface({
    width: WIDTH,
    height: HEIGHT,
    regions: [
      {
        shape: 'polygon', action: 'drag',
        points: [
          { x: 174, y: 2 }, { x: 269, y: 2 }, { x: 292, y: 58 }, { x: 316, y: 83 },
          { x: 365, y: 145 }, { x: 404, y: 225 }, { x: 402, y: 444 }, { x: 353, y: 489 },
          { x: 75, y: 489 }, { x: 29, y: 442 }, { x: 33, y: 213 }, { x: 76, y: 135 },
          { x: 137, y: 76 }, { x: 155, y: 55 }
        ],
        hostGestures: ['move', 'scale-wheel', 'scale-hold']
      },
      { shape: 'ellipse', action: 'interactive', x: 280, y: 58, width: 75, height: 110 }
    ]
  })
  runtime.setBubbleAnchor({ x: 214, y: 4 })
  runtime.onSettingsChange(applySettings)
  runtime.onLifecycle((lifecycle) => {
    if (lifecycle.type === 'hidden' || lifecycle.type === 'paused') stopAnimation()
    if (lifecycle.type === 'shown' || lifecycle.type === 'resumed') startAnimation()
  })
  runtime.onDispose(() => { active = false; window.cancelAnimationFrame(animationFrame) })
  void loadState()
}

startAnimation()
