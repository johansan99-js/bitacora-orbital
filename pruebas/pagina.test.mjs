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
  assert.match(yml, /version="\$\{GITHUB_SHA::8\}"/);
  // El sed cambia ?v=dev por ?v=<commit> en los scripts de poblacion/ y vendor/
  const lineas = yml.split("\n").map(l => l.trim());
  const sed = lineas.find(l => l.startsWith("sed -i -E"));
  assert.ok(sed, "falta el sed que pone la versión");
  for (const trozo of ["(poblacion|vendor)", String.raw`\?v=dev`, "\\1?v=${version}", "_site/index.html"]) assert.ok(sed.includes(trozo), `${sed} no tiene ${trozo}`);
  // Y la guarda que falla si queda algún script local sin versión o con ?v=dev
  const guarda = lineas.findIndex(l => l.startsWith("if grep -nE") && l.includes("(poblacion|vendor)") && l.includes(String.raw`(\?v=dev)?`) && l.includes("_site/index.html"));
  assert.ok(guarda > lineas.indexOf(sed), "falta la guarda después del sed");
  assert.match(lineas[guarda + 1], /exit 1/);
});

test("las copias WebP que pide la página existen y los JPG originales siguen ahí", () => {
  const conjunto = html.match(/const WEBP = new Set\(\[([^\]]*)\]\)/);
  assert.ok(conjunto, "falta el conjunto WEBP en index.html");
  const pagina = [...conjunto[1].matchAll(/"([\w.-]+\.jpg)"/g)].map(m => m[1]);
  assert.ok(pagina.length > 0);
  // La misma lista que genera herramientas/publicar_webp.py
  const py = leer("herramientas/publicar_webp.py").toString("utf8").match(/ARCHIVOS = \[([^\]]*)\]/);
  assert.deepEqual(pagina, [...py[1].matchAll(/"([\w.-]+\.jpg)"/g)].map(m => m[1]));
  for (const jpg of pagina) {
    assert.ok(existsSync(new URL(`tex/${jpg}`, raiz)), `falta el original tex/${jpg}`);
    const webp = leer(`tex/${jpg.replace(/\.jpg$/, ".webp")}`);
    assert.equal(webp.toString("latin1", 0, 4) + webp.toString("latin1", 8, 12), "RIFFWEBP", `${jpg}: la copia no es WebP`);
  }
});
