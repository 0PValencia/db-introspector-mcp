#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import pg from "pg";
import { z } from "zod";

const { Client } = pg;

function dbUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Falta DATABASE_URL (postgresql://user:pass@host:5432/db).");
  }
  return url;
}

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: "db-introspector-mcp", version: "0.1.0" },
    {
      instructions:
        "Lee el esquema real de PostgreSQL (DATABASE_URL). Usa schema_summary / list_foreign_keys / er_dot y luego diagram-studio (graphviz) o escribe el capítulo de diseño en google-documents-mcp.",
    },
  );

  server.registerTool(
    "list_tables",
    {
      title: "Listar tablas",
      description: "Tablas de un schema (default public).",
      inputSchema: z.object({ schema: z.string().optional().default("public") }).strict(),
    },
    async ({ schema }) => {
      try {
        const rows = await withClient(async (c) => {
          const r = await c.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'
             ORDER BY table_name`,
            [schema ?? "public"],
          );
          return r.rows as Array<{ table_name: string }>;
        });
        const result = { schema: schema ?? "public", tables: rows.map((r) => r.table_name) };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describir tabla",
      description: "Columnas, tipos y nullability.",
      inputSchema: z
        .object({
          table: z.string().min(1),
          schema: z.string().optional().default("public"),
        })
        .strict(),
    },
    async ({ table, schema }) => {
      try {
        const columns = await withClient(async (c) => {
          const r = await c.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2
             ORDER BY ordinal_position`,
            [schema ?? "public", table],
          );
          return r.rows;
        });
        const result = { schema: schema ?? "public", table, columns };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_foreign_keys",
    {
      title: "Listar FKs",
      description: "Foreign keys del schema.",
      inputSchema: z.object({ schema: z.string().optional().default("public") }).strict(),
    },
    async ({ schema }) => {
      try {
        const fks = await withClient(async (c) => {
          const r = await c.query(
            `SELECT
               tc.table_name AS from_table,
               kcu.column_name AS from_column,
               ccu.table_name AS to_table,
               ccu.column_name AS to_column,
               tc.constraint_name
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
             ORDER BY tc.table_name, kcu.column_name`,
            [schema ?? "public"],
          );
          return r.rows;
        });
        const result = { schema: schema ?? "public", foreignKeys: fks };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "er_dot",
    {
      title: "Generar DOT (ER)",
      description: "Graphviz DOT a partir de tablas + FKs. Pásalo a diagram-studio render_diagram engine=graphviz.",
      inputSchema: z.object({ schema: z.string().optional().default("public") }).strict(),
    },
    async ({ schema }) => {
      try {
        const sch = schema ?? "public";
        const { tables, fks } = await withClient(async (c) => {
          const t = await c.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
            [sch],
          );
          const f = await c.query(
            `SELECT tc.table_name AS from_table, ccu.table_name AS to_table
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
            [sch],
          );
          return {
            tables: (t.rows as Array<{ table_name: string }>).map((r) => r.table_name),
            fks: f.rows as Array<{ from_table: string; to_table: string }>,
          };
        });
        const lines = ["digraph ER {", "  rankdir=LR;", '  node [shape=box, fontname="Helvetica"];'];
        for (const table of tables) {
          lines.push(`  "${table}";`);
        }
        for (const fk of fks) {
          lines.push(`  "${fk.from_table}" -> "${fk.to_table}";`);
        }
        lines.push("}");
        const dot = lines.join("\n");
        return {
          content: [{ type: "text" as const, text: dot }],
          structuredContent: { schema: sch, tableCount: tables.length, fkCount: fks.length, dot },
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "schema_summary",
    {
      title: "Resumen de schema",
      description: "Conteo de tablas, FKs y lista compacta.",
      inputSchema: z.object({ schema: z.string().optional().default("public") }).strict(),
    },
    async ({ schema }) => {
      try {
        const sch = schema ?? "public";
        const summary = await withClient(async (c) => {
          const tables = await c.query(
            `SELECT count(*)::int AS n FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
            [sch],
          );
          const fks = await c.query(
            `SELECT count(*)::int AS n FROM information_schema.table_constraints
             WHERE table_schema = $1 AND constraint_type = 'FOREIGN KEY'`,
            [sch],
          );
          const names = await c.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
            [sch],
          );
          return {
            schema: sch,
            tableCount: (tables.rows[0] as { n: number }).n,
            foreignKeyCount: (fks.rows[0] as { n: number }).n,
            tables: (names.rows as Array<{ table_name: string }>).map((r) => r.table_name),
          };
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
          structuredContent: summary,
        };
      } catch (error: unknown) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );

  return server;
}

await serveStdio(() => createServer());
