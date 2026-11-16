import { describe, it, beforeEach, afterEach } from '@compat/test';
import { assert, assertEquals, assertRejects, assertThrows } from '@std/assert';
import {
	symlink,
	symlinkSync,
	readlink,
	readlinkSync,
	lstat,
	lstatSync,
	makeTempDir,
	remove,
	writeTextFile,
	writeTextFileSync,
	readTextFile,
	readTextFileSync,
	makeDir,
	makeDirSync,
	toFileUrl,
} from '../src/file.esm.js';

describe('Symlink Extended Compatibility', () => {
	let tempDir;

	beforeEach(async () => {
		tempDir = await makeTempDir({ prefix: 'extcompat_test_' });
	});

	afterEach(async () => {
		if (tempDir) {
			try {
				await remove(tempDir, { recursive: true });
			} catch (_) {
				// Ignore cleanup error if already removed
			}
		}
	});

	describe('File Symlinks', () => {
		it('creates, inspects, and reads file symlinks asynchronously', async () => {
			const targetFile = `${tempDir}/target.txt`;
			const linkFile = `${tempDir}/link.txt`;
			const content = 'Hello Symlink Async';

			await writeTextFile(targetFile, content);
			await symlink(targetFile, linkFile);

			const linkStat = await lstat(linkFile);
			assert(linkStat.isSymbolicLink(), 'lstat should report isSymbolicLink() === true');
			assert(linkStat.isSymlink(), 'lstat should report isSymlink() === true');
			assertEquals(linkStat.isFile(), false, 'lstat should report isFile() === false for symlink');
			assertEquals(linkStat.isDirectory(), false, 'lstat should report isDirectory() === false');

			const readTarget = await readlink(linkFile);
			assertEquals(readTarget, targetFile);

			const readContent = await readTextFile(linkFile);
			assertEquals(readContent, content);
		});

		it('creates, inspects, and reads file symlinks synchronously', () => {
			const targetFile = `${tempDir}/target_sync.txt`;
			const linkFile = `${tempDir}/link_sync.txt`;
			const content = 'Hello Symlink Sync';

			writeTextFileSync(targetFile, content);
			symlinkSync(targetFile, linkFile);

			const linkStat = lstatSync(linkFile);
			assert(linkStat.isSymbolicLink(), 'lstatSync should report isSymbolicLink() === true');
			assert(linkStat.isSymlink(), 'lstatSync should report isSymlink() === true');
			assertEquals(linkStat.isFile(), false, 'lstatSync should report isFile() === false');

			const readTarget = readlinkSync(linkFile);
			assertEquals(readTarget, targetFile);

			const readContent = readTextFileSync(linkFile);
			assertEquals(readContent, content);
		});
	});

	describe('Directory Symlinks', () => {
		it('creates, inspects, and traverses directory symlinks asynchronously', async () => {
			const targetDir = `${tempDir}/target_dir`;
			const linkDir = `${tempDir}/link_dir`;
			const nestedFile = `${targetDir}/nested.txt`;
			const content = 'Nested File Content';

			await makeDir(targetDir);
			await writeTextFile(nestedFile, content);
			await symlink(targetDir, linkDir);

			const linkStat = await lstat(linkDir);
			assert(linkStat.isSymbolicLink(), 'lstat should report isSymbolicLink() === true');
			assertEquals(linkStat.isDirectory(), false, 'lstat should report isDirectory() === false for symlink');

			const readTarget = await readlink(linkDir);
			assertEquals(readTarget, targetDir);

			const readNested = await readTextFile(`${linkDir}/nested.txt`);
			assertEquals(readNested, content);
		});

		it('creates, inspects, and traverses directory symlinks synchronously', () => {
			const targetDir = `${tempDir}/target_dir_sync`;
			const linkDir = `${tempDir}/link_dir_sync`;
			const nestedFile = `${targetDir}/nested.txt`;
			const content = 'Nested Sync Content';

			makeDirSync(targetDir);
			writeTextFileSync(nestedFile, content);
			symlinkSync(targetDir, linkDir);

			const linkStat = lstatSync(linkDir);
			assert(linkStat.isSymbolicLink(), 'lstatSync should report isSymbolicLink() === true');

			const readTarget = readlinkSync(linkDir);
			assertEquals(readTarget, targetDir);

			const readNested = readTextFileSync(`${linkDir}/nested.txt`);
			assertEquals(readNested, content);
		});
	});

	describe('Broken Symlinks', () => {
		it('handles broken symlinks correctly asynchronously', async () => {
			const nonExistentTarget = `${tempDir}/non_existent_target.txt`;
			const linkFile = `${tempDir}/broken_link.txt`;

			await symlink(nonExistentTarget, linkFile);

			const linkStat = await lstat(linkFile);
			assert(linkStat.isSymbolicLink(), 'Broken symlink should report isSymbolicLink() === true');

			const readTarget = await readlink(linkFile);
			assertEquals(readTarget, nonExistentTarget);
		});

		it('handles broken symlinks correctly synchronously', () => {
			const nonExistentTarget = `${tempDir}/non_existent_sync.txt`;
			const linkFile = `${tempDir}/broken_sync_link.txt`;

			symlinkSync(nonExistentTarget, linkFile);

			const linkStat = lstatSync(linkFile);
			assert(linkStat.isSymbolicLink(), 'Broken symlink should report isSymbolicLink() === true');

			const readTarget = readlinkSync(linkFile);
			assertEquals(readTarget, nonExistentTarget);
		});
	});

	describe('Relative Symlink Targets', () => {
		it('creates relative symlinks and resolves content', async () => {
			const subDir = `${tempDir}/subdir`;
			await makeDir(subDir);

			const targetFile = `${subDir}/real.txt`;
			await writeTextFile(targetFile, 'Relative Content');

			const linkFile = `${subDir}/relative_link.txt`;
			await symlink('real.txt', linkFile);

			const readTarget = await readlink(linkFile);
			assertEquals(readTarget, 'real.txt');

			const linkStat = await lstat(linkFile);
			assert(linkStat.isSymbolicLink());

			const readContent = await readTextFile(linkFile);
			assertEquals(readContent, 'Relative Content');
		});
	});

	describe('URL Path Support', () => {
		it('handles file: URLs as target and path inputs', async () => {
			const targetFile = `${tempDir}/url_target.txt`;
			const linkFile = `${tempDir}/url_link.txt`;

			await writeTextFile(targetFile, 'URL Content');

			const targetUrl = toFileUrl(targetFile);
			const linkUrl = toFileUrl(linkFile);

			await symlink(targetUrl, linkUrl);

			const linkStat = await lstat(linkUrl);
			assert(linkStat.isSymbolicLink());

			const readTarget = await readlink(linkUrl);
			// readlink returns the target string as stored
			assert(readTarget.length > 0);

			const readContent = await readTextFile(linkFile);
			assertEquals(readContent, 'URL Content');
		});
	});

	describe('Windows Type Option Handling', () => {
		it('throws unimplemented error when Windows type string option is provided', async () => {
			const target = `${tempDir}/win_target.txt`;
			const link = `${tempDir}/win_link.txt`;

			await assertRejects(
				async () => await symlink(target, link, 'file'),
				Error,
				'unimplemented',
			);

			assertThrows(
				() => symlinkSync(target, link, 'dir'),
				Error,
				'unimplemented',
			);
		});

		it('throws unimplemented error when Windows type object option is provided', async () => {
			const target = `${tempDir}/win_target_obj.txt`;
			const link = `${tempDir}/win_link_obj.txt`;

			await assertRejects(
				async () => await symlink(target, link, { type: 'junction' }),
				Error,
				'unimplemented',
			);

			assertThrows(
				() => symlinkSync(target, link, { type: 'file' }),
				Error,
				'unimplemented',
			);
		});
	});

	describe('Error Handling', () => {
		it('throws on non-existent symlink path for readlink and lstat', async () => {
			const missing = `${tempDir}/does_not_exist`;

			await assertRejects(async () => await readlink(missing));
			assertThrows(() => readlinkSync(missing));

			await assertRejects(async () => await lstat(missing));
			assertThrows(() => lstatSync(missing));
		});

		it('throws when destination link path already exists', async () => {
			const existing = `${tempDir}/already_exists.txt`;
			const target = `${tempDir}/some_target.txt`;
			await writeTextFile(existing, 'existing');

			await assertRejects(async () => await symlink(target, existing));
			assertThrows(() => symlinkSync(target, existing));
		});
	});
});
