"use client";

import { useEffect, useState } from "react";

export default function ManagedSchoolSelect({
  defaultValue = "",
  required = true,
}: {
  defaultValue?: string;
  required?: boolean;
}) {
  const [schools, setSchools] = useState<string[]>([]);
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/schools", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { schools?: Array<{ name: string }> };
        if (!response.ok) return;
        if (!active) return;
        const names = (result.schools ?? []).map((school) => school.name);
        setSchools(names);
        const match = names.find((name) => name.toLowerCase() === defaultValue.trim().toLowerCase());
        if (match) setValue(match);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [defaultValue]);

  const legacy = value && !schools.some((school) => school.toLowerCase() === value.toLowerCase());
  return (
    <label>
      School
      <select name="school" value={value} onChange={(event) => setValue(event.target.value)} required={required}>
        <option value="">{loading ? "Loading schools…" : "Select a school"}</option>
        {legacy && <option value={value}>{value} (existing value)</option>}
        {schools.map((school) => <option value={school} key={school}>{school}</option>)}
      </select>
    </label>
  );
}
