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
    
    // Search each cropped image entry separately (handles tops, tops_1, tops_2, ...)
    const croppedEntries = Object.entries(croppedImages || {}) as [string, string][]
    for (const [resultKey, croppedImageUrl] of croppedEntries) {
      if (!croppedImageUrl) {
        console.log(`⚠️ No cropped image for ${resultKey}`)
        continue
      }

      const categoryKey = resultKey.split('_')[0] // base category without instance suffix
      
      console.log(`\n🔍 Searching for ${resultKey} (3 runs for better accuracy)...`)
      console.log(`   📸 Cropped image URL: ${croppedImageUrl}`)
      
      try {
        // Call Serper Lens 3 times and aggregate results for better coverage
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
        
        // Aggregate results from all 3 runs
        const allOrganicResults: any[] = []
        for (let i = 0; i < serperResponses.length; i++) {
          if (!serperResponses[i].ok) {
            const errorText = await serperResponses[i].text()
            console.log(`   ❌ Run ${i + 1} failed:`, errorText.substring(0, 200))
            continue
          }
          const serperData = await serperResponses[i].json()
          console.log(`   ✅ Run ${i + 1} returned ${serperData.organic?.length || 0} results`)
          
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
        
        const organicResults = uniqueCombinedResults.slice(0, 30) // Keep top 30 for GPT
        
        if (organicResults.length === 0) {
          console.log(`⚠️ No Serper results for ${resultKey} after aggregating 3 runs`)
          continue
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

CRITICAL SELECTION RULES (in order of priority):
1. VISUAL MATCH FIRST: Look for titles/descriptions that mention similar style, color, or item type
2. Accept ANY e-commerce/product website regardless of brand recognition
3. Accept unknown brands, boutique stores, international sites
4. Accept: Amazon, Zara, H&M, Nordstrom, Uniqlo, Musinsa, YesStyle, SHEIN, Etsy, Depop, Poshmark, vintage stores, Korean fashion sites, ANY online retailer
5. ONLY ignore: Instagram, Pinterest, Facebook, Google Images, image CDNs, non-product pages

SELECTION PROCESS:
- These results are aggregated from 3 cropped image API runs + full image search for better coverage
- Full image search catches exact matches for all item types in the photo
- Scan all results and identify the TOP 3 products that BEST VISUALLY MATCH the cropped image
- Prioritize products where the title mentions similar style/color/material
- Example: If searching for "red sweatshirt", prefer "red sweatshirt" over "gray hoodie"
- Example: If searching for "blue jeans", prefer "blue denim pants" over "black trousers"
- Prefer actual product pages over homepages, category pages, or general listings
- Return MULTIPLE links (2-3) to give users backup options in case some items are sold out

Matching criteria (in order):
1. Title mentions the SAME COLOR as the cropped image
2. Title mentions the SAME ITEM TYPE (sweatshirt, jeans, boots, etc.)
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
          model: 'gpt-4-turbo-preview',
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
          
          allResults[resultKey] = linksWithThumbnails
          console.log(`✅ Found ${validLinks.length} link(s) for ${resultKey}:`, validLinks.slice(0, 3))
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
            allResults[resultKey] = fallback
            console.log(`🛟 Fallback used for ${resultKey} with ${fallback.length} link(s)`) 
          } else {
            console.log(`⚠️ No valid link for ${resultKey}`)
          }
        }
      } catch (error) {
        console.error(`❌ Error searching for ${resultKey}:`, error)
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
