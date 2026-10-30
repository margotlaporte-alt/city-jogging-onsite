import JSZip from "jszip";
import templateUrl from "../assets/fla-template.docx?url";
import jpmorganLogoUrl from "../assets/jpmorgan.png?url";

// Rapport Word des statistiques, construit sur le papier à en-tête FLA
// (src/assets/fla-template.docx) : on garde ses en-têtes, pieds de page,
// styles et section, et on remplace seulement le corps du document.

const EMU_PER_CM = 360000;
const JPM_LOGO_RATIO = 493 / 2400;
const JPM_LOGO_REL_ID = "rIdJpmLogo";
const JPM_LOGO_MEDIA = "media/jpmorgan.png";
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
// Le bandeau partenaires du pied de page de la première page est flottant :
// marge basse élargie pour que le texte ne passe pas dessous.
const FIRST_PAGE_BOTTOM_MARGIN = 2100;

let drawingId = 9000;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function run(text, { bold = false, color, size, fill } = {}) {
  const props = [
    bold ? "<w:b/><w:bCs/>" : "",
    color ? `<w:color w:val="${color}"/>` : "",
    size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : "",
    fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""
  ].join("");

  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(content, { style, align, spacingAfter } = {}) {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    spacingAfter !== undefined ? `<w:spacing w:after="${spacingAfter}"/>` : "",
    align ? `<w:jc w:val="${align}"/>` : ""
  ].join("");

  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${content}</w:p>`;
}

function inlineImage(relId, widthCm, ratio, name) {
  const cx = Math.round(widthCm * EMU_PER_CM);
  const cy = Math.round(cx * ratio);
  drawingId += 1;

  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${drawingId}" name="${name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${drawingId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// Mise en page visuelle du rapport, pensée pour tenir sur une seule page :
// éléments Word natifs (tableaux sans bordure, cellules colorées) pour
// rester modifiable dans Word.
const CONTENT_WIDTH = 9638;
const COLORS = {
  navy: "14213D",
  blue: "009FDA",
  red: "EF3340",
  lightBlue: "7FCFEC",
  track: "EEF1F5",
  grey: "667085"
};
const BAR_PALETTE = [COLORS.blue, COLORS.red, COLORS.lightBlue, COLORS.navy];

const NO_BORDERS =
  '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';

// Paragraphe minuscule : une cellule Word doit contenir un paragraphe.
const TINY_PARAGRAPH =
  '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';

// Séparateur des milliers : espace insécable classique. L'espace fine
// (U+202F) de toLocaleString n'existe pas dans toutes les polices Word.
function formatNumber(value) {
  return Number(value || 0)
    .toLocaleString("fr-FR")
    .replace(/\s/g, " ");
}

function formatPercent(value, total) {
  if (!total) {
    return "0 %";
  }

  return `${Math.round((value / total) * 1000) / 10} %`.replace(".", ",");
}

function heading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Titre1"/><w:spacing w:before="120" w:after="40"/></w:pPr>${run(text)}</w:p>`;
}

function cell(content, width, { fill, topBorder, marginY = 0, vAlign = "center" } = {}) {
  const borders = topBorder
    ? `<w:tcBorders><w:top w:val="single" w:sz="18" w:space="0" w:color="${topBorder}"/></w:tcBorders>`
    : "";
  const shading = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "";

  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${borders}${shading}<w:tcMar><w:top w:w="${marginY}" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="${marginY}" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar><w:vAlign w:val="${vAlign}"/></w:tcPr>${content}</w:tc>`;
}

function borderlessTable(widths, rowsXml) {
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((sum, width) => sum + width, 0)}" w:type="dxa"/>${NO_BORDERS}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowsXml}</w:tbl>`;
}

function row(cellsXml, { height, exact = false } = {}) {
  const heightXml = height
    ? `<w:trHeight w:val="${height}" w:hRule="${exact ? "exact" : "atLeast"}"/>`
    : "";

  return `<w:tr><w:trPr><w:cantSplit/>${heightXml}</w:trPr>${cellsXml}</w:tr>`;
}

// Barre horizontale : segments colorés proportionnels à `scale`, puis le
// reste de la largeur en gris clair.
function bar(segments, width, height, scale) {
  let used = 0;
  const cells = [];

  segments.forEach((segment) => {
    const segmentWidth = scale ? Math.round((segment.value / scale) * width) : 0;

    if (segmentWidth > 0) {
      cells.push({ width: segmentWidth, fill: segment.color });
      used += segmentWidth;
    }
  });

  if (width - used > 0) {
    cells.push({ width: width - used, fill: COLORS.track });
  }

  return (
    borderlessTable(
      cells.map((entry) => entry.width),
      row(cells.map((entry) => cell(TINY_PARAGRAPH, entry.width, { fill: entry.fill })).join(""), {
        height,
        exact: true
      })
    ) + TINY_PARAGRAPH
  );
}

function kpiRow(items) {
  const gap = 240;
  const width = Math.floor((CONTENT_WIDTH - gap * (items.length - 1)) / items.length);
  const widths = items.flatMap((item, index) =>
    index === items.length - 1 ? [width] : [width, gap]
  );

  const cells = items
    .map((item, index) => {
      const content = [
        paragraph(run(item.label.toUpperCase(), { bold: true, color: COLORS.grey, size: 15 }), {
          spacingAfter: 0
        }),
        paragraph(run(formatNumber(item.value), { bold: true, color: item.color, size: 52 }), {
          spacingAfter: 0
        }),
        paragraph(run(item.caption, { color: COLORS.grey, size: 16 }), { spacingAfter: 0 })
      ].join("");
      const spacerCell = index === items.length - 1 ? "" : cell(TINY_PARAGRAPH, gap);

      return cell(content, width, { topBorder: item.color, marginY: 80, vAlign: "top" }) + spacerCell;
    })
    .join("");

  return borderlessTable(widths, row(cells));
}

function barList(entries, total) {
  const labelWidth = 2700;
  const valueWidth = 1900;
  const barWidth = CONTENT_WIDTH - labelWidth - valueWidth;

  const rows = entries
    .map((entry, index) => {
      const color = entry.color || BAR_PALETTE[index % BAR_PALETTE.length];

      return row(
        [
          cell(paragraph(run(entry.name, { size: 19 }), { spacingAfter: 0 }), labelWidth, {
            marginY: 35
          }),
          cell(bar([{ value: entry.value, color }], barWidth, 150, total), barWidth, {
            marginY: 35
          }),
          cell(
            paragraph(
              run(formatNumber(entry.value), { bold: true, size: 19 }) +
                run(`   ${formatPercent(entry.value, total)}`, { color: COLORS.grey, size: 17 }),
              { align: "right", spacingAfter: 0 }
            ),
            valueWidth,
            { marginY: 35 }
          )
        ].join("")
      );
    })
    .join("");

  return borderlessTable([labelWidth, barWidth, valueWidth], rows);
}

function splitBar(left, right) {
  const total = left.value + right.value;
  const half = CONTENT_WIDTH / 2;
  const legend = (entry, align) =>
    paragraph(
      // Pastille de couleur en surlignage plutôt qu'un caractère « ■ »,
      // absent de certaines polices.
      run("   ", { fill: entry.color, size: 14 }) +
        run(`  ${entry.name}  `, { size: 19 }) +
        run(formatNumber(entry.value), { bold: true, size: 24 }) +
        run(`   ${formatPercent(entry.value, total)}`, { color: COLORS.grey, size: 17 }),
      { align, spacingAfter: 0 }
    );

  return (
    bar([left, right], CONTENT_WIDTH, 240, total) +
    borderlessTable(
      [half, half],
      row(
        cell(legend(left, "left"), half, { marginY: 50 }) +
          cell(legend(right, "right"), half, { marginY: 50 })
      )
    )
  );
}

function buildBody({ editionYear, stats, sexData, typeData, generatedAt }) {
  const dateLabel = generatedAt.toLocaleString("fr-LU", {
    dateStyle: "long",
    timeStyle: "short"
  });
  const [men, women] = sexData;
  const otherSourceTotal =
    stats.total - stats.importTotal - stats.publicOnsiteTotal - stats.organizerOnsiteTotal;
  const originEntries = [
    { name: "Import Miles Republic", value: stats.importTotal, color: COLORS.blue },
    { name: "Sur place – QR code", value: stats.publicOnsiteTotal, color: COLORS.red },
    { name: "Sur place – stand d'inscription", value: stats.organizerOnsiteTotal, color: COLORS.red },
    ...(otherSourceTotal > 0
      ? [{ name: "Autre origine", value: otherSourceTotal, color: COLORS.lightBlue }]
      : [])
  ];
  const distanceEntries = [...stats.distanceData].sort((left, right) => right.value - left.value);

  return [
    paragraph(run(`Statistiques J.P. Morgan City Jogging ${editionYear}`, { size: 44 }), {
      style: "Titre"
    }),
    paragraph(inlineImage(JPM_LOGO_REL_ID, 2.6, JPM_LOGO_RATIO, "Logo J.P. Morgan"), {
      align: "center",
      spacingAfter: 40
    }),
    paragraph(run(`Rapport généré le ${dateLabel}`, { color: COLORS.grey, size: 16 }), {
      align: "center",
      spacingAfter: 160
    }),

    kpiRow([
      { label: "Total inscrits", value: stats.total, color: COLORS.navy, caption: `Édition ${editionYear}` },
      {
        label: "Avant l'événement",
        value: stats.importTotal,
        color: COLORS.blue,
        caption: `${formatPercent(stats.importTotal, stats.total)} · import Miles Republic`
      },
      {
        label: "Jour J",
        value: stats.onsiteDayTotal,
        color: COLORS.red,
        caption: `${formatPercent(stats.onsiteDayTotal, stats.total)} · inscrits sur place`
      }
    ]),

    heading("Origine des inscriptions"),
    barList(originEntries, stats.total),
    paragraph(
      run(
        "Import Miles Republic : inscriptions en ligne avant l'événement. Le jour J, deux façons de s'inscrire sur place : " +
          "QR code, le coureur scanne le code et remplit lui-même le formulaire (LeGuichet public) ; " +
          "stand d'inscription, le coureur se présente au stand et l'organisation saisit son inscription.",
        { color: COLORS.grey, size: 15 }
      ),
      { spacingAfter: 0 }
    ),

    heading("Répartition hommes / femmes"),
    splitBar({ ...men, color: COLORS.blue }, { ...women, color: COLORS.red }),

    heading("Types de participation"),
    barList(typeData, stats.total),

    heading("Répartition par distance"),
    barList(distanceEntries, stats.total),

    paragraph(
      run("Seules les inscriptions avec un dossard attribué sont comptées dans ce rapport.", {
        color: COLORS.grey,
        size: 15
      }),
      { spacingAfter: 0 }
    )
  ].join("");
}

function addRelationship(relsXml, id, type, target) {
  return relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

async function fetchArrayBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${url} (${response.status})`);
  }

  return response.arrayBuffer();
}

export async function buildStatsReport(reportData) {
  const [templateBuffer, logoBuffer] = await Promise.all([
    fetchArrayBuffer(templateUrl),
    fetchArrayBuffer(jpmorganLogoUrl)
  ]);
  const zip = await JSZip.loadAsync(templateBuffer);

  zip.file(`word/${JPM_LOGO_MEDIA}`, logoBuffer);

  // Corps : on remplace le contenu vide du modèle et on garde sa section.
  const documentXml = await zip.file("word/document.xml").async("string");
  const sectPr = documentXml.match(/<w:sectPr[\s\S]*<\/w:sectPr>/)[0];
  const nextSectPr = sectPr.replace(
    /(<w:pgMar[^>]*w:bottom=")\d+(")/,
    `$1${FIRST_PAGE_BOTTOM_MARGIN}$2`
  );
  zip.file(
    "word/document.xml",
    documentXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${buildBody({ ...reportData, generatedAt: new Date() })}${nextSectPr}</w:body>`
    )
  );

  const documentRels = await zip.file("word/_rels/document.xml.rels").async("string");
  zip.file(
    "word/_rels/document.xml.rels",
    addRelationship(documentRels, JPM_LOGO_REL_ID, IMAGE_REL_TYPE, JPM_LOGO_MEDIA)
  );

  // Pied de page des pages suivantes : petit logo J.P. Morgan aligné à droite.
  const footerXml = await zip.file("word/footer1.xml").async("string");
  const footerEnd = /<\/w:pPr><\/w:p>\s*<\/w:ftr>\s*$/;

  if (!footerEnd.test(footerXml)) {
    throw new Error("Pied de page du modèle FLA inattendu (word/footer1.xml).");
  }

  zip.file(
    "word/footer1.xml",
    footerXml.replace(
      footerEnd,
      `<w:jc w:val="right"/></w:pPr>${inlineImage(JPM_LOGO_REL_ID, 2.2, JPM_LOGO_RATIO, "Logo J.P. Morgan")}</w:p></w:ftr>`
    )
  );

  const footerRelsPath = "word/_rels/footer1.xml.rels";
  const footerRels = zip.file(footerRelsPath)
    ? await zip.file(footerRelsPath).async("string")
    : EMPTY_RELS;
  zip.file(
    footerRelsPath,
    addRelationship(footerRels, JPM_LOGO_REL_ID, IMAGE_REL_TYPE, JPM_LOGO_MEDIA)
  );

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
