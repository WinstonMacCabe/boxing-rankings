export interface EmailRow {
  label?: string
  text: string
  sub?: string
  url?: string
}

export interface EmailSection {
  heading: string
  rows: EmailRow[]
}

export function renderEmailHtml(sport: string, sections: EmailSection[]): string {
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const sectionHtml = sections
    .map(section => {
      const rows = section.rows
        .map(row => {
          const nameHtml = row.label
            ? `<div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:0.05em;color:#1d1d1f;text-transform:uppercase;">${escapeHtml(row.label)}</div>`
            : ''
          const text =
            row.url !== undefined
              ? `<a href="${escapeHtml(row.url)}" style="color:#1d1d1f;text-decoration:underline;text-underline-offset:3px;">${escapeHtml(row.text)}</a>`
              : `<span style="color:#1d1d1f;">${escapeHtml(row.text)}</span>`
          const sub = row.sub
            ? `<div style="font-size:12px;letter-spacing:0.12em;color:#86868b;text-transform:uppercase;">${escapeHtml(row.sub)}</div>`
            : ''
          return `          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f0f0f2;">
              ${nameHtml}
              <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.35;letter-spacing:0.02em;margin-top:${row.label ? '2px' : '0'};">${text}</div>
              ${sub}
            </td>
          </tr>`
        })
        .join('\n')

      return `      <!-- ${section.heading} -->
      <tr>
        <td style="padding:28px 32px 0;">
          <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.24em;color:#d20a0a;text-transform:uppercase;">${escapeHtml(section.heading)}</div>
          <div style="height:8px;background:#1d1d1f;width:100%;margin-top:10px;"></div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td>
      </tr>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(sport)} Rankings Update</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e2e2e4;">
          <tr>
            <td style="background:#1d1d1f;padding:26px 32px;">
              <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:30px;font-weight:700;letter-spacing:0.08em;color:#ffffff;text-transform:uppercase;">Winston's Rankings</div>
              <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.28em;color:#d20a0a;text-transform:uppercase;margin-top:6px;">${escapeHtml(sport)} / Daily Update</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 16px;font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:13px;letter-spacing:0.18em;color:#86868b;text-transform:uppercase;border-bottom:1px solid #e2e2e4;">${date}</td>
          </tr>
${sectionHtml}
          <tr>
            <td style="background:#1d1d1f;padding:22px 32px;margin-top:8px;">
              <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.18em;color:#ffffff;text-transform:uppercase;">Winston's Rankings</div>
              <div style="font-family:'Saira Condensed','Helvetica Neue',Arial,sans-serif;font-size:12px;letter-spacing:0.1em;color:#86868b;margin-top:4px;">Rankings, records, and fight news. Updated daily.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}