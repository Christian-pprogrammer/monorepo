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
  console.log(`🚀 Starting crawl for: ${job.data.search}`);
  
  const googleCrawler = new GoogleCrawler();
  await googleCrawler.initialize();
  await googleCrawler.searchGoogle({
    keyword: job.data.search,
    location: job.data.location,
    site: job.data.site,
  });
  await googleCrawler.close();
  
  console.log(`✅ Crawl completed! Found ${googleCrawler.results.length} results`);
  return googleCrawler.results; // ✅ Return results to BullMQ
}

console.log("Worker started! Listening for jobs..");
const worker = new Worker("crawler", onCrawl, { connection });

worker.on("completed", async (job) => {
  console.log("Job completed!");
  console.log("Posting results to Strapi");
  try {
    await client.post("/api/results/bulk", {
      keyword: job.data.id,
      data: job.returnvalue, // ✅ This contains googleCrawler.results
    });
    console.log("Results posted!");
    console.log("Waiting for next job..");
  } catch (e) {
    const error = e as AxiosError;
    console.log(inspect(error.response?.data, false, null, true));
  }
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});