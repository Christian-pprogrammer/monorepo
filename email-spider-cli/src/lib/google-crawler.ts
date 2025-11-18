import fs from "fs";
import type { Browser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdBlocker from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");

puppeteer.use(StealthPlugin());
puppeteer.use(
  AdBlocker({
    blockTrackers: true,
  })
);

puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.CAPTCHA_API_KEY,
    },
    visualFeedback: true,
  })
);

export class GoogleCrawler {
  browser: Browser;
  keyword: string;
  crawling: boolean = false;

  constructor() {}

  async close() {
    await this.browser.close();
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: process.env.HEADLESS === "true" ? true : false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // trigger even on page change
    this.browser.on("targetchanged", this.onTargetChanged.bind(this));
  }

  async onTargetChanged(target) {
    const page = await target.page();
    const targetUrl = new URL(target.url());
    const pathname = targetUrl.pathname;
    console.log("pathname: ", pathname);
    if (pathname === "/sorry/index") {
      await page.solveRecaptchas();
      console.log("Captcha detected! Waiting for user input...");
    } else if (pathname === "/search" && !this.crawling) {
      this.crawling = true;
      await page.waitForNavigation({
        waitUntil: "networkidle2",
      });
      await this._crawlResults({
        timeout: 1000,
      });
    }
  }

  async searchGoogle({ options }: { options: Record<string, string> }) {
    console.log(`Searching Google for ${options.keyword}`);
    const searchQuery = `${options.keyword} ` + `( @gmail.com OR @yahoo.com OR @hotmail.com ) ` + (options.location ? `in ${options.location} ` : "") + (options.site ? `site:${options.site}` : "");
    this.keyword = options.keyword.replace(/\s+/g, "-");

    const [page] = await this.browser.pages();
    await page.goto("https://www.google.com");
    const textarea = await page.$("textarea");
    if (!textarea) {
      console.error("Search area not found!");
      return;
    }
    await textarea.type(searchQuery, { delay: 10 });
    await page.keyboard.press("Enter");
    console.log("Waiting for navigation...");
  }

  _stripEmails(html): string[] {
    const EMAIL_PATTERN = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const emails = html.match(EMAIL_PATTERN) as string[];
    return Array.from(new Set(emails));
  }

  _isEndOfPage() {
    const viewMoreButton = document.querySelector(".T7sFge.sW9g3e.VknLRd");
    const spinner = document.querySelector(".QjmzCd");
    if (viewMoreButton && spinner) {
      const spinnerStyle = spinner.getAttribute("style");
      const viewMoreButtonStyle = viewMoreButton.getAttribute("style");
      if (spinnerStyle == "display: none;" && viewMoreButtonStyle == "transform: scale(0);") {
        return true;
      }
    }
    return false;
  }

  async _crawlResults({ timeout = 1000 }: { timeout?: number }) {
    console.log("Crawling results...");
    const [page] = await this.browser.pages();

    const results: {
      id: number;
      emails: string[];
      description: string;
    }[] = [];

    let isEndOfPage = false;
    let counter = 0;

    while (!isEndOfPage) {
      isEndOfPage = await page.evaluate(this._isEndOfPage);

      if (isEndOfPage) {
        break;
      }

      const viewMoreButton = await page.$(".T7sFge.sW9g3e.VknLRd");
      const spinner = await page.$(".QjmzCd");

      if (viewMoreButton && spinner) {
        await viewMoreButton.scrollIntoView();

        const buttonPosition = await viewMoreButton.boundingBox();
        await page.mouse.click(buttonPosition!.x + buttonPosition!.width / 2, buttonPosition!.y + buttonPosition!.height / 2);
      }

      const contents = (await page.$$(".VwiC3b.yXK7lf.lVm3ye.r025kc.hJNv6b.Hdw6tb")).slice(counter);

      console.log("Total contents: ", counter);
      console.log("Found contents: ", contents.length);

      for (const content of contents) {
        // access innerText
        const html = await content.evaluate((node) => (node as any).innerText);
        const emails = this._stripEmails(html).map((email) => (email.endsWith(".") ? email.slice(0, -1) : email));
        results.push({
          id: counter + 1,
          emails,
          description: html,
        });
        counter++;
      }

      await new Promise((resolve) => setTimeout(resolve, timeout));
    }

    let emails = results
      .map((result) => result.emails)
      .flat()
      .filter((email) => email);

    emails = Array.from(new Set(emails));

    console.log(`Found ${emails.length} unique emails`);

    fs.writeFileSync(`${this.keyword}.json`, JSON.stringify(results, null, 2));
    fs.writeFileSync(`${this.keyword}.txt`, emails.join("\n"));

    if (fs.existsSync(`emails.txt`)) {
      console.log("Appending to emails.txt");
      const prevEmails = fs.readFileSync(`emails.txt`, "utf-8").split("\n");
      const uniqueEmails = Array.from(new Set([...prevEmails, ...emails]));
      console.log(`Found ${uniqueEmails.length} unique emails`);
      fs.writeFileSync(`emails.txt`, uniqueEmails.join("\n"));
    } else {
      console.log("Creating emails.txt");
      fs.writeFileSync(`emails.txt`, emails.join("\n"));
    }

    this.browser.off("targetchanged", this.onTargetChanged.bind(this));
    await page.close();
    await this.browser.close();
  }
}

// https://www.google.com/sorry/index?continue=https://www.google.com/search%3Fq%3Dcontractor%2B%2528%2B%2540gmail.com%2BOR%2B%2540yahoo.com%2BOR%2B%2540hotmail.com%2B%2529%2Bsite%253Afacebook.com%26sca_esv%3Dc62ac071dfd388fc%26source%3Dhp%26ei%3DNIhsZtCbF6npi-gP6KuLyAo%26iflsig%3DAL9hbdgAAAAAZmyWRLuYHZlNZHaHDNDCZ8JUnjJHhG03%26udm%3D%26ved%3D0ahUKEwjQhcWK2duGAxWp9AIHHejVAqkQ4dUDCA0%26uact%3D5%26oq%3Dcontractor%2B%2528%2B%2540gmail.com%2BOR%2B%2540yahoo.com%2BOR%2B%2540hotmail.com%2B%2529%2Bsite%253Afacebook.com%26gs_lp%3DEgdnd3Mtd2l6Ikljb250cmFjdG9yICggQGdtYWlsLmNvbSBPUiBAeWFob28uY29tIE9SIEBob3RtYWlsLmNvbSApIHNpdGU6ZmFjZWJvb2suY29tSMIHUABYtAdwAHgAkAEAmAFboAHlAqoBATS4AQPIAQD4AQGYAgCgAgCYAwCSBwCgB5cP%26sclient%3Dgws-wiz&q=EgSw6R9-GLaQsrMGIjCm7Oo2dojlUSqIvKHFOQobxmjtcSuylhqJyqfErHu_Ba2gqx5-SG-NlM4SIjoMfaMyAXJaAUM
