# Release Legal Checklist

Use this checklist before packaging or publishing a release.

## Dependency And License Review

- [ ] Review direct dependencies in [package.json](../package.json).
- [ ] Review lockfile changes in [package-lock.json](../package-lock.json).
- [ ] Confirm no newly introduced copyleft or restricted licenses without explicit approval.
- [ ] Update [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for any added, removed, or upgraded components.

## Vendored Asset Review

- [ ] Verify each file under [media/vendor](../media/vendor) has a known upstream source and version/tag recorded in internal release notes.
- [ ] Verify each vendored library license still permits redistribution in packaged artifacts.
- [ ] Verify required attribution text or notices are present.

## Packaging And Attribution

- [ ] Ensure [LICENSE](../LICENSE) is included in the release artifact.
- [ ] Ensure [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) is included in the release artifact.
- [ ] Ensure README licensing section remains accurate in [README.md](../README.md).

## Final Sign-Off

- [ ] Perform a final human review for compliance-sensitive changes.
- [ ] Record reviewer and date in release notes.
- [ ] Proceed to package/publish only after all checks pass.
