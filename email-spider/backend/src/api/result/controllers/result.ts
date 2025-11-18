/**
 * result controller
 */
import z from "zod";
import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::result.result",
  ({ strapi }) => ({
    async bulkCreate(ctx) {
      const schema = z.object({
        keyword: z.number(),
        data: z.array(
          z.object({
            description: z.string().optional(),
            emails: z.array(z.string()),
          })
        ),
      });

      const parsedBody = schema.parse(ctx.request.body);

      const resultService = strapi.service("api::result.result");
      const emailService = strapi.service("api::email.email");
      const resultEntities: any[] = [];

      for (const result of parsedBody.data) {
        let emailIds: number[] = [];
        for (const email of result.emails) {
          try {
            const emailEntity = await emailService.create({
              data: {
                email,
              },
            });
            emailIds.push(emailEntity.id);
          } catch (error) {
            console.error(error);
          }
        }
        const resultEntity = await resultService.create({
          data: {
            description: result.description,
            emails: {
              connect: emailIds,
            },
            keyword: {
              connect: [parsedBody.keyword],
            },
          },
        });
        resultEntities.push(resultEntity);
      }
      return resultEntities;
    },
  })
);
