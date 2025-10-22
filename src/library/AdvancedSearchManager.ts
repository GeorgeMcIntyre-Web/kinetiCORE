/**
 * Advanced Asset Search and Filtering System
 * Owner: George
 * 
 * Intelligent search with semantic understanding, faceted filtering,
 * and personalized recommendations
 */

import type { LibraryAsset } from './types';
import type { User } from '../auth/UserStore';
import type { AssetMetadata } from './AssetMetadataManager';

/**
 * Search Query Types
 */
export interface SearchQuery {
  // Basic search
  query: string;
  filters: SearchFilters;
  
  // Context
  context: SearchContext;
  
  // Sorting and pagination
  sorting: SearchSorting;
  pagination: SearchPagination;
  
  // Advanced options
  options: SearchOptions;
}

export interface SearchFilters {
  // Ownership and access
  ownership: 'own' | 'shared' | 'public' | 'all';
  
  // Asset classification
  assetTypes: string[];
  domains: string[];
  categories: string[];
  manufacturers: string[];
  
  // Technical filters
  capabilities: string[];
  complexity: ('simple' | 'medium' | 'complex')[];
  fileTypes: string[];
  
  // Quality filters
  qualityScore: { min: number; max: number };
  rating: { min: number; max: number };
  validationStatus: string[];
  
  // Usage filters
  usageCount: { min: number; max: number };
  popularityScore: { min: number; max: number };
  trendingScore: { min: number; max: number };
  
  // File properties
  fileSize: { min: number; max: number }; // bytes
  uploadDate: { from: Date; to: Date };
  lastUsed: { from: Date; to: Date };
  
  // Tags and keywords
  tags: string[];
  keywords: string[];
  
  // Relationships
  relatedTo: string[]; // Asset IDs
  compatibleWith: string[]; // Asset IDs
  dependencies: string[]; // Asset IDs
}

export interface SearchContext {
  // User context
  userId: string;
  userRole: string;
  userPreferences: any;
  
  // Project context
  currentProject?: string;
  projectType?: string;
  
  // Session context
  sessionId: string;
  searchHistory: string[];
  recentSearches: string[];
  
  // Geographic context
  timezone: string;
  language: string;
}

export interface SearchSorting {
  field: 'relevance' | 'name' | 'uploadDate' | 'lastUsed' | 'rating' | 'popularity' | 'fileSize';
  order: 'asc' | 'desc';
  secondarySort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset?: number;
}

export interface SearchOptions {
  // Search behavior
  fuzzySearch: boolean;
  semanticSearch: boolean;
  includeSynonyms: boolean;
  caseSensitive: boolean;
  
  // Result options
  includeMetadata: boolean;
  includeAnalytics: boolean;
  includeRelated: boolean;
  maxRelated: number;
  
  // Performance options
  cacheResults: boolean;
  cacheTimeout: number; // seconds
  maxResults: number;
}

export interface SearchResult {
  asset: LibraryAsset;
  metadata?: AssetMetadata;
  score: number;
  matchedFields: string[];
  highlights: SearchHighlight[];
  relatedAssets?: LibraryAsset[];
  suggestions?: SearchSuggestion[];
}

export interface SearchHighlight {
  field: string;
  value: string;
  start: number;
  end: number;
  score: number;
}

export interface SearchSuggestion {
  type: 'query' | 'filter' | 'asset' | 'tag';
  text: string;
  count?: number;
  reason: string;
}

export interface SearchFacet {
  name: string;
  values: SearchFacetValue[];
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface SearchFacetValue {
  value: string | number | boolean;
  count: number;
  selected: boolean;
}

export interface SearchAnalytics {
  queryId: string;
  query: string;
  userId: string;
  timestamp: Date;
  resultCount: number;
  clickThroughRate: number;
  averageScore: number;
  executionTime: number; // ms
  filters: SearchFilters;
}

/**
 * Advanced Search Manager
 */
export class AdvancedSearchManager {
  private static instance: AdvancedSearchManager | null = null;
  private searchCache: Map<string, SearchResult[]> = new Map();
  private searchHistory: Map<string, string[]> = new Map();
  private searchAnalytics: SearchAnalytics[] = [];
  private searchIndex: Map<string, Set<string>> = new Map();
  private synonymDictionary: Map<string, string[]> = new Map();

  private constructor() {
    this.initializeSynonymDictionary();
  }

  public static getInstance(): AdvancedSearchManager {
    if (!AdvancedSearchManager.instance) {
      AdvancedSearchManager.instance = new AdvancedSearchManager();
    }
    return AdvancedSearchManager.instance;
  }

  /**
   * Perform advanced search
   */
  public async search(
    query: SearchQuery,
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>
  ): Promise<{
    results: SearchResult[];
    facets: SearchFacet[];
    suggestions: SearchSuggestion[];
    analytics: SearchAnalytics;
  }> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(query);
    if (query.options.cacheResults && this.searchCache.has(cacheKey)) {
      const cachedResults = this.searchCache.get(cacheKey)!;
      return {
        results: cachedResults,
        facets: this.generateFacets(assets, metadata),
        suggestions: [],
        analytics: this.createAnalytics(queryId, query, cachedResults.length, startTime)
      };
    }

    // Perform search
    const results = await this.performSearch(query, assets, metadata);
    
    // Generate facets
    const facets = this.generateFacets(assets, metadata);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(query, results);
    
    // Cache results
    if (query.options.cacheResults) {
      this.searchCache.set(cacheKey, results);
      setTimeout(() => {
        this.searchCache.delete(cacheKey);
      }, query.options.cacheTimeout * 1000);
    }
    
    // Update search history
    this.updateSearchHistory(query.context.userId, query.query);
    
    // Create analytics
    const analytics = this.createAnalytics(queryId, query, results.length, startTime);
    this.searchAnalytics.push(analytics);
    
    return {
      results,
      facets,
      suggestions,
      analytics
    };
  }

  /**
   * Get search suggestions
   */
  public async getSearchSuggestions(
    partialQuery: string,
    context: SearchContext,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // Query suggestions based on history
    const userHistory = this.searchHistory.get(context.userId) || [];
    const matchingHistory = userHistory
      .filter(query => query.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, limit);
    
    for (const query of matchingHistory) {
      suggestions.push({
        type: 'query',
        text: query,
        reason: 'Previous search'
      });
    }
    
    // Asset name suggestions
    const assetSuggestions = await this.getAssetNameSuggestions(partialQuery, limit);
    suggestions.push(...assetSuggestions);
    
    // Tag suggestions
    const tagSuggestions = await this.getTagSuggestions(partialQuery, limit);
    suggestions.push(...tagSuggestions);
    
    // Manufacturer suggestions
    const manufacturerSuggestions = await this.getManufacturerSuggestions(partialQuery, limit);
    suggestions.push(...manufacturerSuggestions);
    
    return suggestions.slice(0, limit);
  }

  /**
   * Get search facets
   */
  public getSearchFacets(
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>,
    selectedFilters: Partial<SearchFilters> = {}
  ): SearchFacet[] {
    const facets: SearchFacet[] = [];
    
    // Asset types facet
    const assetTypes = new Map<string, number>();
    const domains = new Map<string, number>();
    const manufacturers = new Map<string, number>();
    const tags = new Map<string, number>();
    const capabilities = new Map<string, number>();
    
    for (const asset of assets) {
      // Count asset types
      const assetType = asset.assetType || 'unknown';
      assetTypes.set(assetType, (assetTypes.get(assetType) || 0) + 1);
      
      // Count domains
      const domain = asset.domain || 'general';
      domains.set(domain, (domains.get(domain) || 0) + 1);
      
      // Count tags
      for (const tag of asset.tags || []) {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      }
      
      // Count capabilities
      for (const capability of asset.capabilities || []) {
        capabilities.set(capability, (capabilities.get(capability) || 0) + 1);
      }
      
      // Get metadata for additional facets
      const assetMetadata = metadata.get(asset.id);
      if (assetMetadata) {
        // Count manufacturers
        for (const manufacturer of assetMetadata.searchable.manufacturers) {
          manufacturers.set(manufacturer, (manufacturers.get(manufacturer) || 0) + 1);
        }
      }
    }
    
    // Create facets
    facets.push({
      name: 'Asset Type',
      type: 'string',
      values: Array.from(assetTypes.entries()).map(([value, count]) => ({
        value,
        count,
        selected: selectedFilters.assetTypes?.includes(value) || false
      }))
    });
    
    facets.push({
      name: 'Domain',
      type: 'string',
      values: Array.from(domains.entries()).map(([value, count]) => ({
        value,
        count,
        selected: selectedFilters.domains?.includes(value) || false
      }))
    });
    
    facets.push({
      name: 'Manufacturer',
      type: 'string',
      values: Array.from(manufacturers.entries()).map(([value, count]) => ({
        value,
        count,
        selected: selectedFilters.manufacturers?.includes(value) || false
      }))
    });
    
    facets.push({
      name: 'Tags',
      type: 'string',
      values: Array.from(tags.entries()).map(([value, count]) => ({
        value,
        count,
        selected: selectedFilters.tags?.includes(value) || false
      }))
    });
    
    facets.push({
      name: 'Capabilities',
      type: 'string',
      values: Array.from(capabilities.entries()).map(([value, count]) => ({
        value,
        count,
        selected: selectedFilters.capabilities?.includes(value) || false
      }))
    });
    
    return facets;
  }

  /**
   * Get personalized recommendations
   */
  public async getPersonalizedRecommendations(
    userId: string,
    context: SearchContext,
    limit: number = 10
  ): Promise<LibraryAsset[]> {
    const recommendations: LibraryAsset[] = [];
    
    // Get user's search history
    const userHistory = this.searchHistory.get(userId) || [];
    
    // Get user's recent asset interactions
    const recentInteractions = await this.getUserRecentInteractions(userId);
    
    // Generate recommendations based on:
    // 1. Search history patterns
    // 2. Recent asset interactions
    // 3. Similar users' preferences
    // 4. Trending assets
    
    // Placeholder implementation
    return recommendations;
  }

  /**
   * Get search analytics
   */
  public getSearchAnalytics(
    userId?: string,
    timeRange?: { from: Date; to: Date }
  ): SearchAnalytics[] {
    let analytics = this.searchAnalytics;
    
    if (userId) {
      analytics = analytics.filter(a => a.userId === userId);
    }
    
    if (timeRange) {
      analytics = analytics.filter(a => 
        a.timestamp >= timeRange.from && a.timestamp <= timeRange.to
      );
    }
    
    return analytics;
  }

  /**
   * Clear search cache
   */
  public clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * Private helper methods
   */
  private async performSearch(
    query: SearchQuery,
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const asset of assets) {
      const assetMetadata = metadata.get(asset.id);
      
      // Apply filters
      if (!this.matchesFilters(asset, assetMetadata, query.filters)) {
        continue;
      }
      
      // Calculate relevance score
      const score = this.calculateRelevanceScore(asset, assetMetadata, query);
      
      if (score > 0) {
        const matchedFields = this.getMatchedFields(asset, assetMetadata, query);
        const highlights = this.generateHighlights(asset, assetMetadata, query);
        
        results.push({
          asset,
          metadata: assetMetadata,
          score,
          matchedFields,
          highlights
        });
      }
    }
    
    // Sort results
    results.sort((a, b) => {
      if (query.sorting.field === 'relevance') {
        return query.sorting.order === 'asc' ? a.score - b.score : b.score - a.score;
      }
      
      // Other sorting fields
      const aValue = this.getSortValue(a.asset, a.metadata, query.sorting.field);
      const bValue = this.getSortValue(b.asset, b.metadata, query.sorting.field);
      
      if (aValue < bValue) return query.sorting.order === 'asc' ? -1 : 1;
      if (aValue > bValue) return query.sorting.order === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Apply pagination
    const start = query.pagination.offset || (query.pagination.page * query.pagination.limit);
    const end = start + query.pagination.limit;
    
    return results.slice(start, end);
  }

  private matchesFilters(
    asset: LibraryAsset,
    metadata: AssetMetadata | undefined,
    filters: SearchFilters
  ): boolean {
    // Ownership filter
    if (filters.ownership !== 'all') {
      // This would need to be implemented based on user permissions
      // For now, we'll skip this check
    }
    
    // Asset type filter
    if (filters.assetTypes.length > 0) {
      if (!filters.assetTypes.includes(asset.assetType)) {
        return false;
      }
    }
    
    // Domain filter
    if (filters.domains.length > 0) {
      if (!filters.domains.includes(asset.domain)) {
        return false;
      }
    }
    
    // Tags filter
    if (filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag => 
        asset.tags?.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    // File size filter
    if (filters.fileSize) {
      const fileSize = asset.fileSize || 0;
      if (fileSize < filters.fileSize.min || fileSize > filters.fileSize.max) {
        return false;
      }
    }
    
    // Upload date filter
    if (filters.uploadDate) {
      const uploadDate = asset.createdAt || new Date();
      if (uploadDate < filters.uploadDate.from || uploadDate > filters.uploadDate.to) {
        return false;
      }
    }
    
    // Metadata-based filters
    if (metadata) {
      // Quality score filter
      if (filters.qualityScore) {
        const qualityScore = metadata.quality.qualityScore;
        if (qualityScore < filters.qualityScore.min || qualityScore > filters.qualityScore.max) {
          return false;
        }
      }
      
      // Rating filter
      if (filters.rating) {
        const rating = metadata.analytics.rating;
        if (rating < filters.rating.min || rating > filters.rating.max) {
          return false;
        }
      }
      
      // Manufacturer filter
      if (filters.manufacturers.length > 0) {
        const hasMatchingManufacturer = filters.manufacturers.some(manufacturer =>
          metadata.searchable.manufacturers.includes(manufacturer)
        );
        if (!hasMatchingManufacturer) {
          return false;
        }
      }
    }
    
    return true;
  }

  private calculateRelevanceScore(
    asset: LibraryAsset,
    metadata: AssetMetadata | undefined,
    query: SearchQuery
  ): number {
    let score = 0;
    const searchQuery = query.query.toLowerCase();
    
    // Name match (highest weight)
    if (asset.name.toLowerCase().includes(searchQuery)) {
      score += 1.0;
    }
    
    // Description match
    if (asset.description?.toLowerCase().includes(searchQuery)) {
      score += 0.8;
    }
    
    // Tag matches
    const tagMatches = asset.tags?.filter(tag => 
      tag.toLowerCase().includes(searchQuery)
    ).length || 0;
    score += tagMatches * 0.6;
    
    // Keyword matches
    if (metadata) {
      const keywordMatches = metadata.searchable.keywords.filter(keyword =>
        keyword.toLowerCase().includes(searchQuery)
      ).length;
      score += keywordMatches * 0.4;
    }
    
    // Manufacturer match
    if (metadata) {
      const manufacturerMatches = metadata.searchable.manufacturers.filter(manufacturer =>
        manufacturer.toLowerCase().includes(searchQuery)
      ).length;
      score += manufacturerMatches * 0.5;
    }
    
    // Boost score for popular assets
    if (metadata) {
      score += metadata.analytics.popularityScore * 0.1;
    }
    
    // Boost score for high-rated assets
    if (metadata && metadata.analytics.rating > 0) {
      score += metadata.analytics.rating * 0.2;
    }
    
    return Math.min(score, 10.0); // Cap at 10
  }

  private getMatchedFields(
    asset: LibraryAsset,
    metadata: AssetMetadata | undefined,
    query: SearchQuery
  ): string[] {
    const fields: string[] = [];
    const searchQuery = query.query.toLowerCase();
    
    if (asset.name.toLowerCase().includes(searchQuery)) {
      fields.push('name');
    }
    
    if (asset.description?.toLowerCase().includes(searchQuery)) {
      fields.push('description');
    }
    
    if (asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery))) {
      fields.push('tags');
    }
    
    if (metadata) {
      if (metadata.searchable.keywords.some(keyword => 
        keyword.toLowerCase().includes(searchQuery)
      )) {
        fields.push('keywords');
      }
      
      if (metadata.searchable.manufacturers.some(manufacturer =>
        manufacturer.toLowerCase().includes(searchQuery)
      )) {
        fields.push('manufacturer');
      }
    }
    
    return fields;
  }

  private generateHighlights(
    asset: LibraryAsset,
    metadata: AssetMetadata | undefined,
    query: SearchQuery
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const searchQuery = query.query.toLowerCase();
    
    // Highlight name matches
    const nameIndex = asset.name.toLowerCase().indexOf(searchQuery);
    if (nameIndex !== -1) {
      highlights.push({
        field: 'name',
        value: asset.name,
        start: nameIndex,
        end: nameIndex + searchQuery.length,
        score: 1.0
      });
    }
    
    // Highlight description matches
    if (asset.description) {
      const descIndex = asset.description.toLowerCase().indexOf(searchQuery);
      if (descIndex !== -1) {
        highlights.push({
          field: 'description',
          value: asset.description,
          start: descIndex,
          end: descIndex + searchQuery.length,
          score: 0.8
        });
      }
    }
    
    return highlights;
  }

  private getSortValue(
    asset: LibraryAsset,
    metadata: AssetMetadata | undefined,
    field: string
  ): any {
    switch (field) {
      case 'name':
        return asset.name;
      case 'uploadDate':
        return asset.createdAt || new Date();
      case 'lastUsed':
        return metadata?.analytics.lastUsed || new Date();
      case 'rating':
        return metadata?.analytics.rating || 0;
      case 'popularity':
        return metadata?.analytics.popularityScore || 0;
      case 'fileSize':
        return asset.fileSize || 0;
      default:
        return 0;
    }
  }

  private generateFacets(
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>
  ): SearchFacet[] {
    return this.getSearchFacets(assets, metadata);
  }

  private generateSuggestions(
    query: SearchQuery,
    results: SearchResult[]
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    
    // Suggest related tags
    const allTags = new Set<string>();
    for (const result of results) {
      result.asset.tags?.forEach(tag => allTags.add(tag));
    }
    
    for (const tag of allTags) {
      if (!query.filters.tags.includes(tag)) {
        suggestions.push({
          type: 'filter',
          text: tag,
          reason: 'Related tag'
        });
      }
    }
    
    return suggestions.slice(0, 5);
  }

  private async getAssetNameSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<SearchSuggestion[]> {
    // Placeholder for asset name suggestions
    return [];
  }

  private async getTagSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<SearchSuggestion[]> {
    // Placeholder for tag suggestions
    return [];
  }

  private async getManufacturerSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<SearchSuggestion[]> {
    // Placeholder for manufacturer suggestions
    return [];
  }

  private async getUserRecentInteractions(userId: string): Promise<any[]> {
    // Placeholder for user interaction history
    return [];
  }

  private updateSearchHistory(userId: string, query: string): void {
    if (!this.searchHistory.has(userId)) {
      this.searchHistory.set(userId, []);
    }
    
    const history = this.searchHistory.get(userId)!;
    history.unshift(query);
    
    // Keep only last 50 searches
    if (history.length > 50) {
      history.splice(50);
    }
    
    this.searchHistory.set(userId, history);
  }

  private createAnalytics(
    queryId: string,
    query: SearchQuery,
    resultCount: number,
    startTime: number
  ): SearchAnalytics {
    return {
      queryId,
      query: query.query,
      userId: query.context.userId,
      timestamp: new Date(),
      resultCount,
      clickThroughRate: 0, // Would be calculated from actual clicks
      averageScore: 0, // Would be calculated from results
      executionTime: Date.now() - startTime,
      filters: query.filters
    };
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      query: query.query,
      filters: query.filters,
      sorting: query.sorting
    });
  }

  private initializeSynonymDictionary(): void {
    // Initialize synonym dictionary for better search results
    this.synonymDictionary.set('robot', ['robotic', 'automation', 'automated']);
    this.synonymDictionary.set('conveyor', ['belt', 'transport', 'movement']);
    this.synonymDictionary.set('fixture', ['jig', 'holder', 'clamp']);
    this.synonymDictionary.set('assembly', ['assembly line', 'production', 'manufacturing']);
    this.synonymDictionary.set('tool', ['instrument', 'device', 'equipment']);
  }
}

/**
 * Search API
 */
export class SearchAPI {
  private searchManager: AdvancedSearchManager;

  constructor() {
    this.searchManager = AdvancedSearchManager.getInstance();
  }

  /**
   * Perform advanced search
   */
  public async search(
    query: SearchQuery,
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>
  ) {
    return await this.searchManager.search(query, assets, metadata);
  }

  /**
   * Get search suggestions
   */
  public async getSearchSuggestions(
    partialQuery: string,
    context: SearchContext,
    limit?: number
  ) {
    return await this.searchManager.getSearchSuggestions(partialQuery, context, limit);
  }

  /**
   * Get search facets
   */
  public getSearchFacets(
    assets: LibraryAsset[],
    metadata: Map<string, AssetMetadata>,
    selectedFilters?: Partial<SearchFilters>
  ) {
    return this.searchManager.getSearchFacets(assets, metadata, selectedFilters);
  }

  /**
   * Get personalized recommendations
   */
  public async getPersonalizedRecommendations(
    userId: string,
    context: SearchContext,
    limit?: number
  ) {
    return await this.searchManager.getPersonalizedRecommendations(userId, context, limit);
  }

  /**
   * Get search analytics
   */
  public getSearchAnalytics(
    userId?: string,
    timeRange?: { from: Date; to: Date }
  ) {
    return this.searchManager.getSearchAnalytics(userId, timeRange);
  }

  /**
   * Clear search cache
   */
  public clearSearchCache() {
    this.searchManager.clearSearchCache();
  }
}
