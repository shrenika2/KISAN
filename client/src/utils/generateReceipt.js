import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * @param {object} order — populated product_id, farmer_id, consumer_id
 */
export function downloadInvoice(order) {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    const itemName = order.product_id?.crop_name || 'Produce';
    const qty = order.requested_quantity ?? 0;
    const ratePerKg = order.final_price || order.negotiated_price || order.original_price || 0;
    const totalAmount = Number(ratePerKg) * Number(qty);
    const farmer = order.farmer_id;
    const buyer = order.consumer_id;
    const farmerName = farmer?.name || 'Seller';
    const farmerPlace = [farmer?.village, farmer?.district].filter(Boolean).join(', ') || '—';
    const buyerName = buyer?.name || 'Buyer';
    const txId = String(order._id);

    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, pageW, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Kisan (Farm2Door) - Official Transaction Receipt', pageW / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Digitally Verified via Secure OTP Handshake', pageW / 2, 30, { align: 'center' });

    let y = 52;
    doc.setTextColor(35, 35, 35);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction ID', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(txId, margin + 42, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Date', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(
        new Date(
            order.receiptGeneratedAt || order.completed_at || order.updatedAt || order.order_date
        ).toLocaleString(),
        margin + 42,
        y
    );

    y += 14;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Participants', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Seller: ${farmerName}, ${farmerPlace}`, margin, y);
    y += 6;
    doc.text(`Buyer: ${buyerName}`, margin, y);

    y += 12;
    autoTable(doc, {
        startY: y,
        head: [['Item', 'Quantity', 'Rate (per kg)', 'Total Amount']],
        body: [
            [
                itemName,
                `${qty} kg`,
                `Rs. ${Number(ratePerKg).toFixed(2)}`,
                `Rs. ${totalAmount.toFixed(2)}`
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        margin: { left: margin, right: margin }
    });

    const afterTable = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : y + 36;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text(`Grand total: Rs. ${totalAmount.toFixed(2)}`, margin, afterTable);

    const stampX = pageW / 2;
    const stampY = pageH / 2 + 12;
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID & DELIVERED', stampX, stampY, { align: 'center', angle: -16 });
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.75);
    doc.rect(stampX - 50, stampY - 14, 100, 24, 'S');

    const footY = pageH - 16;
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
        'Thank you for supporting local agriculture. This is a computer-generated receipt.',
        pageW / 2,
        footY,
        { align: 'center' }
    );

    doc.save(`Kisan-Farm2Door-Receipt-${txId.slice(-8)}.pdf`);
}
