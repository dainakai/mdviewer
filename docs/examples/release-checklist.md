# Release Checklist

This second file is intentionally open in another tab so the README screenshot shows how multiple documents appear in the tab bar.

## Preflight

- Confirm `npm run check` succeeds.
- Confirm the changelog contains the target version.
- Confirm release notes are generated from `CHANGELOG.md`.

## Packaging

```mermaid
sequenceDiagram
  participant PR;
  participant CI;
  participant Main;
  participant Release;
  PR->>CI: run Build check;
  CI-->>PR: success;
  PR->>Main: merge;
  Main->>Release: validate, tag, package;
  Release-->>Main: publish artifacts;
```

## Manual Smoke Test

Open a Markdown file from the file manager and verify that tabs, search, math, Mermaid, and file refresh still behave as expected.
