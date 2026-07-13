const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    },
    fileName: filename
  }).outputText;

  const loadedModule = new Module(filename, module);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename));
  loadedModule._compile(compiled, filename);
  return loadedModule.exports;
}

const { vkRandomIdForEvent } = loadTypeScriptModule('lib/notify.ts');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('VK uses the same random_id when the same event is retried', () => {
  const first = vkRandomIdForEvent('claim:9bb5e0f8-84cd-42d8-9f21-7b2a9aa91795');
  const retry = vkRandomIdForEvent('claim:9bb5e0f8-84cd-42d8-9f21-7b2a9aa91795');

  assert.equal(retry, first);
  assert.ok(first > 0 && first <= 2147483647);
});

test('different notification events get different random_id values', () => {
  const claim = vkRandomIdForEvent('claim:9bb5e0f8-84cd-42d8-9f21-7b2a9aa91795');
  const submit = vkRandomIdForEvent('submit:9bb5e0f8-84cd-42d8-9f21-7b2a9aa91795:2026-07-13T12:00:00.000Z');

  assert.notEqual(submit, claim);
});

test('claim requests use the client request id as the assignment primary key', () => {
  const route = readProjectFile('app/api/claim/route.ts');

  assert.match(route, /id:\s*assignmentId/);
  assert.match(route, /error\?\.code === '23505'/);
  assert.match(route, /duplicate:\s*true/);
});

test('submit requests atomically skip an assignment that is already submitted', () => {
  const route = readProjectFile('app/api/submit/route.ts');

  assert.match(route, /\.neq\('status', 'Материал сдан'\)/);
  assert.match(route, /current\?\.status === 'Материал сдан'/);
  assert.match(route, /duplicate:\s*true/);
});

test('the client blocks both action buttons while their requests are pending', () => {
  const page = readProjectFile('app/page.tsx');

  assert.match(page, /if \(claimPendingRef\.current\) return/);
  assert.match(page, /if \(submitPendingRef\.current\) return/);
  assert.match(page, /disabled=\{claimPending\}/);
  assert.match(page, /disabled=\{submitPending\}/);
});
