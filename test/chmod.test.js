import { describe, it, beforeEach, afterEach } from '@compat/test';
import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert';
import {
	chmod,
	chmodSync,
	lstat,
	lstatSync,
	stat,
	statSync,
	makeTempDir,
	remove,
	writeTextFile,
	writeTextFileSync,
	makeDir,
	makeDirSync,
	toFileUrl,
} from '../src/file.esm.js';

describe('Chmod Extended Compatibility', () => {
	let tempDir;

	beforeEach(async () => {
		tempDir = await makeTempDir({ prefix: 'extcompat_chmod_test_' });
	});

	afterEach(async () => {
		if (tempDir) {
			try {
				// Restore permissions to ensure tempDir can be cleaned up
				try {
					await chmod(tempDir, 0o777);
				} catch (_) {
					// Ignore if tempDir was already removed
				}
				await remove(tempDir, { recursive: true });
			} catch (_) {
				// Ignore cleanup error if already removed
			}
		}
	});

	describe('File Permissions', () => {
		it('changes file permissions asynchronously with numeric modes', async () => {
			const targetFile = `${tempDir}/file_async.txt`;
			await writeTextFile(targetFile, 'Async content');

			await chmod(targetFile, 0o755);
			let st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			await chmod(targetFile, 0o644);
			st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);

			await chmod(targetFile, 0o700);
			st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o700);
		});

		it('changes file permissions synchronously with numeric modes', () => {
			const targetFile = `${tempDir}/file_sync.txt`;
			writeTextFileSync(targetFile, 'Sync content');

			chmodSync(targetFile, 0o755);
			let st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(targetFile, 0o644);
			st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);

			chmodSync(targetFile, 0o700);
			st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o700);
		});
	});

	describe('Directory Permissions', () => {
		it('changes directory permissions asynchronously', async () => {
			const subDir = `${tempDir}/dir_async`;
			await makeDir(subDir);

			await chmod(subDir, 0o755);
			let st = await lstat(subDir);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			await chmod(subDir, 0o700);
			st = await lstat(subDir);
			assertEquals((st.mode ?? 0) & 0o777, 0o700);

			// Reset before cleanup
			await chmod(subDir, 0o755);
		});

		it('changes directory permissions synchronously', () => {
			const subDir = `${tempDir}/dir_sync`;
			makeDirSync(subDir);

			chmodSync(subDir, 0o755);
			let st = lstatSync(subDir);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(subDir, 0o700);
			st = lstatSync(subDir);
			assertEquals((st.mode ?? 0) & 0o777, 0o700);

			// Reset before cleanup
			chmodSync(subDir, 0o755);
		});
	});

	describe('String Mode Representations', () => {
		it('accepts octal strings without prefix (e.g. "755", "644")', async () => {
			const targetFile = `${tempDir}/file_str1.txt`;
			await writeTextFile(targetFile, 'String mode');

			await chmod(targetFile, '755');
			let st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(targetFile, '644');
			st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);
		});

		it('accepts octal strings with leading zero (e.g. "0755", "0644")', async () => {
			const targetFile = `${tempDir}/file_str2.txt`;
			await writeTextFile(targetFile, 'String mode leading zero');

			await chmod(targetFile, '0755');
			let st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(targetFile, '0644');
			st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);
		});

		it('accepts octal strings with 0o / 0O prefix (e.g. "0o755", "0O644")', async () => {
			const targetFile = `${tempDir}/file_str3.txt`;
			await writeTextFile(targetFile, 'String mode prefix');

			await chmod(targetFile, '0o755');
			let st = await lstat(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(targetFile, '0O644');
			st = lstatSync(targetFile);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);
		});
	});

	describe('URL Path Support', () => {
		it('handles file: URLs as path input asynchronously and synchronously', async () => {
			const targetFile = `${tempDir}/file_url.txt`;
			await writeTextFile(targetFile, 'URL mode');
			const targetUrl = toFileUrl(targetFile);

			await chmod(targetUrl, 0o755);
			let st = await lstat(targetUrl);
			assertEquals((st.mode ?? 0) & 0o777, 0o755);

			chmodSync(targetUrl, 0o644);
			st = lstatSync(targetUrl);
			assertEquals((st.mode ?? 0) & 0o777, 0o644);
		});
	});

	describe('Error Handling', () => {
		it('throws on non-existent path for chmod and chmodSync', async () => {
			const nonExistent = `${tempDir}/non_existent_file.txt`;

			await assertRejects(async () => await chmod(nonExistent, 0o755));
			assertThrows(() => chmodSync(nonExistent, 0o755));
		});

		it('throws TypeError when mode is not number or string', async () => {
			const targetFile = `${tempDir}/file_invalid_mode.txt`;
			await writeTextFile(targetFile, 'test');

			await assertRejects(
				async () => await chmod(targetFile, null),
				TypeError,
			);
			await assertRejects(
				async () => await chmod(targetFile, {}),
				TypeError,
			);
			assertThrows(
				() => chmodSync(targetFile, null),
				TypeError,
			);
			assertThrows(
				() => chmodSync(targetFile, {}),
				TypeError,
			);
		});
	});
});
