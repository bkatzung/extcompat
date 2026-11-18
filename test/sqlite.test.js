import { describe, it, beforeEach, afterEach } from '@compat/test';
import { assert, assertEquals, assertThrows } from '@std/assert';
import { openDatabase } from '../src/sqlite.esm.js';
import { makeTempDir, remove, toFileUrl } from '../src/file.esm.js';

describe ('SQLite Extended Compatibility', () => {
	describe ('In-Memory Database Operations', () => {
		it ('opens default in-memory database and creates tables', async () => {
			const db = await openDatabase();
			db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);');

			const res = db.run('INSERT INTO users (name) VALUES (?);', ['Alice']);
			assertEquals(res.changes, 1);
			assertEquals(Number(res.lastInsertRowid), 1);

			const rows = db.query('SELECT id, name FROM users;');
			assertEquals(rows, [[1, 'Alice']]);

			db.close();
		});

		it ('executes queries returning array tuples and objects', async () => {
			const db = await openDatabase(':memory:');
			db.execute(`
				CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price REAL);
				INSERT INTO items (name, price) VALUES ('Widget', 9.99);
				INSERT INTO items (name, price) VALUES ('Gadget', 19.50);
			`);

			const arrayRows = db.query('SELECT name, price FROM items ORDER BY id;');
			assertEquals(arrayRows, [['Widget', 9.99], ['Gadget', 19.50]]);

			const objectRows = db.queryObjects('SELECT name, price FROM items ORDER BY id;');
			assertEquals(objectRows, [
				{ name: 'Widget', price: 9.99 },
				{ name: 'Gadget', price: 19.50 },
			]);

			const singleRow = db.queryOne('SELECT name, price FROM items WHERE name = ?;', ['Widget']);
			assertEquals(singleRow, { name: 'Widget', price: 9.99 });

			const nonExistent = db.queryOne('SELECT name FROM items WHERE name = ?;', ['Nonexistent']);
			assertEquals(nonExistent, null);

			db.close();
		});

		it ('supports parameter binding with arrays and single values', async () => {
			const db = await openDatabase(':memory:');
			db.exec('CREATE TABLE test (id INTEGER, val TEXT);');

			db.run('INSERT INTO test (id, val) VALUES (?, ?);', [1, 'one']);
			db.run('INSERT INTO test (id, val) VALUES (?, ?);', [2, 'two']);

			const res1 = db.queryObjects('SELECT * FROM test WHERE id = ?;', 1);
			assertEquals(res1, [{ id: 1, val: 'one' }]);

			const res2 = db.queryObjects('SELECT * FROM test WHERE id = ?;', [2]);
			assertEquals(res2, [{ id: 2, val: 'two' }]);

			db.close();
		});

		it ('updates and deletes rows reporting changes count', async () => {
			const db = await openDatabase(':memory:');
			db.exec(`
				CREATE TABLE counter (id INTEGER PRIMARY KEY, val INTEGER);
				INSERT INTO counter (val) VALUES (10), (20), (30);
			`);

			const updateRes = db.run('UPDATE counter SET val = val + 1 WHERE val >= ?;', [20]);
			assertEquals(updateRes.changes, 2);

			const deleteRes = db.run('DELETE FROM counter WHERE val = ?;', [10]);
			assertEquals(deleteRes.changes, 1);

			const remaining = db.query('SELECT val FROM counter ORDER BY val;');
			assertEquals(remaining, [[21], [31]]);

			db.close();
		});

		it ('handles BLOB data types with Uint8Array', async () => {
			const db = await openDatabase(':memory:');
			db.exec('CREATE TABLE blobs (id INTEGER PRIMARY KEY, data BLOB);');

			const binaryData = new Uint8Array([1, 2, 3, 4, 5, 255]);
			db.run('INSERT INTO blobs (data) VALUES (?);', [binaryData]);

			const rows = db.queryObjects('SELECT data FROM blobs WHERE id = 1;');
			assertEquals(rows.length, 1);
			const returnedBlob = new Uint8Array(rows[0].data);
			assertEquals(Array.from(returnedBlob), [1, 2, 3, 4, 5, 255]);

			db.close();
		});
	});

	describe ('Prepared Statements', () => {
		it ('prepares statement and executes values(), all(), get(), and run()', async () => {
			const db = await openDatabase(':memory:');
			db.exec('CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);');

			const insertStmt = db.prepare('INSERT INTO people (name, age) VALUES (?, ?);');
			const r1 = insertStmt.run('Alice', 30);
			assertEquals(r1.changes, 1);
			const r2 = insertStmt.run('Bob', 25);
			assertEquals(r2.changes, 1);
			insertStmt.finalize();

			const selectStmt = db.prepare('SELECT name, age FROM people WHERE age >= ? ORDER BY age;');
			const allRows = selectStmt.all(25);
			assertEquals(allRows, [
				{ name: 'Bob', age: 25 },
				{ name: 'Alice', age: 30 },
			]);

			const valRows = selectStmt.values(25);
			assertEquals(valRows, [
				['Bob', 25],
				['Alice', 30],
			]);

			const firstRow = selectStmt.get(30);
			assertEquals(firstRow, { name: 'Alice', age: 30 });

			selectStmt.finalize();
			db.close();
		});
	});

	describe ('Transactions', () => {
		it ('commits transaction successfully on normal execution', async () => {
			const db = await openDatabase(':memory:');
			db.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER);');
			db.run('INSERT INTO accounts (id, balance) VALUES (1, 100), (2, 200);');

			const result = db.transaction(() => {
				db.run('UPDATE accounts SET balance = balance - 50 WHERE id = 1;');
				db.run('UPDATE accounts SET balance = balance + 50 WHERE id = 2;');
				return 'trans_ok';
			});

			assertEquals(result, 'trans_ok');
			const balances = db.query('SELECT id, balance FROM accounts ORDER BY id;');
			assertEquals(balances, [[1, 50], [2, 250]]);

			db.close();
		});

		it ('rolls back transaction on error without applying changes', async () => {
			const db = await openDatabase(':memory:');
			db.exec('CREATE TABLE logs (msg TEXT);');
			db.run('INSERT INTO logs (msg) VALUES (?);', ['initial']);

			assertThrows(() => {
				db.transaction(() => {
					db.run('INSERT INTO logs (msg) VALUES (?);', ['temp_msg']);
					throw new Error('transaction aborted');
				});
			});

			const logs = db.query('SELECT msg FROM logs;');
			assertEquals(logs, [['initial']]);

			db.close();
		});
	});

	describe ('File-Backed Databases and URLs', () => {
		let tempDir;

		beforeEach (async () => {
			tempDir = await makeTempDir({ prefix: 'extcompat_sqlite_test_' });
		});

		afterEach (async () => {
			if (tempDir) {
				try {
					await remove(tempDir, { recursive: true });
				} catch (_) {
					// Ignore cleanup errors
				}
			}
		});

		it ('persists data in file-backed database and reopens it', async () => {
			const dbPath = `${tempDir}/test.db`;
			const db1 = await openDatabase(dbPath);
			db1.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, content TEXT);');
			db1.run('INSERT INTO notes (content) VALUES (?);', ['hello file']);
			db1.close();

			const db2 = await openDatabase(dbPath);
			const rows = db2.query('SELECT content FROM notes;');
			assertEquals(rows, [['hello file']]);
			db2.close();
		});

		it ('handles file: URLs as database path', async () => {
			const dbPath = `${tempDir}/url_test.db`;
			const fileUrl = toFileUrl(dbPath);

			const db = await openDatabase(fileUrl);
			db.exec('CREATE TABLE test_url (val TEXT);');
			db.run('INSERT INTO test_url (val) VALUES (?);', ['url_ok']);

			const rows = db.query('SELECT val FROM test_url;');
			assertEquals(rows, [['url_ok']]);
			db.close();
		});

		it ('supports Symbol.dispose pattern', async () => {
			const dbPath = `${tempDir}/dispose.db`;
			{
				const db = await openDatabase(dbPath);
				db.exec('CREATE TABLE t (x INT);');
				db[Symbol.dispose]();
			}
			// Should be able to reopen since previous instance was closed
			const db2 = await openDatabase(dbPath);
			db2.close();
		});
	});
});
