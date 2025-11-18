/**
 * keyword controller
 */

import { factories } from "@strapi/strapi";
import { Queue } from "bullmq";
import { connection } from "../../queue/services/queue";

const crawlerQueue = new Queue("crawler", {
  connection,
});

export default factories.createCoreController(
  "api::keyword.keyword",
  ({ strapi }) => ({
    async getActive() {
      return await crawlerQueue.getWaitingCount();
    },
  })
);
