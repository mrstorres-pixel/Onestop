import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

type SaleBodyItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const { data: sales, error: salesError } = await adminSupabase
    .from("wholesale_sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

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
    }))
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
