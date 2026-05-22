export function currency(value: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(value);
}

export function number(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
