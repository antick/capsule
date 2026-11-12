import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { connect } from 'node:net';
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
for (const [launcher, useNative] of [['native', '1'], ['Node fallback', '0']]) {
  test(`CLI ${launcher} builds a disposable static project into prebuilt output`, async () => {
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
      const env = {
        PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: root, XDG_CACHE_HOME: root,
        CI: '1', VERCEL_TELEMETRY_DISABLED: '1', VERCEL_CLI_USE_NATIVE_BINARY: useNative,
        __VERCEL_NATIVE_DOWNLOAD: '0',
      };
      const version = spawnSync(cliPath, ['--version'], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
      assert.equal(version.status, 0, version.stderr);
      assert.equal(version.stdout.trim(), cli('./package.json').version);
      assert.equal(version.stderr.includes('(native)'), useNative === '1', version.stderr);
      const result = spawnSync(cliPath, ['build', '--prod'], {
        cwd: root, encoding: 'utf8', timeout: 45000,
        env,
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
}

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

test('Python analysis match export retains include and exclude selection', () => {
  const { match } = python('minimatch');
  const files = ['api/app.py', 'api/test_app.py', 'src/main.js', '.hidden.py'];
  assert.deepEqual(match(files, 'api/**/*.py'), ['api/app.py', 'api/test_app.py']);
  assert.deepEqual(match(files, '**/test_*.py'), ['api/test_app.py']);
  assert.deepEqual(match(files, '**/*.py'), ['api/app.py', 'api/test_app.py']);
  assert.deepEqual(match(files, '**/*.{py,js}'), files.slice(0, 3));
});

test('NFT glob retains asset discovery, ignore rules and cancellation', async () => {
  const node = consumer('@vercel/node');
  const { glob } = packageRequire(node, '@vercel/nft')('glob');
  const root = await mkdtemp(join(tmpdir(), 'capsule-glob-'));
  try {
    await mkdir(join(root, 'assets'));
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, 'assets/data.json'), '{}');
    await writeFile(join(root, 'assets/.hidden.json'), '{}');
    await writeFile(join(root, 'node_modules/ignored.json'), '{}');
    const paths = await glob(`${root}/**/*`, {
      dot: true, nodir: true, ignore: [`${root}/node_modules/**`],
    });
    assert.deepEqual(paths.sort(), [join(root, 'assets/.hidden.json'), join(root, 'assets/data.json')]);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(glob(`${root}/**/*`, { signal: controller.signal }), { name: 'AbortError' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Node file tracing includes dynamic filesystem assets with the upgraded glob', async () => {
  const { nodeFileTrace } = consumer('@vercel/node')('@vercel/nft');
  const root = await mkdtemp(join(tmpdir(), 'capsule-nft-'));
  try {
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'package.json'), '{"private":true}');
    await writeFile(join(root, 'assets/first.json'), '{"value":1}');
    await writeFile(join(root, 'assets/second.json'), '{"value":2}');
    await writeFile(join(root, 'index.js'), [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "module.exports = name => fs.readFileSync(path.join(__dirname, 'assets', name + '.json'));",
    ].join('\n'));
    const { fileList, warnings } = await nodeFileTrace([join(root, 'index.js')], { base: root });
    assert.ok(fileList.has('index.js'));
    assert.ok(fileList.has('assets/first.json'));
    assert.ok(fileList.has('assets/second.json'));
    assert.equal(warnings.size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Python analyzer validates Pipfile dependency records through its public schemas', () => {
  const { PipfileLikeSchema } = cli('@vercel/python-analysis');
  const config = {
    packages: { flask: '*', requests: { version: '>=2' } },
    'dev-packages': { pytest: '*' },
    scripts: { start: 'python app.py' },
  };
  const parsed = PipfileLikeSchema.parse(config);
  assert.equal(parsed.packages.flask, '*');
  assert.equal(parsed.packages.requests.version, '>=2');
  assert.equal(parsed.scripts.start, 'python app.py');
  assert.equal(PipfileLikeSchema.safeParse({ packages: { flask: 123 } }).success, false);
});

test('Python analyzer retains lockfile, project and UV configuration validation', () => {
  const schemas = cli('@vercel/python-analysis');
  const lock = { default: { flask: { version: '==3.0.0', hashes: ['sha256:fixture'] } } };
  assert.deepEqual(schemas.PipfileLockLikeSchema.parse(lock), lock);
  const project = {
    project: { name: 'fixture', dependencies: ['flask>=3'], 'optional-dependencies': { test: ['pytest'] } },
    'build-system': { requires: ['setuptools'], 'build-backend': 'setuptools.build_meta' },
  };
  assert.deepEqual(schemas.PyProjectTomlSchema.parse(project), project);
  const uv = { sources: { local: { path: './local', editable: true } }, workspace: { members: ['packages/*'] } };
  assert.deepEqual(schemas.UvConfigSchema.parse(uv), uv);
  const invalid = schemas.UvConfigSchema.safeParse({ sources: { local: { editable: 'yes' } } });
  assert.equal(invalid.success, false);
  assert.ok(invalid.error.issues.length > 0);
  assert.equal(schemas.PyProjectTomlSchema.safeParse({ project: { dependencies: [123] } }).success, false);
});

for (const [name, parent] of [['CLI', cli], ['Node builder', consumer('@vercel/node')]]) {
  test(`${name} transport retains fetch, multipart, redirects, abort and custom agents`, async () => {
    const { fetch, request, FormData, Agent, Response } = parent('undici');
    const server = createServer(async (req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/final' });
        res.end();
        return;
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ url: req.url, auth: req.headers.authorization, body }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const agent = new Agent({ allowH2: false });
    try {
      const manual = await fetch(`${base}/redirect`, { redirect: 'manual', dispatcher: agent });
      assert.equal(manual.status, 302);
      await manual.text();
      const followed = await fetch(`${base}/redirect`, { dispatcher: agent });
      assert.equal((await followed.json()).url, '/final');
      const form = new FormData();
      form.set('message', 'local multipart fixture');
      const posted = await fetch(base, { method: 'POST', body: form, headers: { authorization: 'Bearer fixture' }, dispatcher: agent });
      const echoed = await posted.json();
      assert.equal(echoed.auth, 'Bearer fixture');
      assert.match(echoed.body, /name="message"/);
      assert.match(echoed.body, /local multipart fixture/);
      const multipart = new Response('--fixture\r\nContent-Disposition: form-data; name="value"\r\n\r\nparsed\r\n--fixture--\r\n', {
        headers: { 'content-type': 'multipart/form-data; boundary=fixture' },
      });
      assert.equal((await multipart.formData()).get('value'), 'parsed');
      const bytes = await request(base, { dispatcher: agent });
      assert.ok((await bytes.body.arrayBuffer()).byteLength > 0);
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(fetch(base, { signal: controller.signal, dispatcher: agent }), { name: 'AbortError' });
    } finally {
      await agent.close();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}

test('transport retains authenticated CONNECT proxying over a local tunnel', { timeout: 10000 }, async () => {
  const { ProxyAgent, request } = consumer('@vercel/node')('undici');
  const target = createServer((_req, res) => res.end('proxied fixture'));
  const proxy = createServer();
  const sockets = new Set();
  let proxyAuthorization;
  target.listen(0, '127.0.0.1');
  await once(target, 'listening');
  proxy.on('connect', (req, socket, head) => {
    proxyAuthorization = req.headers['proxy-authorization'];
    sockets.add(socket);
    const upstream = connect(target.address().port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    sockets.add(upstream);
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  const dispatcher = new ProxyAgent({ uri: `http://127.0.0.1:${proxy.address().port}`, token: 'Basic Zml4dHVyZQ==', proxyTunnel: true });
  try {
    const response = await request(`http://127.0.0.1:${target.address().port}`, { dispatcher });
    assert.equal(await response.body.text(), 'proxied fixture');
    assert.equal(proxyAuthorization, 'Basic Zml4dHVyZQ==');
  } finally {
    for (const socket of sockets) socket.destroy();
    await dispatcher.destroy();
    target.closeAllConnections();
    await Promise.all([new Promise(resolve => target.close(resolve)), new Promise(resolve => proxy.close(resolve))]);
  }
});

test('transport rejects untrusted TLS and accepts only an explicitly trusted local certificate', async () => {
  const { Agent, request } = consumer('@vercel/node')('undici');
  const root = await mkdtemp(join(tmpdir(), 'capsule-tls-'));
  let server;
  let trusted;
  let untrusted;
  try {
    const key = join(root, 'fixture.key');
    const cert = join(root, 'fixture.crt');
    const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(generated.status, 0, generated.stderr);
    const ca = await readFile(cert);
    server = createSecureServer({ key: await readFile(key), cert: ca }, (_req, res) => res.end('trusted fixture'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `https://localhost:${server.address().port}`;
    untrusted = new Agent({ connect: { family: 4 } });
    await assert.rejects(request(url, { dispatcher: untrusted }), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
    trusted = new Agent({ connect: { family: 4, ca } });
    const response = await request(url, { dispatcher: trusted });
    assert.equal(await response.body.text(), 'trusted fixture');
  } finally {
    await Promise.all([trusted?.close(), untrusted?.close()]);
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await rm(root, { recursive: true, force: true });
  }
});
