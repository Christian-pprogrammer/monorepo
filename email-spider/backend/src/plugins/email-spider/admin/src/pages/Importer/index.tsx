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
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

type ImportForm = {
  content: string;
  location: string;
};

export const ImporterPage = () => {
  const client = getFetchClient();
  const { refetch: fetchStatus, data: activeJobs } = useQuery({
    queryKey: [],
    queryFn: async () => {
      const no = await fetch("/api/keywords/active").then((res) => res.json());
      return no;
    },
    enabled: false,
    initialData: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetch]);

  const { register, handleSubmit } = useForm<ImportForm>();

  const {
    mutateAsync: addKeywords,
    isPending: isLoading,
    isSuccess,
    reset,
  } = useMutation({
    mutationFn: async (data: ImportForm) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const keywords = data.content.split("\n").filter((k) => k.trim() !== "");
      for (const keyword of keywords) {
        await client.post(
          `/content-manager/collection-types/api::keyword.keyword`,
          {
            search: keyword,
            ...(data.location && { location: data.location }),
          }
        );
      }
    },
    mutationKey: [],
  });

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        reset();
      }, 2000);
    }
  }, [isSuccess]);

  async function onSubmit(data: ImportForm) {
    await addKeywords(data);
  }

  return (
    <div className="px-14 py-8">
      <div className="bg-white rounded overflow-hidden p-8 grid grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold mb-4">Bulk Importer</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="max-w-[400px]">
            <div className="mb-4">
              <label className="font-medium block mb-2">Content</label>
              <textarea
                className="block bg-gray-100 outline-none p-2 w-full"
                rows={4}
                {...register("content", { required: "This field is required" })}
              />
            </div>
            <div className="mb-4">
              <label className="font-medium block mb-2">Location</label>
              <input
                type="text"
                placeholder="Location (Optional)"
                className="block bg-gray-100 outline-none p-2 w-full"
                {...register("location")}
              />
            </div>
            <Button type="submit" loading={isLoading}>
              {isSuccess ? "Sent" : "Submit"}
            </Button>
          </form>
          <Link
            to={`/plugins/${pluginId}/exporter`}
            className="block mt-4 text-[#4945FF]"
          >
            Switch to bulk exporter
          </Link>
        </div>
        <div>
          <p>Active Jobs: {activeJobs}</p>
        </div>
      </div>
    </div>
  );
};
