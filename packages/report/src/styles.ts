// The report's CSS — the design contract, ported verbatim from the approved mock
// (footfall-dashboards.v2). Kept as a string so the report stays self-contained.
// A `.greyed` state is added for coverage-matrix grey-out of unavailable modules.

export const STYLES = `
  :root{
    --paper:#f7f7f4; --card:#ffffff; --ink:#16181d; --muted:#676e79; --line:#e3e4de;
    --accent:#2743d6; --accent-soft:#eceffb;
    --human:#9aa1ab; --crawler:#d99a2b; --unknown:#c9cdd4;
    --crit:#c73a2e; --crit-soft:#faeeec; --ok:#2e7d4f; --ok-soft:#eaf4ee; --warn:#b97f1f; --warn-soft:#f9f1e2;
    --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{background:var(--paper);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0 20px 60px}
  .wrap{max-width:1120px;margin:0 auto}
  h1,h2,h3{text-wrap:balance;margin:0}
  a{color:var(--accent)}
  .mono{font-family:var(--mono)}
  .num{font-variant-numeric:tabular-nums}

  .masthead{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 16px;padding:26px 0 16px}
  .brand{font-size:21px;font-weight:700;letter-spacing:-.02em}
  .brand .steps{color:var(--accent)}
  .masthead .sub{color:var(--muted);font-size:13.5px}

  section.mod{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 24px 22px;margin:0 0 20px}
  .modhead{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:14px}
  .modhead h2{font-size:16px;font-weight:700;letter-spacing:-.01em}
  .chip{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.08em;padding:3px 8px;border-radius:5px;white-space:nowrap}
  .chip.heur{background:var(--warn-soft);color:var(--warn)}
  .footnote{font-size:12.5px;color:var(--muted);margin-top:12px}

  .report-head{background:var(--ink);color:#fff;border-radius:12px;padding:24px 28px;margin-bottom:20px}
  .report-head .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;color:#9fb0f5;text-transform:uppercase}
  .report-head h2{font-size:23px;line-height:1.3;font-weight:700;margin:10px 0 4px;letter-spacing:-.015em;max-width:34em}
  .report-head h2 em{font-style:normal;color:#aebcf8}
  .report-head .meta{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:14px;font-size:13px;color:#b9bfd0}
  .report-head .meta span b{color:#fff;font-weight:600}

  .chart{overflow-x:auto}
  .chart svg{display:block;min-width:640px;width:100%;height:auto}
  .legend{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:13px;color:#3d434c;margin:8px 2px 2px}
  .legend .sw{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:7px;vertical-align:-1px}
  .callout{background:var(--accent-soft);border-radius:8px;padding:9px 14px;font-size:13px;color:#2b3568;margin-top:14px}
  .donut-row{display:flex;gap:26px;align-items:center;flex-wrap:wrap}
  .donut-legend{font-size:13.5px;min-width:230px}
  .donut-legend div{display:flex;align-items:baseline;gap:9px;padding:4px 0}
  .donut-legend .sw{width:11px;height:11px;border-radius:3px;flex:none;align-self:center}
  .donut-legend .l{flex:1}
  .donut-legend .v{font-family:var(--mono);font-size:12.5px;color:var(--muted)}

  .scroll{overflow-x:auto}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;font-weight:600;padding:8px 14px 8px 0;border-bottom:1px solid var(--line);white-space:nowrap}
  td{padding:9px 14px 9px 0;border-bottom:1px solid #eef0ea;vertical-align:top}
  tr:last-child td{border-bottom:0}
  td.path{font-family:var(--mono);font-size:12.5px;white-space:nowrap}
  td.n{font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12.5px}
  .sharebar{background:#eef0ea;border-radius:4px;height:8px;width:120px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:8px}
  .sharebar i{display:block;height:100%;background:var(--accent)}
  .pill{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}
  .pill.crit{background:var(--crit-soft);color:var(--crit)}
  .pill.ok{background:var(--ok-soft);color:var(--ok)}
  .pill.warn{background:var(--warn-soft);color:var(--warn)}
  .pill.mut{background:#eef1ee;color:#5a635d}

  .failcards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}
  .failcard{border:1px solid var(--line);border-left:3px solid var(--crit);border-radius:8px;padding:13px 15px}
  .failcard.h{border-left-color:var(--warn)}
  .failcard .t{font-size:13px;font-weight:700}
  .failcard .v{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;margin:2px 0}
  .failcard .d{font-size:12.5px;color:var(--muted)}

  ol.recs{margin:0;padding:0;list-style:none;counter-reset:rec}
  ol.recs li{counter-increment:rec;display:flex;gap:14px;padding:11px 0;border-bottom:1px solid #eef0ea;align-items:baseline}
  ol.recs li:last-child{border-bottom:0}
  ol.recs li::before{content:counter(rec);font-family:var(--mono);font-weight:700;font-size:13px;color:var(--accent);background:var(--accent-soft);border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex:none;align-self:center}
  .rec-t{font-weight:600;font-size:14px}
  .rec-d{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
  pre.code{background:#16181d;color:#d6dae2;border-radius:8px;padding:14px 16px;font-family:var(--mono);font-size:12px;line-height:1.6;overflow-x:auto;margin:14px 0 0;white-space:pre-wrap}
  pre.code .c{color:#7d879a}

  td.field{font-family:var(--mono);font-size:12.5px;font-weight:600;white-space:nowrap}

  .greyed{position:relative;opacity:.55;filter:grayscale(1)}
  .greyed-note{font-size:12.5px;color:var(--muted);font-style:italic;margin-top:10px}

  footer{color:var(--muted);font-size:12.5px;margin-top:30px;border-top:1px solid var(--line);padding-top:14px}
  footer .acc{font-family:var(--mono)}

  @media (max-width:880px){
    .failcards{grid-template-columns:1fr}
  }
`;
