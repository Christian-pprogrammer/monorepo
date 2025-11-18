import { program } from "commander";
import fs from "fs";

program
  .requiredOption("-f, --file <file>", "File to read")
  .option("-o, --output <output>", "Output file")
  .action(async (options) => {
    const fileName = options.file;
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(fileName, "utf-8");
    } catch (e) {
      console.error(`Error reading file: ${e.message}`);
      process.exit(1);
    }

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gm;
    const emails = fileContent.match(emailRegex);

    if (!emails) {
      console.error("No emails were found");
      return;
    }

    const uniqueEmails = Array.from(new Set(emails));
    fs.writeFileSync(options.output || "parsed-emails.txt", uniqueEmails.join("\n"));
  });

program.parse();
