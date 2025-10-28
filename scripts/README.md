# Batch Testing Script

This script allows you to test multiple images and categories in parallel to validate the accuracy of your pipeline.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure your servers are running:
   - Next.js dev server: `npm run dev` (should be on port 3000)
   - Python FastAPI server: `cd python_backend && source venv/bin/activate && uvicorn api.server:app --host 0.0.0.0 --port 8000`

## Usage

1. Edit `batch_test.ts` and add your test cases to the `testCases` array. You can use either remote URLs or local image files:

```typescript
const testCases: TestCase[] = [
  // Minimal format - just provide imagePath and categories
  {
    imagePath: 'test_images/outfit1.jpg',
    categories: ['tops', 'bottoms']
  },
  
  // Optional: You can also provide a custom name
  {
    name: 'Light gray ribbed shirt',
    imageUrl: 'https://i.ibb.co/9FTjvrf/d37dda80ed7d.jpg',
    categories: ['tops']
  },
  
  // More examples
  {
    imagePath: 'test_images/full_outfit.jpg',
    categories: ['tops', 'bottoms', 'shoes']
  },
]
```

**Note**: If you don't provide a `name`, it will be automatically generated from the filename (without extension).

**Note**: For local images, make sure you have a `test_images` directory in your project root (or any path relative to the project root). The script will automatically upload local images to imgbb before processing.

2. Run the batch test:
```bash
npm run batch-test
```

## Output

Results are saved to `batch_test_results/results-{timestamp}.json` with detailed information including:
- Test case name and configuration
- Duration for each test
- Cropped image URLs
- Search results (3 links per category with thumbnails)
- Success/failure status
- Any errors encountered

The script also prints a summary to the console showing:
- Number of successful vs failed tests
- Average duration
- Quick preview of results for each test

## Configuration

You can adjust the `concurrencyLimit` in the script to control how many tests run in parallel (default is 2).

