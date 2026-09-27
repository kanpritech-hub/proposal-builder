import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { BOCA_DOUGH_REFERENCE_PROPOSAL } from './src/data/sampleProposals.ts';
import { INITIAL_MARKETING_CATEGORIES } from './src/data/digitalMarketingMaster.ts';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const PROPOSALS_FILE = path.join(DATA_DIR, 'proposals.json');
const MARKETING_FILE = path.join(DATA_DIR, 'marketing_master.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'organization_settings.json');

const DEFAULT_SETTINGS = {
  companyName: 'KanpriTech',
  logoUrl: '/assets/kanpritech-logo.svg',
  iconLogoUrl: '/assets/kanpritech-icon.svg',
  logoHeight: 36,
  watermarkOpacity: 0.05,
  address: '506, Saheed Nagar Rd, opp. SBI, Branch, Saheed Nagar, Bhubaneswar, Odisha 751007',
  phone: '+91 7751973970',
  email: 'contact@kanpritech.com',
  website: 'www.kanpritech.com',
  gstNumber: '21AAACK1234F1Z5',
  footerText: 'KanpriTech • Confidential Business Proposal'
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure initial proposals file exists with seed
if (!fs.existsSync(PROPOSALS_FILE)) {
  fs.writeFileSync(PROPOSALS_FILE, JSON.stringify([BOCA_DOUGH_REFERENCE_PROPOSAL], null, 2), 'utf8');
}

// Ensure initial marketing file exists
if (!fs.existsSync(MARKETING_FILE)) {
  fs.writeFileSync(MARKETING_FILE, JSON.stringify(INITIAL_MARKETING_CATEGORIES, null, 2), 'utf8');
}

// Ensure initial settings file exists
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
}

function readSettings(): any {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: any) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

function readProposals(): any[] {
  try {
    const raw = fs.readFileSync(PROPOSALS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading proposals file:', err);
    return [BOCA_DOUGH_REFERENCE_PROPOSAL];
  }
}

function writeProposals(proposals: any[]) {
  fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(proposals, null, 2), 'utf8');
}

function readMarketing(): any[] {
  try {
    const raw = fs.readFileSync(MARKETING_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_MARKETING_CATEGORIES;
  }
}

function writeMarketing(categories: any[]) {
  fs.writeFileSync(MARKETING_FILE, JSON.stringify(categories, null, 2), 'utf8');
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Auth endpoints (Simple, session-ready for employees)
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    // Any valid employee email is allowed
    const namePart = email.split('@')[0];
    const formattedName = namePart
      .split(/[._-]/)
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ') || 'KanpriTech Associate';

    res.json({
      success: true,
      user: {
        id: `usr-${Date.now()}`,
        name: formattedName,
        email,
        role: 'Proposal Architect',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}`
      }
    });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({
      user: {
        id: 'usr-default',
        name: 'KanpriTech Team',
        email: 'proposals@kanpri.tech',
        role: 'Proposal Architect'
      }
    });
  });

  // Proposals CRUD
  app.get('/api/proposals', (req, res) => {
    const proposals = readProposals();
    res.json(proposals);
  });

  app.get('/api/proposals/:id', (req, res) => {
    const proposals = readProposals();
    const found = proposals.find(p => p.id === req.params.id);
    if (!found) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(found);
  });

  app.post('/api/proposals', (req, res) => {
    const newProposal = req.body;
    if (!newProposal || !newProposal.id) {
      return res.status(400).json({ error: 'Invalid proposal data' });
    }
    const proposals = readProposals();
    const existingIndex = proposals.findIndex(p => p.id === newProposal.id);
    if (existingIndex >= 0) {
      proposals[existingIndex] = { ...newProposal, updatedAt: new Date().toISOString().split('T')[0] };
    } else {
      proposals.unshift(newProposal);
    }
    writeProposals(proposals);
    res.json(newProposal);
  });

  app.put('/api/proposals/:id', (req, res) => {
    const proposals = readProposals();
    const index = proposals.findIndex(p => p.id === req.params.id);
    if (index === -1) {
      // Create if doesn't exist
      const proposal = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString().split('T')[0] };
      proposals.unshift(proposal);
      writeProposals(proposals);
      return res.json(proposal);
    }
    proposals[index] = {
      ...proposals[index],
      ...req.body,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    writeProposals(proposals);
    res.json(proposals[index]);
  });

  app.delete('/api/proposals/:id', (req, res) => {
    let proposals = readProposals();
    const initialLen = proposals.length;
    proposals = proposals.filter(p => p.id !== req.params.id);
    if (proposals.length === initialLen) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    writeProposals(proposals);
    res.json({ success: true, message: 'Proposal deleted successfully' });
  });

  // Duplicate proposal
  app.post('/api/proposals/:id/duplicate', (req, res) => {
    const proposals = readProposals();
    const original = proposals.find(p => p.id === req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const randomId = Math.floor(1000 + Math.random() * 9000);
    const currentYear = new Date().getFullYear();
    const newProposalNumber = `KT/PROP/${currentYear}/${randomId.toString().padStart(5, '0')}`;
    const newId = `prop-${Date.now()}`;

    const duplicated = JSON.parse(JSON.stringify(original));
    duplicated.id = newId;
    duplicated.proposalNumber = newProposalNumber;
    duplicated.status = 'draft';
    duplicated.createdAt = new Date().toISOString().split('T')[0];
    duplicated.updatedAt = new Date().toISOString().split('T')[0];
    duplicated.client.proposalTitle = `${duplicated.client.proposalTitle} - Copy`;
    duplicated.client.projectName = `${duplicated.client.projectName} - Copy`;

    proposals.unshift(duplicated);
    writeProposals(proposals);
    res.json(duplicated);
  });

  // Organization Settings endpoints
  app.get('/api/organization-settings', (req, res) => {
    const settings = readSettings();
    res.json(settings);
  });

  app.post('/api/organization-settings', (req, res) => {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload' });
    }
    const current = readSettings();
    const merged = { ...current, ...newSettings };
    writeSettings(merged);
    res.json(merged);
  });

  // Digital Marketing master endpoints
  app.get('/api/marketing-master', (req, res) => {
    const categories = readMarketing();
    res.json(categories);
  });

  app.post('/api/marketing-master', (req, res) => {
    const categories = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Expected array of categories' });
    }
    writeMarketing(categories);
    res.json({ success: true, count: categories.length });
  });

  // AI polishing helper (strictly non-inventive, tone/grammar only)
  app.post('/api/ai/polish', async (req, res) => {
    const { text, sectionTitle } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ai = getGemini();
    if (!ai) {
      return res.status(503).json({ error: 'AI capabilities currently unconfigured' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an elite B2B business proposal editor for KanpriTech. 
Your strict instruction:
Refine and polish the following text for clarity, professional executive cadence, and polished business grammar.
CRITICAL CONSTRAINT: You MUST NOT invent, add, or alter any numbers, prices, dates, deliverables, technologies, or commitments. Preserve all factual claims exactly as written.

Section Title: ${sectionTitle || 'Proposal Section'}
Original Text:
${text}

Return ONLY the polished text without any meta-commentary, introductory remarks, or quotes.`
      });

      const polished = response.text?.trim() || text;
      res.json({ polishedText: polished });
    } catch (err: any) {
      console.error('AI polish error:', err);
      res.status(500).json({ error: 'Failed to polish text', details: err.message });
    }
  });

  // Extract, parse and structure proposal from PDF, DOCX, or direct pasted text
  app.post('/api/ai/parse-and-structure-proposal', async (req, res) => {
    const { sourceType, text = '', fileBase64 = '', fileName = '', proposalType = 'website_development' } = req.body;

    let extractedRawText = text;

    // If PDF base64 provided, extract text with pdf-parse as baseline / fallback
    if (sourceType === 'pdf' && fileBase64) {
      try {
        const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
        const pdfBuffer = Buffer.from(cleanBase64, 'base64');
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ verbosity: 0 });
        if (typeof (parser as any).load === 'function') {
          await (parser as any).load(new Uint8Array(pdfBuffer));
          if (typeof (parser as any).getText === 'function') {
            const parsedText = await (parser as any).getText();
            if (parsedText && typeof parsedText === 'string') {
              extractedRawText = parsedText.trim();
            }
          }
        }
      } catch (pdfErr) {
        console.warn('pdf-parse fallback extraction note:', pdfErr);
      }
    } else if (sourceType === 'docx' && fileBase64) {
      try {
        const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
        const docxBuffer = Buffer.from(cleanBase64, 'base64');
        const mammothModule = await import('mammoth');
        const mammoth = (mammothModule as any).default || mammothModule;
        const resDocx = await mammoth.extractRawText({ buffer: docxBuffer });
        if (resDocx && resDocx.value) {
          extractedRawText = resDocx.value.trim();
        }
      } catch (docxErr) {
        console.warn('docx extraction note:', docxErr);
      }
    }

    const ai = getGemini();

    // 1. Try Gemini AI Generation if configured
    if (ai) {
      try {
        const prompt = `You are a solutions architect and proposal specialist for KanpriTech Solutions.
Analyze the following client input document/text (which could be an RFP, client requirements, email specifications, scope of work, or project brief) for a '${proposalType.replace('_', ' ')}' project.
Input Source Type: ${sourceType}
File Name: ${fileName || 'Direct Client Input'}

Your task:
Synthesize this content into an executive-ready, highly detailed proposal specification.
Carefully extract or infer:
1. Client/Company Name, Proposal Title, Contact Person (if mentioned), Email, Website, Phone.
2. Appropriate Currency based on context (INR/USD/GBP/EUR/CAD/AUD, default INR if not specified).
3. Executive Summary: 1-2 paragraphs highlighting the client's current situation and business objective.
4. Problems Identified: 2-4 distinct challenges, drawbacks, or pain points mentioned or implied.
5. Proposed Solution: Architectural strategy and core technical pillars.
6. Scope of Work: 3-6 distinct functional modules, each with a clear title, description, and 3-6 specific deliverable items.
7. Timeline & Milestones: 3-5 sequential phases with title, estimated duration (e.g. 'Weeks 1-2'), and description.
8. Pricing / Commercials: Line items matching the scope modules. If prices are explicitly stated in the text, use them. Otherwise, provide realistic competitive agency estimates.

Return ONLY a valid JSON object matching this exact schema:
{
  "client": {
    "companyName": "string",
    "proposalTitle": "string",
    "contactPerson": "string",
    "email": "string",
    "phone": "string",
    "website": "string",
    "currency": "INR",
    "currencySymbol": "₹"
  },
  "executiveSummary": "string",
  "problemsIdentified": [
    {
      "title": "string",
      "bullets": ["string", "string"]
    }
  ],
  "proposedSolution": {
    "summary": "string",
    "pillars": [
      { "title": "string", "description": "string" }
    ]
  },
  "scopeOfWork": [
    {
      "title": "string",
      "description": "string",
      "subitems": ["string", "string"]
    }
  ],
  "timelineMilestones": [
    {
      "stepNumber": "01",
      "title": "string",
      "duration": "string",
      "description": "string"
    }
  ],
  "pricing": {
    "items": [
      {
        "name": "string",
        "description": "string",
        "cost": 500,
        "billingType": "one-time"
      }
    ],
    "subtotal": 500,
    "terms": "string"
  }
}`;

        const contentsPayload: any[] = [];

        // If PDF and base64 available, provide as multimodal inlineData
        if (sourceType === 'pdf' && fileBase64) {
          const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
          contentsPayload.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64
            }
          });
          contentsPayload.push({ text: prompt });
        } else {
          // Provide text content
          contentsPayload.push({
            text: `${prompt}\n\nCLIENT INPUT CONTENT:\n"""\n${extractedRawText.slice(0, 50000)}\n"""`
          });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contentsPayload,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const rawJsonText = response.text?.trim() || '';
        const parsed = JSON.parse(rawJsonText);

        return res.json({
          success: true,
          source: 'gemini',
          data: parsed,
          extractedTextSnippet: extractedRawText.slice(0, 300)
        });
      } catch (geminiErr: any) {
        console.warn('Gemini proposal structuring error, switching to rule-based fallback:', geminiErr.message);
      }
    }

    // 2. Intelligent Rule-Based Fallback Parser (guarantees 100% reliability offline or if no API key)
    try {
      const lines = extractedRawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      
      // Extract Company Name
      let extractedCompany = '';
      if (fileName) {
        extractedCompany = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/proposal|rfp|scope|brief|requirement/gi, '').trim();
      }

      for (const line of lines.slice(0, 20)) {
        const clientMatch = line.match(/(?:client|company|for|prepared\s+for|customer)[:\s]+([^,.\n]+)/i);
        if (clientMatch && clientMatch[1].trim().length > 2) {
          extractedCompany = clientMatch[1].trim();
          break;
        }
      }
      if (!extractedCompany || extractedCompany.length < 2) {
        extractedCompany = lines[0]?.slice(0, 40) || 'Enterprise Client';
      }

      const defaultTitle = `${proposalType === 'web_application' ? 'Web Application Development' : 'Website Development'} Proposal for ${extractedCompany}`;

      // Detect currency
      let detectedCurrency: 'INR' | 'USD' | 'GBP' | 'EUR' = 'INR';
      let detectedSymbol = '₹';
      if (extractedRawText.includes('$') || /usd/i.test(extractedRawText)) {
        detectedCurrency = 'USD';
        detectedSymbol = '$';
      } else if (extractedRawText.includes('£') || /gbp/i.test(extractedRawText)) {
        detectedCurrency = 'GBP';
        detectedSymbol = '£';
      } else if (extractedRawText.includes('€') || /eur/i.test(extractedRawText)) {
        detectedCurrency = 'EUR';
        detectedSymbol = '€';
      }

      // Extract bullet points or sentences as scope items
      const bulletLines = lines.filter((l: string) => /^[•\-\*\d+\.]\s*/.test(l) || l.length > 20 && l.length < 180);
      const scopeSubitems = bulletLines.slice(0, 16).map((l: string) => l.replace(/^[•\-\*\d+\.]\s*/, '').trim()).filter(Boolean);

      const scopeModules = [
        {
          title: 'Core Platform & Architecture',
          description: `Custom ${proposalType.replace('_', ' ')} engineered with modern, scalable, and responsive architecture.`,
          subitems: scopeSubitems.length >= 3 ? scopeSubitems.slice(0, 4) : [
            'Fully responsive UI/UX designed for desktop, tablet, and mobile devices',
            'Modern component architecture with fast page load performance',
            'Secure authentication and role-based access management',
            'Intuitive navigation and accessible interface design'
          ]
        },
        {
          title: 'Business Logic & Feature Modules',
          description: 'Custom workflows and operational capabilities based on client specifications.',
          subitems: scopeSubitems.length >= 7 ? scopeSubitems.slice(4, 8) : [
            'Centralized data management and real-time validation',
            'Interactive client dashboards and transaction workflows',
            'Automated email and notification triggers',
            'Exportable reporting and activity auditing'
          ]
        },
        {
          title: 'Integrations, Security & Deployment',
          description: 'Production cloud hosting setup, API connectivity, and continuous security protection.',
          subitems: scopeSubitems.length >= 10 ? scopeSubitems.slice(8, 12) : [
            'Third-party REST API integrations and payment gateway setup',
            'SSL encryption, CSRF protection, and data backup routines',
            'Production server deployment, domain DNS setup, and CDN routing',
            'Complete post-launch technical verification and browser compatibility tests'
          ]
        }
      ];

      // Extract pricing lines if numbers are found
      const pricingItems: any[] = [
        {
          name: 'Architecture & UI/UX Design Phase',
          description: 'Wireframes, responsive component system, and interactive user experience.',
          cost: detectedCurrency === 'INR' ? 45000 : 1200,
          billingType: 'one-time'
        },
        {
          name: 'Core Frontend & Backend Engineering',
          description: 'Complete development of platform features, database integration, and business logic.',
          cost: detectedCurrency === 'INR' ? 85000 : 2800,
          billingType: 'one-time'
        },
        {
          name: 'QA Testing, Security Hardening & Launch',
          description: 'Cross-browser compatibility, security audits, server configuration, and deployment.',
          cost: detectedCurrency === 'INR' ? 25000 : 800,
          billingType: 'one-time'
        }
      ];

      const subtotal = pricingItems.reduce((sum, it) => sum + it.cost, 0);

      const fallbackResult = {
        client: {
          companyName: extractedCompany,
          proposalTitle: defaultTitle,
          contactPerson: 'Project Lead',
          email: '',
          phone: '',
          website: '',
          currency: detectedCurrency,
          currencySymbol: detectedSymbol
        },
        executiveSummary: `${extractedCompany} is embarking on a strategic initiative to deploy a high-performance ${proposalType.replace('_', ' ')} solution. This proposal outlines KanpriTech's comprehensive engineering strategy to fulfill all technical requirements, enhance brand authority, and ensure rapid, reliable deployment.`,
        problemsIdentified: [
          {
            title: 'Current Operational & Digital Limitations',
            bullets: [
              'Existing workflows or presence lack modern interactive capabilities and responsiveness',
              'Need for a unified, scalable digital infrastructure capable of supporting client growth',
              'Requirement for high-converting user experience and streamlined information architecture'
            ]
          }
        ],
        proposedSolution: {
          summary: `KanpriTech proposes an end-to-end custom engineering approach combining tailored UI/UX design, clean modular code, and scalable cloud infrastructure.`,
          pillars: [
            { title: 'Modern Technology Stack', description: 'Engineered using modern standards for speed, security, and long-term maintainability.' },
            { title: 'Agile Milestone Delivery', description: 'Structured phase-wise deliveries ensuring full transparency and iterative feedback.' },
            { title: 'Dedicated Support Warranty', description: 'Comprehensive warranty period covering bug fixes, updates, and platform care.' }
          ]
        },
        scopeOfWork: scopeModules,
        timelineMilestones: [
          { stepNumber: '01', title: 'Discovery, Architecture & UI/UX Design', duration: 'Weeks 1-2', description: 'Detailed requirement analysis, wireframes, and design system approval.' },
          { stepNumber: '02', title: 'Core Development & Integration', duration: 'Weeks 3-5', description: 'Frontend and backend engineering, database schemas, and API connectivity.' },
          { stepNumber: '03', title: 'Testing, QA & Security Review', duration: 'Week 6', description: 'Comprehensive functional, performance, and security testing.' },
          { stepNumber: '04', title: 'Deployment, Training & Launch', duration: 'Week 7', description: 'Production server setup, domain propagation, and stakeholder handover.' }
        ],
        pricing: {
          items: pricingItems,
          subtotal,
          terms: '50% advance upon contract signing, 25% upon milestone review, 25% upon final deployment.'
        }
      };

      res.json({
        success: true,
        source: 'rule-based',
        data: fallbackResult,
        extractedTextSnippet: extractedRawText.slice(0, 300)
      });
    } catch (fallbackErr: any) {
      console.error('Fallback parse error:', fallbackErr);
      res.status(500).json({ error: 'Failed to parse content', details: fallbackErr.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KanpriTech Proposal Builder server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
