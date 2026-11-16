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
