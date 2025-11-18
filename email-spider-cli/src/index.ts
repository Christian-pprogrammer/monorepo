import { GoogleCrawler } from "./lib/google-crawler";
import { program } from "commander";
import fs from "fs";
import * as EmailValidator from "email-validator";
import dotenv from "dotenv";
dotenv.config();

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdBlocker from "puppeteer-extra-plugin-adblocker";

puppeteer.use(StealthPlugin());
puppeteer.use(
  AdBlocker({
    blockTrackers: true,
  })
);

program
  .requiredOption("-k, --keyword <keyword>", "Keyword to search")
  .option("-s, --site <site>", "Site to search")
  .option("-loc, --location <location>", "Location to search")
  .action(async (options) => {
    const googleCrawler = new GoogleCrawler();
    await googleCrawler.initialize();
    await googleCrawler.searchGoogle({ options });
  });

program.parse();
