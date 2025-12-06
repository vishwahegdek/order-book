
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function getTables() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  `);
  return res.rows.map(r => r.table_name);
}

async function getTableSchema(tableName) {
  const columnsRes = await pool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  const constraintsRes = await pool.query(`
    SELECT 
      tc.constraint_name, 
      tc.constraint_type, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name = $1
  `, [tableName]);

  let schema = `CREATE TABLE ${tableName} (\n`;
  const lines = [];

  columnsRes.rows.forEach(col => {
    let line = `  ${col.column_name} ${col.data_type.toUpperCase()}`;
    if (col.character_maximum_length) {
      line += `(${col.character_maximum_length})`;
    }
    if (col.is_nullable === 'NO') {
      line += ' NOT NULL';
    }
    if (col.column_default) {
      line += ` DEFAULT ${col.column_default}`;
    }
    lines.push(line);
  });

  constraintsRes.rows.forEach(con => {
    if (con.constraint_type === 'PRIMARY KEY') {
        // We often see primary keys defined inline, but explicit is fine too
        lines.push(`  CONSTRAINT ${con.constraint_name} PRIMARY KEY (${con.column_name})`);
    } else if (con.constraint_type === 'FOREIGN KEY') {
        lines.push(`  CONSTRAINT ${con.constraint_name} FOREIGN KEY (${con.column_name}) REFERENCES ${con.foreign_table_name} (${con.foreign_column_name})`);
    }
  });

  schema += lines.join(',\n');
  schema += '\n);\n';
  return schema;
}

async function main() {
  try {
    const tables = await getTables();
    console.log('-- Schema extraction --\n');
    for (const table of tables) {
      const schema = await getTableSchema(table);
      console.log(schema);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
