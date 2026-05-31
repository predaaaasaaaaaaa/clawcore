---
name: github
description: Look up GitHub repos, issues, PRs, commits, releases, and stars. Use when the user asks about a GitHub repository or their GitHub activity. Requires the gh CLI installed and authenticated.
---

# GitHub

Use the bash tool with the `gh` CLI. First confirm it's available with `gh --version`. If it's missing, tell the user to install GitHub CLI and run `gh auth login`.

## Common commands
- Repo overview: gh repo view owner/name
- Info as JSON: gh repo view owner/name --json stargazerCount,description,url
- List issues: gh issue list --repo owner/name --limit 10
- List PRs: gh pr list --repo owner/name --limit 10
- Latest release: gh release view --repo owner/name

Summarize results in plain text. On an auth error, tell the user to run `gh auth login`.