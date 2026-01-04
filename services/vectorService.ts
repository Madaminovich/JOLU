
import { Product } from '../types';

/**
 * Enhanced similarity search simulation.
 * Uses a multi-factor scoring system based on AI visual analysis result.
 */
export const findSimilarProducts = async (base64Image: string, products: Product[], analysisResult: any): Promise<string[]> => {
  // Simulate latency of heavy vector computation
  await new Promise(r => setTimeout(r, 1200));
  
  if (!analysisResult) {
    return products.slice(0, 4).map(p => p.id);
  }

  const { 
    catalogType, 
    tags = [], 
    color = '', 
    material = '', 
    pattern = '', 
    texture = '', 
    finish = '' 
  } = analysisResult;

  const searchTerms = [
    ...tags, 
    color, 
    material, 
    pattern, 
    texture, 
    finish
  ].filter(Boolean).map(t => t.toLowerCase());

  const scored = products.map(p => {
    let score = 0;
    
    // 1. Hard filter on Type
    if (p.type !== catalogType) return { id: p.id, score: -100 };

    // 2. High-weight matches (Title & Category)
    const pTitle = p.title.toLowerCase();
    const pCat = p.category.toLowerCase();
    const pSku = p.sku.toLowerCase();
    const pDesc = p.description.toLowerCase();

    searchTerms.forEach(term => {
      if (pSku.includes(term)) score += 25; // Exact SKU/Part match
      if (pTitle.includes(term)) score += 15;
      if (pCat.includes(term)) score += 10;
      if (pDesc.includes(term)) score += 5;
    });

    // 3. Technical matches (GSM/Width) for Fabrics
    // Gemini often detects density, we can correlate it with GSM keywords
    if (tags.some(t => t.includes('heavy')) && (p.gsm || 0) > 200) score += 10;
    if (tags.some(t => t.includes('light')) && (p.gsm || 0) < 150) score += 10;

    // 4. Exact duplicate detection simulation
    // In a real system, we'd compare image embeddings.
    // Here we check if the analysis result is a near-perfect semantic match.
    const criticalMatch = searchTerms.every(term => 
      pTitle.includes(term) || pDesc.includes(term) || pSku.includes(term)
    );
    if (criticalMatch) score += 50;

    return { id: p.id, score };
  });

  // Filter and sort
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(s => s.score >= 15) // Threshold for relevance
    .slice(0, 12)
    .map(s => s.id);
};
