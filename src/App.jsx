import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, ImageIcon, Trash2, Printer, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const PassportPhotoPrinter = () => {
  const photoPresets = [
    { label: '2x3 cm', width: 20, height: 30 },
    { label: '3x4 cm', width: 30, height: 40 },
    { label: '4x6 cm', width: 40, height: 60 },
    { label: '2.5x3.5 cm', width: 25, height: 35 },
    { label: '3.5x4.5 cm', width: 35, height: 45 },
  ];

  const paperPresets = [
    { label: 'A3', width: 297, height: 420 },
    { label: 'A4', width: 210, height: 297 },
    { label: 'A5', width: 148, height: 210 },
    { label: 'A6', width: 105, height: 148 },
    { label: 'Letter', width: 215.9, height: 279.4 },
    { label: 'Legal', width: 215.9, height: 355.6 },
    { label: 'Custom', width: 0, height: 0 },
  ];

  const [selectedPaper, setSelectedPaper] = useState(paperPresets[1]);
  const [customPaper, setCustomPaper] = useState({ width: 210, height: 297 });
  const [selectedPhoto, setSelectedPhoto] = useState(photoPresets[1]);
  const [margin, setMargin] = useState(5);
  const [gutter, setGutter] = useState(0);
  const [border, setBorder] = useState(0);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [guideLines, setGuideLines] = useState('none');
  const [photos, setPhotos] = useState([]);
  const canvasRef = useRef(null);
  const printCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [jsPDFLoaded, setJsPDFLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => setJsPDFLoaded(true);
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 540);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadImageWithExif = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            id: Date.now() + Math.random(),
            file,
            dataUrl: e.target.result,
            width: img.width,
            height: img.height,
            img: img,
            count: 1,
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const loadedPhotos = await Promise.all(files.map(loadImageWithExif));
    setPhotos([...photos, ...loadedPhotos]);
  };

  const removePhoto = (id) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  const updatePhotoCount = (id, count) => {
    setPhotos(photos.map(p => 
      p.id === id ? { ...p, count: Math.max(1, parseInt(count) || 1) } : p
    ));
  };

  const calculateLayout = () => {
    const paper = selectedPaper.label === 'Custom' ? customPaper : selectedPaper;
    const photoW = selectedPhoto.width;
    const photoH = selectedPhoto.height;
    
    const availableWidth = paper.width - (2 * margin);
    const availableHeight = paper.height - (2 * margin);
    
    const cols = Math.floor((availableWidth + gutter) / (photoW + gutter));
    const rows = Math.floor((availableHeight + gutter) / (photoH + gutter));
    
    const maxPhotos = cols * rows;
    
    return { cols, rows, maxPhotos, paperWidth: paper.width, paperHeight: paper.height };
  };

  const generatePhotoArray = () => {
    const { maxPhotos } = calculateLayout();
    const result = [];
    
    for (let photo of photos) {
      for (let i = 0; i < photo.count; i++) {
        if (result.length >= maxPhotos) break;
        result.push(photo);
      }
      if (result.length >= maxPhotos) break;
    }
    
    return result;
  };

  const { cols, rows, maxPhotos, paperWidth, paperHeight } = calculateLayout();
  const photoArray = generatePhotoArray();
  const totalPhotoCount = photos.reduce((sum, p) => sum + p.count, 0);

  const getResponsiveScale = () => {
    if (typeof window === 'undefined') return 1;
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (screenWidth < 540) {
      const availableWidth = screenWidth - 16;
      const availableHeight = screenHeight - 180;
      return Math.min(availableWidth / paperWidth, availableHeight / paperHeight, 4.5);
    }
    
    if (screenWidth < 1024) {
      const availableWidth = screenWidth - 32;
      const availableHeight = screenHeight - 200;
      return Math.min(availableWidth / paperWidth, availableHeight / paperHeight, 4.5);
    }
    
    return Math.min(600 / paperWidth, 800 / paperHeight);
  };

  const [previewScale, setPreviewScale] = useState(getResponsiveScale());

  useEffect(() => {
    const handleResize = () => setPreviewScale(getResponsiveScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [paperWidth, paperHeight]);

  const renderToCanvas = (canvas, dpi) => {
    const paper = selectedPaper.label === 'Custom' ? customPaper : selectedPaper;
    const mmToPixel = dpi / 25.4;
    const ctx = canvas.getContext('2d');
    
    canvas.width = paper.width * mmToPixel;
    canvas.height = paper.height * mmToPixel;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const photoW = selectedPhoto.width * mmToPixel;
    const photoH = selectedPhoto.height * mmToPixel;
    const marginPx = margin * mmToPixel;
    const gutterPx = gutter * mmToPixel;
    const borderPx = border * mmToPixel;
    
    photoArray.forEach((photo, index) => {
      if (!photo) return;
      
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = marginPx + col * (photoW + gutterPx);
      const y = marginPx + row * (photoH + gutterPx);
      
      if (borderPx > 0) {
        ctx.fillStyle = borderColor;
        ctx.fillRect(x - borderPx, y - borderPx, photoW + (borderPx * 2), photoH + (borderPx * 2));
      }
      
      const targetRatio = photoW / photoH;
      const imgRatio = photo.width / photo.height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = photo.height;
        sWidth = photo.height * targetRatio;
        sx = (photo.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = photo.width;
        sHeight = photo.width / targetRatio;
        sx = 0;
        sy = (photo.height - sHeight) / 2;
      }
      
      ctx.drawImage(photo.img, sx, sy, sWidth, sHeight, x, y, photoW, photoH);
    });
    
    if (guideLines === 'cutter') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.3 * mmToPixel;
      ctx.setLineDash([]);
      
      const tickLength = 5 * mmToPixel;
      const photoPositions = new Set();
      photoArray.forEach((photo, index) => {
        if (!photo) return;
        const col = index % cols;
        const row = Math.floor(index / cols);
        photoPositions.add(`${col}-${row}`);
      });
      
      const hasPhoto = (col, row) => photoPositions.has(`${col}-${row}`);
      
      photoArray.forEach((photo, index) => {
        if (!photo) return;
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = marginPx + col * (photoW + gutterPx);
        const y = marginPx + row * (photoH + gutterPx);
        
        const isLeftEdge = !hasPhoto(col - 1, row);
        const isRightEdge = !hasPhoto(col + 1, row);
        const isTopEdge = !hasPhoto(col, row - 1);
        const isBottomEdge = !hasPhoto(col, row + 1);
        
        if (isLeftEdge && isTopEdge) {
          ctx.beginPath();
          ctx.moveTo(x - tickLength, y);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y - tickLength);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (isLeftEdge) {
          ctx.beginPath();
          ctx.moveTo(x - tickLength, y);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (isTopEdge) {
          ctx.beginPath();
          ctx.moveTo(x, y - tickLength);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        
        if (isRightEdge && isTopEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y - tickLength);
          ctx.lineTo(x + photoW, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + photoW, y);
          ctx.lineTo(x + photoW + tickLength, y);
          ctx.stroke();
        } else if (isRightEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y);
          ctx.lineTo(x + photoW + tickLength, y);
          ctx.stroke();
        } else if (isTopEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y - tickLength);
          ctx.lineTo(x + photoW, y);
          ctx.stroke();
        }
        
        if (isLeftEdge && isBottomEdge) {
          ctx.beginPath();
          ctx.moveTo(x - tickLength, y + photoH);
          ctx.lineTo(x, y + photoH);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y + photoH);
          ctx.lineTo(x, y + photoH + tickLength);
          ctx.stroke();
        } else if (isLeftEdge) {
          ctx.beginPath();
          ctx.moveTo(x - tickLength, y + photoH);
          ctx.lineTo(x, y + photoH);
          ctx.stroke();
        } else if (isBottomEdge) {
          ctx.beginPath();
          ctx.moveTo(x, y + photoH);
          ctx.lineTo(x, y + photoH + tickLength);
          ctx.stroke();
        }
        
        if (isRightEdge && isBottomEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y + photoH);
          ctx.lineTo(x + photoW + tickLength, y + photoH);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + photoW, y + photoH);
          ctx.lineTo(x + photoW, y + photoH + tickLength);
          ctx.stroke();
        } else if (isRightEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y + photoH);
          ctx.lineTo(x + photoW + tickLength, y + photoH);
          ctx.stroke();
        } else if (isBottomEdge) {
          ctx.beginPath();
          ctx.moveTo(x + photoW, y + photoH);
          ctx.lineTo(x + photoW, y + photoH + tickLength);
          ctx.stroke();
        }
      });
    } else if (guideLines === 'scissor') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.2 * mmToPixel;
      ctx.setLineDash([]);
      
      photoArray.forEach((photo, index) => {
        if (!photo) return;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = marginPx + col * (photoW + gutterPx);
        const y = marginPx + row * (photoH + gutterPx);
        
        ctx.beginPath();
        ctx.rect(x, y, photoW, photoH);
        ctx.stroke();
      });
    }
  };

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    renderToCanvas(canvas, 300);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'passport-photo-300dpi.png';
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const downloadPDF = () => {
    if (!jsPDFLoaded || !window.jspdf) {
      alert('PDF library is still loading. Please wait a moment and try again.');
      return;
    }

    const canvas = canvasRef.current;
    renderToCanvas(canvas, 300);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        const paper = selectedPaper.label === 'Custom' ? customPaper : selectedPaper;
        const { jsPDF } = window.jspdf;
        
        const pdf = new jsPDF({
          orientation: paper.width > paper.height ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [paper.width, paper.height]
        });
        
        pdf.addImage(img, 'PNG', 0, 0, paper.width, paper.height, '', 'FAST');
        pdf.save('passport-photo.pdf');
        
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    }, 'image/png');
  };

  const handlePrint = () => {
    const canvas = printCanvasRef.current;
    renderToCanvas(canvas, 300);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const printWindow = window.open('', '_blank');
      
      if (printWindow) {
        const paper = selectedPaper.label === 'Custom' ? customPaper : selectedPaper;
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print Passport Photo</title>
            <style>
              @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }
              * { margin: 0; padding: 0; }
              body { margin: 0; }
              img { display: block; width: ${paper.width}mm; height: ${paper.height}mm; }
            </style>
          </head>
          <body>
            <img src="${url}" />
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() { window.close(); };
                }, 250);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }, 'image/png');
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 relative overflow-hidden">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={printCanvasRef} style={{ display: 'none' }} />
      
      <div className={`w-full lg:w-80 bg-white shadow-lg overflow-y-auto lg:relative lg:translate-y-0 fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-y-0' : 'translate-y-full'} max-h-[72vh] lg:max-h-full`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-full bg-blue-500 text-white py-3 flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors sticky top-0 z-10">
          {sidebarOpen ? <><ChevronDown size={20} /><span className="text-sm font-semibold">Hide Controls</span></> : <><ChevronUp size={20} /><span className="text-sm font-semibold">Show Controls</span></>}
        </button>

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">Passport Photo Printer</h1>
        
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Upload Photos</label>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2">
              <Upload size={20} />Choose Photos
            </button>
            
            {photos.length > 0 && (
              <div className="mt-3 space-y-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={photo.dataUrl} alt="" className="w-12 h-12 object-cover rounded" />
                      <span className="text-xs flex-1 truncate">{photo.file.name}</span>
                      <button onClick={() => removePhoto(photo.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">Quantity:</label>
                      <input type="number" min="1" value={photo.count} onChange={(e) => updatePhotoCount(photo.id, e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Paper Size</label>
            <select value={paperPresets.findIndex(p => p.label === selectedPaper.label)} onChange={(e) => setSelectedPaper(paperPresets[e.target.value])} className="w-full border border-gray-300 rounded px-3 py-2">
              {paperPresets.map((preset, idx) => <option key={idx} value={idx}>{preset.label}{preset.width > 0 && ` (${preset.width}x${preset.height} mm)`}</option>)}
            </select>
            
            {selectedPaper.label === 'Custom' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Width (mm)</label>
                  <input type="number" value={customPaper.width} onChange={(e) => setCustomPaper({...customPaper, width: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Height (mm)</label>
                  <input type="number" value={customPaper.height} onChange={(e) => setCustomPaper({...customPaper, height: Number(e.target.value)})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Photo Size</label>
            <select value={photoPresets.findIndex(p => p.label === selectedPhoto.label)} onChange={(e) => setSelectedPhoto(photoPresets[e.target.value])} className="w-full border border-gray-300 rounded px-3 py-2">
              {photoPresets.map((preset, idx) => <option key={idx} value={idx}>{preset.label} ({preset.width}x{preset.height} mm)</option>)}
            </select>
          </div>

          <div className="mb-6 p-3 bg-blue-50 rounded">
            <div className="text-xs text-gray-700 space-y-1">
              <div>Layout: {cols} columns x {rows} rows</div>
              <div>Capacity: {maxPhotos} photos</div>
              <div className="font-semibold">Total photos: {totalPhotoCount}</div>
              {totalPhotoCount > maxPhotos && <div className="text-red-600 font-semibold">Warning: Exceeds capacity! Only {maxPhotos} photos will be printed</div>}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Margin (mm): {margin}</label>
            <input type="range" min="0" max="20" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Gutter/Spacing (mm): {gutter}</label>
            <input type="range" min="0" max="10" value={gutter} onChange={(e) => setGutter(Number(e.target.value))} className="w-full" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Photo Border (mm): {border}</label>
            <input type="range" min="0" max="5" step="0.5" value={border} onChange={(e) => setBorder(Number(e.target.value))} className="w-full" />
            
            {border > 0 && (
              <div className="mt-3">
                <label className="block text-xs text-gray-600 mb-1">Border Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-12 h-8 rounded cursor-pointer" />
                  <input type="text" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="#ffffff" />
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">Cut Guide Lines</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="none" checked={guideLines === 'none'} onChange={(e) => setGuideLines(e.target.value)} />
                <span className="text-sm">No lines</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="cutter" checked={guideLines === 'cutter'} onChange={(e) => setGuideLines(e.target.value)} />
                <span className="text-sm">Cutter marks (corner ticks)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="scissor" checked={guideLines === 'scissor'} onChange={(e) => setGuideLines(e.target.value)} />
                <span className="text-sm">Scissor lines (each photo)</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={handlePrint} disabled={photos.length === 0} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded flex items-center justify-center gap-2 font-semibold">
              <Printer size={20} />Print Now
            </button>
            
            <button onClick={downloadPDF} disabled={photos.length === 0 || !jsPDFLoaded} className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded flex items-center justify-center gap-2 font-semibold">
              <FileText size={20} />{jsPDFLoaded ? 'Download PDF' : 'Loading PDF...'}
            </button>
            
            <button onClick={downloadPNG} disabled={photos.length === 0} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded flex items-center justify-center gap-2 font-semibold">
              <Download size={20} />Download PNG (300 DPI)
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2 text-center">High resolution for best print quality</p>
        </div>
      </div>

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30 bg-blue-500 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-600 transition-all flex items-center gap-2">
          <ChevronUp size={20} /><span className="font-semibold">Show Controls</span>
        </button>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-8 overflow-auto bg-gray-100 h-screen lg:h-auto pb-20 lg:pb-8">
        <div className="mb-2 sm:mb-4 max-w-2xl w-full bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3">
          <p className="text-xs sm:text-sm text-green-800 text-center">
            🔒 <strong>Your privacy is protected!</strong> NO image data uploaded to our server. 
            All image additions and processings are done on your own browser.
          </p>
        </div>

        <div className="w-full flex justify-center items-start" style={{transform: isMobile ? 'scale(1)' : 'scale(1)', transformOrigin: 'top center'}}>
          <div className="bg-white shadow-2xl relative" style={{width: `${paperWidth * previewScale}px`, height: `${paperHeight * previewScale}px`, maxWidth: '100%'}}>
            <div className="absolute" style={{top: `${margin * previewScale}px`, left: `${margin * previewScale}px`, display: 'grid', gridTemplateColumns: `repeat(${cols}, ${selectedPhoto.width * previewScale}px)`, gridAutoRows: `${selectedPhoto.height * previewScale}px`, gap: gutter > 0 ? `${gutter * previewScale}px` : '0px'}}>
              {photoArray.map((photo, idx) => (
                <div key={idx} className="flex items-center justify-center overflow-hidden relative" style={{border: border > 0 ? `${border * previewScale}px solid ${borderColor}` : 'none', backgroundColor: '#f3f4f6'}}>
                  {photo ? <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-300" />}
                </div>
              ))}
            </div>

            {guideLines === 'cutter' && (() => {
              if (photoArray.length === 0) return null;
              
              const photoPositions = new Set();
              photoArray.forEach((photo, index) => {
                if (!photo) return;
                const col = index % cols;
                const row = Math.floor(index / cols);
                photoPositions.add(`${col}-${row}`);
              });
              
              const hasPhoto = (col, row) => photoPositions.has(`${col}-${row}`);
              const tickLen = 5 * previewScale;
              const ticks = [];
              
              photoArray.forEach((photo, index) => {
                if (!photo) return;
                
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = margin * previewScale + col * (selectedPhoto.width * previewScale + gutter * previewScale);
                const y = margin * previewScale + row * (selectedPhoto.height * previewScale + gutter * previewScale);
                const w = selectedPhoto.width * previewScale;
                const h = selectedPhoto.height * previewScale;
                
                const isLeftEdge = !hasPhoto(col - 1, row);
                const isRightEdge = !hasPhoto(col + 1, row);
                const isTopEdge = !hasPhoto(col, row - 1);
                const isBottomEdge = !hasPhoto(col, row + 1);
                
                if (isLeftEdge && isTopEdge) {
                  ticks.push(<line key={`tl-h-${index}`} x1={x - tickLen} y1={y} x2={x} y2={y} stroke="#000" strokeWidth="1" />);
                  ticks.push(<line key={`tl-v-${index}`} x1={x} y1={y - tickLen} x2={x} y2={y} stroke="#000" strokeWidth="1" />);
                } else if (isLeftEdge) {
                  ticks.push(<line key={`l-${index}`} x1={x - tickLen} y1={y} x2={x} y2={y} stroke="#000" strokeWidth="1" />);
                } else if (isTopEdge) {
                  ticks.push(<line key={`t-${index}`} x1={x} y1={y - tickLen} x2={x} y2={y} stroke="#000" strokeWidth="1" />);
                }
                
                if (isRightEdge && isTopEdge) {
                  ticks.push(<line key={`tr-v-${index}`} x1={x + w} y1={y - tickLen} x2={x + w} y2={y} stroke="#000" strokeWidth="1" />);
                  ticks.push(<line key={`tr-h-${index}`} x1={x + w} y1={y} x2={x + w + tickLen} y2={y} stroke="#000" strokeWidth="1" />);
                } else if (isRightEdge) {
                  ticks.push(<line key={`r-${index}`} x1={x + w} y1={y} x2={x + w + tickLen} y2={y} stroke="#000" strokeWidth="1" />);
                } else if (isTopEdge) {
                  ticks.push(<line key={`tr-${index}`} x1={x + w} y1={y - tickLen} x2={x + w} y2={y} stroke="#000" strokeWidth="1" />);
                }
                
                if (isLeftEdge && isBottomEdge) {
                  ticks.push(<line key={`bl-h-${index}`} x1={x - tickLen} y1={y + h} x2={x} y2={y + h} stroke="#000" strokeWidth="1" />);
                  ticks.push(<line key={`bl-v-${index}`} x1={x} y1={y + h} x2={x} y2={y + h + tickLen} stroke="#000" strokeWidth="1" />);
                } else if (isLeftEdge) {
                  ticks.push(<line key={`bl-${index}`} x1={x - tickLen} y1={y + h} x2={x} y2={y + h} stroke="#000" strokeWidth="1" />);
                } else if (isBottomEdge) {
                  ticks.push(<line key={`b-${index}`} x1={x} y1={y + h} x2={x} y2={y + h + tickLen} stroke="#000" strokeWidth="1" />);
                }
                
                if (isRightEdge && isBottomEdge) {
                  ticks.push(<line key={`br-h-${index}`} x1={x + w} y1={y + h} x2={x + w + tickLen} y2={y + h} stroke="#000" strokeWidth="1" />);
                  ticks.push(<line key={`br-v-${index}`} x1={x + w} y1={y + h} x2={x + w} y2={y + h + tickLen} stroke="#000" strokeWidth="1" />);
                } else if (isRightEdge) {
                  ticks.push(<line key={`br-${index}`} x1={x + w} y1={y + h} x2={x + w + tickLen} y2={y + h} stroke="#000" strokeWidth="1" />);
                } else if (isBottomEdge) {
                  ticks.push(<line key={`br2-${index}`} x1={x + w} y1={y + h} x2={x + w} y2={y + h + tickLen} stroke="#000" strokeWidth="1" />);
                }
              });
              
              return <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>{ticks}</svg>;
            })()}

            {guideLines === 'scissor' && (
              <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                {photoArray.map((photo, idx) => {
                  if (!photo) return null;
                  const col = idx % cols;
                  const row = Math.floor(idx / cols);
                  const x = margin * previewScale + col * (selectedPhoto.width * previewScale + gutter * previewScale);
                  const y = margin * previewScale + row * (selectedPhoto.height * previewScale + gutter * previewScale);
                  const w = selectedPhoto.width * previewScale;
                  const h = selectedPhoto.height * previewScale;
                  
                  return <rect key={idx} x={x} y={y} width={w} height={h} fill="none" stroke="#ffffff" strokeWidth="0.5" />;
                })}
              </svg>
            )}

            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded hidden sm:block">
              {paperWidth}x{paperHeight} mm | {selectedPhoto.label}
            </div>
          </div>
        </div>

        <div className="sm:hidden bg-white p-2 fixed bottom-0 left-0 right-0 text-xs text-gray-700 text-center z-20 border-t">
          {paperWidth}x{paperHeight} mm | {selectedPhoto.label}
        </div>
      </div>
    </div>
  );
};

export default PassportPhotoPrinter;