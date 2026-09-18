import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "BR Travels — Book a Ride" },
      {
        name: "description",
        content: "Book a BR Travels ride with live mapping, clear fares, and premium vehicle options.",
      },
      { property: "og:title", content: "BR Travels — Book a Ride" },
      {
        property: "og:description",
        content: "Book a BR Travels ride with live mapping, clear fares, and premium vehicle options.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
