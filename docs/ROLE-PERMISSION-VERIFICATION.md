# Role-permission verification

## Automated verification

The permission regression suite covers:

- NCO and Squad Leader section and squad filtering in tracker reads and writes.
- Custom-role allow-listing and expiry handling.
- Viewer read-only custom-permission behavior.
- Resource, stock, submission, and account mutation guards.
- Senior-only award submissions and Junior-section separation.

Run it with:

```sh
node --test tests/permission-regression.test.mjs
```

## Disposable-account manual check

Create two clearly named accounts in Admin Centre, keeping their passwords private:

1. `Test NCO` — normal role NCO, assigned squad, custom role with resource viewing only.
2. `Test Squad Leader` — normal role Squad Leader, a different assigned squad, custom role with stock viewing only, optionally with an expiry date.

For each account, verify before expiry that only the assigned pages, section, squad, and actions are available. Try a direct URL and a direct API request for an unrelated squad or mutation; it must be denied. After expiry, sign out and refresh; the extra custom or temporary access must no longer be present.

Remove both disposable accounts after the check. Do not use production member records as test fixtures.

## Release checks

The release gate is:

```sh
pnpm lint
pnpm build
node --test tests/*.test.mjs
git diff --check
```

The live health endpoint should return `status: "ok"` before deployment. No production deployment is implied by this verification document.
