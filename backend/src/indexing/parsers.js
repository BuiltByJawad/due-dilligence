const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const pptx2json = require("pptx2json");

async function parsePdf(filePath) {
  const data = await fs.readFile(filePath);
  const parsed = await pdfParse(data);
  return parsed.text || "";
}

async function parseDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function parseXlsx(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames || [];
  const parts = sheetNames.map((name) => xlsx.utils.sheet_to_csv(workbook.Sheets[name]));
  return parts.join("\n");
}

function parsePptx(filePath) {
  return new Promise((resolve, reject) => {
    pptx2json(filePath, (error, json) => {
      if (error) {
        reject(error);
        return;
      }
      const slides = json.slides || [];
      const text = slides
        .flatMap((slide) => slide.texts || [])
        .map((item) => item.text)
        .join("\n");
      resolve(text);
    });
  });
}

async function extractText(filePath, contentType) {
  const extension = path.extname(filePath).toLowerCase();
  if (contentType === "application/pdf" || extension === ".pdf") {
    return parsePdf(filePath);
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx") {
    return parseDocx(filePath);
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || extension === ".xlsx") {
    return parseXlsx(filePath);
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || extension === ".pptx") {
    return parsePptx(filePath);
  }
  return "";
}

module.exports = {
  extractText,
};
