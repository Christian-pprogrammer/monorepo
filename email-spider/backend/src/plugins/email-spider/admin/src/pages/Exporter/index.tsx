/*
 *
 * HomePage
 *
 */

import React, { useEffect, useState } from "react";
import pluginId from "../../pluginId";
import { getFetchClient } from "@strapi/helper-plugin";
import { Button } from "@strapi/design-system";
import { ContentBox } from "@strapi/helper-plugin";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import qs from "qs";

type EmailEntity = {
  pagination: {
    pageCount: number;
  };
  results: {
    id: number;
    email: string;
  }[];
};

export const ExporterPage = () => {
  const client = getFetchClient();
  const [url, setUrl] = useState<string>("");

  const { refetch: fetchEmails, isLoading } = useQuery({
    queryKey: ["exporter"],
    enabled: false,
    queryFn: async () => {
      setUrl("");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let page = 0;
      let totalPages = -1;
      const emails: string[] = [];
      do {
        page = page + 1;
        const emailsResponse: EmailEntity = await client
          .get(
            `/content-manager/collection-types/api::email.email?${qs.stringify({
              page,
              pageSize: 10000,
            })}`
          )
          .then((res: any) => res.data);
        if (totalPages === -1) {
          console.log("totalPages");
          totalPages = emailsResponse.pagination.pageCount;
        }
        emails.push(...emailsResponse.results.map((r) => r.email));
      } while (page != totalPages);

      const emailCsv = ["Email", ...emails.map((email) => email)].join("\n");

      const blob = new Blob([emailCsv], {
        type: "text/csv",
      });

      const generatedUrl = URL.createObjectURL(blob);
      setUrl(generatedUrl);
    },
  });

  return (
    <div className="px-14 py-8">
      <div className="bg-white rounded overflow-hidden p-8">
        <h1 className="text-4xl font-semibold mb-4">Bulk Exporter</h1>
        <Button loading={isLoading} onClick={() => fetchEmails()}>
          {isLoading ? "Exporting.." : "Export"}
        </Button>
        {url && (
          <a
            className="p-2 rounded text-white bg-green-600 block w-fit text-xs mt-4 font-medium"
            href={url}
            download="emails.csv"
          >
            Download
          </a>
        )}
        <Link to={`/plugins/${pluginId}`} className="block mt-4 text-[#4945FF]">
          Switch to bulk importer
        </Link>
      </div>
    </div>
  );
};
