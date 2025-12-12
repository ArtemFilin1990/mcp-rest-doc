# Bitrix MCP REST API Documentation
---

[![Install in Cursor](https://custom-icon-badges.demolab.com/badge/Install_in_Cursor-000000?style=for-the-badge&logo=cursor-ai-white)](cursor://anysphere.cursor-deeplink/mcp/install?name=io.github.bitrix24%2Fbitrix-mcp-rest&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vbWNwLWRldi5iaXRyaXgyNC5jb20vbWNwIn0=)
&nbsp;
[![Install in VS Code](https://custom-icon-badges.demolab.com/badge/Install_in_VS_Code-007ACC?style=for-the-badge&logo=vsc&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=io.github.bitrix24%2Fbitrix-mcp-rest&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp-dev.bitrix24.com%2Fmcp%22%7D)
&nbsp;

Bitrix MCP is the official server that gives AI assistants **direct, up-to-date access to Bitrix24 REST API documentation**.  
Instead of relying on assumed method names or parameters, assistants can query this server and get authoritative answers straight from Bitrix24 docs.

> When a developer asks an AI assistant to write integration code for Bitrix24, the model might invent methods or pass incorrect parameters. With MCP, the assistant can call this server as an expert on the Bitrix24 REST API and work from **actual documentation rather than assumptions**.

### Why Use Bitrix MCP
---

Bitrix MCP is useful for AI assistants that need to work with Bitrix24 **without memorizing the entire REST API**:

- **Accurate, up‑to‑date answers** – the assistant retrieves verified methods and parameters by querying this MCP server for the current REST methods, fields, and examples straight from Bitrix24 documentation.
- **Works without web search** – a local or restricted model (no internet search) can still access the Bitrix24 REST API surface via MCP tools.
- **Reduced context management** – no need to paste large documentation into the prompt or maintain your own embeddings of the API reference; the assistant fetches documentation on demand.
- **Fewer integration mistakes** – the assistant discovers the right method via semantic search, inspects parameters/examples/errors first, and then generates code that matches the real API instead of guesses.

**Example**: a developer asks the assistant “Create a CRM deal with product rows in Bitrix24.”  
The assistant:
- calls `bitrix-search` to find `crm.deal.add` and related methods
- then invokes `bitrix-method-details` to get parameters and examples  
Based on this, it generates a correct REST call **without incorrect or missing fields**.

## Features
---

- **Semantic search over Bitrix24 REST documentation**
- **Detailed method inspection** with parameters, examples, errors, return values, and URLs
- **Article and event documentation** retrieval
- **MCP‑native HTTP server** compatible with any MCP client that supports HTTP transports

## Available Tools
---

### bitrix-search

**Description**:  
Searches for Bitrix24 methods and documentation articles using a natural language query.  
Returns a formatted list of results and, optionally, suggested follow‑up tool calls.

**Parameters**:

- **`query`** (required): Natural language search query.
- **`top_k`** (optional): Maximum number of search results.

**Response**:

- Plain‑text list of matched Bitrix24 REST methods, events, and documentation articles.
- Each line contains a name and short description, ordered by relevance.
- If nothing is found, the tool returns an empty string.

### bitrix-method-details

**Description**:  
Returns details for a Bitrix24 REST method.  
Typical usage is after finding the method via `bitrix-search`.

**Parameters**:

- **`method`** (required): Exact REST method name, e.g. `crm.deal.add`.
- **`field`** (optional, default `all`): One of:
  - `all`
  - `name`
  - `description`
  - `params`
  - `example`
  - `errors`
  - `returns`
  - `url`
- **`filter`** (optional): Additional filter string (specific to the search service).

**Response**:

- For `field="all"`: multi‑section plain text summary with:
  - method name, module, category, scope
  - description and documentation URL
  - parameters, returns, errors, and examples
- For other `field` values: only the requested part (for example, parameters list, only URL, only examples).
- If the method is not found: a short error message advising to call `bitrix-search` first.

### bitrix-article-details

**Description**:  
Returns full text and metadata for a non‑method Bitrix24 documentation article.

**Parameters**:

- **`title_or_hint`** (required): Article title or unique identifying hint (e.g. a line from `bitrix-search` results).
- **`top_k`** (optional): Maximum number of candidate docs to aggregate.

**Response**:

- Structured markdown text with article title, optional metadata (module, category, URL), description section, and full content body.
- If no matching article is found, returns a short "Article not found." message.

### bitrix-event-details

**Description**:  
Returns documentation for Bitrix24 events (webhooks, callbacks, etc.).

**Parameters**:

- **`title_or_hint`** (required): Event name or unique identifying snippet.
- **`top_k`** (optional): Maximum number of candidates to aggregate.

**Response**:

- Same format as `bitrix-article-details`, but focused on event documentation:
  - title, metadata, description, and content assembled from Bitrix24 docs.
- If no matching event documentation is available, returns a short error message.

## Configuration

Bitrix MCP is available as a hosted HTTP endpoint. No API key or local setup is required—just configure your MCP client to connect to our endpoint.

### Cursor

Add to your `mcp.json`:

```json
{
  "mcpServers": {
    "bitrix-mcp-rest": {
      "url": "https://mcp-dev.bitrix24.com/mcp"
    }
  }
}
```

Or use the one-click install badge at the top of this README.

### VS Code

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "bitrix-mcp-rest": {
      "type": "http",
      "url": "https://mcp-dev.bitrix24.com/mcp"
    }
  }
}
```

Or use the one-click install badge at the top of this README.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bitrix-mcp-rest": {
      "type": "http",
      "url": "https://mcp-dev.bitrix24.com/mcp"
    }
  }
}
```

### Other MCP Clients

For any MCP-compatible client that supports HTTP transports, use:

- **URL**: `https://mcp-dev.bitrix24.com/mcp`
- **Type**: `http`



For support, contact Bitrix24 via [`Support24 Helpdesk`](https://helpdesk.bitrix24.com/ticket.php) or file an issue in the GitHub repository for this MCP server.
