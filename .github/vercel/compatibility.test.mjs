import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = createRequire(realpathSync(new URL('./node_modules/vercel/package.json', import.meta.url)));
function packageRequire(parent, name) {
  const path = parent.resolve.paths(name).map(base => join(base, name, 'package.json')).find(existsSync);
  assert.ok(path, `Installed consumer ${name}`);
  return createRequire(realpathSync(path));
}
const consumer = name => packageRequire(cli, name);
const container = consumer('@vercel/container');
const python = consumer('@vercel/python-analysis');

test('container tar.extract supports sync and async archives and rejects escapes', async () => {
  const tar = container('tar');
  const root = await mkdtemp(join(tmpdir(), 'capsule-tar-'));
  try {
    const source = join(root, 'source');
    await mkdir(source);
    await writeFile(join(source, 'artifact.txt'), 'build artifact');
    const archive = join(root, 'artifact.tgz');
    await tar.create({ file: archive, cwd: source, gzip: true }, ['artifact.txt']);
    for (const sync of [true, false]) {
      const cwd = join(root, String(sync));
      await mkdir(cwd);
      await tar.extract({ file: archive, cwd, sync });
      assert.equal(await readFile(join(cwd, 'artifact.txt'), 'utf8'), 'build artifact');
      const header = new tar.Header({ path: '../escape', size: 1, mode: 0o644, type: 'File' });
      header.encode();
      const malicious = join(root, 'malicious.tar');
      await writeFile(malicious, Buffer.concat([header.block, Buffer.from('x'), Buffer.alloc(1535)]));
      const warnings = [];
      await tar.extract({ file: malicious, cwd, sync, onwarn: code => warnings.push(code) });
      assert.ok(warnings.includes('TAR_ENTRY_ERROR'));
      assert.equal(existsSync(join(root, 'escape')), false);
      const linkHeader = new tar.Header({ path: 'link', linkpath: root, type: 'SymbolicLink', mode: 0o777 });
      linkHeader.encode();
      const fileHeader = new tar.Header({ path: 'link/outside', size: 1, type: 'File', mode: 0o644 });
      fileHeader.encode();
      await writeFile(malicious, Buffer.concat([linkHeader.block, fileHeader.block, Buffer.from('x'), Buffer.alloc(1535)]));
      await tar.extract({ file: malicious, cwd, sync, onwarn() {} });
      assert.equal(existsSync(join(root, 'outside')), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('container TOML parsing and serialization retain buildpack reports', () => {
  const toml = container('smol-toml');
  const report = { tools: { node: '24' }, build: { command: 'pnpm build' } };
  const parsed = toml.parse(toml.stringify(report));
  assert.equal(parsed.tools.node, report.tools.node);
  assert.equal(parsed.build.command, report.build.command);
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.throws(() => toml.parse('key = 1\nkey = 2'));
});

test('Python analysis YAML and glob APIs accept configs and select source files', () => {
  const yaml = python('js-yaml');
  assert.deepEqual(yaml.load('runtime: python3\nfiles:\n  - app.py\n'), { runtime: 'python3', files: ['app.py'] });
  assert.throws(() => yaml.load('value: !!js/function function() {}'));
  const { minimatch } = python('minimatch');
  assert.equal(minimatch('src/app.py', '**/*.py'), true);
  assert.equal(minimatch('src/app.js', '**/*.py'), false);
});

test('static config Ajv validates schemas and rejects invalid values', () => {
  const build = consumer('@vercel/static-build');
  const config = packageRequire(build, '@vercel/static-config');
  const Ajv = config('ajv');
  const validate = new Ajv().compile({ type: 'object', properties: { runtime: { type: 'string' } }, required: ['runtime'] });
  assert.equal(validate({ runtime: 'nodejs24.x' }), true);
  assert.equal(validate({ runtime: 24 }), false);
});

test('Node v6 and backend v8 route patterns retain parameter and rejection behavior', () => {
  const v6 = consumer('@vercel/node')('path-to-regexp');
  assert.equal(v6.match('/api/:name')('/api/hello').params.name, 'hello');
  assert.equal(v6.match('/api/:name')('/other'), false);
  const v8 = consumer('@vercel/backends')('path-to-regexp');
  assert.equal(v8.match('/api/:name')('/api/hello').params.name, 'hello');
  assert.equal(v8.match('/api/:name')('/other'), false);
  assert.throws(() => v8.pathToRegexp('/api/:'));
});

test('CLI Zod v4 schemas accept config and reject invalid values', () => {
  const { z } = cli('zod');
  const schema = z.object({ token: z.string().min(1), expires: z.number().optional() });
  assert.equal(schema.safeParse({ token: 'fixture', expires: 10 }).success, true);
  assert.equal(schema.safeParse({ token: '' }).success, false);
});

// Exercise a real local build with isolated configuration and no credentials.
test('CLI builds a disposable static project into prebuilt output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'capsule-vercel-build-'));
  try {
    await mkdir(join(root, '.vercel'));
    await mkdir(join(root, 'public'));
    const html = '<html><body>Local build fixture</body></html>';
    await writeFile(join(root, 'public/index.html'), html);
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'static-build-fixture', private: true }));
    await writeFile(join(root, '.vercel/project.json'), JSON.stringify({
      projectId: 'prj_local_fixture', orgId: 'team_local_fixture',
      settings: { framework: null, buildCommand: null, devCommand: null, installCommand: 'true', outputDirectory: 'public' },
    }));
    const cliPath = fileURLToPath(new URL('./node_modules/.bin/vercel', import.meta.url));
    const result = spawnSync(cliPath, ['build', '--prod'], {
      cwd: root, encoding: 'utf8', timeout: 45000,
      env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: root, CI: '1', VERCEL_TELEMETRY_DISABLED: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    const output = join(root, '.vercel/output');
    assert.equal(await readFile(join(output, 'static/index.html'), 'utf8'), html);
    const config = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
    assert.equal(config.version, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Node consumer Undici Headers and request preserve streamed proxy responses', async () => {
  const { Headers, request } = consumer('@vercel/node')('undici');
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(201, { 'content-type': 'application/json', 'x-fixture': req.headers['x-fixture'] });
    res.end(JSON.stringify({ method: req.method, body }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const headers = new Headers({ 'x-fixture': 'proxy' });
    const response = await request(`http://127.0.0.1:${server.address().port}/api`, {
      method: 'POST', headers: Object.fromEntries(headers), body: 'request body', maxRedirections: 0,
    });
    assert.equal(response.statusCode, 201);
    assert.equal(new Headers(response.headers).get('x-fixture'), 'proxy');
    let text = '';
    for await (const chunk of response.body) text += chunk;
    assert.deepEqual(JSON.parse(text), { method: 'POST', body: 'request body' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
