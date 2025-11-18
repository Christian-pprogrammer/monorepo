import { Job, Worker } from "bullmq";
import { GoogleCrawler } from "./lib/google-crawler";
import dotenv from "dotenv";
import IORedis from "ioredis";
import { client } from "./lib/client";
import { AxiosError } from "axios";
import { inspect } from "util";
dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  maxRetriesPerRequest: null,
});

async function onCrawl(job: Job) {
  const googleCrawler = new GoogleCrawler();
  await googleCrawler.initialize();
  await googleCrawler.searchGoogle({
    keyword: job.data.search,
    location: job.data.location,
    site: job.data.site,
  });
  // await googleCrawler.isDone();
  // await googleCrawler.close();
  // return googleCrawler.results;
}

// console.log(process.env);

console.log("Worker started! Listening for jobs..");
const worker = new Worker("crawler", onCrawl, { connection });

// worker.on("completed", async (job) => {
//   console.log("Job completed!");
//   console.log("Posting results to Strapi");
//   try {
//     await client.post("/api/results/bulk", {
//       keyword: job.data.id,
//       data: job.returnvalue,
//     });
//     console.log("Results posted!");
//     console.log("Waiting for next job..");
//   } catch (e) {
//     const error = e as AxiosError;
//     console.log(inspect(error.response?.data, false, null, true));
//   }
// });
