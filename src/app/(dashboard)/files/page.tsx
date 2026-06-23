import { redirect } from "next/navigation";
import { IMPORTANT_DOCS_SLUG } from "@/lib/files/types";

export default function FilesIndexPage() {
  redirect(`/files/${IMPORTANT_DOCS_SLUG}`);
}
