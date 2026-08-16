const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
    size: [1200, 675], // 16:9 Landscape Widescreen Slide
    margin: 50
});

doc.pipe(fs.createWriteStream('NativeFactory_AI_Presentation.pdf'));

// Slide 1: Title Slide
doc.rect(0, 0, 1200, 675).fill('#090d16');

doc.fillColor('#38bdf8').fontSize(44).text('NativeFactory AI', 80, 140, { bold: true });
doc.fillColor('#a855f7').fontSize(26).text('Autonomous Software Factory for NativeBuilder', 80, 200);
doc.fillColor('#94a3b8').fontSize(18).text('Lablab.ai Hackathon Submission • Build Without Limits 2026', 80, 260);

doc.rect(80, 320, 1040, 2).fill('#1e293b');

doc.fillColor('#34d399').fontSize(20).text('Author & Lead Creator: Frederico Alves', 80, 360);
doc.fillColor('#94a3b8').fontSize(16).text('GitHub: @FREDERICO-SISTEMAS-UNIPAM | LinkedIn: frederico-alves-254226393', 80, 400);
doc.fillColor('#38bdf8').fontSize(16).text('Live Production Vercel: https://gallant-borg.vercel.app', 80, 440);

// Slide 2: Problem & Value Prop
doc.addPage({ size: [1200, 675], margin: 50 });
doc.rect(0, 0, 1200, 675).fill('#090d16');

doc.fillColor('#38bdf8').fontSize(36).text('1. Problem & Value Proposition', 80, 80);
doc.rect(80, 130, 1040, 2).fill('#38bdf8');

doc.fillColor('#ffffff').fontSize(22).text('• Manual App Development is Slow & Fragmented', 80, 170);
doc.fillColor('#cbd5e1').fontSize(16).text('Building full-stack web applications, database schemas, and API specs takes weeks of manual work.', 110, 205);

doc.fillColor('#ffffff').fontSize(22).text('• Static Landing Pages Fall Short for Hackathons', 80, 270);
doc.fillColor('#cbd5e1').fontSize(16).text('Hackathon evaluators require functional, deployed AI-native applications with real working workflows.', 110, 305);

doc.fillColor('#ffffff').fontSize(22).text('• Seamless Sponsor Ecosystem Integration', 80, 370);
doc.fillColor('#cbd5e1').fontSize(16).text('NativeFactory AI bridges prompt-to-code generation directly into the Natively.builder platform.', 110, 405);

// Slide 3: 5-Agent Architecture
doc.addPage({ size: [1200, 675], margin: 50 });
doc.rect(0, 0, 1200, 675).fill('#090d16');

doc.fillColor('#a855f7').fontSize(36).text('2. Autonomous 5-Agent Architecture', 80, 80);
doc.rect(80, 130, 1040, 2).fill('#a855f7');

const agents = [
    { title: "1. Spec Analyst Agent", desc: "Generates OpenAPI 3.0 specs & User Stories JSON." },
    { title: "2. UI/UX Architect Agent", desc: "Synthesizes HSL Dark Glassmorphic Design Tokens." },
    { title: "3. Frontend/Backend Dev Agent", desc: "Compiles HTML5/CSS3/JS & PostgreSQL Schemas." },
    { title: "4. QA & Security Inspector Agent", desc: "Runs vulnerability audits & AST linter (100/100 score)." },
    { title: "5. NativeBuilder Publisher Agent", desc: "Packages 1-click export bundles for Natively.builder." }
];

agents.forEach((ag, idx) => {
    const yPos = 160 + (idx * 90);
    doc.fillColor('#34d399').fontSize(20).text(ag.title, 80, yPos);
    doc.fillColor('#cbd5e1').fontSize(15).text(ag.desc, 100, yPos + 26);
});

// Slide 4: 3-in-1 Ecosystem Suite
doc.addPage({ size: [1200, 675], margin: 50 });
doc.rect(0, 0, 1200, 675).fill('#090d16');

doc.fillColor('#34d399').fontSize(36).text('3. Unified 3-in-1 Ecosystem Suite', 80, 80);
doc.rect(80, 130, 1040, 2).fill('#34d399');

doc.fillColor('#ffffff').fontSize(22).text('🏭 1. NativeFactory AI', 80, 170);
doc.fillColor('#cbd5e1').fontSize(16).text('Autonomous Software Factory & Automated Test Runner.', 110, 205);

doc.fillColor('#ffffff').fontSize(22).text('📊 2. OmniInsight AI', 80, 280);
doc.fillColor('#cbd5e1').fontSize(16).text('Real-Time BI Analytics & Autonomous Action Triggers (WhatsApp / Stripe).', 110, 315);

doc.fillColor('#ffffff').fontSize(22).text('🎨 3. CanvasMind AI', 80, 390);
doc.fillColor('#cbd5e1').fontSize(16).text('Infinite Spatial UI Canvas & WCAG 2.1 Accessibility Inspector.', 110, 425);

// Slide 5: Production Credentials
doc.addPage({ size: [1200, 675], margin: 50 });
doc.rect(0, 0, 1200, 675).fill('#090d16');

doc.fillColor('#38bdf8').fontSize(36).text('4. Production Links & Submission', 80, 80);
doc.rect(80, 130, 1040, 2).fill('#38bdf8');

doc.fillColor('#ffffff').fontSize(20).text('Live Vercel Application:', 80, 180);
doc.fillColor('#38bdf8').fontSize(18).text('https://gallant-borg.vercel.app', 80, 210);

doc.fillColor('#ffffff').fontSize(20).text('GitHub Repository:', 80, 270);
doc.fillColor('#38bdf8').fontSize(18).text('https://github.com/FREDERICO-SISTEMAS-UNIPAM/native-factory-ai', 80, 300);

doc.fillColor('#ffffff').fontSize(20).text('Natively.builder App:', 80, 360);
doc.fillColor('#38bdf8').fontSize(18).text('Project "NativeFactory AI" on Natively.builder', 80, 390);

doc.fillColor('#34d399').fontSize(22).text('Ready for Evaluation & 1st Place Selection!', 80, 480);

doc.end();
console.log('PDF presentation created successfully!');
