# extcompat

Extended cross-runtime compatibility libraries for JavaScript runtimes (**Deno**, **Node.js**, **Bun**, and derivatives), extending the [`@tundralibs/compat`](https://github.com/tundralibs/compat) ecosystem with additional runtime APIs.

All modules are written as zero-build, pure vanilla ECMAScript Modules (ESM).

---

## Current Extensions

### `@extcompat/file` ([`src/file.esm.js`](src/file.esm.js:1))

Extends [`@tundralibs/compat/file`](deno.json:5) with:
- **Permission management**: [`chmod`](src/file.esm.js:292) and [`chmodSync`](src/file.esm.js:309) supporting numeric modes and octal strings.
- **Symbolic link operations**: [`symlink`](src/file.esm.js:192), [`symlinkSync`](src/file.esm.js:211), [`readlink`](src/file.esm.js:228), and [`readlinkSync`](src/file.esm.js:243).
- **Link metadata inspection**: [`lstat`](src/file.esm.js:258), [`lstatSync`](src/file.esm.js:275), and normalized [`StatsResult`](src/file.esm.js:19).

For full API specifications, type details, and examples, see [`docs/file.md`](docs/file.md).

### `@extcompat/sqlite` ([`src/sqlite.esm.js`](src/sqlite.esm.js:1))

Provides cross-runtime SQLite database access across Bun, Deno, Node.js, and derivative runtimes:
- **Connection Management**: [`openDatabase`](src/sqlite.esm.js:521) supporting in-memory (`:memory:`), file paths, and `file:` URLs.
- **Unified Database Client**: [`Database`](src/sqlite.esm.js:132) with [`query`](src/sqlite.esm.js:163) (tuple arrays), [`queryObjects`](src/sqlite.esm.js:174) (objects), [`queryOne`](src/sqlite.esm.js:185), and [`run`](src/sqlite.esm.js:196).
- **Prepared Statements & Transactions**: [`Statement`](src/sqlite.esm.js:67) compilation and [`transaction`](src/sqlite.esm.js:238) block helpers with automatic rollback.

For full API specifications, type details, and examples, see [`docs/sqlite.md`](docs/sqlite.md).

### `@extcompat/subprocess` ([`src/subprocess.esm.js`](src/subprocess.esm.js:1))

Provides cross-runtime subprocess spawning with standard Web Streams and Promise-based controls:
- **Subprocess Spawning**: [`spawn`](src/subprocess.esm.js:429) across Deno, Node.js, and Bun.
- **Unified Controller**: [`Subprocess`](src/subprocess.esm.js:139) with Web Streams (`stdin`, `stdout`, `stderr`), `status` promise, and cancellation via `signal` or [`kill()`](src/subprocess.esm.js:213).
- **Buffered Output Helpers**: [`output()`](src/subprocess.esm.js:164) (binary), [`text()`](src/subprocess.esm.js:189) (string), and [`json()`](src/subprocess.esm.js:203) (JSON).

For full API specifications, type details, and examples, see [`docs/subprocess.md`](docs/subprocess.md).

---

## Testing

Run the test suite across supported runtimes:

```bash
# Deno
deno test -A test

# Bun (via wicbun)
wicbun --test --isolate test

# Node.js (via wicnode)
wicnode --test test
```

---

## License

[MIT](LICENSE)
