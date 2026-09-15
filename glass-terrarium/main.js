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
camera.lookAt(0, 0.24, 0)

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
    color: 0xb8e5dc,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.96,
    thickness: 0.28,
    ior: 1.47,
    transparent: true,
    opacity: 0.31,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  }),
  glassEdge: new THREE.MeshPhysicalMaterial({
    color: 0x9fd7cf,
    roughness: 0.04,
    transmission: 0.84,
    thickness: 0.42,
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x3b2115, roughness: 0.76, metalness: 0.04 }),
  walnutLight: new THREE.MeshStandardMaterial({ color: 0x6b3c22, roughness: 0.68, metalness: 0.02 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xa77935, roughness: 0.26, metalness: 0.91 }),
  brassDark: new THREE.MeshStandardMaterial({ color: 0x5d4020, roughness: 0.38, metalness: 0.82 }),
  enamel: new THREE.MeshPhysicalMaterial({ color: 0x1cb5b1, roughness: 0.12, metalness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.98 }),
  soilWet: new THREE.MeshStandardMaterial({ color: 0x352218, roughness: 0.82 }),
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
    [1.92, -3.05], [2.12, -2.82], [2.27, -2.25], [2.34, -1.1], [2.28, 0.1],
    [2.05, 1.05], [1.6, 1.8], [1.02, 2.35], [0.78, 2.52], [0.77, 3.18]
  ], materials.glass, 96)
  glass.renderOrder = 20
  world.add(glass)

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.03, 0.075, 12, 96), materials.glassEdge)
  baseRing.rotation.x = Math.PI / 2
  baseRing.position.y = -2.93
  baseRing.renderOrder = 21
  world.add(baseRing)

  for (const [y, radius, tube] of [[2.52, 0.82, 0.09], [3.12, 0.85, 0.08]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), materials.glassEdge)
    rim.rotation.x = Math.PI / 2
    rim.position.y = y
    rim.renderOrder = 21
    world.add(rim)
  }
}

function createStopperAndValve() {
  const stopper = new THREE.Group()
  stopper.add(makeLathe([[0.58, 0], [0.71, 0.16], [0.79, 0.42], [0.7, 0.65], [0.46, 0.86]], materials.walnut, 48))
  stopper.position.y = 3.16
  world.add(stopper)

  const grainGeometry = new THREE.TorusGeometry(0.63, 0.018, 5, 40)
  for (let index = 0; index < 5; index += 1) {
    const grain = new THREE.Mesh(grainGeometry, index % 2 ? materials.walnutLight : materials.walnut)
    grain.rotation.x = Math.PI / 2
    grain.position.y = 3.35 + index * 0.13
    grain.scale.set(1 - index * 0.035, 1 - index * 0.035, 1)
    world.add(grain)
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.09, 12, 64), materials.brass)
  collar.rotation.x = Math.PI / 2
  collar.position.y = 2.66
  world.add(collar)

  const valve = new THREE.Group()
  valve.position.set(0.77, 2.78, 0.06)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.25, 18), materials.brass)
  arm.rotation.z = Math.PI / 2
  arm.position.x = 0.55
  valve.add(arm)
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), materials.brassDark)
  hub.position.x = 1.12
  valve.add(hub)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 14), materials.brass)
  stem.position.set(1.12, -0.42, 0)
  valve.add(stem)
  const drop = makeLathe([[0.02, 0], [0.18, 0.14], [0.25, 0.42], [0.22, 0.72], [0, 0.96]], materials.enamel, 36)
  drop.position.set(1.12, -1.04, 0)
  drop.rotation.z = Math.PI
  drop.scale.set(0.82, 0.82, 0.46)
  valve.add(drop)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.22, 18), materials.brass)
  top.position.set(1.12, 0.32, 0)
  valve.add(top)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 10, 28), materials.brass)
  handle.rotation.x = Math.PI / 2
  handle.position.set(1.12, 0.51, 0)
  valve.add(handle)
  world.add(valve)
}

function createGround() {
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 1.88, 0.26, 64), materials.soil)
  bed.position.y = -2.86
  bed.receiveShadow = true
  world.add(bed)
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), materials.soilWet)
  mound.scale.set(1.96, 0.48, 1.56)
  mound.position.set(-0.08, -2.48, 0)
  mound.castShadow = true
  mound.receiveShadow = true
  world.add(mound)

  const pebbleGeometry = new THREE.DodecahedronGeometry(0.22, 1)
  for (let index = 0; index < 18; index += 1) {
    const pebble = new THREE.Mesh(pebbleGeometry, index % 3 ? materials.stone : materials.stoneLight)
    const angle = pseudo(index * 7) * Math.PI * 2
    const radius = 0.55 + pseudo(index * 11) * 1.25
    pebble.position.set(Math.cos(angle) * radius, -2.25 + pseudo(index * 17) * 0.18, Math.sin(angle) * radius)
    pebble.scale.set(0.5 + pseudo(index * 13), 0.32 + pseudo(index * 19) * 0.56, 0.55 + pseudo(index * 23))
    pebble.rotation.set(pseudo(index) * 2, pseudo(index + 3) * 2, pseudo(index + 8) * 2)
    pebble.castShadow = true
    world.add(pebble)
  }

  const mossGeometry = new THREE.IcosahedronGeometry(0.065, 2)
  for (let index = 0; index < 220; index += 1) {
    const tone = index % 5 === 0 ? materials.mossLight : index % 2 ? materials.moss : materials.mossDark
    const moss = new THREE.Mesh(mossGeometry, tone)
    const angle = pseudo(index * 29) * Math.PI * 2
    const radius = 0.22 + Math.sqrt(pseudo(index * 31)) * 1.78
    moss.position.set(Math.cos(angle) * radius, -2.14 + pseudo(index * 37) * 0.25, Math.sin(angle) * radius)
    const scale = 0.54 + pseudo(index * 41) * 1.08
    moss.scale.set(scale * (0.8 + pseudo(index * 43) * 0.5), scale, scale * (0.85 + pseudo(index * 47) * 0.4))
    moss.castShadow = index % 3 === 0
    world.add(moss)
  }
}

function createLog() {
  const trunk = cylinderBetween(new THREE.Vector3(-1.25, -1.95, -0.1), new THREE.Vector3(-0.55, 1.05, -0.48), 0.34, materials.bark, 18)
  world.add(trunk)
  const branchA = cylinderBetween(new THREE.Vector3(-0.95, -0.52, -0.25), new THREE.Vector3(-1.62, 0.12, 0.02), 0.16, materials.barkLight, 14)
  const branchB = cylinderBetween(new THREE.Vector3(-0.73, 0.24, -0.37), new THREE.Vector3(-0.18, 0.92, -0.23), 0.12, materials.barkLight, 14)
  world.add(branchA, branchB)

  const mossGeometry = new THREE.IcosahedronGeometry(0.065, 2)
  for (let index = 0; index < 72; index += 1) {
    const progress = pseudo(index * 17)
    const moss = new THREE.Mesh(mossGeometry, index % 4 ? materials.moss : materials.mossLight)
    moss.position.set(-1.27 + progress * 0.73 + pseudo(index * 3) * 0.25, -1.82 + progress * 2.65, 0.06 + pseudo(index * 5) * 0.22)
    const scale = 0.62 + pseudo(index * 7) * 1.08
    moss.scale.set(scale, scale * 0.72, scale)
    world.add(moss)
  }
}

function createRoundPlant(position, height, phase) {
  const group = new THREE.Group()
  group.position.copy(position)
  const stems = 7
  for (let index = 0; index < stems; index += 1) {
    const angle = (index / stems) * Math.PI * 2 + phase
    const reach = 0.28 + pseudo(index + phase) * 0.28
    const end = new THREE.Vector3(Math.cos(angle) * reach, height * (0.62 + pseudo(index * 4) * 0.38), Math.sin(angle) * reach)
    group.add(cylinderBetween(new THREE.Vector3(0, 0, 0), end, 0.018, materials.fernDark, 6))
    const leaf = makeHeartLeaf(0.28 + pseudo(index * 11 + phase) * 0.08, index % 3 ? materials.roundLeaf : materials.roundLeafLight)
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
    { position: [-0.96, -2.02, 0.02], height: 2.30, yaw: 0.14, lean: 0.08, phase: 0.4 },
    { position: [0.52, -2.05, -0.58], height: 2.62, yaw: -0.34, lean: -0.06, phase: 1.7 },
    { position: [0.98, -2.03, 0.06], height: 1.92, yaw: 0.48, lean: -0.05, phase: 3.1 },
    { position: [-0.12, -2.08, -0.92], height: 2.18, yaw: -0.72, lean: 0.03, phase: 4.5 },
    { position: [-1.18, -2.01, -0.52], height: 1.55, yaw: 0.78, lean: 0.04, phase: 5.3 }
  ]

  placements.forEach((placement, index) => {
    const plant = sourcePlants[index % sourcePlants.length].clone(true)
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
    plant.scale.set(scale * 0.66, scale, scale * 0.66)

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
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.52, 12), materials.mushroomStem)
  stem.position.y = 0.24
  stem.castShadow = true
  group.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glowing ? materials.mushroomGlow : materials.mushroomCap)
  cap.scale.y = 0.48
  cap.position.y = 0.52
  cap.castShadow = true
  group.add(cap)
  world.add(group)
}

function createSnail() {
  const snail = new THREE.Group()
  snail.position.set(-0.45, -1.88, 1.28)
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
  const coreGeometry = new THREE.SphereGeometry(0.027, 10, 8)
  const haloGeometry = new THREE.SphereGeometry(0.12, 12, 8)
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
    const y = -1.55 + pseudo(index * 11) * 3.65
    const bodyRadius = 2.17 - Math.max(0, y - 0.5) * 0.22
    drop.position.set(Math.sin(angle) * bodyRadius, y, Math.cos(angle) * bodyRadius)
    const size = 0.025 + pseudo(index * 13) * 0.045
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
    drop.userData = { delay: index * 0.035, x: -1.25 + pseudo(index * 31) * 2.5, z: -0.7 + pseudo(index * 37) * 1.45 }
    waterDrops.push(drop)
    world.add(drop)
  }
}

async function buildTerrarium() {
  createGround()
  createLog()
  await createDetailedFerns()
  createRoundPlant(new THREE.Vector3(0.12, -1.98, 0.72), 1.24, 0.8)
  createRoundPlant(new THREE.Vector3(-0.82, -1.94, 0.82), 0.98, 4.2)
  createMushroom(-1.34, -1.94, 1.05, 1.1, true)
  createMushroom(-0.98, -1.95, 1.22, 0.72, false)
  createMushroom(1.35, -1.96, 0.9, 0.86, true)
  createMushroom(1.02, -1.98, 1.3, 0.55, false)
  createSnail()
  createFireflies()
  createCondensation()
  createWaterDrops()
  createBottle()
  createStopperAndValve()
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
  hemiLight.intensity = THREE.MathUtils.lerp(1.5, 0.58, nightMix)
  keyLight.intensity = THREE.MathUtils.lerp(3.2, 1.15, nightMix)
  rimLight.intensity = THREE.MathUtils.lerp(2.2, 3.1, nightMix)
  warmFill.intensity = THREE.MathUtils.lerp(6, 15, nightMix)
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 0.92, nightMix)
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
      drop.position.set(drop.userData.x, 2.1 - progress * 4.0, drop.userData.z)
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
          { x: 171, y: 8 }, { x: 261, y: 8 }, { x: 285, y: 60 }, { x: 311, y: 91 },
          { x: 363, y: 151 }, { x: 397, y: 232 }, { x: 393, y: 444 }, { x: 348, y: 488 },
          { x: 77, y: 488 }, { x: 29, y: 441 }, { x: 35, y: 218 }, { x: 76, y: 137 },
          { x: 134, y: 79 }, { x: 151, y: 56 }
        ],
        hostGestures: ['move', 'scale-wheel', 'scale-hold']
      },
      { shape: 'ellipse', action: 'interactive', x: 285, y: 58, width: 82, height: 112 }
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
