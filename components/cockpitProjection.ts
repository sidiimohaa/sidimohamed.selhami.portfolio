import * as THREE from "three";
import { destinations } from "./universe";

const DESKTOP = [
  [-1.65, 1.5, -3.2, 0.45],
  [-0.6, 2.1, -4.1, 0.35],
  [0.65, 1.65, -3.5, 0.35],
  [1.8, 2.15, -4.4, 0.4],
] as const;
const COMPACT = [
  [-0.72, 2.75, -3.7, 0.32],
  [0.72, 2.75, -3.9, 0.3],
  [-0.72, 1.85, -3.4, 0.3],
  [0.72, 1.85, -3.6, 0.32],
] as const;

const vertex = `
 varying vec3 vNormal;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 varying vec3 vLocal;
 void main(){
  vNormal=normalize(normal);
  vLocal=position;
  vViewNormal=normalize(normalMatrix*normal);
  vec4 view=modelViewMatrix*vec4(position,1.0);
  vViewPosition=view.xyz;
  gl_Position=projectionMatrix*view;
 }`;

const surfaceFragment = `
 uniform sampler2D image;
 uniform vec2 imageCenter;
 uniform vec2 imageRadius;
 uniform float ready;
 uniform float time;
 uniform float focus;
 uniform float gain;
 uniform vec3 tint;
 varying vec3 vNormal;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 varying vec3 vLocal;
 float hash(vec3 p){return fract(sin(dot(p,vec3(41.3,289.1,117.7)))*43758.5453);}
 void main(){
  vec3 n=normalize(vNormal);
  vec2 uv=imageCenter+n.xy*imageRadius*.992;
  vec3 reference=texture2D(image,uv).rgb;
  float relief=clamp(sqrt(max(0.0,dot(reference,vec3(.2126,.7152,.0722))))*gain,0.0,1.0);
  float technical=.24+.25*sin(n.x*13.0+n.z*5.0)*sin(n.y*19.0-n.z*7.0);
  relief=mix(technical,relief,ready);
  float face=max(0.0,dot(normalize(vViewNormal),normalize(-vViewPosition)));
  float rim=pow(1.0-face,2.7);
  float band=.72+.28*smoothstep(.18,.68,fract(gl_FragCoord.y*.27-time*.22));
  float sweep=pow(max(0.0,cos(n.y*5.0-time*.55)),24.0)*.15;
  float detail=smoothstep(.025,.72,relief);
  float grain=.91+.09*hash(floor(n*170.0)+floor(time*6.0));
  float alpha=(.15+detail*.44+rim*.42+sweep)*band*grain;
  vec3 color=tint*(.5+detail*.68+rim*.32)+vec3(.12,.2,.23)*rim;
  color*=1.0+focus*.18;
  gl_FragColor=vec4(color,min(.84,alpha));
  #include <colorspace_fragment>
 }`;

const atmosphereFragment = `
 uniform vec3 tint;
 uniform float focus;
 varying vec3 vViewNormal;
 varying vec3 vViewPosition;
 void main(){
  float face=max(0.0,dot(normalize(vViewNormal),normalize(-vViewPosition)));
  float rim=pow(1.0-face,4.5);
  gl_FragColor=vec4(tint,rim*(.2+focus*.17));
 }`;

function circle(radius: number, segments = 96) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    );
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

/** A self-contained projection; the parent supplies its cockpit, camera and controls. */
export function createCockpitProjection() {
  const group = new THREE.Group();
  group.name = "cockpit-stellar-projection";
  const emitter = new THREE.Vector3(0, 0.78, -2.03);
  const cyan = new THREE.Color(0x58d2ff);
  const violet = new THREE.Color(0xb99cff);
  const fallback = new THREE.DataTexture(
    new Uint8Array([190, 215, 230, 255]),
    1,
    1,
  );
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  const textures = new Set<THREE.Texture>([fallback]);
  let disposed = false;
  const loader = new THREE.TextureLoader();
  const uniforms = destinations.map((destination, index) => {
    const frame = destination.reference;
    const values = {
      image: { value: fallback as THREE.Texture },
      imageCenter: {
        value: new THREE.Vector2(
          frame.centerX / frame.width,
          1 - frame.centerY / frame.height,
        ),
      },
      imageRadius: {
        value: new THREE.Vector2(
          frame.radius / frame.width,
          frame.radius / frame.height,
        ),
      },
      ready: { value: 0 },
      time: { value: 0 },
      focus: { value: 0 },
      gain: { value: index === 2 ? 2.35 : 1.1 },
      tint: { value: cyan.clone() },
    };
    loader.load(
      destination.image,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.add(texture);
        values.image.value = texture;
        values.ready.value = 1;
      },
      undefined,
      () => {
        // The procedural globe and its meridians remain available offline.
      },
    );
    return values;
  });

  const meridians: THREE.Group[] = [];
  const halos: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>[] =
    [];
  const grids: THREE.LineDashedMaterial[] = [];
  const planets = destinations.map((destination, index) => {
    const root = new THREE.Group();
    const radius = DESKTOP[index][3];
    root.name = `hologram-${destination.className}`;
    root.userData.radius = radius;
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms[index],
      vertexShader: vertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    root.add(
      new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material),
    );
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.037, 64, 40),
      new THREE.ShaderMaterial({
        uniforms: { tint: uniforms[index].tint, focus: uniforms[index].focus },
        vertexShader: vertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    root.add(atmosphere);
    const grid = new THREE.Group();
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0x8bdeff,
      dashSize: radius * 0.095,
      gapSize: radius * 0.07,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const gridPoints: number[] = [];
    const appendRing = (
      ring: THREE.BufferGeometry,
      rotation: THREE.Euler,
      y = 0,
    ) => {
      const transform = new THREE.Matrix4().makeRotationFromEuler(rotation);
      transform.setPosition(0, y, 0);
      ring.applyMatrix4(transform);
      const position = ring.getAttribute("position");
      for (let segment = 0; segment < position.count; segment++) {
        const next = (segment + 1) % position.count;
        gridPoints.push(
          position.getX(segment),
          position.getY(segment),
          position.getZ(segment),
          position.getX(next),
          position.getY(next),
          position.getZ(next),
        );
      }
      ring.dispose();
    };
    for (let meridian = 0; meridian < 3; meridian++) {
      appendRing(
        circle(radius * 1.008, 72),
        new THREE.Euler(0, (meridian * Math.PI) / 3, 0),
      );
    }
    for (const latitude of [-0.5, 0.5]) {
      appendRing(
        circle(radius * Math.sqrt(1 - latitude * latitude) * 1.008, 72),
        new THREE.Euler(Math.PI / 2, 0, 0),
        radius * latitude,
      );
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gridPoints, 3),
    );
    const gridLines = new THREE.LineSegments(gridGeometry, lineMaterial);
    gridLines.computeLineDistances();
    grid.add(gridLines);
    root.add(grid);
    meridians.push(grid);
    grids.push(lineMaterial);
    const halo = new THREE.LineLoop(
      circle(radius * 1.19),
      new THREE.LineBasicMaterial({
        color: 0xb6b1ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    halo.rotation.set(0.35, -0.18, 0);
    root.add(halo);
    halos.push(halo);
    group.add(root);
    return root;
  });

  const linksGeometry = new THREE.BufferGeometry();
  const linkPositions = new Float32Array(18);
  linksGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(linkPositions, 3),
  );
  group.add(
    new THREE.LineSegments(
      linksGeometry,
      new THREE.LineDashedMaterial({
        color: 0x83c9e9,
        dashSize: 0.06,
        gapSize: 0.075,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  const links = group.children[group.children.length - 1] as THREE.LineSegments;
  const beams: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  let compact: boolean | null = null;
  function setCompact(value: boolean) {
    if (value === compact) return;
    compact = value;
    const layout = value ? COMPACT : DESKTOP;
    planets.forEach((planet, index) => {
      const [x, y, z, radius] = layout[index];
      planet.position.set(x, y, z);
      planet.scale.setScalar(radius / DESKTOP[index][3]);
      planet.userData.radius = radius;
      const direction = planet.position.clone().sub(emitter);
      const distance = direction.length();
      const geometry = new THREE.ConeGeometry(
        radius * 0.74,
        distance,
        32,
        1,
        true,
      );
      let beam = beams[index];
      if (!beam) {
        const material = new THREE.ShaderMaterial({
          uniforms: { focus: uniforms[index].focus },
          vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `uniform float focus;varying vec2 vUv;void main(){float alpha=(.012+focus*.012)*pow(vUv.y,1.8);gl_FragColor=vec4(.18,.64,.9,alpha);}`,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        beam = new THREE.Mesh(geometry, material);
        beam.name = "hologram-projector-beam";
        beams.push(beam);
        group.add(beam);
      } else {
        beam.geometry.dispose();
        beam.geometry = geometry;
      }
      beam.position.copy(emitter).add(planet.position).multiplyScalar(0.5);
      beam.quaternion.setFromUnitVectors(up, direction.normalize().negate());
      if (index < planets.length - 1) {
        planet.position.toArray(linkPositions, index * 6);
        const next = layout[index + 1];
        linkPositions.set([next[0], next[1], next[2]], index * 6 + 3);
      }
    });
    linksGeometry.getAttribute("position").needsUpdate = true;
    linksGeometry.computeBoundingSphere();
    links.computeLineDistances();
  }
  setCompact(false);
  let last = -1;
  return {
    group,
    planets: planets as THREE.Object3D[],
    setCompact,
    tick(elapsed: number, selected: number, reduced: boolean) {
      const dt =
        last < 0 ? 1 / 60 : THREE.MathUtils.clamp(elapsed - last, 0, 0.05);
      last = elapsed;
      uniforms.forEach((values, index) => {
        const target = selected === index ? 1 : 0;
        values.focus.value = reduced
          ? target
          : THREE.MathUtils.damp(values.focus.value, target, 9, dt);
        values.time.value = reduced ? 0 : elapsed;
        values.tint.value.copy(cyan).lerp(violet, values.focus.value * 0.68);
        grids[index].opacity = 0.075 + values.focus.value * 0.055;
        halos[index].material.opacity = values.focus.value * 0.58;
        const scale = reduced ? 1 : 1 + Math.sin(elapsed * 1.4) * 0.012;
        halos[index].scale.setScalar(scale);
        if (!reduced)
          meridians[index].rotation.y = elapsed * (0.023 + index * 0.004);
      });
    },
    dispose() {
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      textures.clear();
    },
  };
}
