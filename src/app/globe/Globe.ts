// Globe View: the pixel-art Earth, whose countries can be hovered and selected.
// Textures come from tools/data/build_world.py:
//   earth.png    pixel-art colour map
//   regions.png  region id per texel (R + G·256 = region index + 1, 0 = sea)
//   borders.png  country borders (RGBA)
// A small data texture maps each region index to a tint colour, which marks the selected
// country. Another holds each region's night-light density. Regions are internal: the user
// only sees the countries they make up.
//
// The sun follows the clock (UTC): the night side is dark with pixel city lights, and a thin
// atmosphere glows on the lit side of the limb. Semi-transparent pixel clouds, baked once when
// the globe is made, drift in a shell just above the ground.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Pinch, PINCH_OUT } from "../pinch";
import { renderScale } from "../renderScale";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RegionTint {
  /** CSS colour, or null for no tint. */
  color: string | null;
  /** 0–1 tint strength. */
  strength: number;
}

const RADIUS = 1;
/** The atmosphere shell sits just above the surface: a thin wisp, not a thick halo. */
const ATMOSPHERE_RADIUS = 1.022;
/** Clouds float just above the ground. */
const CLOUD_RADIUS = 1.005;
/** Turns of the cloud shell per second (eastward drift). */
const CLOUD_DRIFT = 0.0012;
/** The clouds' baked map, a texel to each pixel of earth.png. */
const CLOUD_GRID = new THREE.Vector2(2048, 1024);
const OBLIQUITY = (23.44 * Math.PI) / 180;

/**
 * Direction from Earth's centre to the sun in globe coordinates, for a day of the year
 * (0 = 1 January) and a time of day as a fraction of 24 h UTC. Ignores the equation of
 * time, which shifts noon by at most ~16 minutes.
 */
export function sunDirection(dayOfYear: number, dayFraction: number, target = new THREE.Vector3()): THREE.Vector3 {
  const declination = -OBLIQUITY * Math.cos(((2 * Math.PI) / 365.25) * (dayOfYear + dayFraction + 10));
  // At 12:00 UTC the sun is overhead at 0°; it moves 15° west per hour.
  const longitude = -(dayFraction - 0.5) * 2 * Math.PI;
  // The texture starts at −180°, so (lat, lon) maps to (cos lat cos lon, sin lat, −cos lat sin lon).
  return target.set(Math.cos(declination) * Math.cos(longitude), Math.sin(declination), -Math.cos(declination) * Math.sin(longitude));
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D earth;
  uniform sampler2D regions;
  uniform sampler2D borders;
  uniform sampler2D tints;
  uniform sampler2D lights;
  uniform float tintCount;
  uniform vec2 mapSize;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Night-light density of the region under a map coordinate (0 at sea).
  float lightDensity(vec2 uv) {
    vec4 t = texture2D(regions, uv);
    float id = floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) * 256.0;
    return id > 0.5 ? texture2D(lights, vec2((id + 0.5) / tintCount, 0.5)).r : 0.0;
  }

  void main() {
    vec3 base = texture2D(earth, vUv).rgb;
    vec4 idTexel = texture2D(regions, vUv);
    float id = floor(idTexel.r * 255.0 + 0.5) + floor(idTexel.g * 255.0 + 0.5) * 256.0;
    if (id > 0.5) {
      vec4 tint = texture2D(tints, vec2((id + 0.5) / tintCount, 0.5));
      base = mix(base, tint.rgb, tint.a);
    }
    vec4 border = texture2D(borders, vUv);
    base = mix(base, border.rgb, border.a * 0.8);
    // Hovered country (the lights texture's green channel): a soft glow, brighter on its borders.
    float hover = id > 0.5 ? texture2D(lights, vec2((id + 0.5) / tintCount, 0.5)).g : 0.0;

    // Day/night with a soft terminator. The night side stays dim rather than black so the
    // map (tints and borders) is still readable.
    float sun = dot(normalize(vNormal), normalize(sunDirection));
    float day = smoothstep(-0.10, 0.12, sun);
    vec3 lit = base * (0.62 + 0.55 * clamp(sun, 0.0, 1.0));
    vec3 night = base * vec3(0.16, 0.18, 0.28) + border.rgb * border.a * 0.12;
    vec3 color = mix(night, lit, day);
    // Warm band along the terminator.
    float twilight = exp(-pow(sun / 0.08, 2.0));
    color += vec3(0.32, 0.12, 0.02) * twilight * 0.18;
    color = mix(color, vec3(0.92, 0.97, 1.0), hover * (0.14 + 0.3 * border.a));

    // City lights: sparse pixel lights, as before, but each one is a small round dot at a
    // jittered spot in its map texel rather than a filled square. Neighbouring texels are
    // checked too, so a dot's soft edge can spill past its own texel and the grid doesn't show.
    // Lit texels rise steeply with density, so only crowded, wealthy regions read as bright.
    float night_ = 1.0 - day;
    if (night_ > 0.0) {
      vec2 p = vUv * mapSize;
      vec2 cell = floor(p);
      float lightSum = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 c = cell + vec2(float(x), float(y));
          c.x = mod(c.x, mapSize.x);
          float chance = 0.22 * pow(lightDensity((c + 0.5) / mapSize), 2.5);
          if (hash(c) <= 1.0 - chance) continue;
          vec2 center = c + 0.5 + (vec2(hash(c + 3.1), hash(c + 7.7)) - 0.5) * 0.6;
          vec2 offset = p - center;
          // Wrap the distance at the 180° seam.
          offset.x -= mapSize.x * floor(offset.x / mapSize.x + 0.5);
          float brightness = 0.5 + 0.5 * hash(c + 17.0);
          lightSum += brightness * exp(-dot(offset, offset) / 0.22);
        }
      }
      color += vec3(1.0, 0.78, 0.42) * min(lightSum, 1.2) * night_ * 1.05;
    }

    // Atmospheric haze toward the limb, on the lit side only.
    float rim = pow(1.0 - abs(normalize(vViewNormal).z), 3.0);
    color += vec3(0.30, 0.55, 1.0) * rim * 0.30 * smoothstep(-0.25, 0.35, sun);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewNormal;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Drawn from the inside of a slightly larger sphere (back faces) with additive blending.
// Where the shell rises off the planet's edge, the back-face normal turns from facing away
// (just above the surface) to side-on (the shell's outer edge), so the glow is brightest
// at the surface and fades to nothing a thin band above it.
const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 sunDirection;
  uniform float edge;
  varying vec3 vNormal;
  varying vec3 vViewNormal;
  void main() {
    float height = clamp(-normalize(vViewNormal).z / edge, 0.0, 1.0);
    float glow = pow(height, 1.6);
    float sun = dot(normalize(vNormal), normalize(sunDirection));
    float lit = smoothstep(-0.30, 0.25, sun);
    // Blue by day, reddening at the terminator.
    vec3 color = mix(vec3(0.95, 0.45, 0.20), vec3(0.35, 0.62, 1.0), smoothstep(-0.05, 0.35, sun));
    gl_FragColor = vec4(color * glow * (0.06 + 1.3 * lit), 1.0);
  }
`;

// Clouds are made from 3D noise sampled at each point of the sphere, so they keep their shape
// everywhere (an equirectangular cloud map pinches into streaks at the poles). That is far too
// slow to do for every pixel on every frame, and they only drift, so it is done once, a texel to
// each pixel of the map's grid, and the shell then reads the result. A warped, east–west
// stretched fractal gives wispy decks and streaks.
const cloudBakeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const cloudBakeFragmentShader = /* glsl */ `
  varying vec2 vUv;

  float sq(float x) {
    return x * x;
  }

  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y),
      u.z);
  }

  float fbm(vec3 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float total = 0.0;
    for (int i = 0; i < 7; i++) {
      if (i >= octaves) break;
      sum += amp * noise(p);
      total += amp;
      p = p * 2.03 + 17.1;
      amp *= 0.52;
    }
    return sum / total;
  }

  void main() {
    // The sphere's u starts at −180°, as the map does (see latLonToVector).
    float lon = vUv.x * 6.2831853 - 3.1415927;
    float lat = (vUv.y - 0.5) * 3.1415927;
    vec3 p = vec3(cos(lat) * cos(lon), sin(lat), -cos(lat) * sin(lon));
    // Warp the sampling point for curling, streaky shapes.
    vec3 warp = vec3(fbm(p * 2.2 + 3.7, 3), fbm(p * 2.2 + 11.3, 3), fbm(p * 2.2 + 23.9, 3)) - 0.5;
    vec3 q = p + warp * 0.35;
    // A gentle preference for the tropics' convergence zone and the storm tracks near ±55°,
    // fewer clouds over the subtropical deserts, and thin, scattered ones over the poles.
    float a = abs(lat);
    float band = 0.3 * exp(-sq(lat / 0.14)) + 0.35 * exp(-sq((a - 0.96) / 0.25)) - 0.35 * exp(-sq((a - 0.45) / 0.15)) - 0.5 * smoothstep(1.15, 1.5, a);
    // In standard deviations of the fractal (which clusters tightly around 0.5), so cut-offs read
    // as shares of the sky. Packed into two channels, for a plain texture that every phone can draw to.
    float density = (fbm(vec3(q.x, q.y * 2.0, q.z) * 5.5, 7) - 0.5) / 0.085 + band;
    float packed = clamp((density + 6.0) / 12.0, 0.0, 1.0) * 255.0;
    gl_FragColor = vec4(floor(packed) / 255.0, fract(packed), 0.0, 1.0);
  }
`;

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A second sample a little toward the sun shades each cloud's far side, and the light is cut
// into a few tones.
const cloudFragmentShader = /* glsl */ `
  uniform sampler2D densities;
  uniform float drift;
  uniform vec2 grid;
  uniform vec3 sunDirection;
  varying vec2 vUv;

  float sq(float x) {
    return x * x;
  }

  // Cloud density at a point of the baked map.
  float density(vec2 uv) {
    vec4 t = texture2D(densities, vec2(fract(uv.x), uv.y));
    return (t.r + t.g / 255.0) * 12.0 - 6.0;
  }

  // Rotates about the polar axis, adding a to the longitude.
  vec3 rotY(vec3 v, float a) {
    return vec3(v.x * cos(a) + v.z * sin(a), v.y, -v.x * sin(a) + v.z * cos(a));
  }

  void main() {
    // The centre of this fragment's map pixel; the clouds' map turns under it with the drift.
    vec2 cell = (floor(vUv * grid) + 0.5) / grid;
    float d = density(vec2(cell.x - drift, cell.y));
    // Coverage: about one sky in six.
    const float edge = 1.3;
    if (d < edge) discard;
    float thick = smoothstep(edge, edge + 1.2, d);

    // The sphere's u starts at −180°, as the map does (see latLonToVector).
    float lon = cell.x * 6.2831853 - 3.1415927;
    float lat = (cell.y - 0.5) * 3.1415927;
    vec3 world = vec3(cos(lat) * cos(lon), sin(lat), -cos(lat) * sin(lon));

    // Self-shadowing: more cloud toward the sun means this side faces away from it.
    vec3 sunDir = normalize(sunDirection);
    float turn = -drift * 6.2831853;
    vec3 toward = normalize(rotY(world, turn) + rotY(normalize(sunDir - dot(sunDir, world) * world + 1e-5), turn) * 0.025);
    float ahead = density(vec2(atan(-toward.z, toward.x) / 6.2831853 + 0.5, asin(toward.y) / 3.1415927 + 0.5));
    float light = clamp(0.55 + (d - ahead) * 0.6 + thick * 0.3, 0.0, 1.0);
    // Four tones, pixel-art style: shadowed underside, mid, lit, bright top.
    float tone = floor(light * 3.99) / 3.0;
    vec3 base = mix(vec3(0.58, 0.63, 0.72), vec3(1.0, 1.0, 1.0), tone);

    float sun = dot(world, sunDir);
    float day = smoothstep(-0.12, 0.15, sun);
    vec3 lit = base * (0.6 + 0.5 * clamp(sun, 0.0, 1.0));
    // Sunset pink along the terminator.
    lit = mix(lit, lit * vec3(1.15, 0.78, 0.62), exp(-sq(sun / 0.12)) * 0.6);
    vec3 color = mix(vec3(0.07, 0.08, 0.13), lit, day);
    // Thin fringes, denser cores; in two steps so edges stay crisp.
    float alpha = thick > 0.35 ? 0.62 : 0.36;
    gl_FragColor = vec4(color, alpha * (0.45 + 0.55 * day));
  }
`;

/** Unit vector for a latitude and longitude in degrees, matching the texture (see sunDirection). */
function latLonToVector(p: LatLon, target = new THREE.Vector3()): THREE.Vector3 {
  const lat = (p.lat * Math.PI) / 180;
  const lon = (p.lon * Math.PI) / 180;
  return target.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

/** The camera's starting distance, in Earth radii, which zoom speeds are measured from. */
const CAMERA_START_DISTANCE = Math.hypot(0.9, 1.2, 2.9);
/** How far out the camera can go, in Earth radii, before the Solar System view takes over. */
export const GLOBE_FARTHEST = 12;
/** Where the globe starts to fade into the Solar System view's Earth. */
export const GLOBE_FADE_FROM = 8;
/** How long the glide in after flying home takes. */
const GLIDE_SECONDS = 0.8;

function loadTexture(url: string, data: boolean): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url).then((texture) => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    // Id maps must be read back exactly, so no colour-space conversion.
    texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    return texture;
  });
}

/** CPU copy of the region id map, for picking. */
async function loadIdMap(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data };
}
export class Globe {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly earth: THREE.Mesh;
  private readonly tintData: Uint8Array;
  private readonly tintTexture: THREE.DataTexture;
  private readonly lightData: Uint8Array;
  private readonly lightTexture: THREE.DataTexture;
  /**
   * Called when the user scrolls out past the farthest zoom (to the Solar System view), with
   * the camera's direction from the Earth's centre (in the globe's Earth-fixed frame) and its
   * distance in Earth radii.
   */
  onZoomOut: ((direction: THREE.Vector3, distance: number) => void) | null = null;
  /**
   * Called every frame, just before the globe is drawn, with its camera: the Solar System view
   * beneath follows it, drawing in the same frame.
   */
  onFrame: ((camera: THREE.PerspectiveCamera) => void) | null = null;
  /** Rendering pauses while another view is shown. */
  private active = true;
  /** A glide in after coming back from the Solar System view, in Earth radii. */
  private glide: { from: number; to: number; start: number } | null = null;
  /** A turn to a country found by search. */
  private turn: { rotation: THREE.Quaternion; from: THREE.Vector3; start: number } | null = null;

  private readonly sun = new THREE.Vector3(1, 0, 0);
  private idMap: { width: number; height: number; data: Uint8ClampedArray } | null = null;
  private frame = 0;
  private downAt: { x: number; y: number } | null = null;
  private hovered = -1;
  private readonly pinch = new Pinch();
  private readonly clouds: THREE.Mesh;
  private readonly cloudMap = new THREE.WebGLRenderTarget(CLOUD_GRID.x, CLOUD_GRID.y, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  /** The clouds' drift (turns), shared with their shader. */
  private readonly drift = { value: 0 };
  private readonly clock = new THREE.Clock();

  constructor(
    private readonly container: HTMLElement,
    regionCount: number,
    private readonly onSelectRegion: (regionIndex: number | null) => void,
    private readonly onHoverRegion: (regionIndex: number | null) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setPixelRatio(renderScale());
    // See-through, so the Solar System view drawn beneath shows through (its stars, the Sun and
    // the Moon), and the globe fades into its pixel-art Earth as the camera pulls out.
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0.9, 1.2, 2.9);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = GLOBE_FARTHEST;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;

    // Index 0 is the sea; regions are 1..regionCount.
    const tintCount = regionCount + 1;
    this.tintData = new Uint8Array(tintCount * 4);
    this.tintTexture = new THREE.DataTexture(this.tintData, tintCount, 1, THREE.RGBAFormat);
    this.tintTexture.magFilter = THREE.NearestFilter;
    this.tintTexture.minFilter = THREE.NearestFilter;
    this.tintTexture.needsUpdate = true;
    this.lightData = new Uint8Array(tintCount * 4);
    this.lightTexture = new THREE.DataTexture(this.lightData, tintCount, 1, THREE.RGBAFormat);
    this.lightTexture.magFilter = THREE.NearestFilter;
    this.lightTexture.minFilter = THREE.NearestFilter;
    this.lightTexture.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        earth: { value: null },
        regions: { value: null },
        borders: { value: null },
        tints: { value: this.tintTexture },
        lights: { value: this.lightTexture },
        tintCount: { value: tintCount },
        mapSize: { value: new THREE.Vector2(2048, 1024) },
        sunDirection: { value: this.sun },
      },
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 128, 64), material);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 128, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
          sunDirection: { value: this.sun },
          // How far from side-on the back-face normal is at the planet's edge: sqrt(1 − (R / Ratm)²).
          edge: { value: Math.sqrt(1 - (RADIUS / ATMOSPHERE_RADIUS) ** 2) },
        },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(CLOUD_RADIUS, 128, 64),
      new THREE.ShaderMaterial({
        vertexShader: cloudVertexShader,
        fragmentShader: cloudFragmentShader,
        uniforms: { densities: { value: this.cloudMap.texture }, grid: { value: CLOUD_GRID }, drift: this.drift, sunDirection: { value: this.sun } },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.earth, atmosphere, this.clouds);
    this.bakeClouds();

    const base = import.meta.env.BASE_URL;
    void Promise.all([
      loadTexture(`${base}map/earth.png`, false),
      loadTexture(`${base}map/regions.png`, true),
      loadTexture(`${base}map/borders.png`, false),
      loadIdMap(`${base}map/regions.png`),
    ]).then(([earth, regions, borders, idMap]) => {
      material.uniforms.earth!.value = earth;
      const image = earth.image as { width: number; height: number };
      material.uniforms.mapSize!.value.set(image.width, image.height);
      material.uniforms.regions!.value = regions;
      material.uniforms.borders!.value = borders;
      this.idMap = idMap;
    });

    const canvas = this.renderer.domElement;
    // A phone can take the GPU's memory back while the tab is in the background.
    canvas.addEventListener("webglcontextrestored", this.bakeClouds);
    canvas.addEventListener("pointerdown", this.handleDown);
    canvas.addEventListener("pointerup", this.handleUp);
    canvas.addEventListener("pointercancel", this.handleCancel);
    canvas.addEventListener("pointermove", this.handleMove);
    canvas.addEventListener("pointerleave", this.handleLeave);
    canvas.addEventListener("wheel", this.handleWheel, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  /** Draws the clouds' map. */
  private readonly bakeClouds = (): void => {
    const material = new THREE.ShaderMaterial({ vertexShader: cloudBakeVertexShader, fragmentShader: cloudBakeFragmentShader, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.renderer.setRenderTarget(this.cloudMap);
    this.renderer.render(quad, new THREE.Camera());
    this.renderer.setRenderTarget(null);
    quad.geometry.dispose();
    material.dispose();
  };

  /** Sets the tint of every region, indexed like regions.json. */
  setTints(tints: RegionTint[]): void {
    const color = new THREE.Color();
    tints.forEach((tint, i) => {
      const o = (i + 1) * 4;
      if (tint.color) {
        color.set(tint.color);
        this.tintData[o] = Math.round(color.r * 255);
        this.tintData[o + 1] = Math.round(color.g * 255);
        this.tintData[o + 2] = Math.round(color.b * 255);
      }
      this.tintData[o + 3] = tint.color ? Math.round(tint.strength * 255) : 0;
    });
    this.tintTexture.needsUpdate = true;
  }

  /** Night-light density (0–1) of every region, indexed like regions.json. */
  setLights(densities: number[]): void {
    densities.forEach((d, i) => (this.lightData[(i + 1) * 4] = Math.round(Math.min(1, Math.max(0, d)) * 255)));
    this.lightTexture.needsUpdate = true;
  }

  /** Glows the given regions (indexed like regions.json) to show they can be clicked. */
  setHover(regionIndices: number[]): void {
    for (let k = 1; k * 4 < this.lightData.length; k++) this.lightData[k * 4 + 1] = 0;
    for (const i of regionIndices) this.lightData[(i + 1) * 4 + 1] = 255;
    this.lightTexture.needsUpdate = true;
    this.renderer.domElement.style.cursor = regionIndices.length > 0 ? "pointer" : "";
  }

  /** Turns the globe so a point faces the camera, coming in to a distance in Earth radii if further out. */
  turnTo(p: LatLon, distance: number): void {
    const now = this.clock.getElapsedTime();
    const from = this.camera.position.clone().normalize();
    this.turn = { rotation: new THREE.Quaternion().setFromUnitVectors(from, latLonToVector(p)), from, start: now };
    const at = this.camera.position.length();
    if (at > distance) this.glide = { from: at, to: distance, start: now };
  }

  /** The camera's direction from the Earth's centre, and its distance in Earth radii. */
  cameraPlace(): { direction: THREE.Vector3; distance: number } {
    return { direction: this.camera.position.clone().normalize(), distance: this.camera.position.length() };
  }

  /** Places the sun for a day of the year (0 = 1 January) and time of day (fraction of 24 h UTC). */
  setTime(dayOfYear: number, dayFraction: number): void {
    sunDirection(dayOfYear, dayFraction, this.sun);
  }

  /** Region index under a screen point, or null for sea and space. */
  private regionAt(event: PointerEvent): number | null {
    if (!this.idMap) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const uv = this.raycaster.intersectObject(this.earth)[0]?.uv;
    if (!uv) return null;
    const { width, height, data } = this.idMap;
    const x = Math.min(width - 1, Math.floor(uv.x * width));
    const y = Math.min(height - 1, Math.floor((1 - uv.y) * height));
    const o = (y * width + x) * 4;
    const id = data[o]! + data[o + 1]! * 256;
    return id > 0 ? id - 1 : null;
  }

  private readonly handleDown = (event: PointerEvent): void => {
    this.pinch.down(event);
    // A second finger makes it a pinch, not a tap.
    this.downAt = this.pinch.active ? null : { x: event.clientX, y: event.clientY };
    this.turn = null;
  };

  private readonly handleUp = (event: PointerEvent): void => {
    this.pinch.up(event);
    const down = this.downAt;
    this.downAt = null;
    // Dragging rotates the globe; only a near-stationary press counts as a click.
    if (!down || Math.abs(event.clientX - down.x) + Math.abs(event.clientY - down.y) > 5) return;
    this.onSelectRegion(this.regionAt(event));
  };

  private readonly handleCancel = (event: PointerEvent): void => {
    this.pinch.up(event);
    this.downAt = null;
  };

  private readonly handleMove = (event: PointerEvent): void => {
    const spread = this.pinch.move(event);
    if (spread !== null) {
      if (spread < PINCH_OUT) this.zoomOutIfFar();
      return;
    }
    if (this.downAt || event.pointerType === "touch") return;
    const region = this.regionAt(event) ?? -1;
    if (region !== this.hovered) {
      this.hovered = region;
      this.onHoverRegion(region >= 0 ? region : null);
    }
  };

  private readonly handleLeave = (): void => {
    this.hovered = -1;
    this.onHoverRegion(null);
  };

  /** Another notch out at the farthest zoom carries on into the Solar System view. */
  private readonly handleWheel = (event: WheelEvent): void => {
    if (event.deltaY > 0) this.zoomOutIfFar();
  };

  private zoomOutIfFar(): void {
    const far = this.camera.position.length() >= this.controls.maxDistance * 0.995;
    if (far && this.onZoomOut) this.onZoomOut(this.camera.position.clone().normalize(), this.camera.position.length());
  }

  /** Pauses rendering (and hides the globe, so the view beneath takes the mouse) while another view is shown. */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.pinch.clear();
    this.renderer.domElement.style.visibility = active ? "" : "hidden";
    if (!active) return;
    this.controls.update();
    this.resize();
  }

  /**
   * Puts the camera at a direction (Earth-fixed frame) and distance in Earth radii, e.g. on
   * coming back from the Solar System view, and optionally glides it in to another distance.
   */
  setCamera(direction: THREE.Vector3, distance: number, glideTo?: number): void {
    const clamp = (d: number) => THREE.MathUtils.clamp(d, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(direction).normalize().multiplyScalar(clamp(distance));
    this.glide = glideTo === undefined ? null : { from: clamp(distance), to: clamp(glideTo), start: this.clock.getElapsedTime() };
    this.controls.update();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.active) return;
    // Zooming speeds up with distance, matching the Solar System view where they meet.
    this.controls.zoomSpeed = 0.8 * Math.sqrt(Math.max(1, this.camera.position.length() / CAMERA_START_DISTANCE));
    if (this.turn) {
      const t = Math.min(1, (this.clock.getElapsedTime() - this.turn.start) / GLIDE_SECONDS);
      const rotation = new THREE.Quaternion().slerp(this.turn.rotation, t * (2 - t));
      this.camera.position.copy(this.turn.from).applyQuaternion(rotation).multiplyScalar(this.camera.position.length());
      if (t >= 1) this.turn = null;
    }
    if (this.glide) {
      const t = Math.min(1, (this.clock.getElapsedTime() - this.glide.start) / GLIDE_SECONDS);
      const eased = t * (2 - t);
      this.camera.position.setLength(Math.exp(THREE.MathUtils.lerp(Math.log(this.glide.from), Math.log(this.glide.to), eased)));
      if (t >= 1) this.glide = null;
    }
    this.controls.update();
    const fade = (this.camera.position.length() - GLOBE_FADE_FROM) / (GLOBE_FARTHEST - GLOBE_FADE_FROM);
    this.renderer.domElement.style.opacity = String(1 - THREE.MathUtils.clamp(fade, 0, 1));
    this.drift.value = (this.clock.getElapsedTime() * CLOUD_DRIFT) % 1;
    this.camera.updateMatrixWorld();
    this.onFrame?.(this.camera);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("webglcontextrestored", this.bakeClouds);
    canvas.removeEventListener("pointerdown", this.handleDown);
    canvas.removeEventListener("pointerup", this.handleUp);
    canvas.removeEventListener("pointercancel", this.handleCancel);
    canvas.removeEventListener("pointermove", this.handleMove);
    canvas.removeEventListener("pointerleave", this.handleLeave);
    canvas.removeEventListener("wheel", this.handleWheel);
    this.controls.dispose();
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.cloudMap.dispose();
    this.renderer.dispose();
    // Free the context now rather than at garbage collection: browsers cap live WebGL
    // contexts, and dev hot reloads create a new globe each time.
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
