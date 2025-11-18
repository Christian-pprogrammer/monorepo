import dotenv from "dotenv";
import type { Browser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import AdBlocker from "puppeteer-extra-plugin-adblocker";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { client } from "./client";
dotenv.config();

puppeteer.use(StealthPlugin());

puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.CAPTCHA_API_KEY,
    },
    visualFeedback: true,
  })
);

type searchGoogleParams = {
  keyword: string;
  location?: string;
  site?: string;
};

type Result = {
  id: number;
  emails: string[];
  description: string;
};

export class GoogleCrawler {
  browser: Browser;
  keyword: string;
  initial: boolean = true;
  done: boolean = false;
  results: Result[] = [];

  constructor() {}

  async close() {
    await this.browser.close();
  }

  async onTargetChanged(target) {
    const page = await target.page();
    const targetUrl = new URL(target.url());
    const pathname = targetUrl.pathname;

    if (pathname === "/sorry/index") {
      console.log("Captcha detected! Attempting to solve..");
      await page.solveRecaptchas();

      console.log("Captcha solved!");
    } else if (pathname === "/search" && this.initial) {
      this.initial = false;
      await page.waitForNavigation({
        waitUntil: "networkidle2",
      });
      await this._crawlResults({
        timeout: Number(process.env.TIMEOUT) || 1000,
      });
    }
  }

  async isDone() {
    await new Promise((resolve) => {
      setInterval(() => {
        if (this.done) {
          resolve(true);
        }
      }, 1000);
    });
  }

  async initialize() {
    const proxies = await client
      .get("/api/proxies", {
        headers: {
          Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
        },
      })
      .then(
        (res) =>
          res.data as {
            data: {
              attributes: {
                ip: string;
                port: number;
                username: string;
                password: string;
              };
            }[];
          }
      );

    console.log("Available proxies: ", proxies.data.length);

    const randomNo = Math.floor(Math.random() * proxies.data.length);
    const proxy = proxies.data[randomNo];

    console.log("Selected proxy: ", proxy);

    console.log("Initializing browser...");

    try {
      const browserOptions = {
        headless: process.env.HEADLESS === "false" ? false : true,
        args: [
          //
          "--no-sandbox",
          // "--disable-setuid-sandbox",
          // `--proxy-server=${proxy.attributes.ip}:${proxy.attributes.port}`,
        ],
      };

      console.log("Browser options: ", browserOptions);

      this.browser = await puppeteer.launch(browserOptions);

      console.log("Browser initialized!");

      this.browser.on("targetchanged", this.onTargetChanged.bind(this));

      const [page] = await this.browser.pages();

      await page.setViewport({ width: 1920, height: 1080 });

      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

      console.log("Setting up proxy authentication...");
      await page.authenticate({
        username: proxy.attributes.username,
        password: proxy.attributes.password,
      });
      console.log("Proxy authentication setup!");
    } catch (e) {
      console.log(e);
    }
  }

  async searchGoogle({ keyword, location, site }: searchGoogleParams) {
    console.log(`Searching Google for "${keyword}"`);
    const searchQuery = `${keyword} ` + `( @gmail.com OR @yahoo.com OR @hotmail.com ) ` + (location ? `in ${location} ` : "") + (site ? `site:${site}` : "");
    this.keyword = keyword.replace(/\s+/g, "-");

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
    console.log("Timeout: ", timeout);

    const [page] = await this.browser.pages();

    let counter = 0;
    let windowScrollY = 0;
    let prevWindowScrollY = -1;
    let tries = 5;

    while (!this.done) {
      this.done = await page.evaluate(this._isEndOfPage);
      console.log("Done: ", this.done);
      console.log("Tries: ", tries);

      if (prevWindowScrollY === windowScrollY) {
        tries = tries - 1;
      } else {
        tries = 5;
      }

      prevWindowScrollY = windowScrollY;
      windowScrollY = await page.evaluate(() => window.scrollY);

      if (this.done || !tries) {
        this.done = true;
        break;
      }

      const viewMoreButton = await page.$(".T7sFge.sW9g3e.VknLRd");
      const spinner = await page.$(".QjmzCd");

      if (viewMoreButton && spinner) {
        await viewMoreButton.scrollIntoView();

        const buttonPosition = await viewMoreButton.boundingBox();
        await page.mouse.click(buttonPosition!.x + buttonPosition!.width / 2, buttonPosition!.y + buttonPosition!.height / 2);

        const contents = (await page.$$(".VwiC3b.yXK7lf.lVm3ye.r025kc.hJNv6b.Hdw6tb")).slice(counter);

        console.log("Total contents: ", counter);
        // console.log("Found contents: ", contents.length);

        for (const content of contents) {
          // access innerText
          const html = await content.evaluate((node) => (node as any).innerText);
          const emails = this._stripEmails(html).map((email) => (email.endsWith(".") ? email.slice(0, -1) : email));
          this.results.push({
            id: counter + 1,
            emails,
            description: html,
          });
          counter++;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }
}
