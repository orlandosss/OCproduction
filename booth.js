/* ==========================================================================
   Orlando Costi Visuals - Cabina di Proiezione 3D interattiva
   --------------------------------------------------------------------------
   Scaffold WebGL: caricamento scena, look-around, raycasting sui POI,
   fly-to della camera con GSAP, reveal contenuti + animazioni GLTF.

   Convenzione anchor (dal file .glb di Orlando):
     - POI_<Sezione>  -> oggetto/bersaglio che la camera GUARDA (invisibile)
     - CAM_<Sezione>  -> punto in cui la camera si POSIZIONA
   Finché non arriva il .glb usiamo una scena placeholder con box colorati.
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import gsap from 'gsap';

/* ----------------------------------------------------------------------
   0. Configurazione
---------------------------------------------------------------------- */
const CONFIG = {
    // Metti a false e imposta MODEL_URL quando il .glb è pronto.
    USE_PLACEHOLDER: false,
    MODEL_URL: 'assets/booth/booth.glb',

    // Modalità BAKED (lightmap): texture ORIGINALI nitide (1º UV) × luce cotta
    // da Cycles (2º UV). Nessuna luce/IBL runtime extra (era quella il "troppa
    // luce"): solo un filo di env per i riflessi del metallo. Look = Blender.
    USE_BAKED: true,
    // booth.glb = export corrente con l'animazione 'apricassetto' del cassetto.
    // (Niente lightmap su questo export: la scena è illuminata dal rig realtime.)
    BAKED_URL: 'assets/booth/booth.glb',
    LIGHTMAP_URL: 'assets/booth/booth_lightmap.webp',
    LIGHTMAP_INTENSITY: 0.12, // solo GI/rimbalzo tenue; la scena la fanno le luci realtime

    // Impianto luci REALTIME fedele a Blender (posizione, direzione, dimensioni,
    // angolo, intensità). Moltiplicatori W->three.js tunabili a runtime.
    LIGHT_MULT: 1.0,     // scala globale di tutte le luci
    SPOT_WATT: 2.2,      // fattore energia(W) -> intensità spot (abbassato: meno disco sul pavimento)
    AREA_WATT: 2.0,      // fattore energia(W) -> intensità area (nits)
    SPOT_SHADOWS: true,
    SPOT_SOFT: 0.7,      // penombra minima: bordi delle pozze più morbidi
    SHADOW_RADIUS: 8,    // ombre più soffici
    // Debug: solo queste luci sono attive (null = tutte). Nomi come in Blender.
    ACTIVE_LIGHTS: null,

    AMBIENT: 0.34,      // ambientale impostata a 0.34 per un bilanciamento ottimale delle ombre
    // Rim light: taglio da sinistra->destra sul fianco del proiettore, per
    // rivelarne contorni/riflesso. Alta intensità, penombra ridotta per contorni netti.
    RIM: {
        pos: [-0.9, 1.62, -1.55],      // a sinistra del proiettore
        target: [0.44, 1.55, -1.57],   // fianco del proiettore
        color: 0xccd6ff, intensity: 3.6, angleDeg: 55, penumbra: 0.3, distance: 2.4,
    },
    // Le 8 luci attive estratte da Blender (coord three.js).
    BLENDER_LIGHTS: [
        { name: 'Area',     type: 'AREA', pos: [0.449, 2.012, -2.13],  dir: [-0.015, -0.358, 0.934], energy: 0.8,  color: [1,1,1], size: 2.0, sizeY: 2.0 },
        { name: 'Area.001', type: 'SPOT', pos: [2.033, 2.242, -1.159], dir: [-0.052, -0.998, 0.02],  energy: 29.0, color: [1,1,1], angleDeg: 65.0, blend: 0.15 },
        { name: 'Area.002', type: 'AREA', pos: [0.452, 1.264, -0.349], dir: [-0.005, -0.975, -0.221],energy: 1.5,  color: [1,1,1], size: 1.0, sizeY: 1.0 },
        { name: 'Area.003', type: 'SPOT', pos: [0.438, 1.753, -1.983], dir: [0, 0, -1],              energy: 10.0, color: [1,1,1], angleDeg: 55.0, blend: 0.8 },
        { name: 'Area.004', type: 'SPOT', pos: [-0.08, 2.65, 1.214],   dir: [0, -0.361, 0.933],      energy: 10.0, color: [1,1,1], angleDeg: 80.0, blend: 0.45 },
        { name: 'Area.006', type: 'SPOT', pos: [-2.03, 1.957, 2.303],  dir: [0.119, -0.916, -0.383], energy: 10.0, color: [1,1,1], angleDeg: 84.3, blend: 0.15 },
        { name: 'Light.001',type: 'SPOT', pos: [-1.952, 1.746, -1.765],dir: [0.157, -0.865, 0.476],  energy: 9.0,  color: [1,1,1], angleDeg: 74.0, blend: 0.85 },
        { name: 'Light.002',type: 'SPOT', pos: [-1.5, 2.4, 2.0],        dir: [-0.45, -0.89, 0.0],     energy: 0.0,  color: [1,1,1], angleDeg: 45.0, blend: 0.95 },
    ],

    // Post-process "pellicola": grana + vignetta marcate (stile che ti piaceva).
    FILM: { grain: 0.32, vignette: 1.25, aberration: 0.0005 },

    // Color management identico a Blender: AgX + look Greyscale, exposure -0.39,
    // gamma 0.86. L'AgX è applicato dal tone mapping del renderer; qui restano
    // le regolazioni post (B/N + gamma).
    GRADE: { saturation: 0.0, exposure: 0.0, gamma: 0.9, contrast: 1.45 },

    // In placeholder mostriamo i cubi POI/CAM per vederli e cliccarli.
    // Con il modello reale i POI restano invisibili: il raycaster li
    // colpisce comunque perché li interroghiamo esplicitamente (Raycaster
    // NON filtra sul flag .visible degli oggetti che gli passiamo).
    SHOW_ANCHORS: false,

    HOME_POS: new THREE.Vector3(0.4, 1.35, 0.5), // abbassata e spostata a destra per prospettiva Blender
    HOME_LOOK: new THREE.Vector3(-0.1, 1.48, -1), // sguardo allineato sul proiettore e parte dello scrittoio

    LOOK_SENSITIVITY: 0.0026,
    MAX_PITCH: THREE.MathUtils.degToRad(55),
    FLY_DURATION: 1.6,
    DRAG_THRESHOLD: 6, // px: sotto questa soglia il pointer-up è un "click"
    DEFAULT_FOV: 70,   // FOV grandangolare calibrato per la vista di Blender
    FISHEYE: 0.07,     // intensità distorsione barrel (0 = off); tunabile a runtime
    ENV_INTENSITY: 0,  // IBL OFF: era luce ambientale extra che in Blender non c'è
    BLOOM: 0.23,       // alone tenue sulle sorgenti (halation da pellicola)
    BLOOM_THRESHOLD: 0.9, // solo le zone più luminose fioriscono
    SHADOWS: true,     // ombre proiettate dalle luci pratiche
};

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Contenuti mostrati all'arrivo su ogni POI + nome della clip GLTF da riprodurre.
// Le chiavi combaciano con i suffissi dei cubi POI_* / camere CAM_* in Blender.
const SECTIONS = {
    // Cassetto del cinema: all'arrivo si apre (clip Blender) e mostra la scelta corti.
    Cinema: {
        label: '01 / Cinema',
        title: 'Cortometraggi',
        clip: 'apricassetto',
        flow: 'films',
        color: 0x8ab4f8,
    },
    // Prima tappa fotografia: scelta della serie -> vola al muro con la serie scelta.
    PhotoSelect: {
        label: '02 / Fotografia',
        title: 'Progetti fotografici',
        flow: 'projects',
        color: 0xf8b48a,
    },
    // Seconda tappa: il muro dove la serie scelta viene appesa (foto cliccabili).
    PhotoWall: {
        label: '02 / Fotografia',
        title: 'Serie esposta',
        flow: 'wall',
        color: 0xf8c48a,
    },
    About: {
        label: '03 / Chi Sono',
        title: 'Orlando Costi',
        color: 0x9ae6b4,
        body: `
            <p>Visual artist — <strong>Direttore della Fotografia e Fotografo</strong>.
               Studio all'Accademia di Belle Arti di Venezia (Nuove Tecnologie
               dell'Arte) e racconto storie attraverso la luce e il movimento:
               regia, montaggio e direzione della fotografia per cinema, brand
               e progetti musicali.</p>
            <div class="skill-chips">
                <span>Regia</span><span>Montaggio</span><span>Direzione Fotografia</span>
                <span>Fotografia</span><span>3D &amp; Blender</span><span>Adobe Suite</span>
                <span>DaVinci Resolve</span><span>Strumenti AI</span>
            </div>`,
    },
    Contact: {
        label: '04 / Contatti',
        title: 'Lavoriamo insieme',
        color: 0xe6b4f8,
        body: `
            <p>Per collaborazioni, preventivi o anche solo per parlare di un'idea:</p>
            <p><a class="contact-link" href="mailto:info@orlandocostivisuals.com">
               &#9993;&nbsp; info@orlandocostivisuals.com</a></p>
            <p class="contact-alt">Oppure visita la <a href="index.html">versione classica del sito</a>
               per il modulo di contatto completo.</p>`,
    },
    // Porta di uscita: tenta di chiudere la scheda, altrimenti mostra un saluto.
    Exit: {
        label: 'Uscita',
        title: 'Fine proiezione',
        color: 0xe57373,
        action: 'exit',
        body: `<p>Grazie per la visita.</p>`,
    },
};

// Sezioni con hotspot visibile nel free-look (feedback immediato, stile menu di gioco).
const HOTSPOT_SECTIONS = ['Cinema', 'PhotoSelect', 'About', 'Contact', 'Exit'];

// Cortometraggi: scelti dal cassetto. (In futuro: proiezione in una stanza dedicata.)
const FILMS = [
    { id: 'xAbP0Tb6KU0', title: 'A Chess Move', sub: 'Cortometraggio', cover: 'assets/covers/chessboard_cover.png' },
    { id: 'LDUSHwS_K_g', title: 'Terminal Dream', sub: 'Cortometraggio', cover: 'assets/covers/beach_cover.png' },
];

// Progetti fotografici: scelti dalla scatola, poi esposti sul muro.
const PHOTO_PROJECTS = {
    p1: {
        title: 'Progetto Fotografico #1',
        photos: Array.from({ length: 10 }, (_, i) => `assets/photography/${i + 1}.webp`),
    },
    p2: {
        title: 'Progetto Fotografico #2',
        photos: Array.from({ length: 6 }, (_, i) => `assets/photography/p2/${i + 1}.webp`),
    },
};

/* ----------------------------------------------------------------------
   1. Setup base: renderer, scena, camera
---------------------------------------------------------------------- */
const canvas = document.getElementById('booth-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// AgX come Blender. Esposizione = 2^(-0.39) per replicare l'exposure -0.39 di Blender.
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = Math.pow(2, -0.39);
if (CONFIG.SHADOWS) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ombre morbide
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d0f);
scene.fog = new THREE.FogExp2(0x0c0d0f, 0.012);

// Illuminazione basata su ambiente (IBL): riflessi e fill realistici sui
// materiali PBR, generata proceduralmente (nessun file HDRI da scaricare).
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// Nota: scene.environmentIntensity esiste solo da three r163; qui (r161)
// l'intensità IBL si controlla per-materiale via envMapIntensity (vedi applyEnv).

const camera = new THREE.PerspectiveCamera(CONFIG.DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(CONFIG.HOME_POS);
camera.lookAt(CONFIG.HOME_LOOK);

/* ----------------------------------------------------------------------
   1b. Post-processing: distorsione fisheye (il glTF non porta la lente
   panoramica di Blender, quindi ne riproduciamo l'estetica a schermo).
   ---------------------------------------------------------------------- */
const FisheyeShader = {
    uniforms: {
        tDiffuse: { value: null },
        strength: { value: CONFIG.FISHEYE },
        aspect: { value: window.innerWidth / window.innerHeight },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float strength;
        uniform float aspect;
        varying vec2 vUv;
        void main() {
            // Coordinate centrate -1..1 con correzione dell'aspetto (bolla circolare).
            vec2 p = vUv * 2.0 - 1.0;
            p.x *= aspect;
            float r2 = dot(p, p);
            // Barrel: i punti lontani dal centro campionano più vicino => rigonfiamento.
            p *= (1.0 - strength * r2);
            p.x /= aspect;
            vec2 uv = p * 0.5 + 0.5;
            gl_FragColor = texture2D(tDiffuse, uv);
        }`,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Bloom: bagliore morbido sulle sorgenti luminose (lampade, bulbo proiettore).
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.BLOOM,        // forza
    0.5,                 // raggio
    CONFIG.BLOOM_THRESHOLD // soglia: solo le zone chiare fioriscono
);
composer.addPass(bloomPass);
// Fisheye: distorce anche il bloom (più coerente otticamente).
const fisheyePass = new ShaderPass(FisheyeShader);
composer.addPass(fisheyePass);
// OutputPass: applica tone mapping ACES + conversione sRGB al risultato
// composito (indispensabile con EffectComposer, altrimenti l'HDR satura al bianco).
composer.addPass(new OutputPass());

// Grade finale in spazio display: replica il look Blender dell'utente
// (AgX Greyscale + contrasto). Opera dopo il tone mapping.
const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uSaturation: { value: CONFIG.GRADE.saturation },
        uExposure: { value: CONFIG.GRADE.exposure },
        uGamma: { value: CONFIG.GRADE.gamma },
        uContrast: { value: CONFIG.GRADE.contrast },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uSaturation, uExposure, uGamma, uContrast;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            c *= exp2(uExposure);                                  // esposizione
            float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(luma), c, uSaturation);                   // desaturazione (0 = B/N)
            c = pow(max(c, 0.0), vec3(1.0 / uGamma));              // gamma (…<1 scurisce i medi)
            c = (c - 0.5) * uContrast + 0.5;                       // contrasto attorno al grigio medio
            gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);

// Pass "pellicola" finale: grana animata + vignettatura + aberrazione
// cromatica. Ammorbidisce la CG e dà un'identità visiva unica ai materiali.
const FilmShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrain: { value: CONFIG.FILM.grain },
        uVignette: { value: CONFIG.FILM.vignette },
        uAberration: { value: CONFIG.FILM.aberration },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime, uGrain, uVignette, uAberration;
        varying vec2 vUv;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 43.7) * 43758.5453);
        }

        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);

            // Aberrazione cromatica radiale (più forte ai bordi)
            vec2 off = c * uAberration * (1.0 + r2 * 6.0);
            float cr = texture2D(tDiffuse, vUv + off).r;
            float cg = texture2D(tDiffuse, vUv).g;
            float cb = texture2D(tDiffuse, vUv - off).b;
            vec3 col = vec3(cr, cg, cb);

            // Grana pellicola animata (più visibile nei medi toni)
            float g = hash(vUv * vec2(1920.0, 1080.0));
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            float grainMask = 1.0 - abs(lum - 0.5) * 1.6; // massima sui medi
            col += (g - 0.5) * uGrain * max(grainMask, 0.15);

            // Vignettatura morbida
            float vig = 1.0 - smoothstep(0.15, 0.85, r2 * 2.2) * uVignette;
            col *= vig;

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
};
const filmPass = new ShaderPass(FilmShader);
composer.addPass(filmPass);

composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* ----------------------------------------------------------------------
   2. Stato applicazione + riferimenti anchor
---------------------------------------------------------------------- */
const STATE = { IDLE: 'idle', FLYING: 'flying', FOCUSED: 'focused' };
let state = STATE.IDLE;

const pois = {};   // { Cinema: Object3D, ... }  bersagli da guardare
const cams = {};   // { Cinema: Object3D, ... }  posizioni camera
let poiList = [];  // array di mesh POI per il raycasting
let hovered = null;
let activeSection = null;

let mixer = null;               // AnimationMixer del modello
const clips = {};               // { clipName: AnimationClip }
const activeActions = [];       // action attualmente in riproduzione

// Stato di orientamento durante i voli (slerp del quaternione via GSAP).
const _startQuat = new THREE.Quaternion();
const orientProx = { p: 0 };
let startFov = CONFIG.DEFAULT_FOV;

/* ----------------------------------------------------------------------
   3. Look-around (drag / gyro) con smorzamento
---------------------------------------------------------------------- */
const look = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };

// Deriva yaw/pitch iniziali dallo sguardo di partenza.
(function initLookFromHome() {
    const dir = new THREE.Vector3().subVectors(CONFIG.HOME_LOOK, CONFIG.HOME_POS).normalize();
    look.yaw = look.targetYaw = Math.atan2(-dir.x, -dir.z);
    look.pitch = look.targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
})();

const pointer = new THREE.Vector2(-2, -2); // NDC; fuori schermo di default
let dragging = false;
let downX = 0, downY = 0, movedDist = 0;

canvas.addEventListener('pointerdown', (e) => {
    // In IDLE il drag ruota lo sguardo; in FOCUSED serve solo a rilevare il click
    // (es. foto appese sul muro). In volo si ignora.
    if (state === STATE.FLYING) return;
    dragging = true;
    movedDist = 0;
    downX = e.clientX; downY = e.clientY;
    // Su touch il pointermove può non scattare prima del tap: fisso subito le
    // coordinate NDC così il raycast del tap-to-select funziona anche su mobile.
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});

canvas.addEventListener('pointermove', (e) => {
    // Aggiorna sempre la posizione NDC per l'hover.
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (dragging && state === STATE.IDLE) {
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        movedDist += Math.abs(dx) + Math.abs(dy);
        look.targetYaw -= dx * CONFIG.LOOK_SENSITIVITY;
        look.targetPitch -= dy * CONFIG.LOOK_SENSITIVITY;
        look.targetPitch = THREE.MathUtils.clamp(look.targetPitch, -CONFIG.MAX_PITCH, CONFIG.MAX_PITCH);
        hint.classList.add('hidden');
    }
});

function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (movedDist >= CONFIG.DRAG_THRESHOLD) return;
    // Movimento minimo => è un click.
    if (state === STATE.IDLE) trySelect();
    else if (state === STATE.FOCUSED && activeSection === 'PhotoWall'
             && !lightboxOpen() && !videoOpen() && !cardsOpen()) {
        pickPhoto(); // click su una foto appesa -> lightbox
    }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Gyro opzionale su mobile (senza permessi iOS espliciti resta un no-op).
if (!FINE_POINTER && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
        if (state !== STATE.IDLE || e.beta == null || e.gamma == null) return;
        look.targetYaw = THREE.MathUtils.degToRad(-e.gamma) * 1.5;
        look.targetPitch = THREE.MathUtils.clamp(
            THREE.MathUtils.degToRad(e.beta - 90), -CONFIG.MAX_PITCH, CONFIG.MAX_PITCH);
    }, true);
}

/* ----------------------------------------------------------------------
   4. Raycasting: hover + selezione
---------------------------------------------------------------------- */
const raycaster = new THREE.Raycaster();

function pickPOI() {
    if (poiList.length === 0) return null;
    raycaster.setFromCamera(pointer, camera);
    // Interroghiamo SOLO i POI: funziona anche se sono invisibili.
    const hits = raycaster.intersectObjects(poiList, false);
    return hits.length ? hits[0].object : null;
}

function sectionOf(obj) {
    return obj ? obj.name.replace(/^POI_/, '') : null;
}

function setHovered(obj) {
    if (hovered === obj) return;
    // Ripristina il precedente.
    if (hovered) gsap.to(hovered.scale, { x: 1, y: 1, z: 1, duration: 0.25, overwrite: true });
    hovered = obj;
    reticle.classList.toggle('hot', !!obj);
    if (obj) {
        gsap.to(obj.scale, { x: 1.14, y: 1.14, z: 1.14, duration: 0.25, overwrite: true });
        poiLabel.textContent = SECTIONS[sectionOf(obj)]?.label ?? sectionOf(obj);
        poiLabel.classList.add('visible');
    } else {
        poiLabel.classList.remove('visible');
    }
    canvas.style.cursor = obj ? 'pointer' : 'grab';
}

function trySelect() {
    const obj = pickPOI();
    if (obj) flyTo(sectionOf(obj));
}

/* ----------------------------------------------------------------------
   5. Fly-to / ritorno (GSAP) — tween di posizione + quaternione + FOV
---------------------------------------------------------------------- */
const _m4 = new THREE.Matrix4();

// Quaternione per "stare in fromPos e guardare toPos".
function lookQuat(fromPos, toPos) {
    _m4.lookAt(fromPos, toPos, camera.up);
    return new THREE.Quaternion().setFromRotationMatrix(_m4);
}

// Posa di destinazione per una sezione: se CAM_* è una Camera Blender uso la
// sua posizione + angolo (+ focale); se è un Empty (o manca) guardo il POI.
function destinationPose(section) {
    const camAnchor = cams[section];
    const poiAnchor = pois[section];
    const pos = camAnchor
        ? camAnchor.getWorldPosition(new THREE.Vector3())
        : CONFIG.HOME_POS.clone();

    let quat, fov = CONFIG.DEFAULT_FOV;
    if (camAnchor) {
        // Uso posizione + angolo esatti del nodo CAM. Vale anche se la camera
        // Blender è panoramica/fisheye: il glTF perde la lente ma conserva la
        // trasformazione del nodo, che è il framing che ci serve.
        quat = camAnchor.getWorldQuaternion(new THREE.Quaternion());
        if (camAnchor.isPerspectiveCamera) fov = camAnchor.fov;
    } else {
        // Nessun CAM (es. POI_Exit): guardo il centro del POI dalla home.
        const target = poiAnchor.getWorldPosition(new THREE.Vector3());
        quat = lookQuat(pos, target);
    }
    return { pos, quat, fov };
}

// Anima la camera verso una posa; onDone al termine.
function tweenTo(pose, onDone) {
    const dur = REDUCED_MOTION ? 0 : CONFIG.FLY_DURATION;
    _startQuat.copy(camera.quaternion);
    startFov = camera.fov;
    orientProx.p = 0;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(orientProx);
    gsap.to(camera.position, {
        x: pose.pos.x, y: pose.pos.y, z: pose.pos.z,
        duration: dur, ease: 'power3.inOut',
    });
    gsap.to(orientProx, {
        p: 1, duration: dur, ease: 'power3.inOut',
        onUpdate: () => {
            camera.quaternion.copy(_startQuat).slerp(pose.quat, orientProx.p);
            camera.fov = THREE.MathUtils.lerp(startFov, pose.fov, orientProx.p);
            camera.updateProjectionMatrix();
        },
        onComplete: onDone,
    });
}

function flyTo(section) {
    if (!pois[section]) {
        console.warn(`[booth] Nessun POI per la sezione "${section}"`);
        return;
    }
    state = STATE.FLYING;
    activeSection = section;
    setHovered(null);
    hint.classList.add('hidden');
    tweenTo(destinationPose(section), () => onArrived(section));
}

function onArrived(section) {
    state = STATE.FOCUSED;
    backBtn.classList.add('visible');
    const S = SECTIONS[section];
    playClip(S?.clip); // es. 'apricassetto': il cassetto si apre

    if (S?.flow === 'films') {
        // Il cassetto è aperto: dentro ci sono i corti. La scelta appare in overlay
        // sincronizzata con la fine dell'animazione.
        setTimeout(() => { if (activeSection === 'Cinema') openFilmChooser(); }, clipMs(S?.clip, 650));
    } else if (S?.flow === 'projects') {
        openProjectChooser();
    } else if (S?.flow === 'wall') {
        wallHint(true); // foto appese: clicca per ingrandire
    } else if (S) {
        showContent(section);
    }

    // Porta di uscita: prova a chiudere la scheda. I browser lo consentono solo
    // se la scheda è stata aperta via script (window.open), quindi in genere per
    // una scheda aperta dall'utente resta senza effetto e mostriamo il saluto.
    if (S?.action === 'exit') {
        showContent(section);
        try { window.close(); } catch (_) {}
    }
}

// Durata (ms) di una clip GLTF, con fallback.
function clipMs(name, fallback) {
    return clips[name] ? clips[name].duration * 1000 : fallback;
}

function flyHome() {
    state = STATE.FLYING;
    hideContent();
    closeCards();
    wallHint(false);
    backBtn.classList.remove('visible');
    reverseClip(SECTIONS[activeSection]?.clip); // es. il cassetto si richiude
    if (activeSection === 'PhotoWall') clearPhotoWall();

    const pose = {
        pos: CONFIG.HOME_POS.clone(),
        quat: lookQuat(CONFIG.HOME_POS, CONFIG.HOME_LOOK),
        fov: CONFIG.DEFAULT_FOV,
    };
    tweenTo(pose, () => {
        // Risincronizza yaw/pitch dal quaternione corrente: il free-look riprende liscio.
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        look.yaw = look.targetYaw = e.y;
        look.pitch = look.targetPitch = e.x;
        activeSection = null;
        state = STATE.IDLE;
    });
}

/* ----------------------------------------------------------------------
   6. Animazioni GLTF (mixer)
---------------------------------------------------------------------- */
function playClip(name) {
    if (!mixer || !name || !clips[name]) return;
    const action = mixer.clipAction(clips[name]);
    action.reset();
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce);
    action.timeScale = 1;
    action.play();
    activeActions.push(action);
}

function reverseClip(name) {
    if (!mixer || !name || !clips[name]) return;
    const action = mixer.existingAction(clips[name]);
    if (!action) return;
    action.paused = false;
    action.timeScale = -1;
    if (action.time === 0) action.time = clips[name].duration; // se era a inizio, parti dalla fine
    action.play();
}

/* ----------------------------------------------------------------------
   7. Pannello contenuti (HUD)
---------------------------------------------------------------------- */
function showContent(section) {
    const data = SECTIONS[section];
    if (!data) return;
    panelLabel.textContent = data.label;
    panelTitle.textContent = data.title;
    panelBody.innerHTML = data.body;
    contentPanel.classList.add('visible');
}
function hideContent() { contentPanel.classList.remove('visible'); }

/* ----------------------------------------------------------------------
   7b. Overlay interattivi: scelta corti/progetti, video, lightbox foto
---------------------------------------------------------------------- */
const selectOverlay = document.getElementById('select-overlay');
const selectTitle = document.getElementById('select-title');
const selectCards = document.getElementById('select-cards');
const videoOverlay = document.getElementById('video-overlay');
const videoFrame = document.getElementById('video-frame');
const photoLightbox = document.getElementById('photo-lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const wallHintEl = document.getElementById('wall-hint');

// Griglia di card cliccabili (corti o progetti foto).
function openCards(title, items, onPick) {
    selectTitle.textContent = title;
    selectCards.innerHTML = '';
    items.forEach((it) => {
        const card = document.createElement('button');
        card.className = 'select-card';
        card.innerHTML = `
            ${it.cover ? `<img src="${it.cover}" alt="" loading="lazy">` : '<div class="card-ph"></div>'}
            <span class="card-title">${it.title}</span>
            ${it.sub ? `<span class="card-sub">${it.sub}</span>` : ''}`;
        card.addEventListener('click', () => onPick(it));
        selectCards.appendChild(card);
    });
    selectOverlay.classList.add('visible');
}
function closeCards() { selectOverlay.classList.remove('visible'); }
const cardsOpen = () => selectOverlay.classList.contains('visible');

function openFilmChooser() {
    openCards('Scegli un cortometraggio', FILMS, (film) => openVideo(film.id));
}

function openProjectChooser() {
    const items = Object.entries(PHOTO_PROJECTS).map(([key, p]) => ({
        key, title: p.title, sub: `${p.photos.length} fotografie`, cover: p.photos[0],
    }));
    openCards('Scegli un progetto', items, (p) => {
        closeCards();
        buildPhotoWall(p.key);
        flyTo('PhotoWall'); // la camera si sposta a inquadrare il muro
    });
}

// Video del corto in overlay. (Prossimo passo: stanza di proiezione dedicata.)
function openVideo(id) {
    videoFrame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    videoOverlay.classList.add('visible');
}
function closeVideo() {
    videoOverlay.classList.remove('visible');
    videoFrame.src = ''; // ferma la riproduzione
}
const videoOpen = () => videoOverlay.classList.contains('visible');

// Lightbox della singola foto (frecce per scorrere la serie).
let lbPhotos = [], lbIndex = 0;
function openLightbox(photos, idx) {
    lbPhotos = photos; lbIndex = idx;
    lightboxImg.src = photos[idx];
    photoLightbox.classList.add('visible');
}
function lightboxStep(d) {
    if (!lbPhotos.length) return;
    lbIndex = (lbIndex + d + lbPhotos.length) % lbPhotos.length;
    lightboxImg.src = lbPhotos[lbIndex];
}
function closeLightbox() { photoLightbox.classList.remove('visible'); }
const lightboxOpen = () => photoLightbox.classList.contains('visible');

document.getElementById('video-close').addEventListener('click', closeVideo);
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => lightboxStep(-1));
document.getElementById('lightbox-next').addEventListener('click', () => lightboxStep(1));

function wallHint(show) { wallHintEl.classList.toggle('visible', !!show); }

/* ----------------------------------------------------------------------
   7c. Muro fotografico: le foto del progetto scelto appese davanti al muro
---------------------------------------------------------------------- */
const photoWall = { group: null, planes: [], photos: [], project: null };

function buildPhotoWall(projectKey) {
    clearPhotoWall();
    const project = PHOTO_PROJECTS[projectKey];
    const poi = pois.PhotoWall, cam = cams.PhotoWall;
    if (!project || !poi || !cam) return;

    const P = poi.getWorldPosition(new THREE.Vector3());
    const C = cam.getWorldPosition(new THREE.Vector3());

    // Trova la superficie REALE del muro: raycast dalla camera lungo il suo
    // sguardo (il cubo POI può sporgere oltre la parete, non è affidabile).
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const rc = new THREE.Raycaster(C, fwd.clone().normalize(), 0.3, 12);
    const targets = [];
    scene.traverse((o) => {
        if (o.isMesh && !o.name.startsWith('POI_') && !o.userData.isPhoto) targets.push(o);
    });
    const hit = rc.intersectObjects(targets, false)[0];

    let n, center;
    if (hit) {
        // Normale reale della parete (in world space), raddrizzata in orizzontale.
        n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        if (n.dot(fwd) > 0) n.negate(); // deve puntare verso la camera
        n.y = 0; n.normalize();
        center = hit.point.clone();
    } else {
        // Fallback: piano del POI.
        n = C.clone().sub(P); n.y = 0; n.normalize();
        center = P.clone();
    }
    center.y = THREE.MathUtils.clamp(center.y, 1.05, 1.8); // quota quadri realistica
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize();

    const group = new THREE.Group();
    group.name = 'PhotoWall_' + projectKey;

    const H = 0.36;              // altezza foto (m)
    const GAP_X = 0.58, GAP_Y = 0.5;
    const cols = Math.min(4, project.photos.length);
    const rows = Math.ceil(project.photos.length / cols);
    const loader = new THREE.TextureLoader();

    project.photos.forEach((src, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const geo = new THREE.PlaneGeometry(H * 1.5, H); // aspetto provvisorio 3:2
        const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const mesh = new THREE.Mesh(geo, mat);

        const offX = (col - (cols - 1) / 2) * GAP_X;
        const offY = ((rows - 1) / 2 - row) * GAP_Y;
        mesh.position.copy(center)
            .add(right.clone().multiplyScalar(offX))
            .add(new THREE.Vector3(0, offY, 0))
            .add(n.clone().multiplyScalar(0.04)); // staccata di 4cm dal muro
        mesh.lookAt(mesh.position.clone().add(n));
        mesh.userData.photoIndex = i;
        mesh.userData.isPhoto = true;
        group.add(mesh);
        photoWall.planes.push(mesh);

        loader.load(src, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
            // Adatta la larghezza del quadro all'aspetto reale della foto.
            const aspect = tex.image.width / tex.image.height;
            mesh.scale.x = (H * aspect) / (H * 1.5);
        });
    });

    scene.add(group);
    photoWall.group = group;
    photoWall.photos = project.photos;
    photoWall.project = projectKey;
}

function clearPhotoWall() {
    if (!photoWall.group) return;
    scene.remove(photoWall.group);
    photoWall.planes.forEach((m) => {
        m.geometry.dispose();
        if (m.material.map) m.material.map.dispose();
        m.material.dispose();
    });
    photoWall.group = null; photoWall.planes = []; photoWall.photos = []; photoWall.project = null;
}

// Click su una foto del muro -> lightbox.
function pickPhoto() {
    if (!photoWall.planes.length) return false;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(photoWall.planes, false)[0];
    if (hit) {
        openLightbox(photoWall.photos, hit.object.userData.photoIndex);
        return true;
    }
    return false;
}

/* ----------------------------------------------------------------------
   7d. Hotspot visibili: pallini pulsanti sulle zone interattive
---------------------------------------------------------------------- */
const hotspotEls = [];
function initHotspots() {
    const wrap = document.getElementById('hotspots');
    HOTSPOT_SECTIONS.forEach((section) => {
        if (!pois[section]) return;
        const el = document.createElement('button');
        el.className = 'hotspot';
        el.innerHTML = `<span class="hs-dot"></span><span class="hs-label">${SECTIONS[section].label}</span>`;
        el.addEventListener('click', () => { if (state === STATE.IDLE) flyTo(section); });
        wrap.appendChild(el);
        hotspotEls.push({ section, el });
    });
}

const _hsPos = new THREE.Vector3();
function updateHotspots() {
    const idle = state === STATE.IDLE;
    hotspotEls.forEach(({ section, el }) => {
        if (!idle) { el.style.display = 'none'; return; }
        pois[section].getWorldPosition(_hsPos).project(camera);
        if (_hsPos.z > 1) { el.style.display = 'none'; return; } // dietro la camera
        const a = window.innerWidth / window.innerHeight;
        let px = _hsPos.x * a, py = _hsPos.y;
        const f = 1 + CONFIG.FISHEYE * (px * px + py * py);
        px *= f; py *= f;
        el.style.display = 'block';
        el.style.left = ((px / a * 0.5 + 0.5) * window.innerWidth) + 'px';
        el.style.top = ((-py * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
}

/* ----------------------------------------------------------------------
   8. Raccolta anchor dalla scena (placeholder o .glb reale)
---------------------------------------------------------------------- */
function collectAnchors(root) {
    root.traverse((obj) => {
        if (obj.name.startsWith('POI_')) {
            const s = obj.name.slice(4);
            pois[s] = obj;
            obj.visible = CONFIG.SHOW_ANCHORS; // invisibile col modello reale
            poiList.push(obj);
        } else if (obj.name.startsWith('CAM_')) {
            cams[obj.name.slice(4)] = obj;
            obj.visible = false; // i CAM non si vedono e non si cliccano mai
        }
    });

    // CAM_Start (se presente) definisce la posa iniziale reale dalla scena Blender.
    if (cams.Start) applyStartPose(cams.Start);

    const found = Object.keys(pois).filter((s) => SECTIONS[s]); // sezioni navigabili
    const missing = found.filter((s) => !cams[s]);
    if (missing.length) console.warn('[booth] POI senza CAM corrispondente:', missing);
    console.log('[booth] Sezioni rilevate:', found);
    initHotspots(); // pallini interattivi visibili sulle zone
}

// Allinea home + camera alla posa del nodo CAM_Start.
function applyStartPose(startCam) {
    startCam.getWorldPosition(CONFIG.HOME_POS);
    const q = startCam.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    CONFIG.HOME_LOOK.copy(CONFIG.HOME_POS).add(fwd);
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    look.yaw = look.targetYaw = e.y;
    look.pitch = look.targetPitch = e.x;
    camera.position.copy(CONFIG.HOME_POS);
    camera.quaternion.copy(q);
}

/* ----------------------------------------------------------------------
   9a. Scena placeholder (box colorati) — sostituibile col .glb
---------------------------------------------------------------------- */
function buildPlaceholder() {
    const group = new THREE.Group();
    group.name = 'PlaceholderBooth';

    // Stanza (box con normali verso l'interno)
    const room = new THREE.Mesh(
        new THREE.BoxGeometry(20, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.95, metalness: 0.0, side: THREE.BackSide })
    );
    room.position.y = 4;
    group.add(room);

    // Pavimento leggermente più chiaro
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    group.add(floor);

    // Layout anchor placeholder: POI sulle pareti, CAM (Empty) davanti a ciascuno.
    // Con il .glb reale questo viene rimpiazzato dagli anchor di Blender.
    const layout = {
        Cinema:      { poi: [0, 2.6, -9.6],   cam: [0, 1.7, -3.2] },
        PhotoSelect: { poi: [-9.6, 2.2, -3],  cam: [-3.4, 1.7, -3] },
        PhotoWall:   { poi: [-9.6, 2.2, 4],   cam: [-3.4, 1.7, 4] },
        About:       { poi: [9.6, 2.2, 0],    cam: [3.4, 1.7, 0] },
        Contact:     { poi: [-4, 2.2, 9.6],   cam: [-4, 1.7, 3.2] },
        Exit:        { poi: [4, 2.2, 9.6],    cam: [4, 1.7, 3.2] },
    };

    for (const [section, { poi, cam }] of Object.entries(layout)) {
        const color = SECTIONS[section]?.color ?? 0xe5e7eb;

        // Cubo POI (bersaglio cliccabile / da guardare)
        const poiMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.4, 0.4),
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.5 })
        );
        poiMesh.name = 'POI_' + section;
        poiMesh.position.set(...poi);
        poiMesh.lookAt(CONFIG.HOME_POS); // orientato verso il centro stanza
        group.add(poiMesh);

        // Marker CAM (piccola sfera wireframe, solo riferimento visivo)
        const camMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        camMesh.name = 'CAM_' + section;
        camMesh.position.set(...cam);
        group.add(camMesh);
    }

    scene.add(group);
    collectAnchors(group);
}

/* ----------------------------------------------------------------------
   9b. Caricamento .glb reale — pronto per il file di Orlando
---------------------------------------------------------------------- */
function loadModel(url) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(draco);

    loader.load(
        url,
        (gltf) => {
            scene.add(gltf.scene);
            collectAnchors(gltf.scene);
            if (CONFIG.USE_BAKED) applyBakedLook(gltf.scene);
            else addInteriorLights(gltf.scene);

            // Registra le clip di animazione (es. "About_Open").
            if (gltf.animations.length) {
                mixer = new THREE.AnimationMixer(gltf.scene);
                gltf.animations.forEach((clip) => { clips[clip.name] = clip; });
                console.log('[booth] Clip disponibili:', Object.keys(clips));
            }
            hideLoader();
        },
        undefined,
        (err) => {
            console.error('[booth] Errore nel caricamento del modello:', err);
            loaderEl.textContent = 'Modello non trovato — uso il placeholder';
            buildPlaceholder();
            setTimeout(hideLoader, 800);
        }
    );
}

/* ----------------------------------------------------------------------
   10. Illuminazione
---------------------------------------------------------------------- */
function setupLights() {
    // Con l'IBL attivo teniamo l'ambiente basso: la luce viene dalle pratiche.
    scene.add(new THREE.HemisphereLight(0xaab4c4, 0x0a0b0d, 0.25));
}

// Rig da interno dimensionato sul modello: lampada calda a soffitto (con ombre
// morbide e bulbo emissivo che alimenta il bloom) + riempimento freddo basso.
function addInteriorLights(root) {
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());

    const lamp = new THREE.PointLight(0xffdca8, 26, 0, 2);
    lamp.position.set(c.x, box.max.y * 0.82, c.z);
    if (CONFIG.SHADOWS) {
        lamp.castShadow = true;
        lamp.shadow.mapSize.set(1024, 1024);
        lamp.shadow.bias = -0.0015;
        lamp.shadow.radius = 4;
    }
    scene.add(lamp);

    // Bulbo visibile: piccola sfera emissiva sopra la soglia di bloom.
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
    );
    bulb.position.copy(lamp.position);
    scene.add(bulb);

    const fill = new THREE.PointLight(0x9fb6d8, 5, 0, 2);
    fill.position.set(c.x, box.max.y * 0.3, c.z);
    scene.add(fill);

    // Ombre + intensità IBL per-materiale sulle mesh del modello.
    root.traverse((o) => {
        if (!o.isMesh) return;
        if (CONFIG.SHADOWS) { o.castShadow = true; o.receiveShadow = true; }
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m && 'envMapIntensity' in m) m.envMapIntensity = CONFIG.ENV_INTENSITY; });
    });
}

// Modalità BAKED: applica la lightmap Cycles come materiale unlit.
// La luce (GI, ombre, lampade) è già "cotta" nell'atlas sul canale UV2:
// qualità da render offline a costo runtime praticamente nullo.
function applyBakedLook(root) {
    // Lightmap: texture ORIGINALI (1º UV, nitide) × luce cotta (2º UV). Niente
    // luci runtime; solo un filo di env per i riflessi del metallo. L'emissione
    // dei materiali (bulbo proiettore) resta. Look = render diffuso di Blender.
    const lm = new THREE.TextureLoader().load(CONFIG.LIGHTMAP_URL);
    lm.flipY = false;
    lm.channel = 1;                       // TEXCOORD_1 (UV "LM")
    lm.colorSpace = THREE.SRGBColorSpace;
    let n = 0;
    root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const hasLM = !!o.geometry.attributes.uv1;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
            if (hasLM && 'lightMap' in m) {
                m.lightMap = lm;
                m.lightMapIntensity = CONFIG.LIGHTMAP_INTENSITY;
                if (m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                n++;
            }
            if ('envMapIntensity' in m) m.envMapIntensity = CONFIG.ENV_INTENSITY;
            m.needsUpdate = true;
        });
    });
    console.log(`[booth] lightmap su ${n} materiali`);
    buildBlenderLights(root);
}

// Ricrea fedelmente l'impianto luci di Blender come luci realtime three.js.
const blenderLights = [];
function buildBlenderLights(root) {
    RectAreaLightUniformsLib.init(); // richiesto per le RectAreaLight

    // Le mesh proiettano/ricevono ombre (proiettore -> muro, cassetti, tavoli...).
    if (CONFIG.SHADOWS) {
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    }

    const V = THREE.Vector3;
    CONFIG.BLENDER_LIGHTS.forEach((d, index) => {
        if (CONFIG.ACTIVE_LIGHTS && !CONFIG.ACTIVE_LIGHTS.includes(d.name)) return; // filtro debug
        const color = new THREE.Color().setRGB(d.color[0], d.color[1], d.color[2], THREE.LinearSRGBColorSpace);
        const pos = new V(...d.pos);
        const tgt = new V(...d.pos).add(new V(...d.dir)); // punto guardato lungo la direzione

        // Sfera rossa per individuare la luce in 3D
        const debugSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff3333, wireframe: true, depthTest: false })
        );
        debugSphere.position.copy(pos);
        scene.add(debugSphere);

        // Label HTML fluttuante
        const div = document.createElement('div');
        div.className = 'light-debug-label';
        div.style.position = 'absolute';
        div.style.background = 'rgba(255, 51, 51, 0.9)';
        div.style.color = '#fff';
        div.style.padding = '3px 8px';
        div.style.borderRadius = '4px';
        div.style.fontSize = '10px';
        div.style.fontFamily = 'monospace';
        div.style.pointerEvents = 'none';
        div.style.zIndex = '9999';
        div.textContent = `[L${index}] ${d.name}`;
        document.body.appendChild(div);

        d.debugEl = div;
        d.debugSphere = debugSphere;

        if (d.type === 'SPOT') {
            const intensity = d.energy * CONFIG.SPOT_WATT * CONFIG.LIGHT_MULT;
            const penumbra = Math.max(d.blend, CONFIG.SPOT_SOFT); // bordi più morbidi
            const l = new THREE.SpotLight(color, intensity, 0,
                THREE.MathUtils.degToRad(d.angleDeg) / 2, penumbra, 2); // three.js angle = mezzo cono
            l.position.copy(pos);
            l.target.position.copy(tgt);
            if (CONFIG.SPOT_SHADOWS && CONFIG.SHADOWS) {
                l.castShadow = true;
                const sm = FINE_POINTER ? 2048 : 1024; // più leggere su mobile/touch
                l.shadow.mapSize.set(sm, sm);
                l.shadow.bias = -0.002;
                l.shadow.radius = CONFIG.SHADOW_RADIUS;
                l.shadow.camera.near = 0.1;
                l.shadow.camera.far = 12;
            }
            scene.add(l, l.target);
            blenderLights.push({ def: d, light: l });
        } else if (d.type === 'AREA') {
            const intensity = d.energy * CONFIG.AREA_WATT * CONFIG.LIGHT_MULT;
            const l = new THREE.RectAreaLight(color, intensity, d.size, d.sizeY);
            l.position.copy(pos);
            l.lookAt(tgt);
            scene.add(l);
            blenderLights.push({ def: d, light: l });
        }
    });
    console.log(`[booth] luci Blender realtime: ${blenderLights.length}`);
    addAccentLights();
}

// Ambientale bassissima + rim light sul proiettore (nessuna ombra, portata corta).
let ambientLight = null, rimLight = null;
function addAccentLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT);
    scene.add(ambientLight);

    const R = CONFIG.RIM;
    rimLight = new THREE.SpotLight(
        new THREE.Color(R.color), R.intensity, R.distance,
        THREE.MathUtils.degToRad(R.angleDeg) / 2, R.penumbra, 2);
    rimLight.position.set(...R.pos);
    rimLight.target.position.set(...R.target);
    rimLight.castShadow = false; // niente ombre sul muro
    scene.add(rimLight, rimLight.target);
}

// Scala globale delle luci (per __booth.setLights) mantenendo i rapporti Blender.
function setLightMult(v) {
    CONFIG.LIGHT_MULT = v;
    blenderLights.forEach(({ def, light }) => {
        const w = def.type === 'SPOT' ? CONFIG.SPOT_WATT : CONFIG.AREA_WATT;
        light.intensity = def.energy * w * v;
    });
}

// Applica una nuova intensità IBL a tutti i materiali del modello (per __booth.setEnv).
function applyEnv(v) {
    CONFIG.ENV_INTENSITY = v;
    scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m && 'envMapIntensity' in m) m.envMapIntensity = v; });
    });
}

/* ----------------------------------------------------------------------
   11. Riferimenti HUD
---------------------------------------------------------------------- */
const hud = document.getElementById('hud');
const hint = document.getElementById('hud-hint');
const reticle = document.getElementById('reticle');
const poiLabel = document.getElementById('poi-label');
const backBtn = document.getElementById('back-btn');
const contentPanel = document.getElementById('content-panel');
const panelLabel = document.getElementById('panel-label');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');
const loaderEl = document.getElementById('loader');

// Back a strati: chiude prima l'overlay più in alto, poi torna alla cabina.
function goBack() {
    if (videoOpen()) { closeVideo(); return; }
    if (lightboxOpen()) { closeLightbox(); return; }
    if (state === STATE.FOCUSED) flyHome();
}
backBtn.addEventListener('click', goBack);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') goBack(); });

function hideLoader() { loaderEl.classList.add('hidden'); }

/* ----------------------------------------------------------------------
   12. Loop di rendering
---------------------------------------------------------------------- */
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (state === STATE.IDLE) {
        // Smorzamento del look-around.
        look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, 0.12);
        look.pitch = THREE.MathUtils.lerp(look.pitch, look.targetPitch, 0.12);
        camera.position.copy(CONFIG.HOME_POS);
        const euler = new THREE.Euler(look.pitch, look.yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        // Aggiorna hover (solo con puntatore fine).
        if (FINE_POINTER && !dragging) setHovered(pickPOI());

        // Etichetta POI proiettata sullo schermo.
        if (hovered) positionLabel(hovered);
    } else if (state === STATE.FOCUSED && activeSection === 'PhotoWall'
               && FINE_POINTER && photoWall.planes.length && !lightboxOpen()) {
        // Cursore a mano sulle foto appese.
        raycaster.setFromCamera(pointer, camera);
        canvas.style.cursor = raycaster.intersectObjects(photoWall.planes, false).length ? 'pointer' : 'default';
    }
    // FLYING / FOCUSED: posizione, quaternione e FOV sono guidati da GSAP (tweenTo).
    updateHotspots();

    if (mixer) mixer.update(dt);

    // Aggiorna posizioni etichette debug delle luci
    CONFIG.BLENDER_LIGHTS.forEach((d) => {
        if (d.debugEl && d.debugSphere) {
            _proj.copy(d.debugSphere.position);
            _proj.project(camera);
            const x = (_proj.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
            d.debugEl.style.left = x + 'px';
            d.debugEl.style.top = y + 'px';
            // Nasconde l'etichetta se si trova dietro la telecamera
            d.debugEl.style.display = _proj.z > 1 ? 'none' : 'block';
        }
    });

    filmPass.uniforms.uTime.value = clock.elapsedTime; // grana animata
    composer.render();
}

// Proietta la posizione 3D del POI in coordinate schermo per l'etichetta,
// applicando l'inverso (approssimato) del barrel così l'etichetta segue la bolla.
const _proj = new THREE.Vector3();
function positionLabel(obj) {
    obj.getWorldPosition(_proj);
    _proj.project(camera);
    const a = window.innerWidth / window.innerHeight;
    let px = _proj.x * a, py = _proj.y;
    const f = 1 + CONFIG.FISHEYE * (px * px + py * py);
    px *= f; py *= f;
    const x = (px / a * 0.5 + 0.5) * window.innerWidth;
    const y = (-py * 0.5 + 0.5) * window.innerHeight;
    poiLabel.style.left = x + 'px';
    poiLabel.style.top = y + 'px';
}

/* ----------------------------------------------------------------------
   13. Resize + avvio
---------------------------------------------------------------------- */
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(w, h);
    fisheyePass.uniforms.aspect.value = w / h;
});

// Gestione parametri URL per testare versioni diverse senza sovrascrivere i file attuali.
// es: ?v=new (carica booth_new.glb o booth_baked_new.glb)
// es: ?baked=false (disattiva la modalità lightmap per usare le luci realtime di booth.js)
const urlParams = new URLSearchParams(window.location.search);
const version = urlParams.get('v'); 
const bakedParam = urlParams.get('baked'); 

if (bakedParam !== null) {
    CONFIG.USE_BAKED = bakedParam === 'true';
}

if (version) {
    if (CONFIG.USE_BAKED) {
        CONFIG.BAKED_URL = `assets/booth/booth_baked_${version}.glb`;
        CONFIG.LIGHTMAP_URL = `assets/booth/booth_lightmap_${version}.webp`;
    } else {
        CONFIG.MODEL_URL = `assets/booth/booth_${version}.glb`;
    }
}

if (!CONFIG.USE_BAKED || CONFIG.USE_PLACEHOLDER) setupLights();

if (CONFIG.USE_PLACEHOLDER) {
    buildPlaceholder();
    hideLoader();
} else {
    const targetModelUrl = CONFIG.USE_BAKED ? CONFIG.BAKED_URL : CONFIG.MODEL_URL;
    console.log(`[booth] Caricamento modello: ${targetModelUrl} (baked: ${CONFIG.USE_BAKED})`);
    loadModel(targetModelUrl);
}

canvas.style.cursor = 'grab';
animate();

// Handle di debug: utile per tarare gli anchor, il fisheye e ispezionare lo stato.
window.__booth = {
    camera, scene, pois, cams, poiList, gsap, composer, fisheyePass, bloomPass, filmPass,
    get state() { return state; },
    flyTo, flyHome, goBack,
    openFilmChooser, openProjectChooser, buildPhotoWall, clearPhotoWall, photoWall,
    openVideo, closeVideo, openLightbox, closeLightbox,
    // Regolazioni dal vivo, es. __booth.setFisheye(0.5)
    setFisheye(v) { CONFIG.FISHEYE = v; fisheyePass.uniforms.strength.value = v; },
    setBloom(v) { bloomPass.strength = v; },
    setExposure(v) { renderer.toneMappingExposure = v; },
    setEnv(v) { applyEnv(v); },
    // Stile pellicola: es. __booth.setFilm({ grain: 0.3, vignette: 0.7, aberration: 0.003 })
    setFilm(f) {
        Object.assign(CONFIG.FILM, f);
        filmPass.uniforms.uGrain.value = CONFIG.FILM.grain;
        filmPass.uniforms.uVignette.value = CONFIG.FILM.vignette;
        filmPass.uniforms.uAberration.value = CONFIG.FILM.aberration;
    },
    // Scala globale luci Blender: es. __booth.setLights(1.4) più forti / 0.6 più deboli
    setLights(v) { setLightMult(v); },
    setAmbient(v) { if (ambientLight) ambientLight.intensity = v; },
    setRim(v) { if (rimLight) rimLight.intensity = v; },
    blenderLights,
    // Intensità della luce cotta: es. __booth.setLightmap(2.4) per schiarire
    setLightmap(v) {
        CONFIG.LIGHTMAP_INTENSITY = v;
        scene.traverse((o) => {
            if (!o.isMesh || !o.material) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => { if (m.lightMap) m.lightMapIntensity = v; });
        });
    },
    // Grade: es. __booth.setGrade({ saturation: 1, contrast: 1 }) per tornare a colori
    setGrade(g) {
        Object.assign(CONFIG.GRADE, g);
        gradePass.uniforms.uSaturation.value = CONFIG.GRADE.saturation;
        gradePass.uniforms.uExposure.value = CONFIG.GRADE.exposure;
        gradePass.uniforms.uGamma.value = CONFIG.GRADE.gamma;
        gradePass.uniforms.uContrast.value = CONFIG.GRADE.contrast;
    },
    pickAt(nx, ny) {
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hit = raycaster.intersectObjects(poiList, false)[0];
        return hit ? hit.object.name : null;
    },
};

// Inizializzazione pannello FX in tempo reale
function setupFXPanel() {
    const toggleBtn = document.getElementById('fx-toggle');
    const panel = document.getElementById('fx-panel');
    const copyBtn = document.getElementById('fx-copy-btn');

    if (!toggleBtn || !panel) return;

    // Mostra/Nascondi il pannello
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
    });

    // Chiude il pannello cliccando fuori
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== toggleBtn) {
            panel.classList.remove('active');
        }
    });

    // Assicura che i click sugli slider non scatenino movimenti della camera
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('touchstart', (e) => e.stopPropagation());

    // Mappa dei controlli: id elemento -> callback per aggiornare Three.js/CONFIG
    const controls = [
        {
            sliderId: 'sld-contrast', valId: 'val-contrast', initVal: CONFIG.GRADE.contrast,
            onInput: (v) => {
                CONFIG.GRADE.contrast = v;
                gradePass.uniforms.uContrast.value = v;
            }
        },
        {
            sliderId: 'sld-exposure', valId: 'val-exposure', initVal: CONFIG.GRADE.exposure,
            onInput: (v) => {
                CONFIG.GRADE.exposure = v;
                gradePass.uniforms.uExposure.value = v;
            }
        },
        {
            sliderId: 'sld-fisheye', valId: 'val-fisheye', initVal: CONFIG.FISHEYE,
            onInput: (v) => {
                CONFIG.FISHEYE = v;
                fisheyePass.uniforms.strength.value = v;
            }
        },
        {
            sliderId: 'sld-bloom', valId: 'val-bloom', initVal: CONFIG.BLOOM,
            onInput: (v) => {
                CONFIG.BLOOM = v;
                bloomPass.strength = v;
            }
        },
        {
            sliderId: 'sld-grain', valId: 'val-grain', initVal: CONFIG.FILM.grain,
            onInput: (v) => {
                CONFIG.FILM.grain = v;
                filmPass.uniforms.uGrain.value = v;
            }
        },
        {
            sliderId: 'sld-vignette', valId: 'val-vignette', initVal: CONFIG.FILM.vignette,
            onInput: (v) => {
                CONFIG.FILM.vignette = v;
                filmPass.uniforms.uVignette.value = v;
            }
        },
        {
            sliderId: 'sld-aberration', valId: 'val-aberration', initVal: CONFIG.FILM.aberration,
            onInput: (v) => {
                CONFIG.FILM.aberration = v;
                filmPass.uniforms.uAberration.value = v;
            }
        },
        {
            sliderId: 'sld-ambient', valId: 'val-ambient', initVal: CONFIG.AMBIENT,
            onInput: (v) => {
                CONFIG.AMBIENT = v;
                if (ambientLight) ambientLight.intensity = v;
            }
        },
        {
            sliderId: 'sld-rim', valId: 'val-rim', initVal: CONFIG.RIM.intensity,
            onInput: (v) => {
                CONFIG.RIM.intensity = v;
                if (rimLight) rimLight.intensity = v;
            }
        }
    ];

    // Collega gli eventi a tutti gli slider
    controls.forEach((c) => {
        const sld = document.getElementById(c.sliderId);
        const val = document.getElementById(c.valId);
        if (sld && val) {
            sld.value = c.initVal;
            val.textContent = Number(c.initVal).toFixed(c.sliderId === 'sld-aberration' ? 4 : 2);

            sld.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                val.textContent = v.toFixed(c.sliderId === 'sld-aberration' ? 4 : 2);
                c.onInput(v);
            });
        }
    });

    // Copia i valori attuali della configurazione negli appunti in formato JSON
    copyBtn.addEventListener('click', () => {
        const configJson = {
            contrast: CONFIG.GRADE.contrast,
            exposure: CONFIG.GRADE.exposure,
            fisheye: CONFIG.FISHEYE,
            bloom: CONFIG.BLOOM,
            grain: CONFIG.FILM.grain,
            vignette: CONFIG.FILM.vignette,
            aberration: CONFIG.FILM.aberration,
            ambient: CONFIG.AMBIENT,
            rim: CONFIG.RIM.intensity
        };

        const textToCopy = JSON.stringify(configJson, null, 2);
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.textContent = 'Copiato!';
            copyBtn.style.borderColor = 'transparent';
            copyBtn.style.background = 'var(--silver)';
            copyBtn.style.color = '#000';
            setTimeout(() => {
                copyBtn.textContent = 'Copia Configurazione';
                copyBtn.style.borderColor = 'var(--silver)';
                copyBtn.style.background = 'transparent';
                copyBtn.style.color = 'var(--silver)';
            }, 1800);
        }).catch((err) => {
            console.error('Copia fallita:', err);
            alert('Copia fallita, i parametri sono stampati in console!');
            console.log(textToCopy);
        });
    });
}

setupFXPanel();
