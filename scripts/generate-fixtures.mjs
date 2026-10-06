import { mkdir, readFile, writeFile } from 'fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';

await mkdir('fixtures', { recursive: true });

const english = await PDFDocument.create();
const font = await english.embedFont(StandardFonts.Helvetica);
const first = english.addPage();
first.drawText('Motor Policy', { x: 50, y: 720, size: 16, font });
first.drawText('Section 1 Collision Coverage', { x: 50, y: 680, size: 14, font });
first.drawText('Deductible 500 on 2026-01-01', { x: 50, y: 650, size: 12, font });
const second = english.addPage();
second.drawText('Section 2 Liability', { x: 50, y: 720, size: 14, font });
second.drawText('Limit 100000', { x: 50, y: 680, size: 12, font });
await writeFile('fixtures/motor-policy-en.pdf', await english.save());

const arabic = await PDFDocument.create();
arabic.registerFontkit(fontkit);
const arabicFontBytes = await readFile('C:/Windows/Fonts/arial.ttf');
const arabicFont = await arabic.embedFont(arabicFontBytes, { subset: true });
const arabicPage = arabic.addPage();
arabicPage.drawText('تغطية التصادم', { x: 50, y: 700, size: 18, font: arabicFont });
arabicPage.drawText('التحمل 500 في 2026-01-01', { x: 50, y: 660, size: 14, font: arabicFont });
await writeFile('fixtures/motor-policy-ar.pdf', await arabic.save());

const zip = new JSZip();
zip.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
);
zip.folder('_rels')?.file(
  '.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
);
zip.folder('word')?.file(
  'document.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Section 1 Collision Coverage</w:t></w:r></w:p>
    <w:p><w:r><w:t>Deductible 500 on 2026-01-01</w:t></w:r></w:p>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p><w:r><w:t>Section 2 Liability</w:t></w:r></w:p>
    <w:p><w:r><w:t>Limit 100000</w:t></w:r></w:p>
  </w:body>
</w:document>`,
);
await writeFile('fixtures/sample-policy.docx', await zip.generateAsync({ type: 'nodebuffer' }));
