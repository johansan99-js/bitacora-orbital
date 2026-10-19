// Escena 3D de la escala "La Tierra": globo con hielo y costas antiguas, bandas que caminan y luces de la partida.
const VistaTierra = (() => {
  const R = 10, D2R = Math.PI / 180, MAX_BANDAS = 3000, MAX_LUCES = 20000;
  // Colores de las bandas y luces: cálido de siempre, y celeste donde tu pueblo es mayoría (modo "Tu pueblo")
  const CALIDO = [1, 0xc2 / 255, 0x7a / 255], CELESTE = [0x7f / 255, 0xd8 / 255, 1], LUZ = [1, 0.78, 0.45];

  // Escribe en arr el punto k de latitud y longitud dadas sobre una esfera de radio `radio`, con la misma
  // orientación que las texturas en THREE.SphereGeometry (u = 0 en la longitud −180°, v = 1 en el polo norte)
  function escribirPunto(arr, k, lat, lon, radio) {
    const phi = (lon + 180) * D2R, c = Math.cos(lat * D2R);
    arr[k * 3] = -Math.cos(phi) * c * radio;
    arr[k * 3 + 1] = Math.sin(lat * D2R) * radio;
    arr[k * 3 + 2] = Math.sin(phi) * c * radio;
  }
  const uno = new Float32Array(3);
  function normal(lat, lon) { escribirPunto(uno, 0, lat, lon, 1); return new THREE.Vector3(uno[0], uno[1], uno[2]); }
  // Azar fijo por número: cada celda reparte sus luces siempre en los mismos lugares
  const hash = n => { const s = Math.sin(n * 12.9898) * 43758.5453, t = Math.sin(n * 78.233) * 12345.6789; return [s - Math.floor(s), t - Math.floor(t)]; };

  function crear({ partida, historia, cargarTextura, respaldo, punto, fondo, aspectK, reduceMotion, pixelRatio }) {
    const scene = new THREE.Scene();
    fondo(scene);
    const sol = new THREE.Vector3(1, 0.25, 0.4).normalize();
    let angSol = 0;

    // Capa de datos: un píxel por celda (R = hielo de la glaciación, G = plataforma seca de un puente de tierra).
    // La fila 0 de una DataTexture es el sur, así que las filas del motor (0 = norte) se escriben al revés.
    const { ancho: W, alto: H } = partida.motor().celdas;
    const datos = new Uint8Array(W * H * 4);
    const capas = new THREE.DataTexture(datos, W, H, THREE.RGBAFormat);
    capas.magFilter = THREE.LinearFilter; capas.minFilter = THREE.LinearFilter;
    const negro = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    negro.needsUpdate = true;

    // Globo: textura real de día, brillo del Sol en el mar, hielo y plataformas secas encima, noche azulada
    const globoMat = new THREE.ShaderMaterial({
      uniforms: { dia: { value: respaldo }, mares: { value: negro }, capas: { value: capas }, sol: { value: sol }, verCapas: { value: 1 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform sampler2D dia, mares, capas; uniform vec3 sol; uniform float verCapas; varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        void main() {
          vec3 N = normalize(vN), L = normalize(sol), V = normalize(cameraPosition - vWp);
          float nl = dot(N, L);
          vec4 c = texture2D(capas, vUv) * verCapas;
          vec3 col = texture2D(dia, vUv).rgb;
          col = mix(col, vec3(0.45, 0.42, 0.32), c.g * (1.0 - c.r));
          float hielo = c.r * (1.0 - texture2D(mares, vUv).r * 0.9);   // el hielo glaciar se dibuja sobre la tierra, no sobre el mar
          col = mix(col, vec3(0.93, 0.96, 1.0), hielo);
          float mar = texture2D(mares, vUv).r * (1.0 - c.g) * (1.0 - hielo);
          vec3 luz = col * (max(nl, 0.0) * 1.1 + 0.05);
          luz += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, normalize(L + V)), 0.0), 220.0) * mar * 0.5 * step(0.0, nl);
          luz += vec3(0.015, 0.025, 0.05) * (1.0 - smoothstep(-0.2, 0.1, nl));
          gl_FragColor = vec4(luz, 1.0);
        }`
    });
    const globo = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), globoMat);
    scene.add(globo);
    cargarTextura("earth_day.jpg").then(t => { if (t) globoMat.uniforms.dia.value = t; });
    cargarTextura("earth_spec.jpg").then(t => { if (t) globoMat.uniforms.mares.value = t; });
    // Atmósfera: borde azul, más brillante del lado de día
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 32), new THREE.ShaderMaterial({
      uniforms: { sol: { value: sol } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 sol; varying vec3 vN; varying vec3 vV;
        void main() { float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.6); float dia = 0.25 + 0.75 * smoothstep(-0.3, 0.4, dot(vN, normalize(sol)));
          gl_FragColor = vec4(vec3(0.37, 0.66, 1.0) * rim * dia * 1.4, rim * dia); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })));

    // Bandas de recolectores: puntos cálidos que caminan dentro de su celda
    const bPos = new Float32Array(MAX_BANDAS * 3);
    const bandasGeo = new THREE.BufferGeometry();
    bandasGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    const bCol = new Float32Array(MAX_BANDAS * 3);
    bandasGeo.setAttribute("color", new THREE.BufferAttribute(bCol, 3));
    bandasGeo.setDrawRange(0, 0);
    const bandas = new THREE.Points(bandasGeo, new THREE.PointsMaterial({ color: 0xffffff, vertexColors: true, size: 3.2, sizeAttenuation: false, map: punto,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bandas.frustumCulled = false;
    scene.add(bandas);
    const bCelda = new Int32Array(MAX_BANDAS), bU = new Float32Array(MAX_BANDAS), bV = new Float32Array(MAX_BANDAS);
    const bDu = new Float32Array(MAX_BANDAS), bDv = new Float32Array(MAX_BANDAS);
    let nBandas = 0;
    function rumbo(b) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.06; bDu[b] = Math.cos(a) * v; bDv[b] = Math.sin(a) * v; }
    function nuevaBanda(b, i) { bCelda[b] = i; bU[b] = 0.15 + Math.random() * 0.7; bV[b] = 0.15 + Math.random() * 0.7; rumbo(b); }
    function copiarBanda(a, b) { if (a === b) return; bCelda[b] = bCelda[a]; bU[b] = bU[a]; bV[b] = bV[a]; bDu[b] = bDu[a]; bDv[b] = bDv[a]; }
    // Cuántas bandas quiere cada celda de recolectores (sigue el logaritmo de su población); conserva las que siguen sirviendo
    function repartirBandas() {
      const c = partida.motor().celdas, quiere = new Map();
      let suma = 0;
      for (const i of c.tierra) {
        if (c.etapa[i] !== 1) continue;
        const n = Math.min(4, Math.max(1, Math.round(Math.log10(c.poblacion[i]) - 1)));
        quiere.set(i, n); suma += n;
      }
      if (suma > MAX_BANDAS) {
        const f = MAX_BANDAS / suma;
        for (const [i, n] of quiere) { const x = n * f; quiere.set(i, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0)); }
      }
      const tiene = new Map();
      let k = 0;
      for (let b = 0; b < nBandas; b++) {
        const i = bCelda[b], ya = tiene.get(i) || 0;
        if ((quiere.get(i) || 0) > ya) { tiene.set(i, ya + 1); copiarBanda(b, k++); }
      }
      for (const [i, n] of quiere) for (let ya = tiene.get(i) || 0; ya < n && k < MAX_BANDAS; ya++) nuevaBanda(k++, i);
      nBandas = k;
      bandasGeo.setDrawRange(0, nBandas);
      pintarBandas();
    }
    // Colorea cada banda según si su celda es de tu pueblo (sin crear nada: solo escribe en bCol)
    function pintarBandas() {
      const pb = partida.motor().pueblo();
      for (let b = 0; b < nBandas; b++) {
        const col = pb !== null && pb.mayoria(bCelda[b]) ? CELESTE : CALIDO;
        bCol[b * 3] = col[0]; bCol[b * 3 + 1] = col[1]; bCol[b * 3 + 2] = col[2];
      }
      bandasGeo.attributes.color.needsUpdate = true;
    }
    function moverBandas(dt) {
      const c = partida.motor().celdas, G = c.grados;
      for (let b = 0; b < nBandas; b++) {
        if (!reduceMotion) {
          bU[b] += bDu[b] * dt; bV[b] += bDv[b] * dt;
          if (bU[b] < 0.1 || bU[b] > 0.9) { bDu[b] = -bDu[b]; bU[b] = Math.min(0.9, Math.max(0.1, bU[b])); }
          if (bV[b] < 0.1 || bV[b] > 0.9) { bDv[b] = -bDv[b]; bV[b] = Math.min(0.9, Math.max(0.1, bV[b])); }
          if (Math.random() < dt * 0.3) rumbo(b);
        }
        const i = bCelda[b];
        escribirPunto(bPos, b, c.lat[i] + (0.5 - bV[b]) * G, c.lon[i] + (bU[b] - 0.5) * G, R * 1.004);
      }
      bandasGeo.attributes.position.needsUpdate = true;
    }

    // Luces de aldeas, ciudades e industria: solo se ven del lado de noche
    const lPos = new Float32Array(MAX_LUCES * 3), lBrillo = new Float32Array(MAX_LUCES), lTinte = new Float32Array(MAX_LUCES * 3);
    const lucesGeo = new THREE.BufferGeometry();
    lucesGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lucesGeo.setAttribute("brillo", new THREE.BufferAttribute(lBrillo, 1));
    lucesGeo.setAttribute("tinte", new THREE.BufferAttribute(lTinte, 3));
    lucesGeo.setDrawRange(0, 0);
    const luces = new THREE.Points(lucesGeo, new THREE.ShaderMaterial({
      uniforms: { sol: { value: sol }, mapa: { value: punto }, escala: { value: pixelRatio } },
      vertexShader: `attribute float brillo; attribute vec3 tinte; uniform vec3 sol; uniform float escala; varying float vLuz; varying vec3 vTinte;
        void main() {
          vTinte = tinte;
          vLuz = brillo * (1.0 - smoothstep(-0.15, 0.1, dot(normalize(position), normalize(sol))));
          gl_PointSize = (2.0 + 5.0 * brillo) * escala;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform sampler2D mapa; varying float vLuz; varying vec3 vTinte;
        void main() { float a = texture2D(mapa, gl_PointCoord).a * vLuz; if (a < 0.01) discard; gl_FragColor = vec4(vTinte * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    luces.frustumCulled = false;
    scene.add(luces);
    function encenderLuces() {
      const c = partida.motor().celdas, G = c.grados, pb = partida.motor().pueblo();
      let k = 0;
      for (const i of c.tierra) {
        const e = c.etapa[i];
        if (e < 2) continue;
        const col = pb !== null && pb.mayoria(i) ? CELESTE : LUZ;
        const brillo = Math.min(1, Math.max(0.15, (Math.log10(c.poblacion[i]) - 3) / 5));
        const puntos = e === 2 ? 1 : e === 3 ? 3 : 5;
        for (let p = 0; p < puntos && k < MAX_LUCES; p++, k++) {
          const [hu, hv] = hash(i * 7 + p);
          escribirPunto(lPos, k, c.lat[i] + (hv - 0.5) * G * 0.8, c.lon[i] + (hu - 0.5) * G * 0.8, R * 1.002);
          lBrillo[k] = brillo * (p === 0 ? 1 : 0.6);
          lTinte[k * 3] = col[0]; lTinte[k * 3 + 1] = col[1]; lTinte[k * 3 + 2] = col[2];
        }
      }
      lucesGeo.setDrawRange(0, k);
      lucesGeo.attributes.position.needsUpdate = true;
      lucesGeo.attributes.brillo.needsUpdate = true;
      lucesGeo.attributes.tinte.needsUpdate = true;
    }

    function pintarCapas() {
      const c = partida.motor().celdas;
      for (const i of c.tierra) {
        const t = ((H - 1 - Math.floor(i / W)) * W + (i % W)) * 4;
        datos[t] = c.hielo[i] ? 255 : 0;
        datos[t + 1] = c.plataforma[i] ? 255 : 0;
        datos[t + 3] = 255;
      }
      capas.needsUpdate = true;
    }

    // Continentes del muelle, con el punto del globo donde va su etiqueta
    const objs = historia.continentes.map(c => {
      const n = normal(c.lat, c.lon);
      return Object.assign(c, { world: n.clone().multiplyScalar(R * 1.02), normal: n, view: R * 2.4, r: 0 });
    });

    let tCapas = 1, tGente = 1, añoCapas = NaN, añoGente = NaN;
    partida.alEvento(e => {
      if (e.tipo !== "nueva") return;
      nBandas = 0; bandasGeo.setDrawRange(0, 0);
      añoCapas = añoGente = NaN;
      pintarCapas(); repartirBandas(); encenderLuces();
    });
    function update(dt) {
      partida.paso(dt);
      if (!reduceMotion) {
        angSol += dt * Math.PI * 2 / 60;
        sol.set(Math.cos(angSol), 0.25, Math.sin(angSol)).normalize();
      }
      const año = partida.motor().año();
      tCapas += dt; tGente += dt;
      if (tCapas >= 0.25 && año !== añoCapas) { tCapas = 0; añoCapas = año; pintarCapas(); }
      if (tGente >= 0.5 && año !== añoGente) { tGente = 0; añoGente = año; repartirBandas(); encenderLuces(); }
      moverBandas(dt);
    }
    function setCapa(nombre, on) {
      if (nombre === "hielo") globoMat.uniforms.verCapas.value = on ? 1 : 0;
      if (nombre === "grupos") bandas.visible = on;
      if (nombre === "luces") luces.visible = on;
    }

    pintarCapas(); repartirBandas(); encenderLuces();
    // La celda con más tuyos (null en modo Historia o si no queda ninguno)
    function centroPueblo() {
      const m = partida.motor(), pb = m.pueblo();
      if (pb === null) return null;
      const c = m.celdas, tu = pb.tuyos;
      let mejor = -1, max = 0;
      for (const i of c.tierra) if (tu[i] > max) { max = tu[i]; mejor = i; }
      return mejor < 0 ? null : { lat: c.lat[mejor], lon: c.lon[mejor] };
    }
    return {
      scene, objs, update, setCapa, centroPueblo, oclusor: globo,
      minD: R * 1.15, maxD: R * 6, near: R * 2.6, radio: R * 1.6,
      tgt: new THREE.Vector3(), anchor: new THREE.Vector3(),
      over: () => new THREE.Vector3(0, R * 0.9, R * 2.8).multiplyScalar(aspectK())
    };
  }

  return { crear, normal, R };
})();
if (typeof module !== "undefined") module.exports = VistaTierra;
