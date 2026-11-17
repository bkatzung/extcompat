/**
 * @fileoverview Extends `@tundralibs/compat/file` Cross-Runtime File System Module For Bun/Deno/Node And Derivatives
 * - symlink, symlinkSync
 * - readlink, readlinkSync
 * - lstat, lstatSync
 * - chmod, chmodSync
 *
 * @module @extcompat/file
 */

import { isDeno } from '@compat/runtime';
import { fromFileUrl } from '@tundralibs/compat/file';

export * from '@tundralibs/compat/file';

/**
 * Normalized file status object providing consistent cross-runtime metadata
 * and inspector methods for lstat operations across Deno FileInfo and Node fs.Stats.
 */
export class StatsResult {
	#isFile;
	#isDirectory;
	#isSymlink;
	#isBlockDevice;
	#isCharacterDevice;
	#isFIFO;
	#isSocket;

	/**
	 * Creates a normalized StatsResult instance from a runtime-native stat object.
	 * @param {object} raw - Native Deno.FileInfo or Node.js fs.Stats object.
	 */
	constructor (raw) {
		const isFn = (fn) => typeof fn === 'function';

		this.#isFile = isFn(raw.isFile) ? raw.isFile() : Boolean(raw.isFile);
		this.#isDirectory = isFn(raw.isDirectory) ? raw.isDirectory() : Boolean(raw.isDirectory);
		this.#isSymlink = isFn(raw.isSymbolicLink) ? raw.isSymbolicLink() : Boolean(raw.isSymlink);
		this.#isBlockDevice = isFn(raw.isBlockDevice) ? raw.isBlockDevice() : Boolean(raw.isBlockDevice);
		this.#isCharacterDevice = isFn(raw.isCharacterDevice) ? raw.isCharacterDevice() : Boolean(raw.isCharDevice);
		this.#isFIFO = isFn(raw.isFIFO) ? raw.isFIFO() : Boolean(raw.isFifo);
		this.#isSocket = isFn(raw.isSocket) ? raw.isSocket() : Boolean(raw.isSocket);

		this.size = raw.size ?? 0;
		this.mtime = raw.mtime ? new Date(raw.mtime) : null;
		this.atime = raw.atime ? new Date(raw.atime) : null;
		this.birthtime = raw.birthtime ? new Date(raw.birthtime) : null;
		this.ctime = raw.ctime ? new Date(raw.ctime) : null;
		this.mode = raw.mode ?? null;
		this.uid = raw.uid ?? null;
		this.gid = raw.gid ?? null;
		this.dev = raw.dev ?? null;
		this.ino = raw.ino ?? null;
		this.nlink = raw.nlink ?? null;
		this.rdev = raw.rdev ?? null;
		this.blksize = raw.blksize ?? null;
		this.blocks = raw.blocks ?? null;
	}

	/**
	 * Returns whether the target is a standard file.
	 * @returns {boolean} True if the target is a regular file.
	 */
	isFile() {
		return this.#isFile;
	}

	/**
	 * Returns whether the target is a directory.
	 * @returns {boolean} True if the target is a directory.
	 */
	isDirectory() {
		return this.#isDirectory;
	}

	/**
	 * Returns whether the target is a symbolic link.
	 * @returns {boolean} True if the target is a symbolic link.
	 */
	isSymbolicLink() {
		return this.#isSymlink;
	}

	/**
	 * Alias for isSymbolicLink().
	 * @returns {boolean} True if the target is a symbolic link.
	 */
	isSymlink() {
		return this.#isSymlink;
	}

	/**
	 * Returns whether the target is a block device.
	 * @returns {boolean} True if the target is a block device.
	 */
	isBlockDevice() {
		return this.#isBlockDevice;
	}

	/**
	 * Returns whether the target is a character device.
	 * @returns {boolean} True if the target is a character device.
	 */
	isCharacterDevice() {
		return this.#isCharacterDevice;
	}

	/**
	 * Returns whether the target is a FIFO (named pipe).
	 * @returns {boolean} True if the target is a FIFO pipe.
	 */
	isFIFO() {
		return this.#isFIFO;
	}

	/**
	 * Returns whether the target is a socket.
	 * @returns {boolean} True if the target is a socket.
	 */
	isSocket() {
		return this.#isSocket;
	}
}

let nodeFs;
let nodeFsPromises;

if (!isDeno) {
	nodeFs = await import('node:fs');
	nodeFsPromises = nodeFs.promises ?? (await import('node:fs/promises'));
}

async function getFsPromises () {
	if (!nodeFsPromises) {
		const mod = await import('node:fs/promises');
		nodeFsPromises = mod.default ?? mod;
	}
	return nodeFsPromises;
}

function getFsSync () {
	if (!nodeFs) {
		throw new Error('Synchronous Node fs operations require node:fs module');
	}
	return nodeFs;
}

function normalizePath (p) {
	if (p instanceof URL || (typeof p === 'object' && p !== null && p.protocol === 'file:')) {
		return fromFileUrl(p);
	}
	return p;
}

function normalizeMode (mode) {
	if (typeof mode === 'number') {
		return mode;
	}
	if (typeof mode === 'string') {
		if (mode.startsWith('0o') || mode.startsWith('0O')) {
			return parseInt(mode.slice(2), 8);
		}
		return parseInt(mode, 8);
	}
	throw new TypeError(`Expected mode to be a number or string, got ${typeof mode}`);
}

function normalizeType (typeOrOptions) {
	if (typeOrOptions == null) {
		return undefined;
	}
	let type;
	if (typeof typeOrOptions === 'string') {
		type = typeOrOptions;
	} else if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
		type = typeOrOptions.type;
	}
	if (type !== undefined) {
		throw new Error(`Windows symlink type option '${type}' is currently unimplemented`);
	}
	return undefined;
}

/**
 * Creates a symbolic link pointing to target at destination path asynchronously.
 *
 * @param {string | URL} target - Target path that the symlink points to.
 * @param {string | URL} path - The path where the symlink will be created.
 * @param {string | { type?: 'file' | 'dir' | 'junction' }} [typeOrOptions] - Optional type hint.
 * @returns {Promise<void>} Resolves when the symlink is created.
 */
export async function symlink (target, path, typeOrOptions) {
	normalizeType(typeOrOptions);
	const normalizedTarget = normalizePath(target);
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		return await Deno.symlink(normalizedTarget, normalizedPath);
	}
	const fs = await getFsPromises();
	return await fs.symlink(normalizedTarget, normalizedPath);
}

/**
 * Creates a symbolic link pointing to target at destination path synchronously.
 *
 * @param {string | URL} target - Target path that the symlink points to.
 * @param {string | URL} path - The path where the symlink will be created.
 * @param {string | { type?: 'file' | 'dir' | 'junction' }} [typeOrOptions] - Optional type hint.
 * @returns {void}
 */
export function symlinkSync (target, path, typeOrOptions) {
	normalizeType(typeOrOptions);
	const normalizedTarget = normalizePath(target);
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		return Deno.symlinkSync(normalizedTarget, normalizedPath);
	}
	const fs = getFsSync();
	return fs.symlinkSync(normalizedTarget, normalizedPath);
}

/**
 * Reads the destination target of a symbolic link asynchronously.
 *
 * @param {string | URL} path - Path to the symbolic link.
 * @returns {Promise<string>} Target path pointed to by the symlink.
 */
export async function readlink (path) {
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		return await Deno.readLink(normalizedPath);
	}
	const fs = await getFsPromises();
	return await fs.readlink(normalizedPath);
}

/**
 * Reads the destination target of a symbolic link synchronously.
 *
 * @param {string | URL} path - Path to the symbolic link.
 * @returns {string} Target path pointed to by the symlink.
 */
export function readlinkSync (path) {
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		return Deno.readLinkSync(normalizedPath);
	}
	const fs = getFsSync();
	return fs.readlinkSync(normalizedPath);
}

/**
 * Retrieves FileInfo/Stats for path without dereferencing symbolic links asynchronously.
 *
 * @param {string | URL} path - Path to inspect.
 * @returns {Promise<StatsResult>} Normalized file status object.
 */
export async function lstat (path) {
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		const raw = await Deno.lstat(normalizedPath);
		return new StatsResult(raw);
	}
	const fs = await getFsPromises();
	const raw = await fs.lstat(normalizedPath);
	return new StatsResult(raw);
}

/**
 * Retrieves FileInfo/Stats for path without dereferencing symbolic links synchronously.
 *
 * @param {string | URL} path - Path to inspect.
 * @returns {StatsResult} Normalized file status object.
 */
export function lstatSync (path) {
	const normalizedPath = normalizePath(path);
	if (isDeno) {
		const raw = Deno.lstatSync(normalizedPath);
		return new StatsResult(raw);
	}
	const fs = getFsSync();
	const raw = fs.lstatSync(normalizedPath);
	return new StatsResult(raw);
}

/**
 * Changes the permissions of a file or directory asynchronously.
 *
 * @param {string | URL} path - Path or file URL to the target file or directory.
 * @param {number | string} mode - Permissions to set, as numeric bitmask (e.g. 0o755) or octal string (e.g. '755', '0755', '0o755').
 * @returns {Promise<void>} Resolves when permission change is complete.
 */
export async function chmod (path, mode) {
	const normalizedPath = normalizePath(path);
	const normalizedMode = normalizeMode(mode);
	if (isDeno) {
		return await Deno.chmod(normalizedPath, normalizedMode);
	}
	const fs = await getFsPromises();
	return await fs.chmod(normalizedPath, normalizedMode);
}

/**
 * Changes the permissions of a file or directory synchronously.
 *
 * @param {string | URL} path - Path or file URL to the target file or directory.
 * @param {number | string} mode - Permissions to set, as numeric bitmask (e.g. 0o755) or octal string (e.g. '755', '0755', '0o755').
 * @returns {void}
 */
export function chmodSync (path, mode) {
	const normalizedPath = normalizePath(path);
	const normalizedMode = normalizeMode(mode);
	if (isDeno) {
		return Deno.chmodSync(normalizedPath, normalizedMode);
	}
	const fs = getFsSync();
	return fs.chmodSync(normalizedPath, normalizedMode);
}
