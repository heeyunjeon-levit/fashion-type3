'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface BboxItem {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  category: string;
  mapped_category: string;
  confidence: number;
  selected?: boolean;
}

interface InteractiveBboxSelectorProps {
  imageUrl: string;
  bboxes: BboxItem[];
  imageSize: [number, number]; // [width, height]
  onSelectionChange: (allBboxes: BboxItem[]) => void; // Receives full array with selection states
  onConfirm: () => void;
  autoDrawMode?: boolean;  // Auto-enable drawing mode (when no items detected)
  onAutoDrawModeUsed?: () => void;  // Callback when auto-draw mode is acknowledged
}

export default function InteractiveBboxSelector({
  imageUrl,
  bboxes: initialBboxes,
  imageSize,
  onSelectionChange,
  onConfirm,
  autoDrawMode = false,
  onAutoDrawModeUsed
}: InteractiveBboxSelectorProps) {
  const { t, language } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Category translation helper
  const translateCategory = (category: string): string => {
    if (language !== 'ko') return category.replace(/_/g, ' ');
    
    const translations: Record<string, string> = {
      'necklace': '목걸이',
      'sunglasses': '선글라스',
      'button_up_shirt': '셔츠',
      'button up shirt': '셔츠',
      'jacket': '재킷',
      'watch': '시계',
      'belt': '벨트',
      'pants': '바지',
      'jeans': '청바지',
      'handbag': '핸드백',
      'bag': '가방',
      'shoes': '신발',
      'dress': '드레스',
      'top': '상의',
      'tops': '상의',
      'bottom': '하의',
      'bottoms': '하의',
      'accessory': '악세사리',
      'accessories': '악세사리',
      'jewelry': '주얼리',
      'earrings': '귀걸이',
      'bracelet': '팔찌',
      'ring': '반지',
      'hat': '모자',
      'scarf': '스카프',
      'gloves': '장갑',
      'coat': '코트',
      'sweater': '스웨터',
      'skirt': '치마',
      'shorts': '반바지',
      'sneakers': '운동화',
      'boots': '부츠',
      'sandals': '샌들',
      'shirt': '셔츠',
      'blouse': '블라우스',
      't-shirt': '티셔츠',
      'tshirt': '티셔츠',
      'tee': '티셔츠',
      'cardigan': '가디건',
      'hoodie': '후드티',
      'vest': '조끼',
      'blazer': '블레이저',
      'tie': '넥타이',
      'bowtie': '나비넥타이',
      'socks': '양말',
      'stockings': '스타킹',
      'leggings': '레깅스',
      'wallet': '지갑',
      'clutch': '클러치',
      'backpack': '백팩',
      'tote': '토트백',
      'crossbody': '크로스백',
      'shoulder bag': '숄더백',
      'heels': '힐',
      'flats': '플랫슈즈',
      'loafers': '로퍼',
      'purse': '지갑',
      'earring': '귀걸이',
      'outerwear': '아우터'
    };
    
    const lowerCategory = category.toLowerCase().replace(/_/g, ' ');
    return translations[lowerCategory] || translations[category.toLowerCase()] || category.replace(/_/g, ' ');
  };
  
  const [bboxes, setBboxes] = useState<BboxItem[]>(
    initialBboxes.map(bbox => ({ ...bbox, selected: false }))
  );
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Manual bbox drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingManualBox, setPendingManualBox] = useState<[number, number, number, number] | null>(null);
  
  // Smart button positioning - alternates left/right sides to prevent overlap
  const getButtonPositions = () => {
    // Estimate button width based on text length (more accurate)
    const estimateButtonWidth = (text: string) => {
      // Smaller buttons: Base width ~50px (padding + icon + gap)
      // Text width: ~7px per character for xs font size
      return Math.max(70, 50 + (text.length * 7));
    };
    
    const buttonHeight = 32; // Smaller height for compact buttons
    const horizontalOffset = 16; // Distance from bbox edge
    const verticalSpacing = 60; // Minimum vertical space between buttons
    
    // Sort bboxes by vertical position (top to bottom)
    const sortedBboxes = bboxes.map((bbox, index) => {
      const [x1, y1, x2, y2] = bbox.bbox;
      const bboxCenterY = ((y1 + y2) / 2) * scale;
      return { bbox, index, bboxCenterY };
    }).sort((a, b) => a.bboxCenterY - b.bboxCenterY);
    
    // Track used positions to prevent overlap
    const usedPositions: Array<{ y: number; side: 'left' | 'right'; width: number; height: number }> = [];
    
    return sortedBboxes.map(({ bbox, index, bboxCenterY }, sortedIndex) => {
      const [x1, y1, x2, y2] = bbox.bbox;
      const scaledX1 = x1 * scale;
      const scaledY1 = y1 * scale;
      const scaledX2 = x2 * scale;
      const scaledY2 = y2 * scale;
      const bboxCenterX = (scaledX1 + scaledX2) / 2;
      
      // Get dynamic button width based on translated category text
      const buttonWidth = estimateButtonWidth(translateCategory(bbox.category));
      
      // Determine which side to use
      // Rule: Alternate sides, but check for conflicts with previous buttons
      let preferredSide: 'left' | 'right' = sortedIndex % 2 === 0 ? 'left' : 'right';
      
      // Check if this position conflicts with recently placed buttons (more sophisticated check)
      const conflicts = usedPositions.filter(pos => {
        // Check for vertical overlap
        const verticalOverlap = Math.abs(pos.y - bboxCenterY) < (pos.height + buttonHeight);
        // Check for same side
        const sameSide = pos.side === preferredSide;
        return verticalOverlap && sameSide;
      });
      
      // If there's a conflict, use the opposite side
      if (conflicts.length > 0) {
        preferredSide = preferredSide === 'left' ? 'right' : 'left';
      }
      
      // Calculate button position based on side
      let buttonX, anchorX;
      if (preferredSide === 'left') {
        buttonX = Math.max(horizontalOffset, scaledX1 - buttonWidth - horizontalOffset);
        anchorX = scaledX1;
      } else {
        buttonX = Math.min(displaySize.width - buttonWidth - horizontalOffset, scaledX2 + horizontalOffset);
        anchorX = scaledX2;
      }
      
      // Vertical centering on the bbox
      const buttonY = Math.max(
        horizontalOffset,
        Math.min(
          displaySize.height - buttonHeight - horizontalOffset,
          bboxCenterY - buttonHeight / 2
        )
      );
      
      // Record this position with width/height for better conflict detection
      usedPositions.push({ 
        y: buttonY, 
        side: preferredSide,
        width: buttonWidth,
        height: buttonHeight
      });
      
      return {
        originalIndex: index,
        buttonX,
        buttonY,
        anchorX,
        anchorY: bboxCenterY,
        bboxCenterX,
        bboxCenterY,
        side: preferredSide
      };
    }).sort((a, b) => a.originalIndex - b.originalIndex); // Restore original order
  };

  // Debug logging
  useEffect(() => {
    console.log('🎨 InteractiveBboxSelector mounted:', {
      initialBboxes: initialBboxes.length,
      imageUrl,
      imageSize,
      autoDrawMode
    });
  }, [initialBboxes.length, imageUrl, imageSize, autoDrawMode]);

  // Auto-enable drawing mode when no items detected
  useEffect(() => {
    if (autoDrawMode && !isDrawingMode) {
      console.log('✏️ Auto-enabling drawing mode (no items detected)');
      setIsDrawingMode(true);
      onAutoDrawModeUsed?.();
    }
  }, [autoDrawMode]);

  // Load image and calculate display size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('🖼️  Image loaded:', {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        imageSize: imageSize
      });
      
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = window.innerHeight * 0.6; // Max 60vh
        
        // Use actual image dimensions instead of relying on imageSize from backend
        const actualWidth = img.naturalWidth;
        const actualHeight = img.naturalHeight;
        
        // Calculate scale to fit container while maintaining aspect ratio
        const scaleX = containerWidth / actualWidth;
        const scaleY = containerHeight / actualHeight;
        const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        setScale(newScale);
        setDisplaySize({
          width: actualWidth * newScale,
          height: actualHeight * newScale
        });
      }
    };
    img.onerror = (e) => {
      console.error('❌ Failed to load image:', e);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw bboxes on canvas (non-interactive, just visual reference)
  useEffect(() => {
    if (!canvasRef.current || displaySize.width === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    console.log('🎨 Drawing bboxes:', {
      count: bboxes.length,
      displaySize,
      scale
    });
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each bbox with subtle, elegant styling
    bboxes.forEach((bbox, idx) => {
      const [x1, y1, x2, y2] = bbox.bbox;
      
      // Bboxes are in absolute pixel coordinates from original image
      // Scale them to display size
      const scaledX1 = x1 * scale;
      const scaledY1 = y1 * scale;
      const scaledX2 = x2 * scale;
      const scaledY2 = y2 * scale;
      
      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;
      
      if (bbox.selected) {
        // Selected: vibrant hot pink with glow effect
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        
        // Outer glow
        ctx.shadowColor = 'rgba(255, 105, 180, 0.4)';
        ctx.shadowBlur = 8;
        ctx.strokeRect(scaledX1, scaledY1, width, height);
        ctx.shadowBlur = 0;
        
        // Light fill
        ctx.fillStyle = 'rgba(255, 105, 180, 0.08)';
        ctx.fillRect(scaledX1, scaledY1, width, height);
      } else {
        // Unselected: subtle dashed border
        ctx.strokeStyle = 'rgba(209, 213, 219, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(scaledX1, scaledY1, width, height);
        ctx.setLineDash([]);
        
        // Very subtle fill
        ctx.fillStyle = 'rgba(229, 231, 235, 0.05)';
        ctx.fillRect(scaledX1, scaledY1, width, height);
      }
    });
    
    // Draw manual box being drawn
    if (isDrawing && drawStart && drawCurrent) {
      const x1 = Math.min(drawStart.x, drawCurrent.x);
      const y1 = Math.min(drawStart.y, drawCurrent.y);
      const x2 = Math.max(drawStart.x, drawCurrent.x);
      const y2 = Math.max(drawStart.y, drawCurrent.y);
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue for manual drawing
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
  }, [bboxes, displaySize, scale, isDrawing, drawStart, drawCurrent]);

  // Handle button click for specific bbox
  const handleBboxToggle = (index: number) => {
    const newBboxes = [...bboxes];
    newBboxes[index] = { ...newBboxes[index], selected: !newBboxes[index].selected };
    setBboxes(newBboxes);
    onSelectionChange(newBboxes);
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    const allSelected = bboxes.every(b => b.selected);
    const newBboxes = bboxes.map(b => ({ ...b, selected: !allSelected }));
    setBboxes(newBboxes);
    onSelectionChange(newBboxes);
  };

  const selectedCount = bboxes.filter(b => b.selected).length;
  
  // Manual drawing handlers (works for both mouse and touch)
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return null;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };
  
  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  };
  
  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isDrawing || !drawStart) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setDrawCurrent(coords);
  };
  
  const handleDrawEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isDrawing || !drawStart || !drawCurrent) return;
    e.preventDefault();
    
    // Calculate bbox in original image coordinates
    const x1 = Math.min(drawStart.x, drawCurrent.x) / scale;
    const y1 = Math.min(drawStart.y, drawCurrent.y) / scale;
    const x2 = Math.max(drawStart.x, drawCurrent.x) / scale;
    const y2 = Math.max(drawStart.y, drawCurrent.y) / scale;
    
    // Only accept box if it's large enough (at least 30x30 pixels)
    if (x2 - x1 > 30 && y2 - y1 > 30) {
      setPendingManualBox([x1, y1, x2, y2]);
      setShowCategoryModal(true);
    }
    
    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };
  
  const handleCategorySelect = (category: string) => {
    if (!pendingManualBox) return;
    
    const newBbox: BboxItem = {
      id: `manual_${Date.now()}`,
      bbox: pendingManualBox,
      category: category,
      mapped_category: category,
      confidence: 1.0,
      selected: true // Auto-select the manually added box
    };
    
    const updatedBboxes = [...bboxes, newBbox];
    setBboxes(updatedBboxes);
    onSelectionChange(updatedBboxes);
    
    setShowCategoryModal(false);
    setPendingManualBox(null);
    setIsDrawingMode(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* No items detected banner */}
      {bboxes.length === 0 && !isDrawingMode && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3">
          <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="font-bold text-lg">
              {language === 'ko' ? '패션 아이템을 찾지 못했어요' : 'No fashion items detected'}
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              {language === 'ko' ? '아래 버튼을 눌러 직접 영역을 선택해주세요' : 'Click the button below to manually select the area'}
            </p>
          </div>
        </div>
      )}

      {/* Drawing mode instruction banner */}
      {isDrawingMode && (
        <div className="mb-4 bg-blue-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-pulse">
          <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
          <div className="flex-1">
            <p className="font-bold text-lg">
              {language === 'ko' ? '드래그해서 박스를 그려주세요' : 'Drag to draw a box'}
            </p>
            <p className="text-sm text-blue-100 mt-0.5">
              {language === 'ko' ? '원하는 아이템 주위를 터치하고 드래그하세요' : 'Touch and drag around the item you want'}
            </p>
          </div>
        </div>
      )}
      
      {/* Image with overlay buttons - Instagram style */}
      <div ref={containerRef} className="relative w-full flex items-center justify-center">
        {displaySize.width > 0 && (
          <div 
            className="relative w-full"
            style={{
              maxWidth: displaySize.width,
              aspectRatio: `${displaySize.width} / ${displaySize.height}`,
            }}
          >
            <img
              src={imageUrl}
              alt="Uploaded"
              className={`w-full h-full object-contain rounded-lg transition-opacity ${isDrawingMode ? 'opacity-80' : ''}`}
            />
            <canvas
              ref={canvasRef}
              width={displaySize.width}
              height={displaySize.height}
              className={`absolute top-0 left-0 w-full h-full ${isDrawingMode ? 'cursor-crosshair pointer-events-auto touch-none' : 'pointer-events-none'}`}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={(e) => {
                if (isDrawing) handleDrawEnd(e);
              }}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
              onTouchCancel={(e) => {
                if (isDrawing) handleDrawEnd(e);
              }}
            />
            
            {/* SVG for connecting lines */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            >
              {getButtonPositions().map((pos, index) => {
                const bbox = bboxes[index];
                const isSelected = bbox.selected;
                const isHovered = hoveredIndex === index;
                
                if (!isSelected && !isHovered) return null;
                
                // Calculate line positions as percentages (adjusted for smaller buttons)
                const buttonCenterX = ((pos.buttonX + 35) / displaySize.width) * 100; // ~half of smaller button width
                const buttonCenterY = ((pos.buttonY + 16) / displaySize.height) * 100; // ~half of smaller button height
                const anchorX = (pos.anchorX / displaySize.width) * 100;
                const anchorY = (pos.anchorY / displaySize.height) * 100;
                
                return (
                  <g key={`line-${bbox.id}`}>
                    {/* Connecting line */}
                    <line
                      x1={`${buttonCenterX}%`}
                      y1={`${buttonCenterY}%`}
                      x2={`${anchorX}%`}
                      y2={`${anchorY}%`}
                      stroke={isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(156,163,175,0.4)'}
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeDasharray={isSelected ? '0' : '3 3'}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}
            </svg>
            
            {/* Overlay buttons - alternating left/right */}
            {getButtonPositions().map((pos, index) => {
              const bbox = bboxes[index];
              
              // Calculate position as percentages for responsive design
              const leftPercent = (pos.buttonX / displaySize.width) * 100;
              const topPercent = (pos.buttonY / displaySize.height) * 100;
              
              return (
                <button
                  key={bbox.id}
                  onClick={() => handleBboxToggle(index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  title={translateCategory(bbox.category)}
                  className={`absolute px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap max-w-[160px] ${
                    bbox.selected
                      ? 'bg-black text-white shadow-lg'
                      : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-md hover:shadow-lg'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    zIndex: 50,
                  }}
                >
                  <span className={language === 'ko' ? 'truncate' : 'capitalize truncate'}>{translateCategory(bbox.category)}</span>
                  {bbox.selected ? (
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom fixed action buttons - Instagram style */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto space-y-3">
          {/* Manual draw button */}
          <button
            onClick={() => {
              if (isDrawingMode) {
                setIsDrawingMode(false);
                setIsDrawing(false);
                setDrawStart(null);
                setDrawCurrent(null);
              } else {
                setIsDrawingMode(true);
              }
            }}
            className={`w-full py-3 text-sm font-semibold rounded-full transition-all ${
              isDrawingMode
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400 shadow-md'
            }`}
          >
            {isDrawingMode 
              ? (language === 'ko' ? '✕ 취소' : '✕ Cancel') 
              : (language === 'ko' ? '✏️ 원하는 패션템이 없어요' : '✏️ Item Missing? Draw It')
            }
          </button>
          
          {/* Confirm button */}
          <button
            onClick={onConfirm}
            disabled={selectedCount === 0}
            className={`w-full py-4 text-base font-bold rounded-full transition-all ${
              selectedCount > 0
                ? 'bg-black text-white hover:bg-gray-900 shadow-xl hover:shadow-2xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {language === 'ko' 
              ? selectedCount > 0 ? `${selectedCount}개 아이템 검색` : '아이템을 선택하세요'
              : selectedCount > 0 ? `Search ${selectedCount} Items` : 'Select items to search'
            }
          </button>
        </div>
      </div>
      
      {/* Category selection modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {language === 'ko' ? '어떤 아이템인가요?' : 'What type of item?'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { ko: '상의', en: 'top', value: 'top' },
                { ko: '하의', en: 'bottom', value: 'bottom' },
                { ko: '원피스', en: 'dress', value: 'dress' },
                { ko: '아우터', en: 'outerwear', value: 'outerwear' },
                { ko: '신발', en: 'shoes', value: 'shoes' },
                { ko: '가방', en: 'bag', value: 'bag' },
                { ko: '모자', en: 'hat', value: 'hat' },
                { ko: '악세사리', en: 'accessories', value: 'accessories' },
                { ko: '치마', en: 'skirt', value: 'skirt' },
                { ko: '바지', en: 'pants', value: 'pants' },
                { ko: '재킷', en: 'jacket', value: 'jacket' },
                { ko: '스웨터', en: 'sweater', value: 'sweater' },
              ].map((category) => (
                <button
                  key={category.value}
                  onClick={() => handleCategorySelect(category.value)}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  {language === 'ko' ? category.ko : category.en}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowCategoryModal(false);
                setPendingManualBox(null);
                setIsDrawingMode(false);
              }}
              className="w-full mt-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              {language === 'ko' ? '취소' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

