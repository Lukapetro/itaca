---
"@itacajs/cli": minor
---

Detect Azure DevOps remotes and Electron apps.

Two misreads found by running itaca over 11 real repos:

- Repos hosted on Azure Repos had no `code` service at all — only GitHub remotes
  were understood. `codeHostService` now also resolves Azure DevOps remotes (both
  the HTTPS `dev.azure.com/{org}/{project}/_git/{repo}` form and the SSH
  `ssh.dev.azure.com/v3/…` form) to repository, pull request and pipeline links.
- Electron apps were reported by whichever bundler they happened to use (Vite,
  Next). `electron` now takes precedence in framework detection: the shell is what
  decides how the project runs and ships.
