# Image Search MVP

A three-screen image search application that allows users to upload an image, select clothing categories, and find similar products online.

## Features

1. **Image Upload Screen**: Upload an image to get started
2. **Category Selection Screen**: Select from three categories (상의, 하의, 신발) with multi-select capability
3. **Results Screen**: Display product links for the selected categories

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Storage**: AWS S3 for image uploads
- **Search**: Serper API Lens endpoint
- **AI**: OpenAI GPT-4 for intelligent JSON parsing

## Setup

### Prerequisites

- Node.js 18+ installed
- AWS account with S3 bucket configured
- Serper API key
- OpenAI API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with the following variables:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name

SERPER_API_KEY=your_serper_api_key

OPENAI_API_KEY=your_openai_api_key

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

3. Configure your AWS S3 bucket:
   - Create a bucket in your AWS account
   - Enable CORS configuration (see `s3-cors-config.json` for reference)
   - Make the bucket publicly readable or implement pre-signed URLs
   - Update the `.env.local` file with your bucket name and credentials

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. **Image Upload**: User uploads an image which is stored in AWS S3
2. **Category Selection**: User selects one or more categories (tops, bottoms, shoes)
3. **Search Processing**:
   - The uploaded image URL is sent to Serper API's Lens endpoint
   - The API returns image search results
   - GPT-4 analyzes the results and extracts direct product links based on the selected categories
   - Results are filtered to ignore social media links and focus on e-commerce stores
4. **Results Display**: One product link is shown per selected category

## API Endpoints

### POST `/api/upload`
Uploads an image to AWS S3 and returns the public URL.

**Request**: FormData with `file` field
**Response**: `{ imageUrl: string }`

### POST `/api/search`
Processes the image search and returns product links.

**Request**: 
```json
{
  "imageUrl": "string",
  "categories": ["tops", "bottoms", "shoes"]
}
```
**Response**: 
```json
{
  "results": {
    "tops": "https://...",
    "bottoms": "https://...",
    "shoes": "https://..."
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region (e.g., us-east-1) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_S3_BUCKET_NAME` | S3 bucket name |
| `SERPER_API_KEY` | Serper API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `NEXT_PUBLIC_BASE_URL` | Base URL for the application |

## Deployment

The application can be deployed to Vercel:

1. Push your code to a Git repository
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## License

MIT

# fashion-type3
