/**
 * PDF Invoice Service
 * Generates professional, KRA-compliant HTML invoices and customer statements.
 * Rendered as HTML with print-optimized CSS — no external PDF library needed.
 * Customers can open in browser and print/save as PDF.
 */

async function getCompanySettings() {
  const defaults = {
    name: 'Your ISP Company',
    address: 'Nairobi, Kenya',
    phone: '+254 700 000 000',
    email: 'billing@yourcompany.co.ke',
    kra_pin: 'P051234567A',
    paybill: '000000',
    abbreviation: 'ISP',
  };

  if (!global.dbAvailable || !global.db) return defaults;

  try {
    const result = await global.db.query(
      `SELECT key, value FROM settings
       WHERE key IN ('company_name','company_address','company_phone','company_email','kra_pin','mpesa_paybill','company_abbreviation')`
    );
    const map = {};
    for (const row of result.rows) map[row.key] = row.value;
    return {
      name: map.company_name || defaults.name,
      address: map.company_address || defaults.address,
      phone: map.company_phone || defaults.phone,
      email: map.company_email || defaults.email,
      kra_pin: map.kra_pin || defaults.kra_pin,
      paybill: map.mpesa_paybill || defaults.paybill,
      abbreviation: map.company_abbreviation || defaults.abbreviation,
    };
  } catch {
    return defaults;
  }
}

function fmt(amount) {
  return 'KES ' + (parseFloat(amount) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function statusBadge(status) {
  const colors = {
    paid: '#00c851',
    pending: '#ff8800',
    overdue: '#cc0000',
    partial: '#3399ff',
    cancelled: '#888888',
  };
  const color = colors[status?.toLowerCase()] || '#888888';
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${color};color:#fff;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">${status || 'pending'}</span>`;
}

function generateInvoiceHTML(invoice, company) {
  const isOverdue = invoice.status !== 'paid' && new Date(invoice.due_date) < new Date();
  const effectiveStatus = isOverdue && invoice.status === 'pending' ? 'overdue' : invoice.status;

  const subtotal = parseFloat(invoice.amount) || 0;
  const taxRate = parseFloat(invoice.tax_rate) || 0;
  const taxAmount = parseFloat(invoice.tax) || (subtotal * taxRate / 100);
  const total = parseFloat(invoice.total) || (subtotal + taxAmount);
  const paidAmount = parseFloat(invoice.paid_amount) || 0;
  const balance = total - paidAmount;

  // Build line items
  const itemDescription = invoice.notes || `Internet service subscription`;
  const isPaid = effectiveStatus === 'paid';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invoice.invoice_number} — ${company.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #333; background: #f4f4f4; }
  .page { max-width: 800px; margin: 30px auto; background: #fff; padding: 48px; box-shadow: 0 4px 24px rgba(0,0,0,.12); border-radius: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0052cc; padding-bottom: 24px; margin-bottom: 32px; }
  .company-name { font-size: 26px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px; }
  .company-details { font-size: 12px; color: #666; line-height: 1.6; margin-top: 6px; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #111; letter-spacing: 1px; }
  .invoice-number { font-size: 14px; color: #0052cc; font-weight: 600; margin-top: 4px; }
  .invoice-dates { font-size: 12px; color: #555; margin-top: 8px; line-height: 1.8; }
  .billing-section { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .billing-block h4 { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .billing-block .name { font-size: 16px; font-weight: 700; color: #111; }
  .billing-block .detail { font-size: 12px; color: #555; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #0052cc; color: #fff; }
  thead th { padding: 12px 14px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: .5px; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #eee; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody td { padding: 12px 14px; font-size: 13px; }
  tbody td:last-child { text-align: right; font-weight: 500; }
  .totals { margin-left: auto; width: 300px; }
  .totals-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .totals-row.total { font-size: 16px; font-weight: 800; color: #0052cc; border-top: 2px solid #0052cc; border-bottom: none; padding-top: 12px; margin-top: 4px; }
  .totals-row.balance { font-size: 14px; font-weight: 700; color: #cc0000; }
  .payment-info { margin-top: 32px; padding: 20px; background: #f0f6ff; border-left: 4px solid #0052cc; border-radius: 4px; }
  .payment-info h4 { font-size: 13px; font-weight: 700; color: #0052cc; margin-bottom: 10px; }
  .payment-info p { font-size: 12px; color: #444; line-height: 1.8; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 11px; color: #999; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 96px; font-weight: 900; color: rgba(0,200,80,.08); pointer-events: none; z-index: 0; letter-spacing: 4px; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; padding: 32px; border-radius: 0; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 20mm; }
  }
</style>
</head>
<body>
${isPaid ? '<div class="watermark">PAID</div>' : ''}
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${company.name}</div>
      <div class="company-details">
        ${company.address}<br>
        Tel: ${company.phone} | Email: ${company.email}<br>
        KRA PIN: ${company.kra_pin}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">TAX INVOICE</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div class="invoice-dates">
        <strong>Date:</strong> ${fmtDate(invoice.created_at)}<br>
        <strong>Due Date:</strong> ${fmtDate(invoice.due_date)}<br>
        <strong>Status:</strong> ${statusBadge(effectiveStatus)}
      </div>
    </div>
  </div>

  <!-- Billing Info -->
  <div class="billing-section">
    <div class="billing-block">
      <h4>Bill To</h4>
      <div class="name">${invoice.customer_name || 'Customer'}</div>
      <div class="detail">
        ${invoice.customer_phone ? `Tel: ${invoice.customer_phone}<br>` : ''}
        ${invoice.customer_email ? `Email: ${invoice.customer_email}<br>` : ''}
        ${invoice.customer_address ? `${invoice.customer_address}, ${invoice.customer_city || ''}` : ''}
      </div>
    </div>
    <div class="billing-block" style="text-align:right;">
      <h4>Payment Details</h4>
      <div class="detail">
        M-Pesa Paybill: <strong>${company.paybill}</strong><br>
        Account No: <strong>${invoice.invoice_number}</strong><br>
        Amount Due: <strong style="color:#cc0000;">${fmt(balance)}</strong>
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="width:50%;">Description</th>
        <th>Period</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${itemDescription}</td>
        <td>${fmtDate(invoice.created_at).split(' ').slice(1).join(' ')}</td>
        <td>1</td>
        <td>${fmt(subtotal)}</td>
        <td>${fmt(subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>${fmt(subtotal)}</span>
    </div>
    ${taxRate > 0 ? `<div class="totals-row">
      <span>VAT (${taxRate}%)</span>
      <span>${fmt(taxAmount)}</span>
    </div>` : ''}
    <div class="totals-row total">
      <span>TOTAL</span>
      <span>${fmt(total)}</span>
    </div>
    ${paidAmount > 0 ? `<div class="totals-row">
      <span>Amount Paid</span>
      <span style="color:#00c851;">(${fmt(paidAmount)})</span>
    </div>
    <div class="totals-row balance">
      <span>Balance Due</span>
      <span>${fmt(balance)}</span>
    </div>` : ''}
  </div>

  <!-- Payment Instructions -->
  ${!isPaid ? `<div class="payment-info">
    <h4>📱 How to Pay via M-Pesa</h4>
    <p>
      1. Go to M-Pesa → Lipa na M-Pesa → Pay Bill<br>
      2. Business No: <strong>${company.paybill}</strong><br>
      3. Account No: <strong>${invoice.invoice_number}</strong><br>
      4. Amount: <strong>${fmt(balance)}</strong><br>
      5. Enter your M-Pesa PIN and confirm
    </p>
  </div>` : `<div class="payment-info" style="background:#f0fff4;border-color:#00c851;">
    <h4 style="color:#00a651;">✅ Payment Received — Thank You!</h4>
    <p>This invoice has been fully paid. Thank you for your timely payment.</p>
  </div>`}

  <!-- Footer -->
  <div class="footer">
    <div>KRA PIN: ${company.kra_pin} | This is a computer-generated tax invoice</div>
    <div>Generated: ${new Date().toLocaleDateString('en-KE')}</div>
  </div>
</div>

<div class="no-print" style="text-align:center;padding:16px;background:#222;color:#fff;">
  <button onclick="window.print()" style="padding:10px 24px;background:#0052cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
    🖨️ Print / Save as PDF
  </button>
</div>
</body>
</html>`;
}

function generateStatementHTML(customer, invoices, payments, company) {
  // Sort all events chronologically
  const events = [
    ...invoices.map(i => ({ type: 'invoice', date: new Date(i.created_at), data: i })),
    ...payments.map(p => ({ type: 'payment', date: new Date(p.received_at || p.created_at), data: p })),
  ].sort((a, b) => a.date - b.date);

  let runningBalance = 0;
  let rows = '';

  for (const event of events) {
    if (event.type === 'invoice') {
      const inv = event.data;
      const total = parseFloat(inv.total) || 0;
      runningBalance += total;
      rows += `<tr>
        <td>${fmtDate(inv.created_at)}</td>
        <td>${inv.invoice_number}</td>
        <td style="color:#cc4400;">${fmt(total)}</td>
        <td>—</td>
        <td style="font-weight:600;">${fmt(runningBalance)}</td>
        <td>${statusBadge(inv.status)}</td>
      </tr>`;
    } else {
      const pay = event.data;
      const amount = parseFloat(pay.amount) || 0;
      runningBalance -= amount;
      rows += `<tr>
        <td>${fmtDate(pay.received_at)}</td>
        <td>${pay.receipt_number || pay.reference || '—'}</td>
        <td>—</td>
        <td style="color:#007733;">${fmt(amount)}</td>
        <td style="font-weight:600;${runningBalance < 0 ? 'color:#007733;' : ''}">${fmt(Math.abs(runningBalance))}${runningBalance < 0 ? ' CR' : ''}</td>
        <td><span style="display:inline-block;padding:3px 10px;border-radius:12px;background:#00c851;color:#fff;font-size:11px;font-weight:700;">Payment</span></td>
      </tr>`;
    }
  }

  const totalInvoiced = invoices.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const outstanding = totalInvoiced - totalPaid;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Account Statement — ${customer.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; color:#333; background:#f4f4f4; }
  .page { max-width:900px; margin:30px auto; background:#fff; padding:48px; box-shadow:0 4px 24px rgba(0,0,0,.12); border-radius:4px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0052cc; padding-bottom:24px; margin-bottom:32px; }
  .company-name { font-size:26px; font-weight:800; color:#0052cc; }
  .stmt-title { font-size:22px; font-weight:700; color:#111; }
  .summary { display:flex; gap:20px; margin-bottom:32px; }
  .summary-card { flex:1; padding:16px; background:#f8f9fa; border-radius:8px; border-left:4px solid #0052cc; }
  .summary-card h4 { font-size:11px; color:#999; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .summary-card .val { font-size:20px; font-weight:800; color:#111; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:#0052cc; color:#fff; }
  thead th { padding:11px 12px; text-align:left; font-size:12px; }
  tbody tr { border-bottom:1px solid #eee; }
  tbody tr:nth-child(even) { background:#f9f9f9; }
  tbody td { padding:10px 12px; font-size:12px; }
  .footer { margin-top:32px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#999; }
  @media print { body{background:#fff;} .page{box-shadow:none;margin:0;} .no-print{display:none!important;} @page{size:A4;margin:15mm;} }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">${company.name}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">KRA PIN: ${company.kra_pin} | ${company.phone}</div>
    </div>
    <div style="text-align:right;">
      <div class="stmt-title">ACCOUNT STATEMENT</div>
      <div style="font-size:12px;color:#555;margin-top:6px;">
        Customer: <strong>${customer.name}</strong><br>
        Account: <strong>${customer.account_number || customer.id?.slice(0,8)}</strong><br>
        Period: Last 12 months<br>
        Generated: ${fmtDate(new Date())}
      </div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h4>Total Invoiced</h4>
      <div class="val">${fmt(totalInvoiced)}</div>
    </div>
    <div class="summary-card">
      <h4>Total Paid</h4>
      <div class="val" style="color:#007733;">${fmt(totalPaid)}</div>
    </div>
    <div class="summary-card" style="border-color:${outstanding > 0 ? '#cc0000' : '#00c851'};">
      <h4>Outstanding Balance</h4>
      <div class="val" style="color:${outstanding > 0 ? '#cc0000' : '#007733'};">${outstanding > 0 ? fmt(outstanding) : fmt(0) + ' (Paid)'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Reference</th>
        <th>Debit (Invoice)</th>
        <th>Credit (Payment)</th>
        <th>Running Balance</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:#999;">No transactions in the last 12 months</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <p>This is an official account statement from ${company.name} | KRA PIN: ${company.kra_pin}</p>
  </div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#222;color:#fff;">
  <button onclick="window.print()" style="padding:10px 24px;background:#0052cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
    🖨️ Print / Save as PDF
  </button>
</div>
</body>
</html>`;
}

module.exports = { generateInvoiceHTML, generateStatementHTML, getCompanySettings };
