export function currency(value: number) {
  return `P${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)}`;
}

export function number(value: number) {
  return new Intl.NumberFormat("en-PH").format(value);
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
