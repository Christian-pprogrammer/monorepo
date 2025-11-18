export default {
  routes: [
    {
      method: "GET",
      path: "/keywords/active",
      handler: "api::keyword.keyword.getActive",
    },
  ],
};
