export default {
  routes: [
    {
      method: "POST",
      path: "/results/bulk",
      handler: "api::result.result.bulkCreate",
    },
  ],
};
