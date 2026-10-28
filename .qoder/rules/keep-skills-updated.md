# Keep Project Skills Updated

This universal maintenance rule applies to every project, not only docker_local_management. Skills must reflect the exact current codebase; stale documentation is worse than no documentation because it misleads implementation.

After any code change, update affected skill files in the same response:

- New, removed, renamed, or moved modules: update `features-map`; update `project-map` when locations or structure change.
- New or changed features, hooks, APIs, integrations, templates, or endpoint behavior: update `features-map` and any affected domain map.
- Build commands, dependencies, aliases, compiler/linter/formatter configuration, or deployment flow: update `project-map`.
- React component hierarchy, context ownership, hooks, or data/stream flow: update `react-map` when present.
- Template names, file paths, commands, and feature entries must exactly match the code.
- Keep cross-references between `project-map`, `features-map`, and domain maps valid and bidirectional.
- Make surgical updates to existing guides rather than regenerating unrelated content.
