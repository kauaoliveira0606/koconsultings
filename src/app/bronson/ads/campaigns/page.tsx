import { redirect } from "next/navigation";

/** Campaigns now live on the Ads tab (campaign + ad tables). */
export default function CampaignsPage() {
  redirect("/bronson/ads");
}
