import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// ── WhatFontIs API: detect real fonts from image ──
const WHATFONTIS_API_KEY = process.env.WHATFONTIS_API_KEY;

async function detectFontsFromImage(filePath) {
  if (!WHATFONTIS_API_KEY) {
    console.log('[Warning] WhatFontIs API key not set, skipping font detection');
    return [];
  }
  try {
    // Read image as base64
    let imageBuffer;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      const pngPath = filePath.replace(/\.pdf$/i, '-1.png');
      imageBuffer = fs.existsSync(pngPath) ? fs.readFileSync(pngPath) : fs.readFileSync(filePath);
    } else {
      // Keep small for WhatFontIs — they reject large images (422)
      imageBuffer = await sharp(filePath)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    }
    const base64Image = imageBuffer.toString('base64');

    // Call WhatFontIs API
    const params = new URLSearchParams();
    params.append('API_KEY', WHATFONTIS_API_KEY);
    params.append('IMAGEBASE64', '1');
    params.append('urlimagebase64', base64Image);
    params.append('NOTTEXTBOXSDETECTION', '1');
    params.append('limit', '8');

    const response = await fetch('https://www.whatfontis.com/api2/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('WhatFontIs API error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log(` WhatFontIs detected ${Array.isArray(result) ? result.length : 0} fonts`);

    if (!Array.isArray(result) || result.length === 0) return [];

    // Deduplicate by base font name (remove weight suffixes)
    const seen = new Set();
    const unique = [];
    for (const font of result) {
      const baseName = (font.title || '').replace(/\s*(Bold|Italic|Light|Medium|Regular|Thin|Black|Heavy|Semi|Demi|Extra|Ultra|Condensed)\s*/gi, '').trim();
      if (baseName && !seen.has(baseName.toLowerCase())) {
        seen.add(baseName.toLowerCase());
        unique.push({
          name: font.title,
          url: font.url || null,
          sampleImage: font.image || null,
        });
      }
    }
    return unique.slice(0, 5); // Max 5 unique fonts
  } catch (err) {
    console.error('WhatFontIs detection failed:', err.message);
    return [];
  }
}

// Global brand guidelines state
let brandGuidelines = {
  isSet: false,
  data: null,
  imageUrl: null,
  analysis: null
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" }
});

// Helper: Convert PDF to Image
async function convertPdfToImage(filePath) {
  const outputDir = path.dirname(filePath);
  const opts = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: path.basename(filePath, path.extname(filePath)),
    page: 1,
    scale: 1024
  };

  try {
    const pdf = await import('pdf-poppler');
    const convertFn = pdf.default ? pdf.default.convert : pdf.convert;
    await convertFn(filePath, opts);
    const pngPath = path.join(outputDir, `${opts.out_prefix}-1.png`);
    return pngPath;
  } catch (err) {
    console.error("Error converting PDF to image:", err);
    throw new Error("Failed to process PDF file");
  }
}

// Prepare file for Gemini API
async function fileToGenerativePart(filePath) {
  let targetPath = filePath;
  const ext = path.extname(filePath).toLowerCase();

  // If PDF, convert to image first
  if (ext === '.pdf') {
    console.log(" Detected PDF, converting to image for analysis...");
    targetPath = await convertPdfToImage(filePath);
  }

  // Optimize image with sharp
  try {
    const optimizedBuffer = await sharp(targetPath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return {
      inlineData: {
        data: optimizedBuffer.toString('base64'),
        mimeType: "image/jpeg"
      }
    };
  } catch (err) {
    console.error("Error optimizing image:", err);
    // Fallback
    return {
      inlineData: {
        data: fs.readFileSync(targetPath).toString('base64'),
        mimeType: "image/jpeg"
      }
    };
  }
}

// Initialize - kept for compatibility
export const initializeGenAI = (apiKey) => {
  return true;
};

// Process brand identity uploads
export const processBrandGuidelines = async (filePath) => {
  try {
    console.log(`Processing brand guidelines with Gemini Flash: ${filePath}`);

    const imagePart = await fileToGenerativePart(filePath);

    const prompt = `
    Analyze this brand guideline/design document.
    Extract key brand elements: Colors (hex), Typography, Logo rules, and Visual Style.
    If it's NOT a design document, return field "error": "NOT_RELEVANT".
    
    Output JSON.
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    if (data.error === "NOT_RELEVANT") {
      throw new Error("Not a valid design document.");
    }

    // Store as text representation for future prompts
    const guidelinesSummary = JSON.stringify(data, null, 2);

    brandGuidelines = {
      isSet: true,
      data: guidelinesSummary, // Store the structured analysis
      imageUrl: filePath,
      analysis: guidelinesSummary
    };

    console.log('Brand guidelines stored successfully (Gemini)');

    return {
      success: true,
      message: 'Brand guidelines analyzed and stored',
      imageUrl: filePath,
      analysis: guidelinesSummary
    };
  } catch (error) {
    console.error('Error processing brand guidelines:', error);
    throw new Error(`Failed to process brand guidelines: ${error.message}`);
  }
};

// Analyze designs against brand guidelines
export const analyzeDesign = async (filePath, _unusedGenAI, options = {}) => {
  try {
    const { auditMode, designContext } = options;
    console.log(`Processing design comparison with Gemini Flash: ${filePath}, Mode: ${auditMode}${designContext ? `, Context: ${designContext}` : ''}`);

    const imagePart = await fileToGenerativePart(filePath);
    let prompt;

    // Build optional context line
    const contextLine = designContext
      ? `\n      DESIGN CONTEXT: The designer describes this as: "${designContext}". Tailor your feedback specifically to this type of design — evaluate it against best practices for ${designContext} screens/pages.\n`
      : '';

    if (auditMode === 'universal' || !brandGuidelines.isSet) {
      prompt = `
      You are an elite UI/UX Design Auditor with 15+ years of experience at top design agencies.
      Analyze this design screenshot with the precision of a senior design director reviewing work.
      ${contextLine}

      IMPORTANT RULES:
      - Be SPECIFIC — cite exact UI elements, areas, and visual details you see
      - Give ACTIONABLE suggestions — tell the designer exactly what to change (hex codes, px values, specific improvements)
      - Identify what the designer did WELL (strengths), not just problems
      - Focus on issues that actually matter to a professional designer

      CRITICAL — PIN COORDINATE RULES:
      Imagine overlaying a 100×100 grid on the image. The top-left corner is (0,0) and the bottom-right corner is (100,100).
      For each issue, you MUST point to the CENTER of the specific UI element that has the problem.
      Each pin MUST be at a DIFFERENT location — spread across the design, NOT clustered together.
      
      Coordinate examples for reference:
      - A logo in the top-left corner → x: 8, y: 5
      - A navigation bar across the top → x: 50, y: 5
      - A hero headline in the upper-center → x: 50, y: 25
      - A sidebar on the left → x: 10, y: 50
      - A CTA button in the center → x: 50, y: 50
      - A footer at the bottom → x: 50, y: 95
      - A card on the right side → x: 80, y: 60
      - Left side chart area → x: 25, y: 40
      - Bottom-right element → x: 85, y: 85

      Return a JSON object with this EXACT structure:
      {
        "scores": {
          "overall": number (0-100),
          "visualHierarchy": number (0-100),
          "colorHarmony": number (0-100),
          "typography": number (0-100),
          "spacing": number (0-100),
          "accessibility": number (0-100)
        },
        "colorPalette": [
          {
            "hex": "#hexcode",
            "usage": "Background" | "Primary Text" | "Secondary Text" | "CTA/Accent" | "Border/Divider" | "Card/Surface",
            "contrastWith": "#hexcode of the element it sits on/against",
            "contrastRatio": number (e.g. 4.5),
            "wcag": "AAA" | "AA" | "Fail"
          }
        ],
        "typography": {
          "fontsDetected": ["Font Name 1", "Font Name 2"],
          "hierarchyNote": "One sentence about the type hierarchy quality",
          "issues": ["Specific typography issue 1", "Specific typography issue 2"]
        },
        "spacingAnalysis": "2-3 sentences about spacing consistency, grid usage, and alignment",
        "issues": [
          {
            "title": "Short, specific title (e.g. 'Low contrast on signup button')",
            "description": "2-3 sentences explaining the problem and its impact on users",
            "severity": "high" | "medium" | "low",
            "category": "contrast" | "typography" | "spacing" | "layout" | "accessibility" | "color" | "hierarchy" | "consistency",
            "location": {
              "x": number (0-100, percentage from LEFT edge of image to CENTER of the problematic element),
              "y": number (0-100, percentage from TOP edge of image to CENTER of the problematic element)
            },
            "suggestion": "Specific, actionable fix — include exact values like hex codes, px sizes, or specific UI changes"
          }
        ],
        "strengths": [
          "Specific thing the designer did well (be genuine, cite actual elements)"
        ]
      }

      If the image is NOT a UI/UX design (e.g. a photo, meme, or non-design content), return { "error": "NOT_RELEVANT" }

      Be honest but constructive. A score of 100 should be nearly impossible.
      Detect 3-8 issues maximum — quality over quantity. Each issue MUST point to a DIFFERENT area of the design.
      Extract 4-8 colors from the palette.
      List 2-4 genuine strengths.
      `;
    } else {
      prompt = `
      You are an elite UI/UX Design Auditor with 15+ years at top agencies.
      Compare this design against these BRAND GUIDELINES:
      ${brandGuidelines.data}

      Check Brand Consistency (Colors, Fonts, Visual Tone) AND Universal UI/UX standards.

      IMPORTANT RULES:
      - Be SPECIFIC — cite exact elements and details
      - Give ACTIONABLE suggestions with exact values
      - Pin coordinates must be PRECISE x,y percentages of the problematic element
      - Identify strengths alongside issues
      - Flag any brand deviations with specific "should be X, found Y" comparisons

      Return a JSON object with this EXACT structure:
      {
        "scores": {
          "overall": number (0-100),
          "brandConsistency": number (0-100),
          "visualHierarchy": number (0-100),
          "colorHarmony": number (0-100),
          "typography": number (0-100),
          "spacing": number (0-100),
          "accessibility": number (0-100)
        },
        "colorPalette": [
          {
            "hex": "#hexcode",
            "usage": "Background" | "Primary Text" | "CTA/Accent" | etc,
            "contrastWith": "#hexcode",
            "contrastRatio": number,
            "wcag": "AAA" | "AA" | "Fail",
            "onBrand": true | false,
            "brandExpected": "#hexcode or null"
          }
        ],
        "typography": {
          "fontsDetected": ["Font 1"],
          "hierarchyNote": "Type hierarchy assessment",
          "issues": ["Specific issue"],
          "brandFonts": ["Expected brand fonts"],
          "fontMatchScore": number (0-100)
        },
        "spacingAnalysis": "2-3 sentences about spacing",
        "issues": [
          {
            "title": "Short specific title",
            "description": "2-3 sentences with impact",
            "severity": "high" | "medium" | "low",
            "category": "contrast" | "typography" | "spacing" | "layout" | "accessibility" | "color" | "hierarchy" | "consistency" | "brand",
            "location": { "x": number (0-100), "y": number (0-100) },
            "suggestion": "Actionable fix with exact values"
          }
        ],
        "strengths": ["Genuine positive observation"]
      }

      If NOT a design, return { "error": "NOT_RELEVANT" }
      Detect 3-8 issues, 4-8 colors, 2-4 strengths. Be honest but constructive.
      `;
    }

    // Run Gemini AI analysis + WhatFontIs font detection in PARALLEL
    const [geminiResult, detectedFonts] = await Promise.all([
      model.generateContent([prompt, imagePart]),
      detectFontsFromImage(filePath).catch(err => {
        console.error('Font detection failed (non-blocking):', err.message);
        return [];
      }),
    ]);

    const responseText = geminiResult.response.text();
    console.log("Gemini Response:", responseText.substring(0, 100) + "...");

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '');
      data = JSON.parse(cleaned);
    }

    if (data.error === "NOT_RELEVANT") {
      throw new Error("Image is not design related.");
    }

    // Merge detected fonts into typography section
    if (detectedFonts.length > 0) {
      if (!data.typography) data.typography = {};
      data.typography.detectedFonts = detectedFonts;
      // Also update fontsDetected with real names
      data.typography.fontsDetected = detectedFonts.map(f => f.name);
    }

    return {
      ...data,
      imageUrl: filePath,
      comparedToBrandGuidelines: brandGuidelines.isSet
    };

  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
};

export const analyzeImage = async (filePath) => {
  // Basic analysis logic reusing analyzeDesign or simplified
  return analyzeDesign(filePath, null, { auditMode: 'universal' });
};

export const clearBrandGuidelines = () => {
  brandGuidelines = { isSet: false, data: null, imageUrl: null, analysis: null };
  return { success: true };
};

export const getBrandGuidelinesStatus = () => {
  return { isSet: brandGuidelines.isSet, imageUrl: brandGuidelines.imageUrl };
};