const { Pool } = require("pg");
const { EMBEDDING_DIM } = require("../utils/embeddings");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

async function initDb() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      status TEXT NOT NULL,
      page_count INT NOT NULL,
      text_length INT NOT NULL,
      text TEXT NOT NULL DEFAULT ''
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      embedding VECTOR(${EMBEDDING_DIM})
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists=100)",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      questionnaire_document_id UUID NOT NULL,
      status TEXT NOT NULL,
      scope TEXT NOT NULL,
      document_ids JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id UUID PRIMARY KEY,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      order_index INT NOT NULL,
      text TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS answers (
      id UUID PRIMARY KEY,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL,
      is_answerable BOOLEAN NOT NULL,
      confidence DOUBLE PRECISION NOT NULL,
      citations JSONB NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      manual_answer TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id UUID PRIMARY KEY,
      status TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id UUID PRIMARY KEY,
      project_id UUID NOT NULL,
      answer_id UUID NOT NULL,
      human_answer TEXT NOT NULL,
      similarity_score DOUBLE PRECISION NOT NULL,
      notes TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL
    );
  `);
}

module.exports = {
  pool,
  initDb,
};
