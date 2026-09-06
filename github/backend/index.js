export function createGitHubMcpRegistration({ command = "github-mcp-server", tokenSecretId = "github-token" } = {}) {
  if (!command || !tokenSecretId) throw new TypeError("command and tokenSecretId are required");
  return {
    id: "github",
    transport: "stdio",
    command,
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: { secretRef: tokenSecretId },
    },
  };
}

export function createGitHubToolRequest({ owner, repo, operation, input = {} }) {
  for (const [name, value] of Object.entries({ owner, repo, operation })) {
    if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} is required`);
  }
  return {
    tool: `github.${operation}`,
    arguments: { owner, repo, ...input },
  };
}

export function normalizeGitHubRepository(repository) {
  if (!repository || typeof repository !== "object") throw new TypeError("repository payload is required");
  return {
    id: repository.id ?? null,
    fullName: typeof repository.full_name === "string" ? repository.full_name : null,
    defaultBranch: typeof repository.default_branch === "string" ? repository.default_branch : null,
    private: Boolean(repository.private),
  };
}
