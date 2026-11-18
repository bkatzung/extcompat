/**
 * @fileoverview Cross-Runtime SQLite Database Module for Bun, Deno, Node.js, and Derivatives
 *
 * @module @extcompat/sqlite
 */

import { isBun, isDeno, isNode } from '@compat/runtime';
import { fromFileUrl } from '@tundralibs/compat/file';

/**
 * Normalizes database path or URL to a string.
 *
 * @param {string | URL} p - Database path or file URL.
 * @returns {string} Normalized database path string.
 */
function normalizePath (p) {
	if (p === undefined || p === null) {
		return ':memory:';
	}
	if (p instanceof URL || (typeof p === 'object' && p !== null && p.protocol === 'file:')) {
		return fromFileUrl(p);
	}
	if (typeof p !== 'string') {
		throw new TypeError(`Expected database path to be a string or file URL, got ${typeof p}`);
	}
	return p;
}

/**
 * Normalizes query parameters into array or object suitable for bindings.
 *
 * @param {any} params - Parameters passed to query/run.
 * @returns {Array<any> | Record<string, any>} Normalized parameters.
 */
function normalizeParams (params) {
	if (params === undefined || params === null) {
		return [];
	}
	if (Array.isArray(params)) {
		return params;
	}
	if (typeof params === 'object' && !(params instanceof Uint8Array || params instanceof ArrayBuffer)) {
		return params;
	}
	return [params];
}

/**
 * Flattens variadic statement arguments into array or object.
 *
 * @param {any[]} args - Raw arguments from statement call.
 * @returns {Array<any> | Record<string, any>} Flattened parameter list.
 */
function flattenParams (args) {
	if (args.length === 0) {
		return [];
	}
	if (args.length === 1) {
		return normalizeParams(args[0]);
	}
	return args;
}

/**
 * Statement class providing unified prepared statement operations.
 */
export class Statement {
	#adapter;

	/**
	 * Creates a new Statement instance.
	 *
	 * @param {object} adapter - Driver-specific statement adapter.
	 */
	constructor (adapter) {
		this.#adapter = adapter;
	}

	/**
	 * Executes statement and returns all matching rows as objects.
	 *
	 * @param {...any} params - Binding parameters.
	 * @returns {Array<Record<string, any>>} Array of row objects.
	 */
	all (...params) {
		return this.#adapter.all(flattenParams(params));
	}

	/**
	 * Executes statement and returns the first matching row as an object, or null.
	 *
	 * @param {...any} params - Binding parameters.
	 * @returns {Record<string, any> | null} First row object or null.
	 */
	get (...params) {
		return this.#adapter.get(flattenParams(params));
	}

	/**
	 * Executes statement and returns all matching rows as value arrays.
	 *
	 * @param {...any} params - Binding parameters.
	 * @returns {Array<Array<any>>} Array of row value tuples.
	 */
	values (...params) {
		return this.#adapter.values(flattenParams(params));
	}

	/**
	 * Executes statement and returns execution result metadata.
	 *
	 * @param {...any} params - Binding parameters.
	 * @returns {{ changes: number, lastInsertRowid: number | bigint }} Result metadata.
	 */
	run (...params) {
		return this.#adapter.run(flattenParams(params));
	}

	/**
	 * Finalizes and frees prepared statement resources.
	 *
	 * @returns {void}
	 */
	finalize () {
		this.#adapter.finalize();
	}
}

/**
 * Database class providing cross-runtime SQLite operations.
 */
export class Database {
	#adapter;
	#path;

	/**
	 * Creates a unified Database instance.
	 *
	 * @param {object} adapter - Driver-specific database adapter.
	 * @param {string} path - Database path.
	 */
	constructor (adapter, path) {
		this.#adapter = adapter;
		this.#path = path;
	}

	/**
	 * Path or identifier of the opened database.
	 *
	 * @returns {string} Database path.
	 */
	get path () {
		return this.#path;
	}

	/**
	 * Executes a SQL query and returns rows as arrays of values (tuples).
	 *
	 * @param {string} sql - SQL query text.
	 * @param {Array<any> | Record<string, any>} [params] - Query binding parameters.
	 * @returns {Array<Array<any>>} Array of row value tuples.
	 */
	query (sql, params) {
		return this.#adapter.query(sql, normalizeParams(params));
	}

	/**
	 * Executes a SQL query and returns rows as objects keyed by column names.
	 *
	 * @param {string} sql - SQL query text.
	 * @param {Array<any> | Record<string, any>} [params] - Query binding parameters.
	 * @returns {Array<Record<string, any>>} Array of row objects.
	 */
	queryObjects (sql, params) {
		return this.#adapter.queryObjects(sql, normalizeParams(params));
	}

	/**
	 * Executes a SQL query and returns the first matching row as an object, or null if empty.
	 *
	 * @param {string} sql - SQL query text.
	 * @param {Array<any> | Record<string, any>} [params] - Query binding parameters.
	 * @returns {Record<string, any> | null} First row object or null.
	 */
	queryOne (sql, params) {
		return this.#adapter.queryOne(sql, normalizeParams(params));
	}

	/**
	 * Executes a single SQL statement (INSERT, UPDATE, DELETE) with bindings.
	 *
	 * @param {string} sql - SQL statement text.
	 * @param {Array<any> | Record<string, any>} [params] - Statement binding parameters.
	 * @returns {{ changes: number, lastInsertRowid: number | bigint }} Execution result metadata.
	 */
	run (sql, params) {
		return this.#adapter.run(sql, normalizeParams(params));
	}

	/**
	 * Executes one or more raw SQL statements without parameter binding (DDL / batch scripts).
	 *
	 * @param {string} sql - Multi-statement SQL script.
	 * @returns {void}
	 */
	exec (sql) {
		this.#adapter.exec(sql);
	}

	/**
	 * Alias for exec(sql) to maintain compatibility with ad hoc wrappers.
	 *
	 * @param {string} sql - Multi-statement SQL script.
	 * @returns {void}
	 */
	execute (sql) {
		this.exec(sql);
	}

	/**
	 * Prepares a SQL statement for repeated execution.
	 *
	 * @param {string} sql - SQL statement text.
	 * @returns {Statement} Unified prepared statement instance.
	 */
	prepare (sql) {
		return this.#adapter.prepare(sql);
	}

	/**
	 * Executes a callback function inside an atomic SQL transaction.
	 * Automatically issues BEGIN, COMMIT on success, and ROLLBACK on error.
	 *
	 * @template T
	 * @param {() => T} fn - Function to execute inside the transaction.
	 * @returns {T} Return value of the callback function.
	 */
	transaction (fn) {
		this.exec('BEGIN');
		try {
			const result = fn();
			this.exec('COMMIT');
			return result;
		} catch (err) {
			try {
				this.exec('ROLLBACK');
			} catch (_) {
				// Ignore secondary rollback error
			}
			throw err;
		}
	}

	/**
	 * Closes the database connection.
	 *
	 * @returns {void}
	 */
	close () {
		this.#adapter.close();
	}

	/**
	 * Automatic resource disposal.
	 *
	 * @returns {void}
	 */
	[Symbol.dispose] () {
		this.close();
	}
}

/**
 * Creates Bun driver adapter.
 *
 * @param {string} dbPath - Database path.
 * @param {object} options - Database options.
 * @returns {Promise<Database>} Unified Database instance.
 */
async function createBunAdapter (dbPath, options) {
	const { Database: BunDatabase } = await import('bun:sqlite');
	const readonly = options.readonly ?? options.readOnly ?? false;
	const create = options.create ?? true;

	const db = new BunDatabase(dbPath, { readonly, create });

	const adapter = {
		query (sql, params) {
			const q = db.query(sql);
			return Array.isArray(params) ? q.values(...params) : q.values(params);
		},
		queryObjects (sql, params) {
			const q = db.query(sql);
			return Array.isArray(params) ? q.all(...params) : q.all(params);
		},
		queryOne (sql, params) {
			const q = db.query(sql);
			const res = Array.isArray(params) ? q.get(...params) : q.get(params);
			return res ?? null;
		},
		run (sql, params) {
			const q = db.query(sql);
			const res = Array.isArray(params) ? q.run(...params) : q.run(params);
			return {
				changes: res.changes ?? 0,
				lastInsertRowid: res.lastInsertRowid ?? 0,
			};
		},
		exec (sql) {
			db.exec(sql);
		},
		prepare (sql) {
			const stmt = db.query(sql);
			return new Statement({
				all (p) {
					return Array.isArray(p) ? stmt.all(...p) : stmt.all(p);
				},
				get (p) {
					const res = Array.isArray(p) ? stmt.get(...p) : stmt.get(p);
					return res ?? null;
				},
				values (p) {
					return Array.isArray(p) ? stmt.values(...p) : stmt.values(p);
				},
				run (p) {
					const res = Array.isArray(p) ? stmt.run(...p) : stmt.run(p);
					return {
						changes: res.changes ?? 0,
						lastInsertRowid: res.lastInsertRowid ?? 0,
					};
				},
				finalize () {
					stmt.finalize();
				},
			});
		},
		close () {
			db.close();
		},
	};

	return new Database(adapter, dbPath);
}

/**
 * Creates Deno driver adapter (using deno.land/x/sqlite, without node: modules).
 *
 * @param {string} dbPath - Database path.
 * @param {object} options - Database options.
 * @returns {Promise<Database>} Unified Database instance.
 */
async function createDenoAdapter (dbPath, options) {
	const { DB } = await import('https://deno.land/x/sqlite/mod.ts');
	const readonly = options.readonly ?? options.readOnly ?? false;
	const create = options.create ?? true;
	const mode = readonly ? 'read' : (create ? 'create' : 'write');

	const db = new DB(dbPath, { mode });

	const adapter = {
		query (sql, params) {
			return db.query(sql, params);
		},
		queryObjects (sql, params) {
			return db.queryEntries(sql, params);
		},
		queryOne (sql, params) {
			const entries = db.queryEntries(sql, params);
			return entries.length > 0 ? entries[0] : null;
		},
		run (sql, params) {
			db.query(sql, params);
			return {
				changes: db.changes,
				lastInsertRowid: db.lastInsertRowId,
			};
		},
		exec (sql) {
			db.execute(sql);
		},
		prepare (sql) {
			const pq = db.prepareQuery(sql);
			return new Statement({
				all (p) {
					return pq.allEntries(p);
				},
				get (p) {
					const entries = pq.allEntries(p);
					return entries.length > 0 ? entries[0] : null;
				},
				values (p) {
					return pq.all(p);
				},
				run (p) {
					pq.execute(p);
					return {
						changes: db.changes,
						lastInsertRowid: db.lastInsertRowId,
					};
				},
				finalize () {
					pq.finalize();
				},
			});
		},
		close () {
			db.close();
		},
	};

	return new Database(adapter, dbPath);
}

/**
 * Creates Node.js driver adapter (using node:sqlite).
 *
 * @param {string} dbPath - Database path.
 * @param {object} options - Database options.
 * @returns {Promise<Database>} Unified Database instance.
 */
async function createNodeAdapter (dbPath, options) {
	let sqliteMod;
	try {
		sqliteMod = await import('node:sqlite');
	} catch (err) {
		throw new Error(`node:sqlite driver not available in this Node runtime: ${err.message}`);
	}

	const DatabaseSync = sqliteMod.DatabaseSync ?? sqliteMod.default?.DatabaseSync;
	if (!DatabaseSync) {
		throw new Error('DatabaseSync not found in node:sqlite module');
	}

	const readonly = options.readonly ?? options.readOnly ?? false;
	const create = options.create ?? true;

	const db = new DatabaseSync(dbPath, {
		readOnly: readonly,
		create: !readonly && create,
	});

	const adapter = {
		query (sql, params) {
			const stmt = db.prepare(sql);
			if (/^\s*(select|pragma)/i.test(sql)) {
				const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
				return rows.map((row) => Object.values(row));
			}
			if (Array.isArray(params)) {
				stmt.run(...params);
			} else {
				stmt.run(params);
			}
			return [];
		},
		queryObjects (sql, params) {
			const stmt = db.prepare(sql);
			return Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
		},
		queryOne (sql, params) {
			const stmt = db.prepare(sql);
			const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
			return row ?? null;
		},
		run (sql, params) {
			const stmt = db.prepare(sql);
			const res = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
			return {
				changes: Number(res.changes ?? 0),
				lastInsertRowid: res.lastInsertRowid,
			};
		},
		exec (sql) {
			db.exec(sql);
		},
		prepare (sql) {
			const stmt = db.prepare(sql);
			return new Statement({
				all (p) {
					return Array.isArray(p) ? stmt.all(...p) : stmt.all(p);
				},
				get (p) {
					const res = Array.isArray(p) ? stmt.get(...p) : stmt.get(p);
					return res ?? null;
				},
				values (p) {
					const rows = Array.isArray(p) ? stmt.all(...p) : stmt.all(p);
					return rows.map((row) => Object.values(row));
				},
				run (p) {
					const res = Array.isArray(p) ? stmt.run(...p) : stmt.run(p);
					return {
						changes: Number(res.changes ?? 0),
						lastInsertRowid: res.lastInsertRowid,
					};
				},
				finalize () {
					// node:sqlite statement is automatically garbage collected,
					// finalize hook provided for interface consistency
				},
			});
		},
		close () {
			db.close();
		},
	};

	return new Database(adapter, dbPath);
}

/**
 * Opens or creates a SQLite database connection across Bun, Deno, and Node.js.
 *
 * @param {string | URL} [path=':memory:'] - Path to database file, file URL, or ':memory:'.
 * @param {object} [options={}] - Database configuration options.
 * @param {boolean} [options.readonly=false] - Open database in read-only mode.
 * @param {boolean} [options.readOnly=false] - Alias for readonly.
 * @param {boolean} [options.create=true] - Create database if it does not exist.
 * @returns {Promise<Database>} Unified Database connection instance.
 */
export async function openDatabase (path = ':memory:', options = {}) {
	const normalizedPath = normalizePath(path);

	if (isBun) {
		return await createBunAdapter(normalizedPath, options);
	}
	if (isDeno) {
		return await createDenoAdapter(normalizedPath, options);
	}
	if (isNode) {
		return await createNodeAdapter(normalizedPath, options);
	}

	// Fallback detection
	if (globalThis.Bun) {
		return await createBunAdapter(normalizedPath, options);
	}
	if (globalThis.Deno) {
		return await createDenoAdapter(normalizedPath, options);
	}
	return await createNodeAdapter(normalizedPath, options);
}
