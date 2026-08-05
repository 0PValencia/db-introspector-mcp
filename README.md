# @0pvalencia/db-introspector-mcp

MCP introspector PostgreSQL (tablas, FKs, DOT ER).

## Cursor / Claude / VS Code

### Local (recomendado si clonas el repo)

```json
{
  "mcpServers": {
    "db-introspector": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/db-introspector-mcp/dist/cli.js"]
    }
  }
}
```

Tras clonar: `npm install && npm run build`.

### npx (sin clonar)

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

> Si abres este repo en Cursor y usas `npx`, hace falta `npm install && npm run build` para que el bin local exista. Sin eso, `npx` falla con `db-introspector-mcp: not found` y el MCP se queda cargando.

## Install / run

```bash
npx -y @0pvalencia/db-introspector-mcp
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

Requiere `DATABASE_URL`.

## License

MIT
