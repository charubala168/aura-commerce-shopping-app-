import { jsPDF } from 'jspdf';
import type { OrderRecord } from '../types/ecommerce.ts';

export function downloadOrderInvoicePdf(order: OrderRecord) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 56;

  // Brand Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('AURA COMMERCE', 48, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Architectural Objects & Living', 48, y + 18);

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`INVOICE ${order.invoiceNumber}`, pageWidth - 48, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Order: ${order.orderNumber}`, pageWidth - 48, y + 16, { align: 'right' });
  doc.text(
    `Date: ${new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`,
    pageWidth - 48,
    y + 30,
    { align: 'right' }
  );

  y += 58;
  doc.setDrawColor(220, 220, 220);
  doc.line(48, y, pageWidth - 48, y);
  y += 24;

  // Billing / Shipping details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SHIP TO', 48, y);
  doc.text('PAYMENT SUMMARY', pageWidth / 2 + 20, y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(order.shippingAddress.fullName, 48, y);
  doc.text(order.shippingAddress.line1, 48, y + 14);
  doc.text(
    `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
    48,
    y + 28
  );
  doc.text(order.shippingAddress.country, 48, y + 42);
  doc.text(`Tel: ${order.shippingAddress.phone}`, 48, y + 56);

  doc.text(`Method: ${order.paymentMethod}`, pageWidth / 2 + 20, y);
  doc.text(`Payment Status: ${order.paymentStatus}`, pageWidth / 2 + 20, y + 14);
  doc.text(`Order Status: ${order.status}`, pageWidth / 2 + 20, y + 28);
  doc.text(`Tracking: ${order.trackingNumber}`, pageWidth / 2 + 20, y + 42);

  y += 86;

  // Table header
  doc.setFillColor(245, 243, 239);
  doc.rect(48, y - 14, pageWidth - 96, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ITEM', 56, y + 2);
  doc.text('VARIANT', 270, y + 2);
  doc.text('QTY', 390, y + 2, { align: 'right' });
  doc.text('UNIT', 460, y + 2, { align: 'right' });
  doc.text('TOTAL', pageWidth - 56, y + 2, { align: 'right' });

  y += 26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const fmt = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

  for (const item of order.items) {
    const variantStr = [item.variant.size, item.variant.color, item.variant.finish]
      .filter(Boolean)
      .join(' / ');
    doc.text(item.name.slice(0, 36), 56, y);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text((variantStr || 'Standard').slice(0, 26), 270, y);
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.text(String(item.quantity), 390, y, { align: 'right' });
    doc.text(fmt(item.unitPrice), 460, y, { align: 'right' });
    doc.text(fmt(item.lineTotal), pageWidth - 56, y, { align: 'right' });
    y += 22;
    doc.setDrawColor(238, 238, 238);
    doc.line(48, y - 8, pageWidth - 48, y - 8);
  }

  y += 14;
  const labelX = pageWidth - 190;
  const valX = pageWidth - 56;

  doc.setFontSize(10);
  doc.text('Subtotal', labelX, y);
  doc.text(fmt(order.subtotal), valX, y, { align: 'right' });
  y += 18;
  doc.text('Estimated Tax (8%)', labelX, y);
  doc.text(fmt(order.tax), valX, y, { align: 'right' });
  y += 18;
  doc.text('Shipping', labelX, y);
  doc.text(order.shippingFee === 0 ? 'Complimentary' : fmt(order.shippingFee), valX, y, {
    align: 'right',
  });
  y += 22;
  doc.setDrawColor(180, 180, 180);
  doc.line(labelX, y - 10, valX, y - 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', labelX, y + 4);
  doc.text(fmt(order.total), valX, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Thank you for collecting with Aura Commerce. Keep this invoice for warranty and return services.',
    48,
    doc.internal.pageSize.getHeight() - 48
  );

  doc.save(`${order.invoiceNumber}.pdf`);
}
