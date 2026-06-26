# Development Notes

## Packaging

Linux:

```bash
npm run dist:linux
```

macOS:

```bash
npm run dist:mac
```

For signed macOS packages, build on macOS or on the GitHub Actions macOS runner with the appropriate signing credentials.

To publish installable artifacts, update `package.json` version, commit, and push a tag such as `v0.1.1`. The Release workflow builds Linux and macOS artifacts and attaches them to GitHub Releases.
