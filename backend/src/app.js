const express = require("express");
const cors = require("cors");

require("dotenv").config();

const { initDb } = require("./storage/db");
const { router } = require("./api/routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use(router);

initDb()
  .then(() => {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to init DB", error);
    process.exit(1);
  });
