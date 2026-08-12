---
name: GitHub push authentication
description: Secure GitHub tokens may validate through the API but need Git's Basic/ASKPASS flow for smart HTTP pushes.
---

Use Git's username/password prompt flow with the token supplied only through an environment-backed askpass script; do not put the token in a remote URL or chat. A Bearer extra header can be rejected by GitHub's smart HTTP endpoint even when the same token works with the GitHub API.

**Why:** The GitHub API and Git smart HTTP endpoint can handle authorization differently, and exposing a token in command arguments or conversation history creates avoidable risk.

**How to apply:** Prefer the connected GitHub integration. If a secure replacement token is explicitly requested and available, use an ephemeral askpass script, remove it after the operation, and never print the value.