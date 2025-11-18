import { connection } from "../../../queue/services/queue";
import { Queue } from "bullmq";

const crawlerQueue = new Queue("crawler", {
  connection,
});

export default {
  afterCreate(event) {
    const { result } = event;
    const { id, search, location, site } = result as {
      id: number;
      search: string;
      location?: string;
      site?: string;
    };

    crawlerQueue.add("crawl", {
      id,
      search,
      location,
      site,
    });
  },
};
