/**
 * PDF Extractor Service
 * Owner: George (Architecture)
 *
 * AI-powered extraction of specifications from PDF datasheets
 * Uses Claude API to understand and structure technical documents
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedSpecs {
  // Common fields
  payload?: number;           // kg
  reach?: number;             // mm
  dof?: number;               // degrees of freedom
  weight?: number;            // kg
  repeatability?: number;     // mm
  speed?: Record<string, number>; // axis speeds in deg/s
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  powerRequirement?: string;
  material?: string;

  // Extensible for other specs
  [key: string]: any;
}

export type AssetCategory = 'robot' | 'bearing' | 'actuator' | 'gripper' | 'generic';

export class PDFExtractorService {
  private anthropic: Anthropic | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || null;

    if (this.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.apiKey,
      });
    }
  }

  /**
   * Extract specifications from PDF text using AI
   */
  public async extractSpecs(
    pdfText: string,
    category: AssetCategory = 'generic'
  ): Promise<ExtractedSpecs> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const prompt = this.buildPrompt(pdfText, category);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.2, // Lower temperature for more consistent extraction
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse the AI response
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Extract JSON from the response (AI might include explanation text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in AI response:', responseText);
        return {};
      }

      const extracted = JSON.parse(jsonMatch[0]);
      return this.validateAndClean(extracted);
    } catch (error) {
      console.error('Failed to extract specs from PDF:', error);
      throw error;
    }
  }

  /**
   * Build context-aware prompt for Claude
   */
  private buildPrompt(pdfText: string, category: AssetCategory): string {
    // Truncate PDF text to avoid token limits (keep first ~8000 tokens worth)
    const truncatedText = pdfText.slice(0, 30000);

    const basePrompt = `You are a technical data extraction specialist. Extract specifications from this product datasheet and return them as valid JSON.

PDF Content:
${truncatedText}

`;

    switch (category) {
      case 'robot':
        return (
          basePrompt +
          `Extract these robot specifications:
- payload: Maximum payload capacity in kg (number)
- reach: Maximum reach/working radius in mm (number)
- dof: Degrees of freedom (number, typically 6 for industrial robots)
- weight: Robot arm weight in kg (number)
- repeatability: Position repeatability in mm (number, e.g., 0.02 for ±0.02mm)
- speed: Object with axis speeds in deg/s (e.g., {"J1": 170, "J2": 170, "J3": 230})
- dimensions: Base dimensions in mm {length: number, width: number, height: number}
- powerRequirement: Electrical requirements (string, e.g., "200-230V, 3-phase")
- workingTemp: Operating temperature range in Celsius (string, e.g., "0-45°C")
- ipRating: Ingress protection rating if available (string, e.g., "IP67")

Return ONLY valid JSON. Use null for fields you cannot find. Example:
{
  "payload": 7,
  "reach": 911,
  "dof": 6,
  "weight": 130,
  "repeatability": 0.02,
  "speed": {"J1": 230, "J2": 210, "J3": 230, "J4": 295, "J5": 295, "J6": 400},
  "dimensions": {"length": 710, "width": 710, "height": 1165},
  "powerRequirement": "200V, 3-phase",
  "workingTemp": "0-45°C",
  "ipRating": "IP67"
}`
        );

      case 'bearing':
        return (
          basePrompt +
          `Extract these bearing specifications:
- innerDiameter: Inner diameter in mm (number)
- outerDiameter: Outer diameter in mm (number)
- width: Bearing width in mm (number)
- dynamicLoadRating: Dynamic load capacity in kN (number)
- staticLoadRating: Static load capacity in kN (number)
- maxSpeed: Maximum speed in RPM (number)
- weight: Weight in kg (number)
- material: Bearing material (string)
- sealType: Seal type if present (string, e.g., "2RS", "ZZ")

Return ONLY valid JSON. Use null for missing values.`
        );

      case 'gripper':
        return (
          basePrompt +
          `Extract these gripper specifications:
- gripForce: Gripping force in N (number)
- strokeLength: Finger stroke length in mm (number)
- weight: Gripper weight in kg (number)
- maxPayload: Maximum object weight in kg (number)
- openingRange: Min to max opening in mm (array [min, max])
- powerRequirement: Air pressure or electrical (string)
- dimensions: Overall dimensions {length, width, height} in mm

Return ONLY valid JSON. Use null for missing values.`
        );

      case 'actuator':
        return (
          basePrompt +
          `Extract these actuator specifications:
- stroke: Stroke length in mm (number)
- force: Maximum force in N (number)
- speed: Speed in mm/s (number)
- weight: Weight in kg (number)
- powerRequirement: Voltage or air pressure (string)
- repeatability: Position repeatability in mm (number)
- dimensions: Overall dimensions {length, width, height} in mm

Return ONLY valid JSON. Use null for missing values.`
        );

      default:
        // Generic extraction
        return (
          basePrompt +
          `Extract ALL technical specifications you can find. Look for:
- Physical dimensions (length, width, height, diameter) in mm or inches
- Weight/Mass in kg or lbs
- Performance specifications (speed, capacity, force, power)
- Material composition
- Operating conditions (temperature, pressure, voltage)
- Ratings and certifications
- Any numerical specifications with units

Return as a JSON object with descriptive keys. Convert all measurements to metric units (mm, kg, N, etc.).
Use null for values you cannot find. Be conservative - only include values you are confident about.

Example format:
{
  "length": 500,
  "width": 300,
  "height": 200,
  "weight": 25,
  "maxLoad": 100,
  "material": "Aluminum 6061-T6",
  "operatingTemp": "-10 to 60°C"
}`
        );
    }
  }

  /**
   * Validate and clean extracted data
   */
  private validateAndClean(data: any): ExtractedSpecs {
    const cleaned: ExtractedSpecs = {};

    // Remove null values
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        cleaned[key] = data[key];
      }
    });

    // Validate numeric fields are actually numbers
    const numericFields = [
      'payload',
      'reach',
      'dof',
      'weight',
      'repeatability',
      'innerDiameter',
      'outerDiameter',
      'width',
      'gripForce',
      'stroke',
      'force',
      'speed',
    ];

    numericFields.forEach((field) => {
      if (field in cleaned) {
        const value = cleaned[field];
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            cleaned[field] = parsed;
          } else {
            delete cleaned[field]; // Remove invalid numeric values
          }
        }
      }
    });

    return cleaned;
  }

  /**
   * Extract text from PDF buffer (placeholder - requires pdf-parse library)
   */
  public async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    // This would use pdf-parse or similar library
    // For now, return empty string
    console.warn('[PDFExtractor] PDF parsing not yet implemented');
    return '';
  }

  /**
   * Check if API is configured
   */
  public isConfigured(): boolean {
    return this.anthropic !== null;
  }
}
