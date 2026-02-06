const { normalizeLines } = require("../utils/text");

async function parseQuestionnaire(text) {
  const lines = normalizeLines(text);
  const sections = [];
  const questions = [];
  let currentSection = "General";
  for (const line of lines) {
    if (line.toUpperCase() === line && line.split(" ").length <= 6) {
      currentSection = line;
      sections.push(currentSection);
      continue;
    }
    if (line.endsWith("?") || /^\d+/.test(line)) {
      questions.push({ section: currentSection, text: line });
    }
  }
  return { sections, questions };
}

module.exports = {
  parseQuestionnaire,
};
