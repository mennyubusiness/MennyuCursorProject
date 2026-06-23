/**
 * Convert Markdown report(s) under docs/reports/ to PDF.
 *
 * Usage:
 *   npx tsx scripts/report-to-pdf.ts                    # all .md in docs/reports
 *   npx tsx scripts/report-to-pdf.ts beta-readiness-audit.md
 *   npm run report:pdf
 */
import { readdirSync, existsSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";

const REPORTS_DIR = resolve(process.cwd(), "docs/reports");

async function convertFile(mdPath: string): Promise<string> {
  const { mdToPdf } = await import("md-to-pdf");
  const pdfPath = mdPath.replace(/\.md$/i, ".pdf");
  await mdToPdf(
    { path: mdPath },
    {
      dest: pdfPath,
      pdf_options: {
        format: "A4",
        margin: { top: "20mm", right: "18mm", bottom: "20mm", left: "18mm" },
        printBackground: true,
      },
      css: `
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1a1a1a;
        }
        h1 { font-size: 22pt; margin-top: 0; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
        h2 { font-size: 16pt; margin-top: 1.4em; color: #2d2d2d; }
        h3 { font-size: 13pt; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; font-weight: 600; }
        code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
        pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 9pt; }
        blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #555; }
      `,
    }
  );
  return pdfPath;
}

async function main() {
  if (!existsSync(REPORTS_DIR)) {
    console.error(`Reports directory not found: ${REPORTS_DIR}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let files: string[];

  if (args.length > 0) {
    files = args.map((arg) => {
      const name = basename(arg);
      const withExt = extname(name) ? name : `${name}.md`;
      return join(REPORTS_DIR, withExt);
    });
  } else {
    files = readdirSync(REPORTS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(REPORTS_DIR, f));
  }

  if (files.length === 0) {
    console.log("No markdown reports found in docs/reports/");
    return;
  }

  for (const mdPath of files) {
    if (!existsSync(mdPath)) {
      console.error(`Not found: ${mdPath}`);
      process.exit(1);
    }
    const pdfPath = await convertFile(mdPath);
    console.log(`Wrote ${pdfPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
