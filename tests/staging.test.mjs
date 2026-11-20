import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PLUGIN_VERSION, RUNTIME_FILES, markerIsFresh, runtimeFingerprint } from '../index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)

test('staging copies a non-empty source for every unique destination', async () => {
  const destinations = new Set()
  for (const [source, destination] of RUNTIME_FILES) {
    assert.match(source, /^(runtime|shared)\//u, source)
    assert.equal(destinations.has(destination), false, `duplicate destination ${destination}`)
    destinations.add(destination)
    const text = await readFile(path.join(root, source), 'utf8')
    assert.ok(text.length > 0, `${source} is empty`)
  }
})

test('host, reader manifest and marker share one version', async () => {
  for (const manifest of ['package.json', 'runtime/package.json']) {
    const parsed = JSON.parse(await readFile(path.join(root, manifest), 'utf8'))
    assert.equal(parsed.version, PLUGIN_VERSION, manifest)
  }
})

test('the fingerprint covers every staged source', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'fishread-fingerprint-'))
  try {
    for (const [source] of RUNTIME_FILES) {
      const target = path.join(fixture, source)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, `fixture:${source}\n`, 'utf8')
    }
    const baseline = await runtimeFingerprint(fixture)
    assert.equal(await runtimeFingerprint(fixture), baseline, 'fingerprint is not deterministic')
    assert.notEqual(baseline, await runtimeFingerprint(root), 'fixture and real sources collide')

    for (const [source] of RUNTIME_FILES) {
      const target = path.join(fixture, source)
      const original = await readFile(target, 'utf8')
      await writeFile(target, `${original}changed\n`, 'utf8')
      assert.notEqual(await runtimeFingerprint(fixture), baseline, `${source} is not fingerprinted`)
      await writeFile(target, original, 'utf8')
    }
    assert.equal(await runtimeFingerprint(fixture), baseline, 'restoring contents changed the fingerprint')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('a marker written before runtime fingerprints can never be reused', async () => {
  const desired = {
    version: PLUGIN_VERSION,
    runtime: await runtimeFingerprint(root),
    source: '/Applications/DeepSeek Harness.app',
    mtime: 1795001768000,
  }
  assert.equal(markerIsFresh({ ...desired, noSandbox: false }, desired), true)

  // The 0.1.3 marker shape, which let a stale window runtime survive a fixed
  // source tree and kept "Replace novel" opening the book page with the picker.
  const legacy = { version: desired.version, source: desired.source, mtime: desired.mtime, noSandbox: false }
  assert.equal(markerIsFresh(legacy, desired), false)
  assert.equal(markerIsFresh({ ...desired, runtime: 'stale' }, desired), false)
  assert.equal(markerIsFresh({ ...desired, version: '0.1.3' }, desired), false)
  assert.equal(markerIsFresh(null, desired), false)
})
