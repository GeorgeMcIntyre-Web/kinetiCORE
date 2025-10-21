/**
 * AI-Assisted Metadata Extraction Service
 * Owner: George
 * 
 * Automatically extracts asset metadata from manufacturer websites, datasheets, and supplier APIs
 * Reduces asset onboarding from 10 minutes → 30 seconds (review only)
 */

import type { LibraryAsset, AssetCapabilities } from '../types';

/**
 * Metadata extraction configuration
 */
export interface MetadataExtractionConfig {
  query: string; // Part number, URL, or generic name
  sources?: MetadataSource[];
  confidenceThreshold?: number;
  includeSpecifications?: boolean;
  includePricing?: boolean;
  includeImages?: boolean;
}

/**
 * Available metadata sources
 */
export type MetadataSource = 
  | 'mcmaster' 
  | 'grainger' 
  | 'misumi' 
  | 'fanuc' 
  | 'kuka' 
  | 'universal-robots'
  | 'generic-web'
  | 'pdf-extraction';

/**
 * Metadata extraction result
 */
export interface MetadataExtractionResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  data: Partial<LibraryAsset>;
  sources: MetadataSource[];
  errors?: string[];
  warnings?: string[];
  rawData?: Record<string, any>;
}

// Manufacturer-specific scraper interface (for future use)
// interface ManufacturerScraper {
//   name: string;
//   baseUrl: string;
//   searchEndpoint: string;
//   extractMetadata(html: string, partNumber: string): Partial<LibraryAsset>;
//   isValidUrl(url: string): boolean;
// }

/**
 * PDF extraction result
 */
interface PDFExtractionResult {
  text: string;
  specifications: Record<string, string>;
  images: string[];
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  };
}

/**
 * AI-Assisted Metadata Extraction Service
 */
export class MetadataExtractionService {
  private static instance: MetadataExtractionService | null = null;
  private readonly API_BASE_URL = '/api/metadata-extraction';
  
  private constructor() {}

  public static getInstance(): MetadataExtractionService {
    if (!MetadataExtractionService.instance) {
      MetadataExtractionService.instance = new MetadataExtractionService();
    }
    return MetadataExtractionService.instance;
  }

  /**
   * Extract metadata from various sources
   */
  public async extractMetadata(config: MetadataExtractionConfig): Promise<MetadataExtractionResult> {
    try {
      // Determine extraction strategy based on input
      const strategy = this.determineExtractionStrategy(config.query);
      
      switch (strategy.type) {
        case 'part-number':
          return await this.extractFromPartNumber(config.query, config);
        case 'url':
          return await this.extractFromUrl(config.query, config);
        case 'generic-search':
          return await this.extractFromGenericSearch(config.query, config);
        default:
          return {
            success: false,
            confidence: 'low',
            data: {},
            sources: [],
            errors: ['Unknown extraction strategy']
          };
      }
    } catch (error) {
      console.error('[MetadataExtraction] Extraction failed:', error);
      return {
        success: false,
        confidence: 'low',
        data: {},
        sources: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Extract metadata from McMaster-Carr
   */
  public async extractFromMcMaster(partNumber: string): Promise<Partial<LibraryAsset>> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/mcmaster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber })
      });

      if (!response.ok) {
        throw new Error(`McMaster API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseMcMasterData(data);
    } catch (error) {
      console.error('[MetadataExtraction] McMaster extraction failed:', error);
      return {};
    }
  }

  /**
   * Extract metadata from PDF datasheet
   */
  public async extractFromPDF(pdfUrl: string): Promise<PDFExtractionResult> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/pdf-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl })
      });

      if (!response.ok) {
        throw new Error(`PDF extraction error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[MetadataExtraction] PDF extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract metadata from manufacturer website
   */
  public async extractFromManufacturer(url: string): Promise<Partial<LibraryAsset>> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/manufacturer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`Manufacturer extraction error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseManufacturerData(data);
    } catch (error) {
      console.error('[MetadataExtraction] Manufacturer extraction failed:', error);
      return {};
    }
  }

  /**
   * Extract specifications from text using AI
   */
  public async extractSpecificationsFromText(text: string): Promise<AssetCapabilities> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/extract-specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Specification extraction error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseSpecifications(data);
    } catch (error) {
      console.error('[MetadataExtraction] Specification extraction failed:', error);
      return {};
    }
  }

  /**
   * Determine extraction strategy based on input
   */
  private determineExtractionStrategy(query: string): { type: string; value: string } {
    // Check if it's a URL
    if (this.isValidUrl(query)) {
      return { type: 'url', value: query };
    }

    // Check if it's a part number (alphanumeric with specific patterns)
    if (this.isPartNumber(query)) {
      return { type: 'part-number', value: query };
    }

    // Default to generic search
    return { type: 'generic-search', value: query };
  }

  /**
   * Extract metadata from part number
   */
  private async extractFromPartNumber(partNumber: string, _config: MetadataExtractionConfig): Promise<MetadataExtractionResult> {
    const sources: MetadataSource[] = [];
    const errors: string[] = [];
    let combinedData: Partial<LibraryAsset> = {};
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Try McMaster-Carr first (highest success rate)
    try {
      const mcmasterData = await this.extractFromMcMaster(partNumber);
      if (Object.keys(mcmasterData).length > 0) {
        combinedData = { ...combinedData, ...mcmasterData };
        sources.push('mcmaster');
        confidence = 'high';
      }
    } catch (error) {
      errors.push(`McMaster extraction failed: ${error}`);
    }

    // Try manufacturer-specific scrapers
    const manufacturers = ['fanuc', 'kuka', 'universal-robots'];
    for (const manufacturer of manufacturers) {
      try {
        const manufacturerData = await this.extractFromManufacturer(`${manufacturer}.com/search?q=${partNumber}`);
        if (Object.keys(manufacturerData).length > 0) {
          combinedData = { ...combinedData, ...manufacturerData };
          sources.push(manufacturer as MetadataSource);
          if (confidence === 'low') confidence = 'medium';
        }
      } catch (error) {
        errors.push(`${manufacturer} extraction failed: ${error}`);
      }
    }

    return {
      success: Object.keys(combinedData).length > 0,
      confidence,
      data: combinedData,
      sources,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Extract metadata from URL
   */
  private async extractFromUrl(url: string, _config: MetadataExtractionConfig): Promise<MetadataExtractionResult> {
    try {
      const data = await this.extractFromManufacturer(url);
      return {
        success: Object.keys(data).length > 0,
        confidence: 'medium',
        data,
        sources: ['generic-web']
      };
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        data: {},
        sources: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Extract metadata from generic search
   */
  private async extractFromGenericSearch(query: string, _config: MetadataExtractionConfig): Promise<MetadataExtractionResult> {
    // This would use web search APIs to find relevant pages
    // For now, return a basic result
    return {
      success: false,
      confidence: 'low',
      data: {
        name: query,
        description: `Asset found via generic search: ${query}`,
        tags: ['generic', 'search-result']
      },
      sources: ['generic-web']
    };
  }

  /**
   * Parse McMaster-Carr data
   */
  private parseMcMasterData(data: any): Partial<LibraryAsset> {
    return {
      name: data.name || data.title,
      manufacturer: 'McMaster-Carr',
      modelNumber: data.partNumber,
      description: data.description,
      capabilities: {
        dimensions: data.dimensions,
        mass: data.weight,
        material: data.material,
        color: data.color,
        finish: data.finish
      },
      tags: [
        'mcmaster-carr',
        data.category?.toLowerCase(),
        data.material?.toLowerCase(),
        data.finish?.toLowerCase()
      ].filter(Boolean),
      searchKeywords: [
        data.partNumber,
        data.name,
        data.category,
        data.material
      ].filter(Boolean),
      vendor: {
        name: 'McMaster-Carr',
        url: 'https://www.mcmaster.com',
        partNumber: data.partNumber,
        price: data.price,
        currency: 'USD'
      }
    };
  }

  /**
   * Parse manufacturer data
   */
  private parseManufacturerData(data: any): Partial<LibraryAsset> {
    return {
      name: data.name || data.title,
      manufacturer: data.manufacturer,
      modelNumber: data.modelNumber,
      description: data.description,
      capabilities: data.specifications,
      tags: data.tags || [],
      searchKeywords: data.keywords || [],
      documentationUrl: data.documentationUrl,
      specSheetUrl: data.specSheetUrl
    };
  }

  /**
   * Parse specifications from AI response
   */
  private parseSpecifications(data: any): AssetCapabilities {
    return {
      hasKinematics: data.hasKinematics || false,
      dof: data.dof,
      payload: data.payload,
      reach: data.reach,
      dimensions: data.dimensions,
      mass: data.mass,
      powerRequirement: data.powerRequirement,
      precision: data.precision,
      cycleTime: data.cycleTime,
      ...data.otherSpecs
    };
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if string looks like a part number
   */
  private isPartNumber(string: string): boolean {
    // Common part number patterns
    const patterns = [
      /^[A-Z]{2,4}-\d{3,6}$/, // FANUC LR-Mate-200iD
      /^\d{4,8}$/, // Simple numeric
      /^[A-Z]\d{3,6}[A-Z]?$/, // Mixed alphanumeric
      /^[A-Z]{2,4}\d{3,6}[A-Z]?$/ // Prefix + numbers + optional suffix
    ];
    
    return patterns.some(pattern => pattern.test(string.trim()));
  }
}
