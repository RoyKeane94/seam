#!/usr/bin/env python3
"""
Generate Seam extension icons with white background and navy blue "S"
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    exit(1)

def create_icon(size):
    # Create white background
    img = Image.new('RGB', (size, size), color='#FFFFFF')
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle (simulate with filled rectangle for simplicity)
    # For true rounded corners, we'd need to use ImageDraw.rounded_rectangle (Pillow 8.0+)
    # For compatibility, using regular rectangle
    draw.rectangle([0, 0, size-1, size-1], fill='#FFFFFF', outline=None)
    
    # Draw "S" in navy blue
    try:
        # Try to use a system font
        font_size = int(size * 0.65)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Calculate text position (centered)
    bbox = draw.textbbox((0, 0), 'S', font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) / 2
    y = (size - text_height) / 2 - bbox[1]
    
    draw.text((x, y), 'S', fill='#1E40AF', font=font)
    
    return img

def main():
    sizes = [16, 48, 128]
    for size in sizes:
        img = create_icon(size)
        filename = f'icon{size}.png'
        img.save(filename, 'PNG')
        print(f'Created {filename} ({size}x{size})')

if __name__ == '__main__':
    main()

