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
        const fullImagePromises = Array.from({ length: 3 }, (_, i) => {
          console.log(`   Full image run ${i + 1}/3...`)
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
            console.log(`   ❌ Full image run ${i + 1}/3 failed`)
            continue
          }
          const fullImageData = await fullImageResponses[i].json()
          console.log(`   ✅ Full image run ${i + 1}/3 returned ${fullImageData.organic?.length || 0} results`)
          
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
      
      console.log(`\n🔍 Searching for ${resultKey} (3 runs for best coverage)...`)
      console.log(`   📸 Cropped image URL: ${croppedImageUrl}`)
      
      try {
        // Call Serper Lens 3 times for best result coverage
        const serperCallPromises = Array.from({ length: 3 }, (_, i) => {
          console.log(`   Run ${i + 1}/3...`)
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
        
        // Aggregate results from 3 runs
        const allOrganicResults: any[] = []
        for (let i = 0; i < serperResponses.length; i++) {
          if (!serperResponses[i].ok) {
            const errorText = await serperResponses[i].text()
            console.log(`   ❌ Run ${i + 1}/3 failed:`, errorText.substring(0, 200))
            continue
          }
          const serperData = await serperResponses[i].json()
          console.log(`   ✅ Run ${i + 1}/3 returned ${serperData.organic?.length || 0} results`)
          
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
        
        const organicResults = uniqueCombinedResults.slice(0, 30) // Keep top 30 for best GPT analysis
        
        if (organicResults.length === 0) {
          console.log(`⚠️ No Serper results for ${resultKey} after 3 runs`)
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
        
        // For accessories, determine specific sub-type to filter correctly
        let specificAccessoryType = null
        if (categoryKey === 'accessory' && itemDescription) {
          const desc = itemDescription.toLowerCase()
          if (desc.includes('ring')) specificAccessoryType = 'ring'
          else if (desc.includes('necklace')) specificAccessoryType = 'necklace'
          else if (desc.includes('earring')) specificAccessoryType = 'earrings'
          else if (desc.includes('bracelet')) specificAccessoryType = 'bracelet'
          else if (desc.includes('watch')) specificAccessoryType = 'watch'
          else if (desc.includes('hat') || desc.includes('cap') || desc.includes('beanie')) specificAccessoryType = 'headwear'
          else if (desc.includes('belt')) specificAccessoryType = 'belt'
          else if (desc.includes('scarf')) specificAccessoryType = 'scarf'
          else if (desc.includes('sunglasses') || desc.includes('glasses')) specificAccessoryType = 'eyewear'
        }
        
        // Build specific exclusion for accessories
        let accessoryExclusion = ''
        if (categoryKey === 'accessory' && specificAccessoryType) {
          const accessoryTypes = {
            'ring': 'necklaces, earrings, bracelets, watches, hats, belts, scarves, sunglasses',
            'necklace': 'rings, earrings, bracelets, watches, hats, belts, scarves, sunglasses',
            'earrings': 'rings, necklaces, bracelets, watches, hats, belts, scarves, sunglasses',
            'bracelet': 'rings, necklaces, earrings, watches, hats, belts, scarves, sunglasses',
            'watch': 'rings, necklaces, earrings, bracelets, hats, belts, scarves, sunglasses',
            'headwear': 'rings, necklaces, earrings, bracelets, watches, belts, scarves, sunglasses',
            'belt': 'rings, necklaces, earrings, bracelets, watches, hats, scarves, sunglasses',
            'scarf': 'rings, necklaces, earrings, bracelets, watches, hats, belts, sunglasses',
            'eyewear': 'rings, necklaces, earrings, bracelets, watches, hats, belts, scarves'
          }
          accessoryExclusion = `- ⚠️ CRITICAL: You are searching for ${specificAccessoryType} ONLY. ❌ EXCLUDE: ${accessoryTypes[specificAccessoryType]}, clothing, shoes, bags`
        }
        
        const prompt = `You are analyzing aggregated image search results from multiple runs for ${categoryLabels[categoryKey]}.

The original cropped image shows: ${searchTerms.join(', ')}

🚨 CRITICAL CATEGORY FILTER:
- You are searching for: ${categoryLabels[categoryKey]}
- ONLY return products that match this exact category type
- ${categoryKey === 'tops' ? '❌ EXCLUDE: pants, shorts, skirts, dresses, shoes, bags, accessories' : ''}
- ${categoryKey === 'bottoms' ? '❌ EXCLUDE: shirts, jackets, hoodies, sweaters, dresses, shoes, bags, accessories' : ''}
- ${categoryKey === 'shoes' ? '❌ EXCLUDE: clothing items, bags, accessories' : ''}
- ${categoryKey === 'bag' ? '❌ EXCLUDE: clothing items, shoes, accessories (except bags)' : ''}
- ${categoryKey === 'accessory' && !specificAccessoryType ? '❌ EXCLUDE: clothing items, shoes, bags' : ''}
- ${accessoryExclusion}
- ${categoryKey === 'dress' ? '❌ EXCLUDE: shirts, pants, shorts, shoes, bags, accessories' : ''}

CRITICAL SELECTION RULES (in order of priority):
1. CATEGORY MATCH FIRST: Must be the correct garment type (${categorySearchTerms[categoryKey]?.join(' OR ')})
2. ITEM TYPE MATCH: Title must mention the correct type (NOT a different category)
3. VISUAL MATCH: Look for titles/descriptions that mention similar style, color, material
4. Accept ANY e-commerce/product website regardless of brand recognition
5. Accept unknown brands, boutique stores, international sites
6. Accept: Amazon, Zara, H&M, Nordstrom, Uniqlo, Musinsa, YesStyle, SHEIN, Etsy, Depop, Poshmark, vintage stores, Korean fashion sites, ANY online retailer
7. 🚫 REJECT these sites (NOT product pages): Instagram, TikTok, YouTube, Pinterest, Facebook, Twitter/X, Reddit, Google Images, image CDNs, blogs, news sites, wikis, non-product pages
8. If you cannot find 3 VALID PRODUCT LINKS, return fewer than 3. NEVER include non-product sites just to fill the quota.

SELECTION PROCESS:
- These results are aggregated from 3 cropped image runs + 3 full image runs for maximum coverage
- Each result has: "link", "title", "thumbnail" fields
- **CRITICAL: You MUST read and validate the "title" field for EVERY result before selecting it**
- The "title" describes what the link actually shows - use it to verify accuracy
- Example for bottoms: "blue shorts" ✅, "blue hoodie" ❌ (wrong category)
- Example for tops: "red sweatshirt" ✅, "red skirt" ❌ (wrong category)
- Prefer actual product pages over homepages, category pages, or general listings

TITLE VALIDATION RULES (CRITICAL):
1. ✅ READ the "title" field carefully - it tells you what the product actually is
2. ✅ VERIFY the title mentions the CORRECT${specificAccessoryType ? ` ${specificAccessoryType.toUpperCase()}` : ' CATEGORY'} (${searchTerms[0]})
3. ✅ CHECK the title mentions matching COLOR/STYLE details
4. ❌ REJECT if title describes wrong${specificAccessoryType ? ` accessory type (e.g., ${specificAccessoryType} search should NOT return necklaces)` : ' category'} (even if link looks good)
5. ❌ REJECT if title is generic ("Shop now", "Homepage", "Category")

Matching criteria (in order):
1. ✅ Title MUST mention correct category: ${categorySearchTerms[categoryKey]?.join(', ')}
2. ✅ Title MUST mention SAME COLOR as the cropped image  
3. ✅ Title SHOULD mention similar STYLE (vintage, casual, formal, etc.)
4. ✅ Link goes to a product detail page (not category/homepage)

AVALIABILITY NOTES:
- Products from Etsy, Depop, Poshmark, Mercari are from individual sellers and may be sold out
- Try to include at least one link from a major retailer (Amazon, Nordstrom, etc.) if available
- It's okay to include vintage/individual seller links - users can try them and move to the next option if unavailable

Search results (scan all ${organicResults.length} for best matches):
${JSON.stringify(organicResults, null, 2)}

**VALIDATION PROCESS (follow strictly):**
For EACH result you consider:
1. 📖 READ the "title" field first
2. ✅ CHECK: Does title mention the correct category? (${categorySearchTerms[categoryKey]?.join('/')})
3. ✅ CHECK: Does title mention matching color/style?
4. ✅ CHECK: Is it a specific product (not "Shop", "Category", "Homepage")?
5. ❌ SKIP if title doesn't match - even if thumbnail looks good
6. ✅ SELECT only if title validation passes

Find the TOP 3 BEST MATCHES where the TITLE accurately describes a matching product.
Prioritize variety: include different retailers/stores when possible to give users multiple purchasing options.

🚫 IMPORTANT: Return ONLY links where the TITLE confirms it's a matching product. If you find fewer than 3 valid matches, return only what you found (1 or 2 links is fine). 
NEVER include links where the title doesn't match, even if the thumbnail looks similar.

Return JSON: {"${resultKey}": ["https://url1.com/product1", "https://url2.com/product2"]} (1-3 links) or {"${resultKey}": []} if NO valid product links exist.`

        const openai = getOpenAIClient()
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',  // Original model - best quality
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
        
        // Blocked domains - social media and non-product sites
        const blockedDomains = [
          'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
          'pinterest.com', 'facebook.com', 'twitter.com', 'x.com',
          'reddit.com', 'tumblr.com', 'snapchat.com',
          'images.google.com', 'google.com/images'
        ]
        
        // Filter to only valid HTTP links AND exclude blocked domains
        const validLinks = links.filter((link: any) => {
          if (typeof link !== 'string' || !link.startsWith('http')) return false
          
          // Check if link contains any blocked domain
          const linkLower = link.toLowerCase()
          const isBlocked = blockedDomains.some(domain => linkLower.includes(domain))
          
          if (isBlocked) {
            console.log(`🚫 Blocked social media link: ${link.substring(0, 50)}...`)
            return false
          }
          
          return true
        })
        
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
