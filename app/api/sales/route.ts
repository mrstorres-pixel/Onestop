import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

type SaleBodyItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const saleType = searchParams.get("saleType");
  const search = searchParams.get("search")?.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let salesQuery = adminSupabase
    .from("wholesale_sales")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (startDate) salesQuery = salesQuery.gte("created_at", `${startDate}T00:00:00.000Z`);
  if (endDate) salesQuery = salesQuery.lt("created_at", nextDate(endDate));
  if (saleType === "pos" || saleType === "wholesale") salesQuery = salesQuery.eq("sale_type", saleType);
  if (search) {
    const escaped = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    salesQuery = salesQuery.or(`invoice_no.ilike.%${escaped}%,buyer_name.ilike.%${escaped}%,payment_method.ilike.%${escaped}%`);
  }

  const { data: sales, error: salesError, count } = await salesQuery.range(from, to);

  if (salesError) return NextResponse.json({ error: salesError.message }, { status: 400 });

  const saleIds = (sales ?? []).map((sale) => sale.id);
  const { data: items, error: itemsError } = saleIds.length
    ? await adminSupabase.from("wholesale_sale_items").select("*").in("sale_id", saleIds)
    : { data: [], error: null };

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  return NextResponse.json({
    invoices: (sales ?? []).map((sale) => ({
      ...sale,
      items: (items ?? [])
        .filter((item) => item.sale_id === sale.id)
        .map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          barcode: item.barcode,
          expiry_date: item.expiry_date,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        }))
    })),
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize))
    }
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const items = (body.items ?? []) as SaleBodyItem[];
  if (!items.length) return NextResponse.json({ error: "Add at least one product to the sale." }, { status: 400 });

  const productIds = items.map((item) => item.productId);
  const requestedByProduct = items.reduce<Record<string, number>>((totals, item) => {
    totals[item.productId] = (totals[item.productId] ?? 0) + Math.max(1, Number(item.quantity ?? 1));
    return totals;
  }, {});

  const { data: products, error: productError } = await adminSupabase
    .from("products")
    .select("id, name, barcode, expiry_date, stock")
    .in("id", productIds);

  if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });

  let saleItems;
  try {
    saleItems = items.map((item) => {
      const product = products?.find((row) => row.id === item.productId);
      if (!product) throw new Error("One selected product no longer exists.");
      if (Number(product.stock) < requestedByProduct[item.productId]) throw new Error(`${product.name} only has ${product.stock} in stock.`);
      const quantity = Math.max(1, Number(item.quantity));
      const unitPrice = Math.max(0, Number(item.unitPrice));
      return {
        product,
        quantity,
        unitPrice,
        subtotal: quantity * unitPrice
      };
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate sale." }, { status: 400 });
  }

  const subtotal = saleItems.reduce((total, item) => total + item.subtotal, 0);
  const vatRate = Number(body.vatRate ?? 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;
  const invoiceNo = `DR-${Date.now().toString().slice(-8)}`;
  const saleType = body.saleType === "pos" ? "pos" : "wholesale";

  const { data: sale, error: saleError } = await adminSupabase
    .from("wholesale_sales")
    .insert({
      invoice_no: invoiceNo,
      sale_type: saleType,
      buyer_name: String(body.buyerName ?? "Walk-in buyer").trim(),
      buyer_address: String(body.buyerAddress ?? "").trim() || null,
      buyer_phone: String(body.buyerPhone ?? "").trim() || null,
      payment_method: String(body.paymentMethod ?? "Cash"),
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      created_by: user.id
    })
    .select("*")
    .single();

  if (saleError) return NextResponse.json({ error: saleError.message }, { status: 400 });

  const itemPayload = saleItems.map((item) => ({
    sale_id: sale.id,
    product_id: item.product.id,
    product_name: item.product.name,
    barcode: item.product.barcode,
    expiry_date: item.product.expiry_date,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.subtotal
  }));

  const { error: itemError } = await adminSupabase.from("wholesale_sale_items").insert(itemPayload);
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });

  await adminSupabase.from("stock_movements").insert(
    saleItems.map((item) => ({
      product_id: item.product.id,
      type: "sale",
      quantity: -item.quantity,
      reason: "Wholesale delivery receipt",
      reference: invoiceNo
    }))
  );

  await adminSupabase.from("audit_logs").insert({
    action: "Wholesale sale created",
    detail: `${invoiceNo} was created for ${sale.buyer_name}.`,
    entity_type: "wholesale_sales",
    entity_id: sale.id
  });

  return NextResponse.json({
    invoice: {
      ...sale,
      items: itemPayload.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        barcode: item.barcode,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal
      }))
    }
  });
}
