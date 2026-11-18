/**
 * @fileoverview Cross-Runtime Subprocess Execution Module For Bun/Deno/Node And Derivatives
 * - spawn
 * - Subprocess
 *
 * @module @extcompat/subprocess
 */

import { isDeno } from '@compat/runtime';
import { fromFileUrl } from '@tundralibs/compat/file';

let nodeChildProcess;
let nodeStream;

if (!isDeno) {
	nodeChildProcess = await import('node:child_process');
	nodeStream = await import('node:stream');
}

/**
 * Normalizes a path or URL to a string path.
 *
 * @param {string | URL} p - Path or URL to normalize.
 * @returns {string | undefined}
 */
function normalizePath (p) {
	if (p == null) {
		return undefined;
	}
	if (p instanceof URL || (typeof p === 'object' && p !== null && p.protocol === 'file:')) {
		return fromFileUrl(p);
	}
	return String(p);
}

/**
 * Reads all chunks from a ReadableStream and concatenates them into a single Uint8Array.
 *
 * @param {ReadableStream<Uint8Array> | null} stream - Readable stream to collect.
 * @returns {Promise<Uint8Array>}
 */
async function collectStream (stream) {
	if (!stream) {
		return new Uint8Array(0);
	}
	const reader = stream.getReader();
	const chunks = [];
	let totalLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value) {
				chunks.push(value);
				totalLength += value.byteLength;
			}
		}
	} finally {
		reader.releaseLock();
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

/**
 * Converts a Node.js Readable stream to a standard Web ReadableStream.
 *
 * @param {import('node:stream').Readable | null} nodeReadable
 * @returns {ReadableStream<Uint8Array> | null}
 */
function nodeReadableToWeb (nodeReadable) {
	if (!nodeReadable) {
		return null;
	}
	if (typeof nodeStream?.Readable?.toWeb === 'function') {
		return nodeStream.Readable.toWeb(nodeReadable);
	}
	return new ReadableStream({
		start(controller) {
			nodeReadable.on('data', (chunk) => {
				const uint8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
				controller.enqueue(uint8);
			});
			nodeReadable.on('end', () => {
				try {
					controller.close();
				} catch (_) {
					// Ignore if already closed
				}
			});
			nodeReadable.on('error', (err) => {
				controller.error(err);
			});
		},
		cancel() {
			nodeReadable.destroy();
		},
	});
}

/**
 * Converts a Node.js Writable stream to a standard Web WritableStream.
 *
 * @param {import('node:stream').Writable | null} nodeWritable
 * @returns {WritableStream<Uint8Array> | null}
 */
function nodeWritableToWeb (nodeWritable) {
	if (!nodeWritable) {
		return null;
	}
	if (typeof nodeStream?.Writable?.toWeb === 'function') {
		return nodeStream.Writable.toWeb(nodeWritable);
	}
	return new WritableStream({
		write(chunk) {
			return new Promise((resolve, reject) => {
				const canWrite = nodeWritable.write(chunk, (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
				if (!canWrite) {
					nodeWritable.once('drain', resolve);
				}
			});
		},
		close() {
			return new Promise((resolve) => {
				nodeWritable.end(resolve);
			});
		},
		abort(reason) {
			nodeWritable.destroy(reason instanceof Error ? reason : new Error(String(reason)));
		},
	});
}

/**
 * Unified subprocess instance representing an active child process across runtimes.
 */
export class Subprocess {
	#raw;
	#statusPromise;
	#stdoutCollected = null;
	#stderrCollected = null;

	/**
	 * @param {object} params
	 * @param {number} params.pid
	 * @param {WritableStream<Uint8Array> | null} params.stdin
	 * @param {ReadableStream<Uint8Array> | null} params.stdout
	 * @param {ReadableStream<Uint8Array> | null} params.stderr
	 * @param {Promise<{ success: boolean, code: number, signal: string | number | null }>} params.status
	 * @param {object} params.raw - The underlying runtime child process.
	 */
	constructor ({ pid, stdin, stdout, stderr, status, raw }) {
		this.pid = pid;
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.status = status;
		this.#raw = raw;
		this.#statusPromise = status;
	}

	/**
	 * Waits for the process to exit and collects all stdout and stderr into Uint8Array buffers.
	 *
	 * @returns {Promise<{ success: boolean, code: number, signal: string | number | null, stdout: Uint8Array, stderr: Uint8Array }>}
	 */
	async output () {
		if (!this.#stdoutCollected && this.stdout) {
			this.#stdoutCollected = collectStream(this.stdout);
		}
		if (!this.#stderrCollected && this.stderr) {
			this.#stderrCollected = collectStream(this.stderr);
		}

		const [status, stdout, stderr] = await Promise.all([
			this.#statusPromise,
			this.#stdoutCollected ?? Promise.resolve(new Uint8Array(0)),
			this.#stderrCollected ?? Promise.resolve(new Uint8Array(0)),
		]);

		return {
			success: status.success,
			code: status.code,
			signal: status.signal,
			stdout,
			stderr,
		};
	}

	/**
	 * Waits for the process to exit and decodes stdout and stderr as UTF-8 strings.
	 *
	 * @returns {Promise<{ success: boolean, code: number, signal: string | number | null, stdout: string, stderr: string }>}
	 */
	async text () {
		const out = await this.output();
		const decoder = new TextDecoder('utf-8');
		return {
			success: out.success,
			code: out.code,
			signal: out.signal,
			stdout: decoder.decode(out.stdout),
			stderr: decoder.decode(out.stderr),
		};
	}

	/**
	 * Waits for the process to exit and parses stdout as JSON.
	 *
	 * @returns {Promise<{ success: boolean, code: number, signal: string | number | null, stdout: any, stderr: string }>}
	 */
	async json () {
		const txt = await this.text();
		return {
			success: txt.success,
			code: txt.code,
			signal: txt.signal,
			stdout: txt.stdout ? JSON.parse(txt.stdout) : null,
			stderr: txt.stderr,
		};
	}

	/**
	 * Sends a signal to terminate or interrupt the process.
	 *
	 * @param {number | string} [signo='SIGTERM'] - Signal name or number.
	 * @returns {boolean} True if the signal was sent.
	 */
	kill (signo = 'SIGTERM') {
		if (this.#raw && typeof this.#raw.kill === 'function') {
			try {
				const res = this.#raw.kill(signo);
				return res !== false;
			} catch (_) {
				return false;
			}
		}
		return false;
	}

	/**
	 * Restores the subprocess to keep the event loop alive.
	 */
	ref () {
		if (this.#raw && typeof this.#raw.ref === 'function') {
			this.#raw.ref();
		}
	}

	/**
	 * Prevents the subprocess from keeping the event loop alive.
	 */
	unref () {
		if (this.#raw && typeof this.#raw.unref === 'function') {
			this.#raw.unref();
		}
	}

	/**
	 * Asynchronous resource disposal.
	 *
	 * @returns {Promise<void>}
	 */
	async [Symbol.asyncDispose] () {
		try {
			this.kill('SIGTERM');
		} catch (_) {
			// Ignore errors on disposal
		}
	}
}

/**
 * Maps stdio config string to Node.js stdio option.
 *
 * @param {string} opt
 * @param {string} [name='stream']
 * @returns {string}
 */
function mapNodeStdio (opt, name = 'stream') {
	if (opt === 'piped' || opt === 'pipe') {
		return 'pipe';
	}
	if (opt === 'inherit') {
		return 'inherit';
	}
	if (opt === 'null' || opt === 'ignore') {
		return 'ignore';
	}
	throw new TypeError(`Invalid stdio option for ${name}: '${opt}'. Expected 'piped', 'inherit', or 'null'`);
}

/**
 * Maps stdio config string to Deno stdio option.
 *
 * @param {string} opt
 * @param {string} [name='stream']
 * @returns {'piped' | 'inherit' | 'null'}
 */
function mapDenoStdio (opt, name = 'stream') {
	if (opt === 'piped' || opt === 'pipe') {
		return 'piped';
	}
	if (opt === 'inherit') {
		return 'inherit';
	}
	if (opt === 'null' || opt === 'ignore') {
		return 'null';
	}
	throw new TypeError(`Invalid stdio option for ${name}: '${opt}'. Expected 'piped', 'inherit', or 'null'`);
}

/**
 * Normalizes command, arguments, and options.
 *
 * @param {string | URL | string[]} command
 * @param {string[] | object} [argsOrOptions]
 * @param {object} [options]
 * @returns {{ cmd: string, args: string[], opts: object, rawStdinInput: any }}
 */
function normalizeSpawnArgs (command, argsOrOptions, options) {
	let cmd;
	let args = [];
	let opts = {};

	if (Array.isArray(command)) {
		if (command.length === 0) {
			throw new TypeError('Command array cannot be empty');
		}
		cmd = normalizePath(command[0]);
		args = command.slice(1).map(String);
	} else {
		cmd = normalizePath(command);
	}

	if (typeof cmd !== 'string' || cmd.trim() === '') {
		throw new TypeError(`Expected command to be a non-empty string or URL, got ${typeof cmd}`);
	}

	if (Array.isArray(argsOrOptions)) {
		args = args.concat(argsOrOptions.map(String));
		if (options && typeof options === 'object') {
			opts = { ...options };
		}
	} else if (argsOrOptions && typeof argsOrOptions === 'object') {
		opts = { ...argsOrOptions };
		if (Array.isArray(opts.args)) {
			args = args.concat(opts.args.map(String));
		}
	} else if (options && typeof options === 'object') {
		opts = { ...options };
		if (Array.isArray(opts.args)) {
			args = args.concat(opts.args.map(String));
		}
	}

	let rawStdinInput = null;
	let stdinOpt = opts.stdin;

	if (stdinOpt != null && (typeof stdinOpt === 'string' && stdinOpt !== 'piped' && stdinOpt !== 'inherit' && stdinOpt !== 'null')) {
		rawStdinInput = stdinOpt;
		stdinOpt = 'piped';
	} else if (stdinOpt instanceof Uint8Array || stdinOpt instanceof ArrayBuffer || (typeof ReadableStream !== 'undefined' && stdinOpt instanceof ReadableStream)) {
		rawStdinInput = stdinOpt;
		stdinOpt = 'piped';
	}

	opts.stdin = stdinOpt ?? 'inherit';
	opts.stdout = opts.stdout ?? 'piped';
	opts.stderr = opts.stderr ?? 'piped';

	return { cmd, args, opts, rawStdinInput };
}

/**
 * Pumps input data to child stdin WritableStream.
 *
 * @param {WritableStream<Uint8Array>} stdin
 * @param {string | Uint8Array | ArrayBuffer | ReadableStream} input
 */
function pipeInputToStdin (stdin, input) {
	if (!stdin || input == null) {
		return;
	}
	(async () => {
		try {
			if (typeof input === 'string') {
				const writer = stdin.getWriter();
				await writer.write(new TextEncoder().encode(input));
				await writer.close();
			} else if (input instanceof Uint8Array) {
				const writer = stdin.getWriter();
				await writer.write(input);
				await writer.close();
			} else if (input instanceof ArrayBuffer) {
				const writer = stdin.getWriter();
				await writer.write(new Uint8Array(input));
				await writer.close();
			} else if (typeof ReadableStream !== 'undefined' && input instanceof ReadableStream) {
				await input.pipeTo(stdin);
			}
		} catch (_) {
			// Subprocess might have closed stdin early
		}
	})();
}

/**
 * Spawns a child process across Bun, Deno, and Node.js with unified Web Streams.
 *
 * @param {string | URL | string[]} command - The command or executable path, file URL, or command array.
 * @param {string[] | object} [argsOrOptions] - Arguments array or configuration options.
 * @param {object} [options] - Configuration options.
 * @returns {Subprocess} Unified Subprocess instance.
 */
export function spawn (command, argsOrOptions, options) {
	const { cmd, args, opts, rawStdinInput } = normalizeSpawnArgs(command, argsOrOptions, options);
	const cwd = normalizePath(opts.cwd);

	if (isDeno) {
		const denoStdin = mapDenoStdio(opts.stdin, 'stdin');
		const denoStdout = mapDenoStdio(opts.stdout, 'stdout');
		const denoStderr = mapDenoStdio(opts.stderr, 'stderr');

		const denoCmd = new Deno.Command(cmd, {
			args,
			cwd,
			env: opts.env,
			clearEnv: opts.clearEnv ?? false,
			stdin: denoStdin,
			stdout: denoStdout,
			stderr: denoStderr,
			signal: opts.signal,
			uid: opts.uid,
			gid: opts.gid,
			windowsRawArguments: opts.windowsRawArguments,
		});

		const rawChild = denoCmd.spawn();

		const statusPromise = rawChild.status.then((st) => ({
			success: st.success,
			code: st.code,
			signal: st.signal,
		}));

		const stdin = denoStdin === 'piped' ? rawChild.stdin : null;
		const stdout = denoStdout === 'piped' ? rawChild.stdout : null;
		const stderr = denoStderr === 'piped' ? rawChild.stderr : null;

		const subprocess = new Subprocess({
			pid: rawChild.pid,
			stdin,
			stdout,
			stderr,
			status: statusPromise,
			raw: rawChild,
		});

		if (rawStdinInput != null && subprocess.stdin) {
			pipeInputToStdin(subprocess.stdin, rawStdinInput);
		}

		return subprocess;
	}

	// Node.js & Bun environment
	if (!nodeChildProcess) {
		throw new Error('Node child_process module is not available');
	}

	const nodeStdin = mapNodeStdio(opts.stdin, 'stdin');
	const nodeStdout = mapNodeStdio(opts.stdout, 'stdout');
	const nodeStderr = mapNodeStdio(opts.stderr, 'stderr');

	let env;
	if (opts.clearEnv) {
		env = opts.env ?? {};
	} else if (opts.env) {
		const parentEnv = typeof process !== 'undefined' ? process.env : {};
		env = { ...parentEnv, ...opts.env };
	} else {
		env = undefined;
	}

	const rawChild = nodeChildProcess.spawn(cmd, args, {
		cwd,
		env,
		stdio: [nodeStdin, nodeStdout, nodeStderr],
		signal: opts.signal,
		uid: opts.uid,
		gid: opts.gid,
		windowsHide: opts.windowsHide ?? true,
		detached: opts.detached ?? false,
	});

	const statusPromise = new Promise((resolve, reject) => {
		let completed = false;
		rawChild.on('error', (err) => {
			if (!completed) {
				completed = true;
				reject(err);
			}
		});
		rawChild.on('close', (code, signal) => {
			if (!completed) {
				completed = true;
				resolve({
					success: code === 0,
					code: code ?? (signal ? 1 : 0),
					signal: signal ?? null,
				});
			}
		});
	});

	const stdinWeb = rawChild.stdin ? nodeWritableToWeb(rawChild.stdin) : null;
	const stdoutWeb = rawChild.stdout ? nodeReadableToWeb(rawChild.stdout) : null;
	const stderrWeb = rawChild.stderr ? nodeReadableToWeb(rawChild.stderr) : null;

	const subprocess = new Subprocess({
		pid: rawChild.pid,
		stdin: stdinWeb,
		stdout: stdoutWeb,
		stderr: stderrWeb,
		status: statusPromise,
		raw: rawChild,
	});

	if (rawStdinInput != null && subprocess.stdin) {
		pipeInputToStdin(subprocess.stdin, rawStdinInput);
	}

	return subprocess;
}
