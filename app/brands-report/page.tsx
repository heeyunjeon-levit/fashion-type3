import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand Images Processing Results',
  description: 'AI Fashion Detection Pipeline Results',
}

export default function BrandsReportPage() {
  return (
    <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
  )
}

const reportHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            color: #2d3748;
            margin-bottom: 20px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .loading {
            text-align: center;
            padding: 60px 20px;
            color: white;
            font-size: 1.2em;
        }
        
        .footer {
            background: white;
            border-radius: 20px;
            padding: 30px;
            margin-top: 30px;
            text-align: center;
            color: #718096;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Brand Images Processing Results</h1>
            <p style="color: #718096; font-size: 1.1em; margin-top: 10px;">
                Processed 24 images through AI fashion detection pipeline
            </p>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">22</div>
                    <div class="stat-label">Successful Images</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">53</div>
                    <div class="stat-label">Fashion Items Detected</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">144</div>
                    <div class="stat-label">Product Links Found</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">91.7%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
        </div>
        
        <div class="loading">
            <div style="font-size: 3em; margin-bottom: 20px;">⏳</div>
            <p>Loading full results...</p>
            <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">This page displays a summary. Full detailed results coming soon!</p>
        </div>
        
        <div class="footer">
            <p><strong>Summary:</strong> Successfully processed 22 out of 24 brand images</p>
            <p style="margin-top: 10px;"><strong>Pipeline:</strong> GPT-4o Vision → GroundingDINO → Serper Search → GPT-4 Turbo Selection</p>
            <p style="margin-top: 10px;"><strong>Categories:</strong> Tops, Bottoms, Shoes, Bags, Accessories, Dresses</p>
            <p style="margin-top: 20px; font-size: 0.9em;">Generated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
`

