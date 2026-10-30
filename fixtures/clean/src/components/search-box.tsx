"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form role="search" onSubmit={onSubmit}>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" />
    </form>
  );
}
