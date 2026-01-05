export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { Categories } from "./_components/categories";
import { SearchInput } from "@/components/search-input";
import { getCourses } from "@/actions/get-courses";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CoursesList } from "@/components/courses-list";

interface SearchPageProps {
  searchParams: Promise<{
    title?: string;
    categoryId?: string;
  }>;
}

const SearchPage = async ({ searchParams }: SearchPageProps) => {
  const resolvedSearchParams = await searchParams;

  const { userId } = await auth();
  if (!userId) {
    return redirect("/");
  }

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  const courses = await getCourses({
    userId,
    ...resolvedSearchParams,
  });

  return (
    <Suspense fallback={<div className="p-6">Loading search…</div>}>
      <div className="px-6 pt-6 md:hidden block">
        <SearchInput />
      </div>

      <div className="p-6 space-y-4">
        <Categories items={categories} />
        <CoursesList items={courses} />
      </div>
    </Suspense>
  );
};

export default SearchPage;
