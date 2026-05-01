const PDFDocument = require('pdfkit');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'danderson@fontainespecialized.com';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function buildPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const NAV   = '#1E2A3A';
    const BLUE  = '#2563EB';
    const GREEN = '#16A34A';
    const RED   = '#DC2626';
    const MUTED = '#6B7280';
    const BG2   = '#F0F1F3';
    const BORDER= '#E2E4E8';
    const W     = 512; // usable width (612 - 50*2)

    // ── Header bar ──────────────────────────────────────────────────────────
    doc.rect(50, 50, W, 48).fill(NAV);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13)
       .text('FONTAINE HEAVY HAUL MILITARY', 62, 62, { width: W - 120 });
    doc.fillColor('#7FA8D4').font('Helvetica').fontSize(10)
       .text('Work Instruction Process Audit  |  Form No. F-6021', 62, 78);

    // Verdict badge (top right of header)
    const verdictText = data.verdict === 'yes' ? 'MATCHES' : 'MISMATCH';
    const verdictColor = data.verdict === 'yes' ? GREEN : RED;
    doc.roundedRect(490, 58, 72, 22, 4).fill(verdictColor);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
       .text(verdictText, 490, 64, { width: 72, align: 'center' });

    let y = 116;

    // ── Section label helper ─────────────────────────────────────────────────
    function sectionHeader(title) {
      doc.rect(50, y, W, 20).fill(BG2);
      doc.fillColor(NAV).font('Helvetica-Bold').fontSize(9)
         .text(title.toUpperCase(), 58, y + 5, { width: W - 16, characterSpacing: 0.5 });
      y += 20;
    }

    // ── Row helper ───────────────────────────────────────────────────────────
    function row(labelText, value, half = false, xOffset = 0) {
      const rowW = half ? W / 2 - 4 : W;
      const x = 50 + xOffset;
      doc.rect(x, y, 130, 24).fill(BG2);
      doc.rect(x + 130, y, rowW - 130, 24).fill('#FFFFFF');
      doc.rect(x, y, rowW, 24).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5)
         .text(labelText, x + 6, y + 7, { width: 120 });
      doc.fillColor('#1A1A2E').font('Helvetica').fontSize(9.5)
         .text(value || '—', x + 138, y + 6, { width: rowW - 144, ellipsis: true });
      if (!half) y += 24;
    }

    function rowPair(l1, v1, l2, v2) {
      row(l1, v1, true, 0);
      row(l2, v2, true, W / 2 + 4);
      y += 24;
    }

    // ── Audit Info ───────────────────────────────────────────────────────────
    sectionHeader('Audit Information');
    rowPair('Audit Date',             formatDate(data.date),  'Auditor Name',      data.auditor);
    rowPair('Work Instruction Title', data.wiTitle,          'WI Revision #',     data.wiRev || '—');
    rowPair('Section / Area Audited', data.section,          'Operator Audited',  data.operator);
    rowPair('Form Number',            'F-6021',              'Form Revision #',   data.formRev || '—');
    rowPair('Date Created',           formatDate(data.dateCreated), 'Date Revised', formatDate(data.dateRevised));

    y += 10;

    // ── Notes ────────────────────────────────────────────────────────────────
    sectionHeader('Notes / Observations');
    const notesText = data.notes || '(none)';
    const notesHeight = Math.max(60, doc.heightOfString(notesText, { width: W - 16, fontSize: 10 }) + 16);
    doc.rect(50, y, W, notesHeight).fill('#FFFFFF').strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor('#1A1A2E').font('Helvetica').fontSize(10)
       .text(notesText, 58, y + 8, { width: W - 16 });
    y += notesHeight + 10;

    // ── Verdict ──────────────────────────────────────────────────────────────
    sectionHeader('Audit Verdict');
    const vColor = data.verdict === 'yes' ? GREEN : RED;
    const vBg    = data.verdict === 'yes' ? '#F0FDF4' : '#FEF2F2';
    const vLabel = data.verdict === 'yes'
      ? 'YES — Work instruction matches current practice'
      : 'NO — Work instruction does not match current practice';
    doc.rect(50, y, W, 36).fill(vBg).strokeColor(vColor).lineWidth(1.5).stroke();
    doc.rect(50, y, 6, 36).fill(vColor);
    doc.fillColor(vColor).font('Helvetica-Bold').fontSize(11)
       .text(vLabel, 66, y + 12, { width: W - 24 });
    y += 48;

    // ── Signature block ───────────────────────────────────────────────────────
    sectionHeader('Auditor Signature');
    doc.rect(50, y, W, 56).fill('#FFFFFF').strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text('Auditor Name (Print)', 62, y + 8)
       .text('Signature', 260, y + 8)
       .text('Date', 460, y + 8);
    doc.moveTo(62, y + 44).lineTo(240, y + 44).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(260, y + 44).lineTo(440, y + 44).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(460, y + 44).lineTo(552, y + 44).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor('#1A1A2E').font('Helvetica').fontSize(10).text(data.auditor, 62, y + 30);
    y += 68;

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveTo(50, 740).lineTo(562, 740).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
       .text(`Form No. F-6021  |  Submitted: ${new Date().toLocaleString()}  |  Retain per document control requirements`, 50, 746, { width: W, align: 'center' });

    doc.end();
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const data = req.body;
    const { date, auditor, wiTitle, wiRev, formRev, dateCreated, dateRevised, section, operator, notes, verdict } = data;

    if (!date || !auditor || !wiTitle || !section || !operator || !verdict) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pdfBuffer = await buildPDF(data);
    const fDate = formatDate(date);
    const verdictLabel = verdict === 'yes' ? 'Matches' : 'Mismatch';
    const subject = `WI Process Audit | ${wiTitle} | ${fDate} | ${verdictLabel}`;

    await resend.emails.send({
      from: 'WI Audit <onboarding@resend.dev>',
      to: TO_EMAIL,
      subject,
      html: `
        <div style="font-family:Segoe UI,sans-serif;max-width:560px;color:#1A1A2E;">
          <div style="background:#1E2A3A;padding:18px 24px;border-radius:6px 6px 0 0;">
            <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:.04em;">FONTAINE HEAVY HAUL MILITARY</div>
            <div style="color:#7FA8D4;font-size:12px;margin-top:2px;">Work Instruction Process Audit</div>
          </div>
          <div style="border:1px solid #E2E4E8;border-top:none;border-radius:0 0 6px 6px;padding:20px 24px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:6px 0;color:#6B7280;width:160px;">Audit Date</td><td style="padding:6px 0;font-weight:600;">${fDate}</td></tr>
              <tr><td style="padding:6px 0;color:#6B7280;">Auditor</td><td style="padding:6px 0;font-weight:600;">${auditor}</td></tr>
              <tr><td style="padding:6px 0;color:#6B7280;">WI Title</td><td style="padding:6px 0;font-weight:600;">${wiTitle}${data.wiRev ? ' — ' + data.wiRev : ''}</td></tr>
              <tr><td style="padding:6px 0;color:#6B7280;">Section / Area</td><td style="padding:6px 0;">${section}</td></tr>
              <tr><td style="padding:6px 0;color:#6B7280;">Operator</td><td style="padding:6px 0;">${operator}</td></tr>
              <tr><td style="padding:6px 0;color:#6B7280;">Form #</td><td style="padding:6px 0;">F-6021${data.formRev ? ' — ' + data.formRev : ''}</td></tr>
            </table>
            <div style="margin:16px 0;padding:12px 16px;background:${verdict === 'yes' ? '#F0FDF4' : '#FEF2F2'};border-left:4px solid ${verdict === 'yes' ? '#16A34A' : '#DC2626'};border-radius:4px;font-size:13px;font-weight:600;color:${verdict === 'yes' ? '#15803D' : '#B91C1C'};">
              ${verdict === 'yes' ? '✓ WI matches current practice' : '✗ WI does not match current practice'}
            </div>
            ${notes ? `<div style="font-size:13px;color:#6B7280;margin-bottom:4px;">Notes</div><div style="font-size:13px;white-space:pre-wrap;">${notes}</div>` : ''}
            <div style="margin-top:16px;font-size:11px;color:#6B7280;">PDF audit record attached.</div>
          </div>
        </div>
      `,
      attachments: [{
        filename: `WI_Audit_${wiTitle.replace(/[^a-z0-9]/gi, '_')}_${date}.pdf`,
        content: pdfBuffer.toString('base64'),
      }]
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
