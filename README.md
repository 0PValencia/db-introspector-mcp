# @0pvalencia/db-introspector-mcp

MCP introspector PostgreSQL (tablas, FKs, DOT ER).

## Install / run (npx)

```bash
npx -y @0pvalencia/db-introspector-mcp
```

## Cursor / Claude / VS Code

```json
{
  "mcpServers": {
    "db-introspector": {
      "command": "npx",
      "args": ["-y", "@0pvalencia/db-introspector-mcp"]
    }
  }
}
```

## Local

```bash
npm install
npm run build
npm start
```

## Tools

- `list_tables` / `describe_table` / `list_foreign_keys`
- `schema_summary`
- `er_dot` → pasar a diagram-studio-mcp (`engine=graphviz`)

Requiere `DATABASE_URL`.

## License

MIT
