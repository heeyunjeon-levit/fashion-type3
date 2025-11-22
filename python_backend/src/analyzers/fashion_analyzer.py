"""
Unified Fashion Analyzer - Switches between GPT-4o and DINO-X
Controlled by USE_DINOX environment variable

Usage:
    # Use DINO-X (fast):
    export USE_DINOX=true
    
    # Use GPT-4o (default, high quality):
    export USE_DINOX=false  # or unset
"""

import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Feature flag
USE_DINOX = os.getenv('USE_DINOX', 'false').lower() == 'true'

# Log which detector is being used
if USE_DINOX:
    logger.info("🤖 Fashion Analyzer: Using DINO-X (fast mode)")
else:
    logger.info("🧠 Fashion Analyzer: Using GPT-4o (default)")


def analyze_fashion_image(image_url: str) -> Dict[str, Any]:
    """
    Analyze fashion image using the configured detector
    
    Returns consistent format regardless of detector:
    {
        'items': [
            {
                'category': str,
                'bbox': list (optional),
                'confidence': float (optional),
                'groundingdino_prompt': str,
                'description': str
            }
        ],
        'meta': {
            'detector': 'dinox' | 'gpt4o',
            'processing_time': float,
            ...
        }
    }
    """
    if USE_DINOX:
        # Use DINO-X for fast detection
        from .dinox_analyzer import analyze_image_with_dinox
        return analyze_image_with_dinox(image_url)
    else:
        # Use GPT-4o for high-quality detection (default)
        from .gpt4o_analyzer import GPT4OFashionAnalyzer
        
        analyzer = GPT4OFashionAnalyzer()
        result = analyzer.analyze_fashion_items(image_url)
        
        # Add meta information
        if 'meta' not in result:
            result['meta'] = {}
        result['meta']['detector'] = 'gpt4o'
        
        return result


# Export for convenience
__all__ = ['analyze_fashion_image', 'USE_DINOX']

