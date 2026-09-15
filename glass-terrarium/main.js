import * as THREE from './vendor/three.module.min.js'
import { GLTFLoader } from './vendor/GLTFLoader.js'

const WIDTH = 420
const HEIGHT = 500
const STATE_KEY = 'terrarium-state-v3'
const STATE_VERSION = 3
const HOUR_MS = 60 * 60 * 1000
const SAVE_INTERVAL_MS = 30_000

const stage = document.querySelector('#stage')
const root = document.querySelector('#terrarium')
const waterControl = document.querySelector('#water-control')

if (!(stage instanceof HTMLElement)) throw new Error('Terrarium stage is missing')
if (!(root instanceof HTMLElement)) throw new Error('Terrarium root is missing')
if (!(waterControl instanceof HTMLButtonElement)) throw new Error('Terrarium water control is missing')

const runtime = window.elyaPet
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const settings = { lighting: 'auto', growthSpeed: 1, fireflies: 8, condensation: true }
const state = { version: STATE_VERSION, growth: 0.72, moisture: 0.74, wateredCount: 0, updatedAt: Date.now() }

let active = true
let animationFrame = 0
let lastFrameAt = performance.now()
let lastSaveAt = performance.now()
let storageReady = false
let wateringStartedAt = -Infinity
let requestedVisualScale = 1

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
renderer.setClearColor(0x000000, 0)
renderer.setSize(WIDTH, HEIGHT, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.setAttribute('aria-hidden', 'true')
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(29, WIDTH / HEIGHT, 0.1, 60)
camera.position.set(0.22, 0.28, 16)
camera.lookAt(0, 0.08, 0)

const world = new THREE.Group()
world.position.y = -0.05
world.rotation.y = -0.08
scene.add(world)

const hemiLight = new THREE.HemisphereLight(0xcce9dd, 0x17231d, 1.48)
scene.add(hemiLight)
const keyLight = new THREE.DirectionalLight(0xffe2b0, 3.2)
keyLight.position.set(-4.5, 7, 8)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(1024, 1024)
keyLight.shadow.camera.left = -5
keyLight.shadow.camera.right = 5
keyLight.shadow.camera.top = 6
keyLight.shadow.camera.bottom = -6
scene.add(keyLight)
const rimLight = new THREE.DirectionalLight(0x79d5c8, 2.4)
rimLight.position.set(5, 2.5, -3)
scene.add(rimLight)
const warmFill = new THREE.PointLight(0xeab85d, 10, 8, 2)
warmFill.position.set(-1.2, 0.4, 2.2)
scene.add(warmFill)

const materials = {
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xd7f3ed,
    roughness: 0.045,
    metalness: 0,
    transmission: 0.96,
    thickness: 0.2,
    ior: 1.47,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  }),
  glassEdge: new THREE.MeshPhysicalMaterial({
    color: 0xc3ebe4,
    roughness: 0.04,
    transmission: 0.84,
    thickness: 0.42,
    transparent: true,
    opacity: 0.48,
    depthWrite: false
  }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x3b2115, roughness: 0.76, metalness: 0.04 }),
  cork: new THREE.MeshStandardMaterial({ color: 0x8b5b35, roughness: 0.92, metalness: 0 }),
  corkDark: new THREE.MeshStandardMaterial({ color: 0x57351f, roughness: 0.96, metalness: 0 }),
  brassDark: new THREE.MeshStandardMaterial({ color: 0x5d4020, roughness: 0.38, metalness: 0.82 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.98 }),
  soilWet: new THREE.MeshStandardMaterial({ color: 0x352218, roughness: 0.82 }),
  substrate: new THREE.MeshStandardMaterial({ color: 0x75664f, roughness: 0.94 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x3f2818, roughness: 0.94 }),
  barkLight: new THREE.MeshStandardMaterial({ color: 0x624127, roughness: 0.9 }),
  mossDark: new THREE.MeshStandardMaterial({ color: 0x24472b, roughness: 1 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x477a3b, roughness: 0.98 }),
  mossLight: new THREE.MeshStandardMaterial({ color: 0x729b4d, roughness: 0.96 }),
  fernDark: new THREE.MeshPhysicalMaterial({ color: 0x24543b, roughness: 0.78, side: THREE.DoubleSide, sheen: 0.28, sheenColor: 0x6d9f74 }),
  roundLeaf: new THREE.MeshPhysicalMaterial({ color: 0x315f43, roughness: 0.68, side: THREE.DoubleSide, sheen: 0.4, sheenColor: 0x789d7b }),
  roundLeafLight: new THREE.MeshPhysicalMaterial({ color: 0x568662, roughness: 0.66, side: THREE.DoubleSide, sheen: 0.42, sheenColor: 0x9abd91 }),
  mushroomStem: new THREE.MeshStandardMaterial({ color: 0xd6c7a3, roughness: 0.85 }),
  mushroomCap: new THREE.MeshStandardMaterial({ color: 0xb54f2d, roughness: 0.62 }),
  mushroomGlow: new THREE.MeshStandardMaterial({ color: 0xef7d3d, emissive: 0x8c280f, emissiveIntensity: 0.6, roughness: 0.54 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x48514b, roughness: 0.92 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: 0x6b7163, roughness: 0.9 }),
  snailBody: new THREE.MeshStandardMaterial({ color: 0x9a9a64, roughness: 0.82 }),
  snailShell: new THREE.MeshStandardMaterial({ color: 0x8b5029, roughness: 0.58 }),
  water: new THREE.MeshPhysicalMaterial({ color: 0x81e4d5, roughness: 0.08, transmission: 0.74, thickness: 0.12, transparent: true, opacity: 0.82 }),
  condensation: new THREE.MeshPhysicalMaterial({ color: 0xc9fff6, roughness: 0.06, transmission: 0.9, transparent: true, opacity: 0.38, depthWrite: false })
}

const animatedFronds = []
const animatedLeaves = []
const fireflies = []
const condensation = []
const waterDrops = []
const fernLoader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()

function pseudo(seed) {
  const value = Math.sin(seed * 91.345 + 17.13) * 47453.5453
  return value - Math.floor(value)
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function makeLathe(profile, material, segments = 64) {
  const geometry = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function cylinderBetween(start, end, radius, material, radialSegments = 10) {
  const direction = new THREE.Vector3().subVectors(end, start)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, direction.length(), radialSegments), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
  mesh.castShadow = true
  return mesh
}

function makeHeartLeafGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.58)
  shape.bezierCurveTo(-0.08, -0.33, -0.55, -0.15, -0.52, 0.2)
  shape.bezierCurveTo(-0.49, 0.56, -0.12, 0.64, 0, 0.38)
  shape.bezierCurveTo(0.12, 0.64, 0.49, 0.56, 0.52, 0.2)
  shape.bezierCurveTo(0.55, -0.15, 0.08, -0.33, 0, -0.58)
  const geometry = new THREE.ShapeGeometry(shape, 5)
  geometry.computeVertexNormals()
  return geometry
}

const heartLeafGeometry = makeHeartLeafGeometry()

function makeHeartLeaf(size, material) {
  const mesh = new THREE.Mesh(heartLeafGeometry, material)
  mesh.scale.set(size, size, size)
  mesh.castShadow = true
  return mesh
}

function createBottle() {
  const glass = makeLathe([
    [1.62, -3.02], [1.79, -2.9], [1.88, -2.68], [1.9, -2.3], [1.9, 1.68],
    [1.84, 1.92], [1.61, 2.14], [1.03, 2.42], [0.74, 2.58], [0.73, 3.08]
  ], materials.glass, 96)
  glass.renderOrder = 20
  world.add(glass)

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.075, 12, 96), materials.glassEdge)
  baseRing.rotation.x = Math.PI / 2
  baseRing.position.y = -2.93
  baseRing.renderOrder = 21
  world.add(baseRing)

  for (const [y, radius, tube] of [[2.58, 0.77, 0.075], [3.07, 0.79, 0.07]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), materials.glassEdge)
    rim.rotation.x = Math.PI / 2
    rim.position.y = y
    rim.renderOrder = 21
    world.add(rim)
  }
}

function createStopper() {
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.61, 0.62, 64, 5), materials.cork)
  stopper.position.y = 3.31
  stopper.castShadow = true
  world.add(stopper)

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.68, 0.08, 64), materials.corkDark)
  top.position.y = 3.65
  world.add(top)

  const grainGeometry = new THREE.TorusGeometry(0.635, 0.009, 5, 64)
  for (let index = 0; index < 4; index += 1) {
    const grain = new THREE.Mesh(grainGeometry, materials.corkDark)
    grain.rotation.x = Math.PI / 2
    grain.position.y = 3.1 + index * 0.14
    grain.scale.set(0.94 + pseudo(index * 17) * 0.08, 0.94 + pseudo(index * 19) * 0.08, 1)
    world.add(grain)
  }
}

function createGround() {
  const drainage = new THREE.Mesh(new THREE.CylinderGeometry(1.61, 1.55, 0.16, 72), materials.substrate)
  drainage.position.y = -2.88
  drainage.receiveShadow = true
  world.add(drainage)

  const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.59, 0.18, 72), materials.soil)
  bed.position.y = -2.71
  bed.receiveShadow = true
  world.add(bed)
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), materials.soilWet)
  mound.scale.set(1.62, 0.28, 1.4)
  mound.position.set(-0.05, -2.5, 0)
  mound.castShadow = true
  mound.receiveShadow = true
  world.add(mound)

  const pebbleGeometry = new THREE.DodecahedronGeometry(0.12, 1)
  for (let index = 0; index < 42; index += 1) {
    const pebble = new THREE.Mesh(pebbleGeometry, index % 3 ? materials.stone : materials.stoneLight)
    const angle = pseudo(index * 7) * Math.PI * 2
    const radius = 0.28 + pseudo(index * 11) * 1.28
    pebble.position.set(Math.cos(angle) * radius, -2.28 + pseudo(index * 17) * 0.13, Math.sin(angle) * radius)
    pebble.scale.set(0.48 + pseudo(index * 13) * 0.82, 0.28 + pseudo(index * 19) * 0.42, 0.5 + pseudo(index * 23) * 0.76)
    pebble.rotation.set(pseudo(index) * 2, pseudo(index + 3) * 2, pseudo(index + 8) * 2)
    pebble.castShadow = true
    world.add(pebble)
  }

  const mossGeometry = new THREE.IcosahedronGeometry(0.038, 2)
  for (let index = 0; index < 360; index += 1) {
    const tone = index % 5 === 0 ? materials.mossLight : index % 2 ? materials.moss : materials.mossDark
    const moss = new THREE.Mesh(mossGeometry, tone)
    const angle = pseudo(index * 29) * Math.PI * 2
    const radius = 0.16 + Math.sqrt(pseudo(index * 31)) * 1.42
    moss.position.set(Math.cos(angle) * radius, -2.2 + pseudo(index * 37) * 0.2, Math.sin(angle) * radius)
    const scale = 0.48 + pseudo(index * 41) * 0.92
    moss.scale.set(scale * (0.8 + pseudo(index * 43) * 0.5), scale, scale * (0.85 + pseudo(index * 47) * 0.4))
    moss.castShadow = index % 3 === 0
    world.add(moss)
  }
}

function createLog() {
  const trunk = cylinderBetween(new THREE.Vector3(-0.92, -2.14, -0.34), new THREE.Vector3(-0.42, -0.02, -0.58), 0.14, materials.bark, 28)
  world.add(trunk)
  const branchA = cylinderBetween(new THREE.Vector3(-0.74, -1.38, -0.46), new THREE.Vector3(-1.18, -0.98, -0.28), 0.065, materials.barkLight, 18)
  const branchB = cylinderBetween(new THREE.Vector3(-0.58, -0.48, -0.54), new THREE.Vector3(-0.25, -0.18, -0.45), 0.045, materials.barkLight, 16)
  world.add(branchA, branchB)

  const mossGeometry = new THREE.IcosahedronGeometry(0.038, 2)
  for (let index = 0; index < 96; index += 1) {
    const progress = pseudo(index * 17)
    const moss = new THREE.Mesh(mossGeometry, index % 4 ? materials.moss : materials.mossLight)
    moss.position.set(-1.12 + progress * 0.64 + pseudo(index * 3) * 0.16, -1.98 + progress * 2.24, -0.15 + pseudo(index * 5) * 0.14)
    const scale = 0.56 + pseudo(index * 7) * 0.92
    moss.scale.set(scale, scale * 0.72, scale)
    world.add(moss)
  }
}

function createRoundPlant(position, height, phase) {
  const group = new THREE.Group()
  group.position.copy(position)
  const stems = 12
  for (let index = 0; index < stems; index += 1) {
    const angle = (index / stems) * Math.PI * 2 + phase
    const reach = 0.16 + pseudo(index + phase) * 0.2
    const end = new THREE.Vector3(Math.cos(angle) * reach, height * (0.62 + pseudo(index * 4) * 0.38), Math.sin(angle) * reach)
    group.add(cylinderBetween(new THREE.Vector3(0, 0, 0), end, 0.018, materials.fernDark, 6))
    const leaf = makeHeartLeaf(0.145 + pseudo(index * 11 + phase) * 0.045, index % 3 ? materials.roundLeaf : materials.roundLeafLight)
    leaf.position.copy(end)
    leaf.rotation.z = Math.sin(angle) * 0.22
    leaf.rotation.y = -angle
    leaf.rotation.x = -0.42 + pseudo(index + 8) * 0.2
    group.add(leaf)
  }
  group.userData = { phase, baseY: group.rotation.y }
  animatedLeaves.push(group)
  world.add(group)
}

// 细藤使用真实曲线管体和独立小叶，补足瓶内纵向层次而不增加块状体积。
// 开发：Codex / GPT / 模型 ID 无法确认
function createFineVine(position, height, lean, phase) {
  const group = new THREE.Group()
  group.position.copy(position)
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.45, height * 0.54, 0),
    new THREE.Vector3(lean, height, 0)
  )
  group.add(cylinderBetween(new THREE.Vector3(0, 0, 0), curve.getPoint(1), 0.012, materials.fernDark, 6))
  for (let index = 1; index <= 10; index += 1) {
    const progress = index / 11
    const point = curve.getPoint(progress)
    const leaf = makeHeartLeaf(0.075 + pseudo(index * 19 + phase) * 0.03, index % 3 ? materials.roundLeaf : materials.roundLeafLight)
    leaf.position.copy(point)
    leaf.rotation.z = (index % 2 ? 1 : -1) * (0.64 + pseudo(index * 23) * 0.28)
    leaf.rotation.y = pseudo(index * 29 + phase) * 0.34
    group.add(leaf)
  }
  group.userData = { baseZ: 0, phase, amplitude: 0.012 }
  animatedFronds.push(group)
  world.add(group)
}

// 真实植株模型按独立根节点摆放，因此每株可以分别受风与浇水动作影响。
// 开发：Codex / GPT / 模型 ID 无法确认
async function createDetailedFerns() {
  const [gltf, alphaMap] = await Promise.all([
    fernLoader.loadAsync('./assets/fern-02/fern_02_2k.gltf'),
    textureLoader.loadAsync('./assets/fern-02/textures/fern_02_alpha_2k.jpg')
  ])
  alphaMap.flipY = false
  alphaMap.colorSpace = THREE.NoColorSpace

  const sourcePlants = gltf.scene.children.filter((child) => {
    let containsMesh = false
    child.traverse((node) => {
      if (node.isMesh) containsMesh = true
    })
    return containsMesh
  })
  if (sourcePlants.length === 0) throw new Error('Fern model contains no renderable plants')

  const placements = [
    { variant: 1, position: [-0.5, -2.08, 0.02], height: 2.08, yaw: 0.14, lean: 0.03, phase: 0.4 },
    { variant: 1, position: [0.28, -2.08, -0.7], height: 2.72, yaw: -0.34, lean: -0.04, phase: 1.7 },
    { variant: 2, position: [0.58, -2.08, 0.02], height: 1.52, yaw: 0.48, lean: -0.03, phase: 3.1 },
    { variant: 3, position: [-0.1, -2.1, -1], height: 2.5, yaw: -0.72, lean: 0.02, phase: 4.5 },
    { variant: 1, position: [0.08, -2.09, 0.28], height: 1.2, yaw: 1.26, lean: -0.015, phase: 6.2 }
  ]

  placements.forEach((placement) => {
    const plant = sourcePlants[placement.variant % sourcePlants.length].clone(true)
    plant.traverse((node) => {
      if (!node.isMesh) return
      node.material = node.material.clone()
      node.material.alphaMap = alphaMap
      node.material.alphaTest = 0.42
      node.material.transparent = false
      node.material.side = THREE.DoubleSide
      node.castShadow = true
      node.receiveShadow = true
    })

    const bounds = new THREE.Box3().setFromObject(plant)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    plant.position.set(-center.x, -bounds.min.y, -center.z)
    const scale = placement.height / Math.max(size.y, 0.001)
    plant.scale.set(scale * 0.24, scale, scale * 0.24)

    const pivot = new THREE.Group()
    pivot.position.fromArray(placement.position)
    pivot.rotation.y = placement.yaw
    pivot.rotation.z = placement.lean
    pivot.add(plant)
    pivot.userData = {
      baseZ: placement.lean,
      baseX: 0,
      phase: placement.phase,
      amplitude: 0.012 + pseudo(placement.phase * 10) * 0.018
    }
    animatedFronds.push(pivot)
    world.add(pivot)
  })
}

function createMushroom(x, y, z, scale, glowing) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.scale.setScalar(scale)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.38, 16), materials.mushroomStem)
  stem.position.y = 0.18
  stem.castShadow = true
  group.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), glowing ? materials.mushroomGlow : materials.mushroomCap)
  cap.scale.y = 0.48
  cap.position.y = 0.38
  cap.castShadow = true
  group.add(cap)
  world.add(group)
}

function createSnail() {
  const snail = new THREE.Group()
  snail.position.set(-0.28, -2.0, 1.18)
  snail.scale.setScalar(0.72)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), materials.snailBody)
  body.scale.set(1.8, 0.55, 0.72)
  snail.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), materials.snailBody)
  head.position.set(0.24, 0.06, 0)
  snail.add(head)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), materials.snailShell)
  shell.scale.z = 0.48
  shell.position.set(-0.07, 0.18, 0)
  shell.castShadow = true
  snail.add(shell)
  const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.014, 8, 40, Math.PI * 1.78), materials.brassDark)
  spiral.position.set(-0.07, 0.18, 0.115)
  spiral.rotation.z = -0.2
  snail.add(spiral)
  for (const side of [-1, 1]) {
    const antenna = cylinderBetween(new THREE.Vector3(0.28, 0.11, side * 0.035), new THREE.Vector3(0.39, 0.28, side * 0.09), 0.012, materials.snailBody, 6)
    snail.add(antenna)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), materials.walnut)
    eye.position.set(0.39, 0.28, side * 0.09)
    snail.add(eye)
  }
  snail.userData.phase = 0
  animatedLeaves.push(snail)
  world.add(snail)
}

function createFireflies() {
  const coreGeometry = new THREE.SphereGeometry(0.016, 10, 8)
  const haloGeometry = new THREE.SphereGeometry(0.068, 12, 8)
  for (let index = 0; index < 16; index += 1) {
    const group = new THREE.Group()
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2a4 })
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffc84b, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    group.add(new THREE.Mesh(coreGeometry, coreMaterial), new THREE.Mesh(haloGeometry, haloMaterial))
    const angle = pseudo(index * 13) * Math.PI * 2
    const radius = 0.45 + pseudo(index * 17) * 1.38
    group.position.set(Math.cos(angle) * radius, -0.65 + pseudo(index * 19) * 3.15, 0.4 + Math.sin(angle) * 1.1)
    group.userData = { origin: group.position.clone(), phase: pseudo(index * 23) * Math.PI * 2, coreMaterial, haloMaterial }
    fireflies.push(group)
    world.add(group)
  }
}

function createCondensation() {
  const geometry = new THREE.SphereGeometry(1, 12, 8)
  for (let index = 0; index < 32; index += 1) {
    const drop = new THREE.Mesh(geometry, materials.condensation)
    const angle = -1.05 + pseudo(index * 7) * 2.1
    const y = -1.5 + pseudo(index * 11) * 3.72
    const bodyRadius = y > 1.68 ? THREE.MathUtils.lerp(1.84, 0.92, (y - 1.68) / 0.9) : 1.84
    drop.position.set(Math.sin(angle) * bodyRadius, y, Math.cos(angle) * bodyRadius)
    const size = 0.017 + pseudo(index * 13) * 0.032
    drop.scale.set(size * 0.72, size * 1.35, size * 0.45)
    drop.userData = { originY: y, speed: 0.018 + pseudo(index * 17) * 0.035 }
    condensation.push(drop)
    world.add(drop)
  }
}

function createWaterDrops() {
  const geometry = new THREE.SphereGeometry(0.042, 10, 7)
  for (let index = 0; index < 36; index += 1) {
    const drop = new THREE.Mesh(geometry, materials.water)
    drop.visible = false
    drop.userData = { delay: index * 0.035, x: -1.08 + pseudo(index * 31) * 2.16, z: -0.62 + pseudo(index * 37) * 1.24 }
    waterDrops.push(drop)
    world.add(drop)
  }
}

async function buildTerrarium() {
  createGround()
  createLog()
  await createDetailedFerns()
  createRoundPlant(new THREE.Vector3(0.08, -2.06, 0.76), 0.82, 0.8)
  createRoundPlant(new THREE.Vector3(-0.56, -2.04, 0.78), 0.68, 4.2)
  createRoundPlant(new THREE.Vector3(0.92, -2.06, 0.54), 0.62, 2.8)
  createFineVine(new THREE.Vector3(-0.68, -2.05, -0.98), 1.95, 0.32, 0.6)
  createFineVine(new THREE.Vector3(0.72, -2.05, -1.02), 1.7, -0.24, 2.8)
  createFineVine(new THREE.Vector3(-0.28, -2.05, -1.12), 2.16, 0.18, 4.8)
  createMushroom(-1.1, -2.07, 0.98, 0.82, true)
  createMushroom(-0.86, -2.08, 1.16, 0.58, false)
  createMushroom(1.12, -2.08, 0.84, 0.68, true)
  createMushroom(0.9, -2.08, 1.16, 0.46, false)
  createMushroom(0.58, -2.08, 1.28, 0.38, false)
  createMushroom(-0.5, -2.08, 1.3, 0.34, true)
  createSnail()
  createFireflies()
  createCondensation()
  createWaterDrops()
  createBottle()
  createStopper()
}

await buildTerrarium()

// 宿主缩放时同步提高 WebGL 后备缓冲分辨率；视觉缩放不再放大固定栅格图。
// 开发：Codex / GPT / 模型 ID 无法确认
function applyRenderDensity() {
  const visualScale = Number.isFinite(requestedVisualScale) && requestedVisualScale > 0
    ? Math.min(requestedVisualScale, 3)
    : 1
  const density = Math.min((window.devicePixelRatio || 1) * visualScale, 6)
  renderer.setPixelRatio(density)
  renderer.setSize(WIDTH, HEIGHT, false)
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

function updateLighting(nightMix) {
  hemiLight.intensity = THREE.MathUtils.lerp(1.5, 0.84, nightMix)
  keyLight.intensity = THREE.MathUtils.lerp(3.2, 1.58, nightMix)
  rimLight.intensity = THREE.MathUtils.lerp(2.2, 3.1, nightMix)
  warmFill.intensity = THREE.MathUtils.lerp(6, 15, nightMix)
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 1, nightMix)
}

function updateAnimation(time, deltaSeconds) {
  const seconds = time / 1000
  const motion = reducedMotion ? 0 : 1
  const wateringBoost = clamp(1 - (seconds - wateringStartedAt) / 1.6, 0, 1)
  animatedFronds.forEach((frond) => {
    const { baseZ, phase, amplitude } = frond.userData
    frond.rotation.z = baseZ + Math.sin(seconds * (0.48 + wateringBoost * 1.8) + phase) * amplitude * (1 + wateringBoost * 2.8) * motion
    frond.rotation.x = Math.cos(seconds * 0.37 + phase) * amplitude * 0.42 * motion
  })
  animatedLeaves.forEach((plant, index) => {
    if (index === animatedLeaves.length - 1) {
      plant.position.x = -0.45 + Math.sin(seconds * 0.07) * 0.62 * motion
      plant.rotation.y = Math.sin(seconds * 0.11) * 0.16 * motion
    } else {
      plant.rotation.y = plant.userData.baseY + Math.sin(seconds * 0.3 + plant.userData.phase) * 0.035 * motion
    }
  })

  const nightMix = getNightMix()
  updateLighting(nightMix)
  fireflies.forEach((firefly, index) => {
    const visible = index < Math.round(settings.fireflies)
    firefly.visible = visible
    if (!visible) return
    const { origin, phase, coreMaterial, haloMaterial } = firefly.userData
    firefly.position.x = origin.x + Math.sin(seconds * 0.42 + phase) * 0.16 * motion
    firefly.position.y = origin.y + Math.cos(seconds * 0.34 + phase * 1.3) * 0.11 * motion
    firefly.position.z = origin.z + Math.sin(seconds * 0.29 + phase * 0.7) * 0.15 * motion
    const pulse = reducedMotion ? 0.7 : 0.28 + 0.72 * Math.pow((Math.sin(seconds * 2.15 + phase) + 1) / 2, 2)
    haloMaterial.opacity = pulse * (0.18 + nightMix * 0.5)
    coreMaterial.color.setRGB(1, 0.78 + pulse * 0.18, 0.35 + pulse * 0.25)
  })

  condensation.forEach((drop) => {
    drop.visible = settings.condensation && state.moisture > 0.28
    if (drop.visible && motion) {
      drop.position.y -= drop.userData.speed * deltaSeconds
      if (drop.position.y < drop.userData.originY - 0.34) drop.position.y = drop.userData.originY
    }
  })

  const waterElapsed = seconds - wateringStartedAt
  waterDrops.forEach((drop) => {
    const progress = (waterElapsed - drop.userData.delay) / 1.05
    drop.visible = progress >= 0 && progress <= 1
    if (drop.visible) {
      drop.position.set(drop.userData.x, 2.45 - progress * 4.3, drop.userData.z)
      drop.scale.y = 1.5 + progress * 1.2
    }
  })

  const healthy = clamp((state.moisture - 0.18) / 0.54, 0, 1)
  state.growth = clamp(state.growth + deltaSeconds * 0.0000042 * settings.growthSpeed * healthy, 0.55, 1)
  state.moisture = clamp(state.moisture - deltaSeconds * 0.0000028, 0.08, 1)
}

function frame(time) {
  if (!active) return
  const deltaSeconds = Math.min(0.1, Math.max(0, (time - lastFrameAt) / 1000))
  lastFrameAt = time
  updateAnimation(time, deltaSeconds)
  renderer.render(scene, camera)
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
      if (!isCurrentState(saved)) throw new Error('Stored terrarium state does not match version 3')
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
  wateringStartedAt = performance.now() / 1000
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
applyRenderDensity()

if (runtime) {
  runtime.setInteractionSurface({
    width: WIDTH,
    height: HEIGHT,
    regions: [
      {
        shape: 'polygon', action: 'drag',
        points: [
          { x: 175, y: 14 }, { x: 245, y: 14 }, { x: 253, y: 72 }, { x: 291, y: 92 },
          { x: 330, y: 132 }, { x: 354, y: 182 }, { x: 354, y: 448 }, { x: 330, y: 482 },
          { x: 90, y: 482 }, { x: 66, y: 448 }, { x: 66, y: 182 }, { x: 90, y: 132 },
          { x: 129, y: 92 }, { x: 167, y: 72 }
        ],
        hostGestures: ['move', 'scale-wheel', 'scale-hold']
      },
      { shape: 'ellipse', action: 'interactive', x: 168, y: 10, width: 84, height: 78 }
    ]
  })
  runtime.setBubbleAnchor({ x: 211, y: 8 })
  runtime.onSettingsChange(applySettings)
  runtime.onPresentationChange((presentation) => {
    if (presentation.phase === 'committed') {
      requestedVisualScale = presentation.visualScale
      applyRenderDensity()
    }
  })
  runtime.onLifecycle((lifecycle) => {
    if (lifecycle.type === 'hidden' || lifecycle.type === 'paused') stopAnimation()
    if (lifecycle.type === 'shown' || lifecycle.type === 'resumed') startAnimation()
  })
  runtime.onDispose(() => {
    active = false
    window.cancelAnimationFrame(animationFrame)
    renderer.dispose()
  })
  void loadState()
}

startAnimation()
