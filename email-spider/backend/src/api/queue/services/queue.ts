/**
 * queue service
 */
import { exit } from "process";

import IORedis from "ioredis";
export const connection = new IORedis({
  host: process.env.REDIS_HOST,
});

connection.on("error", (error) => {
  strapi.log.error(`Unable to connect to the redis server: ${error.message}`);
  exit(1);
});

export default () => ({});
