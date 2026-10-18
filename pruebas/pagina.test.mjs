// La página carga todo de su propio origen y con versión: three.js desde vendor/ (los mismos bytes que daban los CDN)
// y cada script local con ?v=dev, que el despliegue cambia por el commit (.github/workflows/pages.yml).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const raiz = new URL("../", import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, raiz));
const html = leer("index.html").toString("utf8");
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);

test("los scripts de la página son locales, existen y llevan ?v=dev", () => {
  assert.ok(scripts.length >= 10);
  for (const src of scripts) {
    assert.match(src, /^(vendor|poblacion)\/[\w.-]+\.js\?v=dev$/, src);
    assert.ok(existsSync(new URL(src.split("?")[0], raiz)), `falta ${src}`);
  }
  assert.deepEqual(scripts.slice(0, 2), ["vendor/three.min.js?v=dev", "vendor/OrbitControls.js?v=dev"]);
});

test("vendor/ tiene three.js r128 y OrbitControls sin cambios", () => {
  const sha = ruta => createHash("sha256").update(leer(ruta)).digest("hex");
  // three.min.js de cdnjs (three.js/r128) = npm three@0.128.0/build; OrbitControls de npm three@0.128.0/examples/js/controls
  assert.equal(sha("vendor/three.min.js"), "9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2");
  assert.equal(sha("vendor/OrbitControls.js"), "02bb4ade710f3e607329e37a21f098bc3ac70eb6e33daf8a65e79f4db785e7b2");
  assert.match(leer("vendor/three.min.js").toString("utf8", 0, 200), /@license[\s\S]*SPDX-License-Identifier: MIT/);
  assert.match(leer("vendor/LICENSE-three.txt").toString("utf8"), /The MIT License/);
});

test("el despliegue publica vendor/ y pone la versión del commit", () => {
  const yml = leer(".github/workflows/pages.yml").toString("utf8");
  assert.match(yml, /cp -r index\.html tex renders poblacion vendor _site\//);
  assert.match(yml, /\?v=dev/);
});
