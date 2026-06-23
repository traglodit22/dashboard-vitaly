import { redirect } from "next/navigation";
import { CLOUD_SLUG } from "@/lib/files/types";

export default function FilesIndexPage() {
  redirect(`/files/${CLOUD_SLUG}`);
}
