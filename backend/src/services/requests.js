const { v4: uuidv4 } = require("uuid");
const { pool } = require("../storage/db");
const { REQUEST_STATUS } = require("../models/status");

async function createRequest() {
  const id = uuidv4();
  const now = new Date();
  await pool.query(
    "INSERT INTO requests (id, status, message, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    [id, REQUEST_STATUS.PENDING, null, now, now],
  );
  await pool.query("UPDATE requests SET status=$1, updated_at=$2 WHERE id=$3", [REQUEST_STATUS.RUNNING, now, id]);
  return id;
}

async function updateRequest(id, status, message = null) {
  await pool.query("UPDATE requests SET status=$1, message=$2, updated_at=$3 WHERE id=$4", [
    status,
    message,
    new Date(),
    id,
  ]);
}

async function getRequest(requestId) {
  const result = await pool.query("SELECT * FROM requests WHERE id=$1", [requestId]);
  return result.rows[0] ?? null;
}

module.exports = {
  createRequest,
  updateRequest,
  getRequest,
};
