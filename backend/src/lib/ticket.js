import PDFDocument from 'pdfkit';

const COMPANY = process.env.COMPANY_NAME || 'BusGo';

export function buildTicketPdf(booking) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const s = booking.schedules;
    const route = s?.routes;
    const bus = s?.buses;
    const fmt = (d) => new Date(d).toLocaleString();

    doc.fontSize(20).text(`${COMPANY} — E-Ticket`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#555')
      .text(`Booking ID: ${booking.id}`)
      .text(`Status: ${booking.status.toUpperCase()}`)
      .text(`Payment ref: ${booking.payment_ref || '-'}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(12)
      .text(`${route?.origin?.name || '?'}  ->  ${route?.dest?.name || '?'}`)
      .text(`Bus: ${bus?.reg_no || '-'}${bus?.label ? ` (${bus.label})` : ''} - ${bus?.bus_type || '-'}`)
      .text(`Departure: ${fmt(s?.departure_at)}`)
      .text(`Arrival: ${fmt(s?.arrival_at)}`);
    doc.moveDown();

    doc.fontSize(12).text('Passengers', { underline: true });
    (booking.booking_seats || []).forEach((bs) => {
      doc.fontSize(11).text(
        `  Seat ${bs.seat_no}  -  ${bs.passenger_name}` +
        `${bs.passenger_age ? `, ${bs.passenger_age}` : ''}` +
        `${bs.passenger_gender ? `, ${bs.passenger_gender}` : ''}`
      );
    });
    doc.moveDown();
    doc.fontSize(12).text(`Total paid: ${Number(booking.total_amount).toFixed(2)}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#888')
      .text('This is a mock ticket generated for a demo application.', { align: 'center' });

    doc.end();
  });
}
