import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Asset cache to prevent reloading
const assetCache = new Map<string, Asset>();
const svgCache = new Map<string, string>();

interface AssetLoadOptions {
  priority?: 'high' | 'normal' | 'low';
  cache?: boolean;
  preload?: boolean;
}

/**
 * Efficient asset loader with caching and priority support
 */
export class AssetLoader {
  private static loadPromises = new Map<string, Promise<Asset>>();
  private static svgLoadPromises = new Map<string, Promise<string>>();

  /**
   * Load an asset with caching
   */
  static async loadAsset(
    assetModule: any,
    options: AssetLoadOptions = {}
  ): Promise<Asset> {
    const { cache = true, priority = 'normal' } = options;
    
    // Generate a unique key for the asset
    const key = typeof assetModule === 'string' ? assetModule : assetModule.toString();
    
    // Return cached asset if available
    if (cache && assetCache.has(key)) {
      return assetCache.get(key)!;
    }

    // Return existing promise if already loading
    if (this.loadPromises.has(key)) {
      return this.loadPromises.get(key)!;
    }

    // Create new loading promise
    const loadPromise = this.loadAssetInternal(assetModule, priority);
    this.loadPromises.set(key, loadPromise);

    try {
      const asset = await loadPromise;
      
      // Cache the asset
      if (cache) {
        assetCache.set(key, asset);
      }
      
      return asset;
    } finally {
      // Clean up promise
      this.loadPromises.delete(key);
    }
  }

  /**
   * Load multiple assets concurrently with batching
   */
  static async loadAssets(
    assetModules: any[],
    options: AssetLoadOptions = {}
  ): Promise<Asset[]> {
    const batchSize = 3; // Limit concurrent loads
    const results: Asset[] = [];
    
    for (let i = 0; i < assetModules.length; i += batchSize) {
      const batch = assetModules.slice(i, i + batchSize);
      const batchPromises = batch.map(module => 
        this.loadAsset(module, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Load and cache SVG content
   */
  static async loadSvg(assetModule: any): Promise<string> {
    const key = assetModule.toString();
    
    // Return cached SVG if available
    if (svgCache.has(key)) {
      return svgCache.get(key)!;
    }

    // Return existing promise if already loading
    if (this.svgLoadPromises.has(key)) {
      return this.svgLoadPromises.get(key)!;
    }

    // Create new loading promise
    const loadPromise = this.loadSvgInternal(assetModule);
    this.svgLoadPromises.set(key, loadPromise);

    try {
      const svgContent = await loadPromise;
      svgCache.set(key, svgContent);
      return svgContent;
    } finally {
      this.svgLoadPromises.delete(key);
    }
  }

  /**
   * Clear asset cache to free memory
   */
  static clearCache(): void {
    assetCache.clear();
    svgCache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  static getCacheStats(): {
    assetCacheSize: number;
    svgCacheSize: number;
    activeLoads: number;
  } {
    return {
      assetCacheSize: assetCache.size,
      svgCacheSize: svgCache.size,
      activeLoads: this.loadPromises.size + this.svgLoadPromises.size,
    };
  }

  private static async loadAssetInternal(
    assetModule: any,
    priority: 'high' | 'normal' | 'low'
  ): Promise<Asset> {
    // Add artificial delay for low priority assets
    if (priority === 'low') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const assets = await Asset.loadAsync(assetModule);
    const asset = Array.isArray(assets) ? assets[0] : assets;
    if (!asset) {
      throw new Error('Failed to load asset');
    }
    return asset;
  }

  private static async loadSvgInternal(assetModule: any): Promise<string> {
    const asset = await Asset.loadAsync(assetModule);
    
    if (asset && 'localUri' in asset && asset.localUri) {
      const content = await FileSystem.readAsStringAsync(asset.localUri as string);
      return content;
    }
    
    throw new Error('Failed to load SVG asset');
  }
}

// Export convenience functions
export const loadAsset = AssetLoader.loadAsset.bind(AssetLoader);
export const loadAssets = AssetLoader.loadAssets.bind(AssetLoader);
export const loadSvg = AssetLoader.loadSvg.bind(AssetLoader);
export const clearAssetCache = AssetLoader.clearCache.bind(AssetLoader);
export const getAssetCacheStats = AssetLoader.getCacheStats.bind(AssetLoader);