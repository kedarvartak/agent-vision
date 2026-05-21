# Codex MCP Setup

This project can now run as a real local stdio MCP server.

## 1. Build the server

```bash
npm install
npm run build
```

## 2. Start Chrome or Brave with CDP enabled

Example:

```bash
brave-browser --remote-debugging-port=9222 --user-data-dir=/tmp/agent-vision-cdp
```

## 3. Register it in Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.agent-vision]
command = "node"
args = ["/home/kedar/Desktop/Projects/llm_vision/dist/mcp-stdio.js"]
```

If you prefer to use the future npm-published executable later, the shape will stay the same and you can switch to something like:

```toml
[mcp_servers.agent-vision]
command = "npx"
args = ["-y", "agent-vision-mcp"]
```

## 4. Restart Codex

After restarting, verify the server is available with:

```bash
codex mcp list
```

## 5. What tools should appear

- `getBrowserCdpStatus`
- `discoverBrowserTabsViaCdp`
- `refreshLiveBrowserTabs`
- `listLiveBrowserTabs`
- `pruneStaleLiveBrowserTabs`
- `resolveLiveBrowserTab`
- `captureResolvedBrowserTabScreenshot`
- `getResolvedBrowserTabContext`
- `seeBrowserTabViaCdp`

## 6. Manual behavior check

Once Codex sees the MCP server:
- keep the CDP-enabled browser running
- open one or more distinctive tabs
- ask Codex to use the browser visual MCP to inspect the active tab or a tab whose title matches a query

Examples:

```text
Use the agent-vision MCP server to list my live browser tabs.
Use the agent-vision MCP server to see the active browser tab.
Use the agent-vision MCP server to inspect the tab matching "docs".
```
