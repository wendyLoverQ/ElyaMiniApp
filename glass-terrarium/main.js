const WIDTH = 420
const HEIGHT = 500
const STATE_KEY = 'terrarium-state-v1'
const STATE_VERSION = 1
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

const settings = {
  lighting: 'auto',
  growthSpeed: 1,
  fireflies: 8,
  condensation: true
}

const state = {
  version: STATE_VERSION,
  growth: 0.68,
  moisture: 0.72,
  wateredCount: 0,
  updatedAt: Date.now()
}

let active = true
let animationFrame = 0
let lastFrameAt = performance.now()
let lastSaveAt = performance.now()
let wateringStartedAt = -Infinity
let leafBounce = 0
let storageReady = false

const fireflies = Array.from({ length: 16 }, (_, index) => ({
  x: 104 + pseudo(index * 13 + 2) * 212,
  y: 178 + pseudo(index * 17 + 5) * 182,
  radius: 1.4 + pseudo(index * 23 + 1) * 1.5,
  phase: pseudo(index * 31 + 9) * Math.PI * 2,
  speed: 0.42 + pseudo(index * 19 + 4) * 0.46
}))

const condensationDrops = Array.from({ length: 27 }, (_, index) => ({
  x: 78 + pseudo(index * 29 + 1) * 264,
  y: 148 + pseudo(index * 37 + 3) * 248,
  radius: 1.2 + pseudo(index * 41 + 8) * 3,
  phase: pseudo(index * 11 + 7) * Math.PI * 2
}))

// 稳定的伪随机布局让每次启动保持同一株植物形态，不依赖持久化随机种子。
// 开发：Codex / GPT / 模型 ID 无法确认
function pseudo(seed) {
  const value = Math.sin(seed * 91.345 + 17.13) * 47453.5453
  return value - Math.floor(value)
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function mix(start, end, amount) {
  return start + (end - start) * amount
}

function rgba(day, night, nightMix, alpha = 1) {
  const red = Math.round(mix(day[0], night[0], nightMix))
  const green = Math.round(mix(day[1], night[1], nightMix))
  const blue = Math.round(mix(day[2], night[2], nightMix))
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getNightMix() {
  if (settings.lighting === 'day') return 0
  if (settings.lighting === 'night') return 1
  const hour = new Date().getHours() + new Date().getMinutes() / 60
  if (hour >= 7 && hour <= 17) return 0
  if (hour > 17 && hour < 21) return (hour - 17) / 4
  if (hour > 5 && hour < 7) return (7 - hour) / 2
  return 1
}

function jarPath(inset = 0) {
  const path = new Path2D()
  path.moveTo(146 + inset, 79 + inset)
  path.bezierCurveTo(146 + inset, 111, 125, 122, 96, 139)
  path.bezierCurveTo(61, 160, 53 + inset, 204, 58 + inset, 289)
  path.bezierCurveTo(61, 375, 75, 431, 111 + inset, 450 - inset)
  path.bezierCurveTo(151, 471 - inset, 269, 471 - inset, 309 - inset, 450 - inset)
  path.bezierCurveTo(345, 431, 359 - inset, 375, 362 - inset, 289)
  path.bezierCurveTo(367 - inset, 204, 359, 160, 324, 139)
  path.bezierCurveTo(295, 122, 274 - inset, 111, 274 - inset, 79 + inset)
  path.closePath()
  return path
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, r)
}

function configureCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(WIDTH * ratio)
  canvas.height = Math.round(HEIGHT * ratio)
  canvas.style.width = `${WIDTH}px`
  canvas.style.height = `${HEIGHT}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function drawShadow(ctx, moisture) {
  ctx.save()
  const gradient = ctx.createRadialGradient(210, 457, 18, 210, 457, 154)
  gradient.addColorStop(0, `rgba(19, 31, 25, ${0.27 + moisture * 0.08})`)
  gradient.addColorStop(0.55, 'rgba(20, 35, 28, 0.15)')
  gradient.addColorStop(1, 'rgba(20, 35, 28, 0)')
  ctx.fillStyle = gradient
  ctx.scale(1, 0.19)
  ctx.beginPath()
  ctx.arc(210, 2385, 154, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCork(ctx, nightMix) {
  const cork = ctx.createLinearGradient(0, 36, 0, 91)
  cork.addColorStop(0, rgba([190, 145, 83], [105, 78, 56], nightMix))
  cork.addColorStop(0.5, rgba([145, 96, 50], [79, 57, 43], nightMix))
  cork.addColorStop(1, rgba([101, 67, 39], [54, 43, 36], nightMix))
  ctx.fillStyle = cork
  roundedRect(ctx, 139, 38, 142, 52, 18)
  ctx.fill()

  ctx.strokeStyle = 'rgba(64, 42, 25, 0.48)'
  ctx.lineWidth = 2
  for (let index = 0; index < 10; index += 1) {
    const y = 47 + index * 3.7 + pseudo(index) * 3
    ctx.beginPath()
    ctx.moveTo(151 + pseudo(index + 20) * 17, y)
    ctx.bezierCurveTo(182, y - 3, 238, y + 4, 267 - pseudo(index + 8) * 15, y - 1)
    ctx.stroke()
  }

  const rim = ctx.createLinearGradient(0, 79, 0, 104)
  rim.addColorStop(0, 'rgba(225, 246, 238, 0.72)')
  rim.addColorStop(0.45, 'rgba(86, 124, 116, 0.42)')
  rim.addColorStop(1, 'rgba(214, 240, 232, 0.22)')
  ctx.fillStyle = rim
  roundedRect(ctx, 130, 76, 160, 23, 11)
  ctx.fill()
  ctx.strokeStyle = 'rgba(207, 239, 230, 0.62)'
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawHabitat(ctx, time, nightMix, growth, moisture) {
  const inside = jarPath(8)
  ctx.save()
  ctx.clip(inside)

  const atmosphere = ctx.createLinearGradient(0, 105, 0, 455)
  atmosphere.addColorStop(0, rgba([198, 226, 206], [20, 45, 48], nightMix, 0.28))
  atmosphere.addColorStop(0.58, rgba([97, 139, 105], [20, 57, 52], nightMix, 0.2))
  atmosphere.addColorStop(1, rgba([47, 69, 42], [11, 30, 31], nightMix, 0.34))
  ctx.fillStyle = atmosphere
  ctx.fillRect(54, 92, 312, 371)

  const backGlow = ctx.createRadialGradient(190, 205, 10, 190, 225, 185)
  backGlow.addColorStop(0, rgba([236, 230, 169], [71, 130, 113], nightMix, 0.26))
  backGlow.addColorStop(1, 'rgba(64, 90, 68, 0)')
  ctx.fillStyle = backGlow
  ctx.fillRect(55, 95, 310, 360)

  drawBackBranches(ctx, time, nightMix, growth)
  drawSoil(ctx, nightMix, moisture)
  drawMoss(ctx, time, nightMix, moisture, growth)
  drawPlants(ctx, time, nightMix, growth, moisture)
  drawMushrooms(ctx, time, nightMix, growth)
  drawSnail(ctx, time, nightMix, moisture)
  drawWatering(ctx, time)
  drawFireflies(ctx, time, nightMix)
  ctx.restore()
}

function drawBackBranches(ctx, time, nightMix, growth) {
  ctx.save()
  ctx.globalAlpha = 0.32 + growth * 0.24
  ctx.strokeStyle = rgba([61, 72, 46], [25, 49, 44], nightMix)
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(83, 346)
  ctx.bezierCurveTo(125, 305, 115, 252, 156, 214)
  ctx.moveTo(338, 358)
  ctx.bezierCurveTo(300, 322, 307, 270, 274, 230)
  ctx.stroke()
  ctx.restore()
}

function drawSoil(ctx, nightMix, moisture) {
  const soil = ctx.createLinearGradient(0, 354, 0, 465)
  soil.addColorStop(0, rgba([79, 61, 42], [36, 38, 34], nightMix))
  soil.addColorStop(0.35, rgba([59, 42, 31], [27, 30, 29], nightMix))
  soil.addColorStop(1, rgba([34, 26, 22], [16, 24, 25], nightMix))
  ctx.fillStyle = soil
  ctx.beginPath()
  ctx.moveTo(54, 381)
  ctx.bezierCurveTo(118, 351 - moisture * 8, 286, 354 + moisture * 5, 366, 382)
  ctx.lineTo(370, 470)
  ctx.lineTo(48, 470)
  ctx.closePath()
  ctx.fill()

  for (let index = 0; index < 34; index += 1) {
    const x = 72 + pseudo(index * 9) * 276
    const y = 389 + pseudo(index * 15) * 59
    const radius = 1 + pseudo(index * 21) * 2.5
    ctx.fillStyle = index % 3 === 0
      ? rgba([121, 97, 61], [49, 59, 53], nightMix, 0.45)
      : rgba([29, 25, 20], [13, 22, 22], nightMix, 0.34)
    ctx.beginPath()
    ctx.ellipse(x, y, radius * 1.8, radius, pseudo(index) * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  const stones = [
    { x: 87, y: 389, rx: 18, ry: 9, tone: 0 },
    { x: 132, y: 382, rx: 13, ry: 7, tone: 1 },
    { x: 254, y: 386, rx: 16, ry: 8, tone: 1 },
    { x: 330, y: 392, rx: 20, ry: 10, tone: 0 }
  ]
  stones.forEach((stone) => {
    const pebble = ctx.createRadialGradient(stone.x - 5, stone.y - 4, 1, stone.x, stone.y, stone.rx)
    pebble.addColorStop(0, stone.tone === 0
      ? rgba([139, 139, 112], [73, 101, 90], nightMix)
      : rgba([116, 125, 99], [59, 91, 82], nightMix))
    pebble.addColorStop(1, stone.tone === 0
      ? rgba([68, 76, 61], [33, 58, 56], nightMix)
      : rgba([55, 67, 54], [28, 53, 52], nightMix))
    ctx.fillStyle = pebble
    ctx.beginPath()
    ctx.ellipse(stone.x, stone.y, stone.rx, stone.ry, -0.12, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawMoss(ctx, time, nightMix, moisture, growth) {
  const sway = reducedMotion ? 0 : Math.sin(time * 0.0007) * 1.4
  for (let index = 0; index < 27; index += 1) {
    const x = 70 + index * 10.6 + Math.sin(index * 1.7) * 6
    const y = 373 + Math.sin(index * 0.77) * 8
    const radius = 8 + pseudo(index * 7) * 12 * growth
    const moss = ctx.createRadialGradient(x - 3, y - radius * 0.35, 1, x, y, radius)
    moss.addColorStop(0, rgba([132, 158, 93], [53, 108, 88], nightMix, 0.95))
    moss.addColorStop(0.65, rgba([75, 105, 61], [28, 69, 58], nightMix, 0.98))
    moss.addColorStop(1, rgba([41, 67, 43], [18, 47, 44], nightMix, 1))
    ctx.fillStyle = moss
    ctx.beginPath()
    ctx.arc(x + sway * pseudo(index + 2), y, radius * (0.72 + moisture * 0.2), 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPlants(ctx, time, nightMix, growth, moisture) {
  drawFern(ctx, 154, 382, 105 * growth, -0.25, time, nightMix, moisture, 1)
  drawFern(ctx, 267, 385, 126 * growth, 0.22, time, nightMix, moisture, 0.92)
  drawFern(ctx, 112, 392, 73 * growth, -0.52, time, nightMix, moisture, 0.72)
  drawRoundPlant(ctx, 214, 379, growth, time, nightMix, moisture)
}

function drawFern(ctx, x, y, length, lean, time, nightMix, moisture, scale) {
  const sway = reducedMotion ? 0 : Math.sin(time * 0.00062 + x * 0.03) * (2.6 + leafBounce * 3)
  const tipX = x + length * lean + sway
  const tipY = y - length
  ctx.save()
  ctx.strokeStyle = rgba([55, 101, 58], [42, 102, 82], nightMix)
  ctx.lineWidth = 2.4 * scale
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + sway * 0.2, y - length * 0.55, tipX, tipY)
  ctx.stroke()

  const pairs = Math.max(7, Math.floor(6 + state.growth * 4))
  for (let index = 1; index <= pairs; index += 1) {
    const progress = index / (pairs + 1)
    const stemX = mix(x, tipX, progress) - Math.sin(progress * Math.PI) * lean * 14
    const stemY = mix(y, tipY, progress)
    const leafLength = Math.sin(progress * Math.PI) * 28 * scale * (0.78 + moisture * 0.22)
    const angle = -0.5 + progress * 0.32
    drawLeaf(ctx, stemX, stemY, leafLength, angle - 1.36, time, nightMix, index, scale)
    drawLeaf(ctx, stemX, stemY, leafLength * 0.94, angle + 1.36, time, nightMix, index + 11, scale)
  }
  drawLeaf(ctx, tipX, tipY, 18 * scale, -Math.PI / 2 + lean * 0.2, time, nightMix, 23, scale)
  ctx.restore()
}

function drawLeaf(ctx, x, y, length, angle, time, nightMix, seed, scale) {
  const width = length * 0.34
  const flutter = reducedMotion ? 0 : Math.sin(time * 0.0011 + seed) * 0.035
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle + flutter)
  const gradient = ctx.createLinearGradient(0, 0, length, 0)
  gradient.addColorStop(0, rgba([76, 120, 65], [39, 99, 78], nightMix))
  gradient.addColorStop(0.52, rgba([115, 151, 80], [54, 127, 94], nightMix))
  gradient.addColorStop(1, rgba([62, 101, 57], [34, 83, 69], nightMix))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(length * 0.34, -width, length * 0.82, -width * 0.54, length, 0)
  ctx.bezierCurveTo(length * 0.8, width * 0.72, length * 0.3, width * 0.76, 0, 0)
  ctx.fill()
  ctx.strokeStyle = rgba([38, 77, 48], [22, 67, 58], nightMix, 0.65)
  ctx.lineWidth = Math.max(0.6, 0.9 * scale)
  ctx.beginPath()
  ctx.moveTo(2, 0)
  ctx.lineTo(length * 0.86, 0)
  ctx.stroke()
  ctx.restore()
}

function drawRoundPlant(ctx, x, y, growth, time, nightMix, moisture) {
  const stems = 7
  for (let index = 0; index < stems; index += 1) {
    const angle = -1.18 + index * 0.13
    const length = (48 + pseudo(index + 4) * 34) * growth
    const sway = reducedMotion ? 0 : Math.sin(time * 0.0008 + index) * 2
    const endX = x + Math.cos(angle) * length + sway
    const endY = y + Math.sin(angle) * length
    ctx.strokeStyle = rgba([62, 100, 54], [33, 85, 65], nightMix)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo((x + endX) / 2 + index - 3, (y + endY) / 2, endX, endY)
    ctx.stroke()

    const radius = (9 + pseudo(index + 8) * 4) * (0.82 + moisture * 0.18)
    const leaf = ctx.createRadialGradient(endX - 3, endY - 4, 1, endX, endY, radius)
    leaf.addColorStop(0, rgba([145, 171, 97], [67, 132, 93], nightMix))
    leaf.addColorStop(1, rgba([66, 107, 60], [30, 82, 66], nightMix))
    ctx.fillStyle = leaf
    ctx.beginPath()
    ctx.ellipse(endX, endY, radius * 1.12, radius * 0.88, angle + Math.PI / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMushrooms(ctx, time, nightMix, growth) {
  const mushrooms = [
    { x: 105, y: 386, scale: 0.8 },
    { x: 289, y: 389, scale: 1 },
    { x: 310, y: 398, scale: 0.58 }
  ]
  mushrooms.forEach((mushroom, index) => {
    const reveal = clamp((growth - 0.35 - index * 0.08) * 3, 0, 1)
    if (reveal <= 0) return
    const bob = reducedMotion ? 0 : Math.sin(time * 0.00055 + index * 2) * 0.8
    const height = 24 * mushroom.scale * reveal
    ctx.fillStyle = rgba([220, 206, 164], [135, 153, 126], nightMix)
    roundedRect(ctx, mushroom.x - 3 * mushroom.scale, mushroom.y - height + bob, 6 * mushroom.scale, height, 3)
    ctx.fill()
    const cap = ctx.createRadialGradient(mushroom.x - 4, mushroom.y - height - 5, 1, mushroom.x, mushroom.y - height, 16 * mushroom.scale)
    cap.addColorStop(0, rgba([213, 132, 83], [169, 94, 68], nightMix))
    cap.addColorStop(1, rgba([123, 62, 43], [81, 47, 43], nightMix))
    ctx.fillStyle = cap
    ctx.beginPath()
    ctx.ellipse(mushroom.x, mushroom.y - height + bob, 16 * mushroom.scale * reveal, 9 * mushroom.scale * reveal, -0.08, Math.PI, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
  })
}

function drawSnail(ctx, time, nightMix, moisture) {
  const travel = reducedMotion ? 0.5 : (Math.sin(time * 0.000055) + 1) / 2
  const x = 145 + travel * 88
  const y = 405
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(0.82, 0.82)
  ctx.fillStyle = rgba([157, 137, 91], [105, 119, 91], nightMix)
  ctx.beginPath()
  ctx.ellipse(0, 6, 28, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(24, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rgba([117, 98, 65], [79, 96, 75], nightMix)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(26, -5)
  ctx.lineTo(31, -15)
  ctx.moveTo(22, -5)
  ctx.lineTo(22, -16)
  ctx.stroke()
  ctx.fillStyle = rgba([37, 45, 31], [193, 210, 147], nightMix)
  ctx.beginPath()
  ctx.arc(31, -15, 1.6, 0, Math.PI * 2)
  ctx.arc(22, -16, 1.6, 0, Math.PI * 2)
  ctx.fill()

  const shell = ctx.createRadialGradient(-5, -2, 2, -8, -2, 19)
  shell.addColorStop(0, rgba([193, 139, 77], [139, 101, 79], nightMix))
  shell.addColorStop(1, rgba([91, 62, 42], [65, 57, 54], nightMix))
  ctx.fillStyle = shell
  ctx.beginPath()
  ctx.arc(-7, -3, 19, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rgba([76, 49, 34], [44, 52, 49], nightMix, 0.72)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(-7, -3, 12, 0.15, Math.PI * 2.1)
  ctx.arc(-7, -3, 6, 0.15, Math.PI * 2.1)
  ctx.stroke()
  if (moisture > 0.55) {
    ctx.strokeStyle = 'rgba(188, 226, 204, 0.25)'
    ctx.beginPath()
    ctx.moveTo(-32, 12)
    ctx.lineTo(31, 12)
    ctx.stroke()
  }
  ctx.restore()
}

function drawFireflies(ctx, time, nightMix) {
  const count = Math.round(settings.fireflies)
  const visibility = 0.12 + nightMix * 0.88
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  fireflies.slice(0, count).forEach((firefly, index) => {
    const drift = reducedMotion ? 0 : 10
    const x = firefly.x + Math.sin(time * 0.00035 * firefly.speed + firefly.phase) * drift
    const y = firefly.y + Math.cos(time * 0.00029 * firefly.speed + firefly.phase * 1.4) * drift * 0.7
    const pulse = reducedMotion ? 0.7 : 0.38 + 0.62 * Math.pow((Math.sin(time * 0.0021 + firefly.phase) + 1) / 2, 2)
    const alpha = visibility * pulse
    const glow = ctx.createRadialGradient(x, y, 0, x, y, firefly.radius * 7)
    glow.addColorStop(0, `rgba(255, 244, 161, ${alpha})`)
    glow.addColorStop(0.2, `rgba(232, 201, 109, ${alpha * 0.72})`)
    glow.addColorStop(1, 'rgba(224, 193, 90, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, firefly.radius * 7, 0, Math.PI * 2)
    ctx.fill()
    if (index % 3 === 0) {
      ctx.fillStyle = `rgba(255, 252, 207, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, firefly.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.restore()
}

function drawWatering(ctx, time) {
  const elapsed = time - wateringStartedAt
  if (elapsed < 0 || elapsed > 2400) return
  const progress = elapsed / 2400
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let index = 0; index < 18; index += 1) {
    const delay = index * 52
    const local = clamp((elapsed - delay) / 900, 0, 1)
    if (local <= 0 || local >= 1) continue
    const x = 334 - index * 2.8 + Math.sin(index * 2.4) * 7
    const y = 145 + local * 238
    ctx.strokeStyle = `rgba(151, 220, 210, ${Math.sin(local * Math.PI) * 0.72})`
    ctx.lineWidth = 1.2 + pseudo(index) * 1.4
    ctx.beginPath()
    ctx.moveTo(x, y - 9)
    ctx.quadraticCurveTo(x - 2, y, x, y + 5)
    ctx.stroke()
  }
  const soilGlow = ctx.createRadialGradient(257, 384, 2, 257, 384, 92)
  soilGlow.addColorStop(0, `rgba(116, 176, 130, ${(1 - progress) * 0.18})`)
  soilGlow.addColorStop(1, 'rgba(80, 140, 104, 0)')
  ctx.fillStyle = soilGlow
  ctx.fillRect(160, 335, 190, 110)
  ctx.restore()
}

function drawGlass(ctx, time, nightMix, moisture) {
  const outer = jarPath()
  const glass = ctx.createLinearGradient(47, 0, 372, 0)
  glass.addColorStop(0, rgba([186, 225, 220], [68, 112, 111], nightMix, 0.3))
  glass.addColorStop(0.14, 'rgba(239, 255, 250, 0.08)')
  glass.addColorStop(0.48, 'rgba(220, 246, 237, 0.015)')
  glass.addColorStop(0.82, rgba([135, 188, 179], [44, 85, 88], nightMix, 0.12))
  glass.addColorStop(1, rgba([72, 117, 111], [28, 57, 62], nightMix, 0.32))
  ctx.fillStyle = glass
  ctx.fill(outer)

  ctx.save()
  ctx.clip(outer)
  const highlight = ctx.createLinearGradient(68, 0, 178, 0)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0)')
  highlight.addColorStop(0.45, 'rgba(246, 255, 250, 0.34)')
  highlight.addColorStop(0.7, 'rgba(235, 252, 247, 0.08)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = highlight
  ctx.beginPath()
  ctx.ellipse(126, 270, 38, 168, 0.07, 0, Math.PI * 2)
  ctx.fill()

  const rightGlint = ctx.createLinearGradient(298, 0, 351, 0)
  rightGlint.addColorStop(0, 'rgba(255, 255, 255, 0)')
  rightGlint.addColorStop(0.72, 'rgba(221, 249, 242, 0.18)')
  rightGlint.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rightGlint
  ctx.beginPath()
  ctx.ellipse(322, 284, 23, 135, -0.08, 0, Math.PI * 2)
  ctx.fill()

  if (settings.condensation) drawCondensation(ctx, time, nightMix, moisture)
  ctx.restore()

  ctx.strokeStyle = rgba([218, 244, 237], [100, 150, 145], nightMix, 0.5)
  ctx.lineWidth = 2.2
  ctx.stroke(outer)
  ctx.strokeStyle = rgba([70, 112, 104], [25, 56, 59], nightMix, 0.32)
  ctx.lineWidth = 5
  ctx.stroke(jarPath(5))

  ctx.strokeStyle = 'rgba(244, 255, 251, 0.42)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(92, 171)
  ctx.bezierCurveTo(70, 220, 72, 311, 82, 351)
  ctx.stroke()
}

function drawCondensation(ctx, time, nightMix, moisture) {
  const intensity = clamp((moisture - 0.25) / 0.75, 0, 1)
  condensationDrops.forEach((drop, index) => {
    const slide = reducedMotion ? 0 : ((time * 0.002 * (0.18 + pseudo(index) * 0.24) + drop.phase * 30) % 24)
    const y = drop.y + slide
    const edgeFade = Math.min(1, Math.abs(drop.x - 210) / 88)
    const alpha = intensity * (0.07 + edgeFade * 0.17)
    const gradient = ctx.createRadialGradient(drop.x - drop.radius * 0.4, y - drop.radius * 0.45, 0, drop.x, y, drop.radius)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.8})`)
    gradient.addColorStop(0.42, `rgba(188, 225, 218, ${alpha * 0.55})`)
    gradient.addColorStop(1, rgba([75, 122, 114], [25, 64, 67], nightMix, alpha * 0.52))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(drop.x, y, drop.radius * 0.78, drop.radius * 1.18, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}

function render(time) {
  context.clearRect(0, 0, WIDTH, HEIGHT)
  const nightMix = getNightMix()
  drawShadow(context, state.moisture)
  drawHabitat(context, time, nightMix, state.growth, state.moisture)
  drawGlass(context, time, nightMix, state.moisture)
  drawCork(context, nightMix)
}

function updateState(deltaSeconds) {
  const speed = settings.growthSpeed
  const healthy = clamp((state.moisture - 0.18) / 0.54, 0, 1)
  state.growth = clamp(state.growth + deltaSeconds * 0.0000042 * speed * healthy, 0.42, 1)
  state.moisture = clamp(state.moisture - deltaSeconds * 0.0000028, 0.08, 1)
  leafBounce *= Math.pow(0.12, deltaSeconds)
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
  state.growth = clamp(state.growth + elapsedHours * 0.015 * settings.growthSpeed * healthy, 0.42, 1)
  state.moisture = clamp(state.moisture - elapsedHours * 0.018, 0.08, 1)
  state.updatedAt = Date.now()
}

function isCurrentState(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.version === STATE_VERSION &&
    typeof value.growth === 'number' && Number.isFinite(value.growth) && value.growth >= 0.42 && value.growth <= 1 &&
    typeof value.moisture === 'number' && Number.isFinite(value.moisture) && value.moisture >= 0.08 && value.moisture <= 1 &&
    typeof value.wateredCount === 'number' && Number.isInteger(value.wateredCount) && value.wateredCount >= 0 &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
  )
}

async function loadState() {
  if (!runtime) return
  try {
    const saved = await runtime.storage.get(STATE_KEY)
    if (saved !== undefined) {
      if (!isCurrentState(saved)) throw new Error('Stored terrarium state does not match version 1')
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
    await runtime.storage.set(STATE_KEY, {
      version: STATE_VERSION,
      growth: state.growth,
      moisture: state.moisture,
      wateredCount: state.wateredCount,
      updatedAt: state.updatedAt
    })
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
  leafBounce = 1
  waterControl.classList.add('is-watering')
  window.setTimeout(() => waterControl.classList.remove('is-watering'), 520)
  void saveState()
}

function applySettings(snapshot) {
  if (snapshot.lighting === 'auto' || snapshot.lighting === 'day' || snapshot.lighting === 'night') {
    settings.lighting = snapshot.lighting
  }
  if (typeof snapshot.growthSpeed === 'number' && Number.isFinite(snapshot.growthSpeed)) {
    settings.growthSpeed = clamp(snapshot.growthSpeed, 0.25, 3)
  }
  if (typeof snapshot.fireflies === 'number' && Number.isFinite(snapshot.fireflies)) {
    settings.fireflies = clamp(Math.round(snapshot.fireflies), 0, 16)
  }
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

configureCanvas()
render(performance.now())

if (runtime) {
  // Canvas 负责像素，DOM 命中声明分别保留宿主拖动和生态瓶浇水按钮。
  // 开发：Codex / GPT / 模型 ID 无法确认
  runtime.setInteractionSurface(null)
  runtime.invalidateInteractionSurface()
  runtime.setBubbleAnchor({ x: 210, y: 35 })
  runtime.onSettingsChange(applySettings)
  runtime.onLifecycle((lifecycle) => {
    if (lifecycle.type === 'hidden' || lifecycle.type === 'paused') stopAnimation()
    if (lifecycle.type === 'shown' || lifecycle.type === 'resumed') startAnimation()
  })
  runtime.onDispose(() => {
    active = false
    window.cancelAnimationFrame(animationFrame)
  })
  void loadState()
}

startAnimation()
