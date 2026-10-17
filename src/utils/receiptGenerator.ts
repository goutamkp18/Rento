import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Booking, StudentSubscription } from '../types';

/**
 * Formats a currency amount into Indian Rupee format (₹ X,XXX).
 */
export const formatINR = (amount: number): string => {
  return `₹ ${amount.toLocaleString('en-IN')}`;
};

/**
 * Sanitizes a string for safe inclusion in filenames.
 */
export const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Generates the complete, self-contained HTML for the StaySure Booking Payment Receipt
 * matching the exact styling and structure of StaySure_Booking_Payment_Receipt_Template.html.
 */
export const generateReceiptHtml = (booking: Booking): string => {
  const platformName = booking.platform_name || 'StaySure AI';
  const checkInRow = booking.check_in_date
    ? `<div class="field">
        <span class="label">Planned Check-in Date</span>
        <span class="value">${escapeHtml(booking.check_in_date)}</span>
      </div>`
    : '';

  const managerContact = booking.pg_contact ? escapeHtml(booking.pg_contact) : 'Available in student portal';
  const supportContact = booking.support_contact
    ? escapeHtml(booking.support_contact)
    : 'support@staysure.ai | +91 80 4567 8900';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(platformName)} - Booking Payment Receipt ${escapeHtml(booking.receipt_number)}</title>
  <style>
    :root {
      --navy: #17142b;
      --purple: #5e4aa3;
      --peach: #d7a17b;
      --ink: #29263a;
      --muted: #6d6878;
      --line: #e4dfec;
      --pale: #f5f3fa;
      --pale-peach: #fff4ea;
      --paid: #247a51;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .receipt {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      background: var(--navy);
      color: #ffffff;
      padding: 22px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      border-radius: 12px 12px 0 0;
    }
    .brand { font-weight: 800; letter-spacing: .04em; font-size: 24px; }
    .brand-sub { margin-top: 5px; color: var(--peach); font-size: 10px; font-weight: 700; letter-spacing: .14em; }
    .header-right { text-align: right; min-width: 170px; }
    .doc-title { font-size: 16px; line-height: 1.25; font-weight: 800; letter-spacing: .03em; }
    .receipt-no { margin-top: 8px; font-size: 11px; color: #e8e3f4; font-family: monospace; }
    .intro { padding: 18px 0 12px; display: flex; justify-content: space-between; align-items: center; gap: 18px; }
    .eyebrow { color: var(--purple); font-size: 10px; font-weight: 800; letter-spacing: .13em; }
    .subline { color: var(--muted); font-size: 11px; margin-top: 5px; }
    .status-chip {
      background: #eaf7f0;
      color: var(--paid);
      border: 1px solid #c6e7d4;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      padding: 6px 14px;
      letter-spacing: .08em;
      white-space: nowrap;
    }
    .section-label { color: var(--purple); font-size: 10px; letter-spacing: .1em; font-weight: 800; margin: 18px 0 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .panel { border: 1px solid var(--line); border-radius: 8px; padding: 13px 14px; min-width: 0; }
    .panel.soft { background: var(--pale); }
    .field { margin: 0 0 10px; min-width: 0; }
    .field:last-child { margin-bottom: 0; }
    .label { display: block; text-transform: uppercase; letter-spacing: .06em; font-size: 8px; color: var(--muted); font-weight: 800; margin-bottom: 4px; }
    .value { display: block; font-size: 11px; line-height: 1.35; font-weight: 600; overflow-wrap: anywhere; }
    .small-value { display: block; color: var(--muted); font-size: 9px; line-height: 1.4; margin-top: 3px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    th { background: var(--navy); color: #ffffff; text-align: left; font-size: 8px; letter-spacing: .07em; padding: 11px 12px; }
    th:last-child, td:last-child { text-align: right; white-space: nowrap; }
    td { padding: 11px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    .muted-row td { color: var(--muted); }
    .total-row {
      margin-top: 0;
      background: #f8f6f2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-top: 0;
      border-radius: 0 0 8px 8px;
    }
    .total-label { font-size: 11px; font-weight: 800; color: var(--navy); }
    .total-amount { font-size: 18px; font-weight: 800; color: var(--navy); }
    .payment-meta { margin-top: 10px; }
    .note { margin-top: 16px; border-left: 4px solid var(--peach); background: var(--pale-peach); padding: 13px 15px; border-radius: 0 8px 8px 0; }
    .note-title { font-size: 9px; font-weight: 800; letter-spacing: .08em; color: var(--navy); margin-bottom: 5px; }
    .note p { margin: 0; font-size: 10px; line-height: 1.5; color: var(--ink); }
    .footer { border-top: 1px solid var(--line); margin-top: 22px; padding-top: 12px; display: flex; justify-content: space-between; gap: 18px; color: var(--muted); font-size: 8px; line-height: 1.45; }
    .footer strong { color: var(--ink); }
    .receipt-code { text-align: right; white-space: nowrap; font-family: monospace; }
    .watermark-note { color: var(--muted); font-size: 8px; text-align: center; margin-top: 13px; }
    @page { size: A4; margin: 0; }
    @media print {
      body { padding: 0; }
      .receipt { max-width: 100%; box-shadow: none; padding: 12mm; }
    }
  </style>
</head>
<body>
  <main class="receipt" aria-label="Booking payment receipt">
    <header class="header">
      <div>
        <div class="brand">${escapeHtml(platformName)}</div>
        <div class="brand-sub">PG ACCOMMODATION BOOKING</div>
      </div>
      <div class="header-right">
        <div class="doc-title">BOOKING PAYMENT<br>RECEIPT</div>
        <div class="receipt-no">Receipt No. ${escapeHtml(booking.receipt_number)}</div>
      </div>
    </header>

    <section class="intro">
      <div>
        <div class="eyebrow">PAYMENT RECEIPT</div>
        <div class="subline">Booking fee for verified PG bed reservation</div>
      </div>
      <div class="status-chip">${escapeHtml(booking.verified_payment_status || 'PAID')}</div>
    </section>

    <div class="grid">
      <section class="panel soft">
        <div class="field">
          <span class="label">PG / Property Name</span>
          <span class="value">${escapeHtml(booking.pg_name)}</span>
          <span class="small-value">${escapeHtml(booking.pg_address || booking.pg_city_or_location)}</span>
        </div>
        <div class="field">
          <span class="label">Property Manager / Issuer</span>
          <span class="value">${escapeHtml(booking.pg_manager_name || 'Property Management')}</span>
          <span class="small-value">${managerContact}</span>
        </div>
      </section>
      <section class="panel">
        <div class="field">
          <span class="label">Receipt Date</span>
          <span class="value">${escapeHtml(booking.receipt_date)}</span>
        </div>
        <div class="field">
          <span class="label">Booking Reference</span>
          <span class="value">${escapeHtml(booking.id)}</span>
        </div>
        <div class="field">
          <span class="label">Room / Bed</span>
          <span class="value">${escapeHtml(booking.room_or_bed || 'Standard Bed')}</span>
        </div>
      </section>
    </div>

    <div class="section-label">BOOKING DETAILS</div>
    <section class="panel">
      <div class="grid">
        <div class="field">
          <span class="label">Booking Date</span>
          <span class="value">${escapeHtml(booking.booking_date)}</span>
        </div>
        ${checkInRow}
        <div class="field">
          <span class="label">Booking Status</span>
          <span class="value">${escapeHtml(booking.booking_status.toUpperCase())}</span>
        </div>
        <div class="field">
          <span class="label">Booking Reference</span>
          <span class="value">${escapeHtml(booking.id)}</span>
        </div>
      </div>
    </section>

    <div class="section-label">STUDENT DETAILS</div>
    <section class="panel">
      <div class="grid">
        <div class="field">
          <span class="label">Full Name</span>
          <span class="value">${escapeHtml(booking.student_name)}</span>
        </div>
        <div class="field">
          <span class="label">Phone Number</span>
          <span class="value">${escapeHtml(booking.student_phone || 'Not provided')}</span>
        </div>
        <div class="field">
          <span class="label">Email Address</span>
          <span class="value">${escapeHtml(booking.student_email)}</span>
        </div>
        <div class="field">
          <span class="label">Property Location</span>
          <span class="value">${escapeHtml(booking.pg_city_or_location || 'Bangalore')}</span>
        </div>
      </div>
    </section>

    <div class="section-label">PAYMENT DETAILS</div>
    <table aria-label="Payment breakdown">
      <thead>
        <tr><th>Description</th><th>Amount (INR)</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>PG bed booking fee</strong><br>
            <span class="small-value">Advance payment for the bed reservation only</span>
          </td>
          <td><strong>${formatINR(booking.booking_fee_inr)}</strong></td>
        </tr>
        <tr class="muted-row">
          <td>
            Monthly rent<br>
            <span class="small-value">${booking.monthly_rent_inr ? `Scheduled PG monthly rent: ${formatINR(booking.monthly_rent_inr)}/month` : 'Directly payable to PG manager'}</span>
          </td>
          <td>PAYABLE LATER</td>
        </tr>
      </tbody>
    </table>
    <section class="total-row">
      <div class="total-label">TOTAL PAID NOW</div>
      <div class="total-amount">${formatINR(booking.total_paid_inr)}</div>
    </section>

    <div class="grid payment-meta">
      <section class="panel">
        <div class="field">
          <span class="label">Payment Gateway</span>
          <span class="value">${escapeHtml(booking.payment_gateway)}</span>
        </div>
        <div class="field">
          <span class="label">Payment / Transaction Reference</span>
          <span class="value">${escapeHtml(booking.payment_reference)}</span>
        </div>
      </section>
      <section class="panel">
        <div class="field">
          <span class="label">Payment Date &amp; Time</span>
          <span class="value">${escapeHtml(booking.payment_datetime)}</span>
        </div>
        <div class="field">
          <span class="label">Verified Payment Status</span>
          <span class="value">${escapeHtml(booking.verified_payment_status)}</span>
        </div>
      </section>
    </div>

    <section class="note">
      <div class="note-title">IMPORTANT PAYMENT NOTICE</div>
      <p><strong>Monthly rent has to be paid later.</strong> This receipt records only the booking fee shown above. Monthly rent is not included in this payment and must be paid separately under the PG's agreed payment terms.</p>
    </section>

    <footer class="footer">
      <div>
        <strong>Thank you for choosing ${escapeHtml(platformName)}.</strong><br>
        For booking support: ${supportContact}<br>
        This receipt is generated from the booking and verified payment record.
      </div>
      <div class="receipt-code">
        Receipt: ${escapeHtml(booking.receipt_number)}<br>
        Booking: ${escapeHtml(booking.id)}<br>
        Currency: INR
      </div>
    </footer>
    <div class="watermark-note">Booking payment receipt only. Not a monthly rent receipt or tax invoice unless separately configured and legally applicable.</div>
  </main>
</body>
</html>`;
};

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates and downloads a real, print-perfect PDF from a booking record
 * formatted according to StaySure_Booking_Payment_Receipt_Template.html.
 */
export const downloadBookingPdf = async (booking: Booking): Promise<void> => {
  // Create an off-screen container for rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // ~210mm at 96 DPI (Standard A4 width)
  container.style.background = '#ffffff';
  container.style.color = '#29263a';
  container.style.zIndex = '-99999';

  // Inject receipt HTML
  container.innerHTML = generateReceiptHtml(booking);
  document.body.appendChild(container);

  try {
    const receiptElement = container.querySelector('.receipt') as HTMLElement || container;

    // Use html2canvas at scale 2.0 for razor-sharp vector-like typography
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800,
    });

    const imgData = canvas.toDataURL('image/png');

    // Create jsPDF A4 document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // If the receipt exceeds one page (e.g. lots of custom fields)
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    const filename = `StaySure_Booking_Receipt_${sanitizeFilename(booking.id)}.pdf`;
    pdf.save(filename);
  } finally {
    // Clean up DOM container
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

/**
 * Opens the receipt in a clean printable window.
 */
export const openReceiptWindow = (booking: Booking): void => {
  const html = generateReceiptHtml(booking);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

/**
 * Generates and downloads an authoritative PDF receipt for the ₹9 Student Access Pass.
 * Saves the file directly to the user's local folder.
 */
export const downloadStudentPassPdf = async (sub: StudentSubscription): Promise<void> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 36px; background: #ffffff; color: #1e1b4b; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e0e7ff; padding-bottom: 20px; }
    .brand { font-size: 26px; font-weight: 900; color: #4338ca; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .title-row { margin-top: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-top: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .field-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .table th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-radius: 8px 8px 0 0; }
    .table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .total-row td { font-size: 14px; font-weight: 900; color: #4338ca; border-top: 2px solid #c7d2fe; border-bottom: none; }
    .features { margin-top: 24px; padding: 18px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 14px; }
    .features-title { font-size: 12px; font-weight: 800; color: #3730a3; text-transform: uppercase; margin-bottom: 8px; }
    .features-list { margin: 0; padding-left: 18px; font-size: 11px; color: #312e81; line-height: 1.6; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">RENTO</div>
      <div style="font-size: 11px; color: #64748b; font-weight: 600;">Verified Student Accommodation Platform</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">PAID • ACTIVE • LIFETIME ACCESS</span>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Receipt Ref: ${escapeHtml(sub.payment_reference || sub.id || 'TXN-STU-PASS')}</div>
    </div>
  </div>

  <div class="title-row">
    <h1 class="title">Official Student Access Pass Receipt</h1>
    <p class="subtitle">Tax invoice &amp; proof of all-access entitlement for verified student resident</p>
  </div>

  <div class="card">
    <div class="grid">
      <div>
        <div class="field-label">Student Name</div>
        <div class="field-value">${escapeHtml(sub.student_name || 'Student Resident')}</div>
      </div>
      <div>
        <div class="field-label">Registered Email</div>
        <div class="field-value">${escapeHtml(sub.student_email || 'Attached to active session')}</div>
      </div>
      <div>
        <div class="field-label">Plan Name</div>
        <div class="field-value">₹ 9 Student All-Access Pass</div>
      </div>
      <div>
        <div class="field-label">Payment Mode &amp; Date</div>
        <div class="field-value">${escapeHtml(sub.payment_method?.toUpperCase() || 'UPI')} • ${new Date(sub.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>Fee Breakdown Item</th>
        <th style="text-align: right;">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Student All-Access Pass</strong><br><span style="font-size: 10px; color: #64748b;">Direct owner messaging, bed bookings, live location &amp; comparisons</span></td>
        <td style="text-align: right; font-weight: 600;">₹ 7.63</td>
      </tr>
      <tr>
        <td><strong>Goods &amp; Services Tax (18% GST)</strong><br><span style="font-size: 10px; color: #64748b;">Statutory CGST 9% + SGST 9% / IGST 18%</span></td>
        <td style="text-align: right; font-weight: 600;">₹ 1.37</td>
      </tr>
      <tr class="total-row">
        <td>Total Paid Amount</td>
        <td style="text-align: right;">₹ 9.00</td>
      </tr>
    </tbody>
  </table>

  <div class="features">
    <div class="features-title">Unlocked Entitlements Confirmed:</div>
    <ul class="features-list">
      <li><strong>Online Bed Reservations:</strong> Book student beds directly with verified deposit tracking</li>
      <li><strong>Direct Owner Queries:</strong> Send questions &amp; chat directly with verified property managers</li>
      <li><strong>Physical Room Visits:</strong> Schedule in-person property walkthrough appointments</li>
      <li><strong>Live GPS &amp; Maps Navigation:</strong> Full street address, landmark &amp; Google Maps navigation unlocked</li>
      <li><strong>Multi-PG Comparisons:</strong> Compare up to 3 student accommodations side-by-side</li>
    </ul>
  </div>

  <div class="footer">
    This is an authoritative computer-generated payment voucher issued by Rento Student Living Services.<br>
    Support: support@rento.dev • Website: rento.dev
  </div>
</body>
</html>`;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');

    const filename = `Rento_Student_Pass_Receipt_${sanitizeFilename(sub.payment_reference || sub.id || 'pass')}.pdf`;
    pdf.save(filename);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};
