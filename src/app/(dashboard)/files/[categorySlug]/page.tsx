import { notFound } from "next/navigation";
import { FilesClient } from "@/components/files/FilesClient";
import { isFileCategorySlug } from "@/lib/files/routes";

export default async function FilesCategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  if (!isFileCategorySlug(categorySlug)) notFound();

  return <FilesClient categorySlug={categorySlug} />;
}
