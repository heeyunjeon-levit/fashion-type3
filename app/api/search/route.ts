import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI lazily to read fresh env vars on each request
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Map categories to search terms
const categorySearchTerms: Record<string, string[]> = {
  tops: ['jacket', 'coat', 'outerwear', 'shirt', 'sweater', 'blouse', 'top', 'blazer', 'cardigan'],
  bottoms: ['shorts', 'slacks', 'pants', 'trousers', 'jeans', 'skirt', 'leg trousers'],
  bag: ['bag', 'backpack', 'handbag', 'tote bag', 'purse', 'clutch', 'messenger bag', 'shoulder bag', 'wallet'],
  shoes: ['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats', 'loafers', 'oxford'],
  accessory: ['accessory', 'jewelry', 'watch', 'necklace', 'earrings', 'bracelet', 'ring', 'hat', 'cap', 'beanie', 'belt', 'scarf', 'sunglasses'],
  dress: ['dress', 'gown', 'maxi dress', 'midi dress', 'mini dress', 'cocktail dress', 'casual dress'],
}

const categoryLabels: Record<string, string> = {
  tops: '상의 (tops - jackets, coats, shirts, sweaters)',
  bottoms: '하의 (bottoms - shorts, pants, skirts)',
  bag: '가방 (bag - handbags, backpacks, totes)',
  shoes: '신발 (shoes - sneakers, boots, sandals)',
  accessory: '악세사리 (accessories - jewelry, watches, hats, belts)',
  dress: '드레스 (dress - dresses, gowns)',
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== SEARCH REQUEST STARTED ===')
    
    const { categories, croppedImages, originalImageUrl } = await request.json()
    console.log('📤 Received categories:', categories)
    console.log('📤 Cropped images:', Object.keys(croppedImages || {}))
    console.log('🖼️ Original image URL:', originalImageUrl || 'none')

    if (!categories || categories.length === 0 || !croppedImages) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const allResults: Record<string, Array<{ link: string; thumbnail: string | null; title: string | null }>> = {}
    
    console.log(`🔍 Searching categories: ${categories.join(', ')}`)
    
    // First, do a full image search to get results for all item types
    let fullImageResults: any[] = []
    if (originalImageUrl) {
      console.log('\n🔍 Doing full image search for all item types...')
      try {
        const fullImagePromises = Array.from({ length: 1 }, (_, i) => {
          console.log(`   Full image search...`)
          return fetch('https://google.serper.dev/lens', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: originalImageUrl,
              gl: 'kr',
              hl: 'ko',
            }),
          })
        })

        const fullImageResponses = await Promise.all(fullImagePromises)
        
        const allFullImageResults: any[] = []
        for (let i = 0; i < fullImageResponses.length; i++) {
          if (!fullImageResponses[i].ok) {
            console.log(`   ❌ Full image run ${i + 1} failed`)
            continue
          }
          const fullImageData = await fullImageResponses[i].json()
          console.log(`   ✅ Full image run ${i + 1} returned ${fullImageData.organic?.length || 0} results`)
          
          if (fullImageData.organic) {
            allFullImageResults.push(...fullImageData.organic)
          }
        }

        // Deduplicate full image results
        fullImageResults = Array.from(
          new Map(allFullImageResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Full image search returned ${fullImageResults.length} unique results`)
      } catch (error) {
        console.error('❌ Error in full image search:', error)
        // Continue with cropped image search even if full image search fails
      }
    }
    
    // Search each cropped image entry in parallel (handles tops, tops_1, tops_2, ...)
    const croppedEntries = Object.entries(croppedImages || {}) as [string, string][]
    
    // Process all cropped images in parallel for maximum speed
    const searchPromises = croppedEntries.map(async ([resultKey, croppedImageUrl]) => {
      if (!croppedImageUrl) {
        console.log(`⚠️ No cropped image for ${resultKey}`)
        return { resultKey, results: null }
      }

      const categoryKey = resultKey.split('_')[0] // base category without instance suffix
      
      console.log(`\n🔍 Searching for ${resultKey}...`)
      console.log(`   📸 Cropped image URL: ${croppedImageUrl}`)
      
      try {
        // Call Serper Lens once for maximum speed
        const serperCallPromises = Array.from({ length: 1 }, (_, i) => {
          console.log(`   Cropped image search...`)
          return fetch('https://google.serper.dev/lens', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: croppedImageUrl,
              gl: 'kr',
              hl: 'ko',
            }),
          })
        })

        const serperResponses = await Promise.all(serperCallPromises)
        
        // Get results
        const allOrganicResults: any[] = []
        for (let i = 0; i < serperResponses.length; i++) {
          if (!serperResponses[i].ok) {
            const errorText = await serperResponses[i].text()
            console.log(`   ❌ Cropped image search failed:`, errorText.substring(0, 200))
            continue
          }
          const serperData = await serperResponses[i].json()
          console.log(`   ✅ Cropped image search returned ${serperData.organic?.length || 0} results`)
          
          if (serperData.organic) {
            allOrganicResults.push(...serperData.organic)
          }
        }

        // Deduplicate by URL and keep unique results from cropped image
        const uniqueCroppedResults = Array.from(
          new Map(allOrganicResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Cropped image search: ${uniqueCroppedResults.length} unique results`)
        
        // Filter full image results to only include items relevant to this category
        const filteredFullImageResults = fullImageResults.filter(item => {
          const title = item.title?.toLowerCase() || ''
          const snippet = item.snippet?.toLowerCase() || ''
          const combinedText = `${title} ${snippet}`
          
          // Check if the result contains keywords relevant to this category
          const categoryTerms = categorySearchTerms[categoryKey] || [categoryKey]
          return categoryTerms.some(term => combinedText.includes(term.toLowerCase()))
        })
        
        console.log(`📊 Full image results: ${fullImageResults.length} total, ${filteredFullImageResults.length} relevant to ${categoryKey}`)
        
        // Combine cropped image results with filtered full image results
        const combinedResults = [...uniqueCroppedResults, ...filteredFullImageResults]
        
        // Deduplicate the combined results
        const uniqueCombinedResults = Array.from(
          new Map(combinedResults.map(item => [item.link, item])).values()
        )
        
        console.log(`📊 Combined (cropped + full image): ${uniqueCombinedResults.length} unique results`)
        
        const organicResults = uniqueCombinedResults.slice(0, 15) // Keep top 15 for faster GPT analysis
        
        if (organicResults.length === 0) {
          console.log(`⚠️ No Serper results for ${resultKey}`)
          return { resultKey, results: null }
        }
        
        console.log(`📋 Using top ${organicResults.length} results for ${resultKey}`)

        // Extract specific item description from cropped image filename or use generic terms
        // The cropped image filename contains the item description (e.g., "white_ribbed_cardigan")
        const croppedImageFilename = croppedImageUrl.split('/').pop() || ''
        const itemDescription = croppedImageFilename.includes('_') 
          ? croppedImageFilename.split('_').slice(1, -2).join(' ') // Extract item description from filename
          : null
        
        console.log(`🎯 Detected item: ${itemDescription || 'generic terms'}`)

        // Ask GPT to extract product links from results
        const searchTerms = itemDescription 
          ? [itemDescription, ...(categorySearchTerms[categoryKey] || [categoryKey])]
          : (categorySearchTerms[categoryKey] || [categoryKey])
        
        const prompt = `You are analyzing aggregated image search results from multiple runs for ${categoryLabels[categoryKey]}.

The original cropped image shows: ${searchTerms.join(', ')}

🚨 CRITICAL CATEGORY FILTER:
- You are searching for: ${categoryLabels[categoryKey]}
- ONLY return products that match this exact category type
- ${categoryKey === 'tops' ? '❌ EXCLUDE: pants, shorts, skirts, dresses, shoes, bags, accessories' : ''}
- ${categoryKey === 'bottoms' ? '❌ EXCLUDE: shirts, jackets, hoodies, sweaters, dresses, shoes, bags, accessories' : ''}
- ${categoryKey === 'shoes' ? '❌ EXCLUDE: clothing items, bags, accessories' : ''}
- ${categoryKey === 'bag' ? '❌ EXCLUDE: clothing items, shoes, accessories (except bags)' : ''}
- ${categoryKey === 'accessory' ? '❌ EXCLUDE: clothing items, shoes, bags' : ''}
- ${categoryKey === 'dress' ? '❌ EXCLUDE: shirts, pants, shorts, shoes, bags, accessories' : ''}

CRITICAL SELECTION RULES (in order of priority):
1. CATEGORY MATCH FIRST: Must be the correct garment type (${categorySearchTerms[categoryKey]?.join(' OR ')})
2. ITEM TYPE MATCH: Title must mention the correct type (NOT a different category)
3. VISUAL MATCH: Look for titles/descriptions that mention similar style, color, material
4. Accept ANY e-commerce/product website regardless of brand recognition
5. Accept unknown brands, boutique stores, international sites
6. Accept: Amazon, Zara, H&M, Nordstrom, Uniqlo, Musinsa, YesStyle, SHEIN, Etsy, Depop, Poshmark, vintage stores, Korean fashion sites, ANY online retailer
7. ONLY ignore: Instagram, Pinterest, Facebook, Google Images, image CDNs, non-product pages, WRONG GARMENT CATEGORIES

SELECTION PROCESS:
- These results combine cropped image search + full image search for comprehensive coverage
- Scan all results and identify the TOP 3 products that match BOTH category AND visual appearance
- FIRST filter by correct category, THEN match by color/style
- Example for bottoms: "blue shorts" ✅, "blue hoodie" ❌ (wrong category)
- Example for tops: "red sweatshirt" ✅, "red skirt" ❌ (wrong category)
- Prefer actual product pages over homepages, category pages, or general listings

Matching criteria (in order):
1. ✅ MUST be correct category: ${categorySearchTerms[categoryKey]?.join(', ')}
2. Title mentions the SAME COLOR as the cropped image
3. Title mentions similar STYLE (vintage, casual, formal, etc.)
4. Links directly to a product detail page (not category/homepage)

AVALIABILITY NOTES:
- Products from Etsy, Depop, Poshmark, Mercari are from individual sellers and may be sold out
- Try to include at least one link from a major retailer (Amazon, Nordstrom, etc.) if available
- It's okay to include vintage/individual seller links - users can try them and move to the next option if unavailable

Search results (scan all ${organicResults.length} for best matches):
${JSON.stringify(organicResults, null, 2)}

Find the TOP 3 BEST MATCHES based on visual similarity and return them.
Prioritize variety: include different retailers/stores when possible to give users multiple purchasing options.
Return JSON: {"${resultKey}": ["https://url1.com/product1", "https://url2.com/product2", "https://url3.com/product3"]} or {"${resultKey}": []} if NO product links exist.`

        const openai = getOpenAIClient()
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',  // Fast & efficient for structured extraction (was: gpt-4-turbo-preview)
          messages: [
            {
              role: 'system',
              content: 'You extract product links. Return only valid JSON without any additional text or markdown.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        })

        const responseText = completion.choices[0].message.content || '{}'
        console.log(`📄 GPT response for ${resultKey}:`, responseText.substring(0, 200))
        
        // Parse response
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned)
        
        // Handle both single string and array responses
        let links = result[resultKey]
        if (!Array.isArray(links)) {
          // If GPT returns a single link, convert to array
          links = links && typeof links === 'string' && links.startsWith('http') ? [links] : []
        }
        
        // Filter to only valid HTTP links
        const validLinks = links.filter((link: any) => typeof link === 'string' && link.startsWith('http'))
        
        if (validLinks.length > 0) {
          // Debug: Check first organic result structure
          if (organicResults.length > 0) {
            console.log('🔍 Sample Serper result keys:', Object.keys(organicResults[0]))
          }
          
          // Find the thumbnail images for each link from the organic results
          const linksWithThumbnails = validLinks.slice(0, 3).map((link: string) => {
            const resultItem = organicResults.find((item: any) => item.link === link)
            // Try multiple possible field names for thumbnail
            const thumbnail = resultItem?.thumbnail || resultItem?.image || resultItem?.imageUrl || resultItem?.ogImage || null
            console.log(`🔍 Link: ${link.substring(0, 50)}..., Thumbnail: ${thumbnail ? thumbnail.substring(0, 50) : 'null'}`)
            return {
              link,
              thumbnail,
              title: resultItem?.title || null
            }
          })
          
          console.log(`✅ Found ${validLinks.length} link(s) for ${resultKey}:`, validLinks.slice(0, 3))
          return { resultKey, results: linksWithThumbnails }
        } else {
          // Fallback: take top 3 organic results directly
          const fallback = organicResults
            .filter((item: any) => typeof item?.link === 'string' && item.link.startsWith('http'))
            .slice(0, 3)
            .map((item: any) => ({
              link: item.link,
              thumbnail: item.thumbnail || item.image || item.imageUrl || item.ogImage || null,
              title: item.title || null,
            }))
          if (fallback.length > 0) {
            console.log(`🛟 Fallback used for ${resultKey} with ${fallback.length} link(s)`)
            return { resultKey, results: fallback }
          } else {
            console.log(`⚠️ No valid link for ${resultKey}`)
            return { resultKey, results: null }
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for ${resultKey}:`, error)
        return { resultKey, results: null }
      }
    })

    // Wait for all searches to complete in parallel
    const searchResults = await Promise.all(searchPromises)
    
    // Aggregate results
    for (const { resultKey, results } of searchResults) {
      if (results) {
        allResults[resultKey] = results
      }
    }

    console.log('\n📊 Final results:', Object.keys(allResults))
    return NextResponse.json({ results: allResults })
  } catch (error) {
    console.error('❌ Search error:', error)
    return NextResponse.json(
      { error: 'Failed to process search' },
      { status: 500 }
    )
  }
}
