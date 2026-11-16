# @extcompat/file

Cross-runtime file system compatibility module extending [`@tundralibs/compat/file`](deno.json:5) with symbolic link operations across **Deno**, **Node.js**, and **Bun**.

Written as zero-build, pure vanilla ECMAScript Modules (ESM) without a compilation step.

---

## Features

- **Full Drop-In Superset**: Re-exports all utilities and error types from [`@compat/file`](deno.json:5).
- **Symlink Operations**:
  - [`symlink`](#symlinktarget-path-typeoroptions) / [`symlinkSync`](#symlinksynctarget-path-typeoroptions): Create symbolic links pointing to target paths or `file:` URLs.
  - [`readlink`](#readlinkpath) / [`readlinkSync`](#readlinksyncpath): Read the target destination of symbolic links.
  - [`lstat`](#lstatpath) / [`lstatSync`](#lstatsyncpath): Retrieve metadata without dereferencing symbolic links.
- **Normalized StatsResult**: Standardized inspection methods (`isSymbolicLink()`, `isFile()`, `isDirectory()`, `isFIFO()`, `isSocket()`, `isBlockDevice()`, `isCharacterDevice()`) and metadata properties (`size`, `mtime`, `atime`, `birthtime`, `ctime`, `mode`, etc.) across all runtime engines.
- **Zero Dependencies at Runtime**: Uses native runtime APIs (`Deno.*` in Deno, `node:fs` / `node:fs/promises` in Node/Bun).

---

## Installation & Import

### CDN Distribution

```json
{
  "imports": {
    "@extcompat/file": "https://cdn.jsdelivr.net/gh/bkatzung/extcompat@<semver>/src/file.esm.js"
  }
}
```

### Local Workspace Import

```javascript
import {
  symlink,
  symlinkSync,
  readlink,
  readlinkSync,
  lstat,
  lstatSync,
  StatsResult,
  // Re-exported from @compat/file:
  readFile,
  writeFile,
  makeTempDir,
  remove,
} from './src/file.esm.js';
```

---

## Usage Examples

### Asynchronous Operations

```javascript
import { symlink, readlink, lstat, writeTextFile, readTextFile } from '@extcompat/file';

// 1. Create a target file
await writeTextFile('target.txt', 'Hello Symlink!');

// 2. Create a symbolic link
await symlink('target.txt', 'symlink.txt');

// 3. Inspect with lstat (does not follow symlink)
const stats = await lstat('symlink.txt');
console.log(stats.isSymbolicLink()); // true
console.log(stats.isFile());         // false

// 4. Read the target path
const target = await readlink('symlink.txt');
console.log(target); // "target.txt"

// 5. Read file contents through the symlink
const content = await readTextFile('symlink.txt');
console.log(content); // "Hello Symlink!"
```

### Synchronous Operations

```javascript
import { symlinkSync, readlinkSync, lstatSync, writeTextFileSync, readTextFileSync } from '@extcompat/file';

writeTextFileSync('data.json', '{"status":"ok"}');
symlinkSync('data.json', 'data-link.json');

const stats = lstatSync('data-link.json');
if (stats.isSymbolicLink()) {
  console.log('Symlink destination:', readlinkSync('data-link.json'));
}
```

---

## API Reference

### `symlink(target, path, typeOrOptions?)`
- **`target`**: `string | URL` - Path or `file:` URL that the symlink will point to.
- **`path`**: `string | URL` - Destination path or `file:` URL where the symlink will be created.
- **`typeOrOptions`**: `string | { type?: 'file' | 'dir' | 'junction' }` - *(Optional)* Type hint (reserved for future Windows platform support).
- **Returns**: `Promise<void>`

### `symlinkSync(target, path, typeOrOptions?)`
- Synchronous variant of `symlink`.
- **Returns**: `void`

### `readlink(path)`
- **`path`**: `string | URL` - Path or `file:` URL to the symbolic link.
- **Returns**: `Promise<string>` - Destination path pointed to by the symlink.

### `readlinkSync(path)`
- Synchronous variant of `readlink`.
- **Returns**: `string`

### `lstat(path)`
- **`path`**: `string | URL` - Path or `file:` URL to inspect.
- **Returns**: `Promise<StatsResult>` - Normalized file status object without following symlinks.

### `lstatSync(path)`
- Synchronous variant of `lstat`.
- **Returns**: `StatsResult`

### `StatsResult`
Normalized object providing:
- **Methods**:
  - `isSymbolicLink()` / `isSymlink()`: `boolean`
  - `isFile()`: `boolean`
  - `isDirectory()`: `boolean`
  - `isBlockDevice()`: `boolean`
  - `isCharacterDevice()`: `boolean`
  - `isFIFO()`: `boolean`
  - `isSocket()`: `boolean`
- **Properties**:
  - `size`: `number`
  - `mtime`: `Date | null`
  - `atime`: `Date | null`
  - `birthtime`: `Date | null`
  - `ctime`: `Date | null`
  - `mode`: `number | null`
  - `uid`: `number | null`
  - `gid`: `number | null`
  - `dev`: `number | null`
  - `ino`: `number | null`
  - `nlink`: `number | null`
  - `rdev`: `number | null`
  - `blksize`: `number | null`
  - `blocks`: `number | null`

---

## Testing

Run the test suite across any of the supported JavaScript runtimes:

```bash
# Deno
deno test -A

# Bun (via wicbun)
wicbun --test --isolate test/symlink.test.js

# Node.js (via wicnode)
wicnode --test test/symlink.test.js
```
