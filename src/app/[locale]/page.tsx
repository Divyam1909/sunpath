import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("brand");
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-medium">{t("name")}</h1>
    </main>
  );
}
