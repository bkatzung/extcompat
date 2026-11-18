import { describe, it, beforeEach, afterEach } from '@compat/test';
import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert';
import { spawn } from '../src/subprocess.esm.js';
import { makeTempDir, remove, writeTextFile, toFileUrl } from '../src/file.esm.js';

const currentExec = globalThis.Deno?.execPath() ?? globalThis.process?.execPath ?? 'node';

function makeScriptArgs(scriptPath, extraArgs = []) {
	if (globalThis.Deno) {
		return ['run', '-A', scriptPath, ...extraArgs];
	}
	return [scriptPath, ...extraArgs];
}

describe('Subprocess Extended Compatibility', () => {
	let tempDir;

	beforeEach(async () => {
		tempDir = await makeTempDir({ prefix: 'extcompat_subprocess_test_' });
	});

	afterEach(async () => {
		if (tempDir) {
			try {
				await remove(tempDir, { recursive: true });
			} catch (_) {
				// Ignore cleanup errors
			}
		}
	});

	describe('Basic Spawning & Signatures', () => {
		it('spawns process with command and args array', async () => {
			const scriptPath = `${tempDir}/hello.js`;
			await writeTextFile(scriptPath, 'console.log("hello from subprocess");');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const text = await proc.text();

			assertEquals(text.success, true);
			assertEquals(text.code, 0);
			assertEquals(text.stdout.trim(), 'hello from subprocess');
			assertEquals(text.stderr, '');
		});

		it('spawns process with command array [cmd, ...args]', async () => {
			const scriptPath = `${tempDir}/array_args.js`;
			await writeTextFile(scriptPath, 'console.log(process.argv.slice(2).join(" "));');

			const proc = spawn([currentExec, ...makeScriptArgs(scriptPath, ['foo', 'bar'])]);
			const text = await proc.text();

			assertEquals(text.success, true);
			assertEquals(text.code, 0);
			assertEquals(text.stdout.trim().endsWith('foo bar'), true);
		});

		it('spawns process with options object containing args', async () => {
			const scriptPath = `${tempDir}/opts_args.js`;
			await writeTextFile(scriptPath, 'console.log("opts args ok");');

			const proc = spawn(currentExec, { args: makeScriptArgs(scriptPath) });
			const text = await proc.text();

			assertEquals(text.success, true);
			assertEquals(text.code, 0);
			assertEquals(text.stdout.trim(), 'opts args ok');
		});
	});

	describe('Output and Formats', () => {
		it('captures binary output with proc.output()', async () => {
			const scriptPath = `${tempDir}/binary.js`;
			await writeTextFile(scriptPath, 'process.stdout.write(Buffer.from([65, 66, 67]));');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const out = await proc.output();

			assertEquals(out.success, true);
			assertEquals(out.code, 0);
			assertEquals(Array.from(out.stdout), [65, 66, 67]);
		});

		it('captures text output with proc.text()', async () => {
			const scriptPath = `${tempDir}/text.js`;
			await writeTextFile(scriptPath, 'console.log("line 1\\nline 2");');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const res = await proc.text();

			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'line 1\nline 2');
		});

		it('parses JSON output with proc.json()', async () => {
			const scriptPath = `${tempDir}/json.js`;
			await writeTextFile(scriptPath, 'console.log(JSON.stringify({ status: "ok", count: 42 }));');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const res = await proc.json();

			assertEquals(res.success, true);
			assertEquals(res.stdout, { status: 'ok', count: 42 });
		});

		it('captures stderr stream separately', async () => {
			const scriptPath = `${tempDir}/stderr.js`;
			await writeTextFile(scriptPath, 'console.error("error message"); console.log("normal message");');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const res = await proc.text();

			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'normal message');
			assertEquals(res.stderr.trim(), 'error message');
		});
	});

	describe('Standard Input Piping', () => {
		it('writes to stdin via WritableStream writer', async () => {
			const scriptPath = `${tempDir}/stdin_pipe.js`;
			await writeTextFile(
				scriptPath,
				`
				let data = '';
				process.stdin.setEncoding('utf8');
				process.stdin.on('data', chunk => { data += chunk; });
				process.stdin.on('end', () => { console.log('received:' + data); });
				`,
			);

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { stdin: 'piped' });
			const writer = proc.stdin.getWriter();
			await writer.write(new TextEncoder().encode('streamed input data'));
			await writer.close();

			const res = await proc.text();
			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'received:streamed input data');
		});

		it('passes stdin string directly in options', async () => {
			const scriptPath = `${tempDir}/stdin_string.js`;
			await writeTextFile(
				scriptPath,
				`
				let data = '';
				process.stdin.setEncoding('utf8');
				process.stdin.on('data', chunk => { data += chunk; });
				process.stdin.on('end', () => { console.log('stdin_str:' + data); });
				`,
			);

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { stdin: 'direct string input' });
			const res = await proc.text();

			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'stdin_str:direct string input');
		});

		it('passes stdin Uint8Array directly in options', async () => {
			const scriptPath = `${tempDir}/stdin_uint8.js`;
			await writeTextFile(
				scriptPath,
				`
				let data = '';
				process.stdin.setEncoding('utf8');
				process.stdin.on('data', chunk => { data += chunk; });
				process.stdin.on('end', () => { console.log('stdin_uint8:' + data); });
				`,
			);

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { stdin: new TextEncoder().encode('uint8 input') });
			const res = await proc.text();

			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'stdin_uint8:uint8 input');
		});
	});

	describe('Environment Variables & Working Directory', () => {
		it('passes custom environment variables', async () => {
			const scriptPath = `${tempDir}/env.js`;
			await writeTextFile(scriptPath, 'console.log(process.env.EXTCOMPAT_TEST_KEY);');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), {
				env: { EXTCOMPAT_TEST_KEY: 'test_value_123' },
			});
			const res = await proc.text();

			assertEquals(res.success, true);
			assertEquals(res.stdout.trim(), 'test_value_123');
		});

		it('sets custom working directory (cwd) with string path', async () => {
			const scriptPath = `${tempDir}/cwd_test.js`;
			await writeTextFile(scriptPath, 'console.log(process.cwd());');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { cwd: tempDir });
			const res = await proc.text();

			assertEquals(res.success, true);
			// Under macOS or symlinked /tmp, normalize both or check string ends
			assert(res.stdout.trim().endsWith(tempDir.split('/').pop()));
		});

		it('sets custom working directory (cwd) with file: URL', async () => {
			const scriptPath = `${tempDir}/cwd_url.js`;
			await writeTextFile(scriptPath, 'console.log(process.cwd());');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { cwd: toFileUrl(tempDir) });
			const res = await proc.text();

			assertEquals(res.success, true);
			assert(res.stdout.trim().endsWith(tempDir.split('/').pop()));
		});
	});

	describe('Exit Codes & Signals', () => {
		it('reports non-zero exit codes accurately', async () => {
			const scriptPath = `${tempDir}/exit_code.js`;
			await writeTextFile(scriptPath, 'process.exit(42);');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			const status = await proc.status;

			assertEquals(status.success, false);
			assertEquals(status.code, 42);
		});

		it('kills running subprocess with kill()', async () => {
			const scriptPath = `${tempDir}/sleep.js`;
			await writeTextFile(scriptPath, 'setTimeout(() => {}, 10000);');

			const proc = spawn(currentExec, makeScriptArgs(scriptPath));
			assert(proc.pid > 0);

			const killed = proc.kill('SIGTERM');
			assertEquals(killed, true);

			const status = await proc.status;
			assertEquals(status.success, false);
		});

		it('aborts process using AbortSignal', async () => {
			const scriptPath = `${tempDir}/abort.js`;
			await writeTextFile(scriptPath, 'setTimeout(() => {}, 10000);');

			const controller = new AbortController();
			const proc = spawn(currentExec, makeScriptArgs(scriptPath), { signal: controller.signal });

			setTimeout(() => {
				controller.abort();
			}, 50);

			const status = await proc.status.catch((err) => ({ aborted: true, err }));
			// Either status resolves to failure or error is caught on abort
			assert(status.success === false || status.aborted === true);
		});
	});

	describe('Error Handling', () => {
		it('throws TypeError on invalid command types', () => {
			assertThrows(() => spawn(null), TypeError);
			assertThrows(() => spawn(''), TypeError);
			assertThrows(() => spawn([]), TypeError);
		});

		it('throws TypeError on invalid stdio options', () => {
			assertThrows(() => spawn(currentExec, { stdout: 'invalid_mode' }), TypeError);
		});
	});
});
