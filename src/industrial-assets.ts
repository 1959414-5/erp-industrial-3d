import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Industrial GLB assets from the 3DAssets.dev "Machine Shop and Factory Hall" pack.
 * The source pack is released under CC0 1.0 Universal.
 * Models are loaded lazily from the CORS-enabled CDN and cached by the browser.
 */
export const INDUSTRIAL_ASSETS = {
  cnc: 'https://cdn.3dassets.dev/assets/27732/v1/model.glb',
  plasmaCutter: 'https://cdn.3dassets.dev/assets/37945/v1/model.glb',
  pressBrake: 'https://cdn.3dassets.dev/assets/27731/v1/model.glb',
  bandSaw: 'https://cdn.3dassets.dev/assets/27726/v1/model.glb',
  guillotine: 'https://cdn.3dassets.dev/assets/27733/v1/model.glb',
  palletRack: 'https://cdn.3dassets.dev/assets/27757/v1/model.glb',
  sheetRack: 'https://cdn.3dassets.dev/assets/27761/v1/model.glb',
  forklift: 'https://cdn.3dassets.dev/assets/27768/v1/model.glb',
  steelPallet: 'https://cdn.3dassets.dev/assets/27758/v1/model.glb',
} as const;

export type IndustrialAssetKey = keyof typeof INDUSTRIAL_ASSETS;

export interface IndustrialAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();

function getSource(url: string) {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((gltf) => ({
      scene: gltf.scene,
      animations: gltf.animations,
    }));
    cache.set(url, pending);
    pending.catch(() => cache.delete(url));
  }
  return pending;
}

/** Restrict imported materials to graphite, neutral steel and industrial orange. */
function applyIndustrialPalette(root: THREE.Object3D) {
  const graphite = 0x303b49;
  const steel = 0x858e99;
  const light = 0xdfe3e8;
  const orange = 0xe96b2c;

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sourceMaterials.map((source) => {
      const material = source.clone();
      const color = (material as THREE.MeshStandardMaterial).color;
      if (color) {
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        let target = steel;
        if (hsl.s > 0.24 && hsl.h >= 0.035 && hsl.h <= 0.17) target = orange;
        else if (hsl.s > 0.24) target = graphite;
        else if (hsl.l > 0.78) target = light;
        else if (hsl.l < 0.24) target = graphite;
        color.setHex(target);
      }
      material.needsUpdate = true;
      return material;
    });

    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/** Returns a private scene clone so each placement can be transformed independently. */
export async function loadIndustrialAsset(key: IndustrialAssetKey): Promise<IndustrialAsset> {
  const source = await getSource(INDUSTRIAL_ASSETS[key]);
  const scene = source.scene.clone(true);
  applyIndustrialPalette(scene);

  // GLB assets are authored in metres with +Y up and the origin on the floor.
  // Correct the tiny source-pivot offsets without changing their real-world scale.
  const bounds = new THREE.Box3().setFromObject(scene);
  if (Number.isFinite(bounds.min.y) && Math.abs(bounds.min.y) > 0.0001) {
    scene.position.y -= bounds.min.y;
  }

  return { scene, animations: source.animations };
}
