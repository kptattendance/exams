// Alphabetical order for drop-down lists (departments, roles …).
// Works for { value, label }, { code, name } and [value, label] entries;
// an empty "Select …" / "All …" entry stays first.
//   const departments = [...];  departments.sort(sortOptions);

const parts = (o) => (Array.isArray(o) ? [o[0], o[1]] : [o.value ?? o.code ?? "", o.label ?? o.name ?? ""]);

export function sortOptions(a, b) {
  const [va, la] = parts(a);
  const [vb, lb] = parts(b);
  if (va === "" && vb !== "") return -1;
  if (vb === "" && va !== "") return 1;
  return String(la).localeCompare(String(lb), "en", { sensitivity: "base" });
}
