# Setup Guide

## Step-by-Step Setup Instructions

### 1. AWS S3 Configuration

1. **Create an S3 Bucket**:
   - Log in to AWS Console
   - Navigate to S3 service
   - Click "Create bucket"
   - Choose a unique name (e.g., `image-search-mvp`)
   - Select a region (e.g., `us-east-1`)
   - Uncheck "Block all public access" if you want public URLs, OR configure bucket policy
   - Click "Create bucket"

2. **Configure CORS**:
   - Open your bucket in AWS Console
   - Go to "Permissions" tab
   - Scroll to "Cross-origin resource sharing (CORS)"
   - Click "Edit" and paste the configuration from `s3-cors-config.json`
   - Click "Save changes"

3. **Configure Bucket Policy** (if using public access):
   - In the same "Permissions" tab
   - Click on "Bucket policy"
   - Add the following policy (replace `your-bucket-name`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

4. **Get AWS Credentials**:
   - In AWS Console, go to IAM
   - Create a new user or use existing user
   - Attach policy: `AmazonS3FullAccess` (or create a custom policy for just this bucket)
   - Create Access Key
   - Save the Access Key ID and Secret Access Key

### 2. Serper API Setup

1. **Get API Key**:
   - Go to [https://serper.dev](https://serper.dev)
   - Sign up for an account
   - Navigate to API dashboard
   - Copy your API key

### 3. OpenAI Setup

1. **Get API Key**:
   - Go to [https://platform.openai.com](https://platform.openai.com)
   - Sign up or log in
   - Go to API Keys section
   - Create a new secret key
   - Copy the key (you can't see it again)

### 4. Environment Variables

Create a `.env.local` file in the project root:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your-bucket-name

# Serper API
SERPER_API_KEY=your_serper_api_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Testing

1. Upload an image containing clothing items
2. Select one or more categories (상의, 하의, 신발)
3. View the results with product links

## Troubleshooting

### S3 Upload Errors
- Check that CORS is properly configured
- Verify bucket name in `.env.local`
- Ensure AWS credentials have proper permissions

### Serper API Errors
- Verify API key is correct
- Check API quota/billing status

### OpenAI Errors
- Verify API key is correct
- Check you have credits in your OpenAI account
- Ensure you have access to GPT-4 model

### Image Not Displaying
- Check S3 bucket policy allows public read access
- Verify the image URL is publicly accessible

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

### Important for Production

- Set `NEXT_PUBLIC_BASE_URL` to your production domain
- Ensure S3 bucket has proper permissions
- Consider using presigned URLs for better security
- Monitor API usage and costs

## API Usage Costs

- **Serper API**: Pay-per-search pricing
- **OpenAI GPT-4**: Pay-per-token pricing
- **AWS S3**: Pay-per-storage and request pricing

Optimize by:
- Caching results when possible
- Limiting number of search results processed
- Using GPT-3.5 instead of GPT-4 if acceptable quality difference

