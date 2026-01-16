#!/usr/bin/env python3
"""
Portfolio Image Processor

Processes high-resolution images for the web gallery:
1. Generates Deep Zoom Image (DZI) tiles for OpenSeadragon
2. Creates optimized WebP thumbnails and previews
3. Extracts and preserves EXIF/IPTC metadata
4. Outputs gallery.json manifest

Requirements:
    pip install Pillow

Usage:
    python process_images.py --input ./lightroom_exports --output ./public

The input folder should contain your exported TIFFs/JPEGs from Lightroom.
Name files as: "Title - Location.tiff" or just "Title.tiff"
Organize into subfolders for collections: street/, architecture/, landscapes/
"""

import os
import sys
import json
import hashlib
import argparse
import shutil
import math
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

try:
    from PIL import Image, ExifTags
    # Increase limit for high-resolution images (up to 200MP)
    Image.MAX_IMAGE_PIXELS = 200000000
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install required packages: pip install Pillow")
    sys.exit(1)

# Configuration
THUMBNAIL_SIZE = 800      # Max dimension for gallery thumbnails
PREVIEW_SIZE = 2400       # Max dimension for lightbox preview
TILE_SIZE = 254           # DZI tile size (standard for OpenSeadragon)
TILE_OVERLAP = 1          # DZI tile overlap
JPEG_QUALITY = 92         # Quality for previews (visually lossless)
WEBP_QUALITY = 90         # Quality for thumbnails
TILE_QUALITY = 85         # Quality for tiles

SUPPORTED_FORMATS = {'.tiff', '.tif', '.jpg', '.jpeg', '.png', '.heic', '.heif'}


class DeepZoomGenerator:
    """Pure Python Deep Zoom Image generator using Pillow."""

    def __init__(self, tile_size=254, overlap=1, tile_format='jpg', quality=85):
        self.tile_size = tile_size
        self.overlap = overlap
        self.tile_format = tile_format
        self.quality = quality

    def get_num_levels(self, width, height):
        """Calculate number of levels in the pyramid."""
        max_dimension = max(width, height)
        return int(math.ceil(math.log2(max_dimension))) + 1

    def get_level_dimensions(self, width, height, level, num_levels):
        """Get dimensions at a specific level."""
        scale = 2 ** (num_levels - 1 - level)
        return (
            max(1, int(math.ceil(width / scale))),
            max(1, int(math.ceil(height / scale)))
        )

    def get_tile_count(self, level_width, level_height):
        """Get number of tiles at a level."""
        cols = int(math.ceil(level_width / self.tile_size))
        rows = int(math.ceil(level_height / self.tile_size))
        return cols, rows

    def create_tiles(self, image_path: Path, output_dir: Path) -> Dict[str, Any]:
        """Create DZI tiles from an image."""
        # Open image
        img = Image.open(image_path)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        width, height = img.size
        num_levels = self.get_num_levels(width, height)

        # Create output directory structure
        tiles_dir = output_dir / 'image_files'
        tiles_dir.mkdir(parents=True, exist_ok=True)

        # Generate tiles for each level
        for level in range(num_levels):
            level_width, level_height = self.get_level_dimensions(width, height, level, num_levels)

            # Create level directory
            level_dir = tiles_dir / str(level)
            level_dir.mkdir(exist_ok=True)

            # Resize image for this level
            if level == num_levels - 1:
                # Full resolution level
                level_img = img.copy()
            else:
                level_img = img.resize((level_width, level_height), Image.Resampling.LANCZOS)

            # Generate tiles
            cols, rows = self.get_tile_count(level_width, level_height)

            for col in range(cols):
                for row in range(rows):
                    # Calculate tile bounds with overlap
                    x = col * self.tile_size
                    y = row * self.tile_size

                    # Add overlap (except at edges)
                    x1 = max(0, x - self.overlap) if col > 0 else 0
                    y1 = max(0, y - self.overlap) if row > 0 else 0
                    x2 = min(level_width, x + self.tile_size + self.overlap)
                    y2 = min(level_height, y + self.tile_size + self.overlap)

                    # Extract tile
                    tile = level_img.crop((x1, y1, x2, y2))

                    # Save tile
                    tile_path = level_dir / f'{col}_{row}.{self.tile_format}'
                    if self.tile_format == 'jpg':
                        tile.save(tile_path, 'JPEG', quality=self.quality, optimize=True)
                    elif self.tile_format == 'webp':
                        tile.save(tile_path, 'WEBP', quality=self.quality)
                    else:
                        tile.save(tile_path)

            level_img.close()

        # Create DZI descriptor file
        dzi_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="{self.tile_format}"
       Overlap="{self.overlap}"
       TileSize="{self.tile_size}">
    <Size Width="{width}" Height="{height}"/>
</Image>'''

        dzi_path = output_dir / 'image.dzi'
        with open(dzi_path, 'w') as f:
            f.write(dzi_content)

        img.close()

        return {
            'width': width,
            'height': height,
            'num_levels': num_levels,
            'dzi_path': str(dzi_path)
        }


class ImageProcessor:
    def __init__(self, input_dir: Path, output_dir: Path, storage_url: str = ''):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.storage_url = storage_url.rstrip('/')

        # Output subdirectories
        self.thumbnails_dir = output_dir / 'thumbnails'
        self.previews_dir = output_dir / 'previews'
        self.tiles_dir = output_dir / 'tiles'
        self.masters_dir = output_dir / 'masters'

        # Create directories
        for d in [self.thumbnails_dir, self.previews_dir, self.tiles_dir, self.masters_dir]:
            d.mkdir(parents=True, exist_ok=True)

        # DZI generator
        self.dzi_generator = DeepZoomGenerator(
            tile_size=TILE_SIZE,
            overlap=TILE_OVERLAP,
            tile_format='jpg',
            quality=TILE_QUALITY
        )

        self.gallery_data = {
            'title': 'Edward Ma',
            'subtitle': 'Photography',
            'author': 'Edward Ma',
            'storageBaseUrl': storage_url,
            'images': [],
            'collections': [],
            'lastUpdated': datetime.now().isoformat()
        }

    def generate_id(self, filepath: Path) -> str:
        """Generate a unique ID from the file path."""
        content = str(filepath).encode()
        return hashlib.md5(content).hexdigest()[:12]

    def parse_filename(self, filepath: Path) -> Dict[str, str]:
        """Parse title and location from filename."""
        stem = filepath.stem

        # Handle "Title - Location" format
        if ' - ' in stem:
            parts = stem.split(' - ', 1)
            return {'title': parts[0].strip(), 'location': parts[1].strip()}

        return {'title': stem, 'location': None}

    def get_collection(self, filepath: Path) -> Optional[str]:
        """Get collection name from parent folder if it's not the input root."""
        parent = filepath.parent
        if parent != self.input_dir:
            return parent.name
        return None

    def extract_metadata(self, image: Image.Image, filepath: Path) -> Dict[str, Any]:
        """Extract EXIF metadata from image."""
        metadata = {}

        try:
            exif_data = image._getexif()
            if exif_data:
                exif = {ExifTags.TAGS.get(k, k): v for k, v in exif_data.items()}

                # Camera info
                if 'Make' in exif and 'Model' in exif:
                    make = str(exif['Make']).strip()
                    model = str(exif['Model']).strip()
                    # Remove duplicate make from model if present
                    if model.startswith(make):
                        model = model[len(make):].strip()
                    metadata['camera'] = f"{make} {model}"
                elif 'Model' in exif:
                    metadata['camera'] = str(exif['Model']).strip()

                # Lens info
                if 'LensModel' in exif:
                    metadata['lens'] = str(exif['LensModel']).strip()

                # Exposure settings
                if 'FocalLength' in exif:
                    focal = exif['FocalLength']
                    if hasattr(focal, 'numerator'):
                        focal = focal.numerator / focal.denominator
                    elif isinstance(focal, tuple):
                        focal = focal[0] / focal[1] if focal[1] else focal[0]
                    metadata['focalLength'] = f"{int(focal)}mm"

                if 'FNumber' in exif:
                    f_num = exif['FNumber']
                    if hasattr(f_num, 'numerator'):
                        f_num = f_num.numerator / f_num.denominator
                    elif isinstance(f_num, tuple):
                        f_num = f_num[0] / f_num[1] if f_num[1] else f_num[0]
                    metadata['aperture'] = f"f/{f_num:.1f}".rstrip('0').rstrip('.')

                if 'ExposureTime' in exif:
                    exp = exif['ExposureTime']
                    if hasattr(exp, 'numerator'):
                        if exp.numerator == 1:
                            metadata['shutterSpeed'] = f"1/{exp.denominator}s"
                        else:
                            val = exp.numerator / exp.denominator
                            if val < 1:
                                metadata['shutterSpeed'] = f"1/{int(1/val)}s"
                            else:
                                metadata['shutterSpeed'] = f"{val:.1f}s"
                    elif isinstance(exp, tuple):
                        if exp[0] == 1:
                            metadata['shutterSpeed'] = f"1/{exp[1]}s"
                        else:
                            val = exp[0] / exp[1] if exp[1] else exp[0]
                            metadata['shutterSpeed'] = f"{val}s"

                if 'ISOSpeedRatings' in exif:
                    iso = exif['ISOSpeedRatings']
                    if isinstance(iso, tuple):
                        iso = iso[0]
                    metadata['iso'] = str(iso)

                # Date
                if 'DateTimeOriginal' in exif:
                    try:
                        dt = datetime.strptime(str(exif['DateTimeOriginal']), '%Y:%m:%d %H:%M:%S')
                        metadata['date'] = dt.strftime('%B %d, %Y')
                        metadata['dateSort'] = dt.strftime('%Y%m%d%H%M%S')
                    except:
                        pass
        except Exception as e:
            print(f"  Warning: Could not extract EXIF from {filepath.name}: {e}")

        return metadata

    def create_thumbnail(self, image: Image.Image, output_path: Path) -> None:
        """Create an optimized WebP thumbnail."""
        img = image.copy()
        img.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.Resampling.LANCZOS)

        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        img.save(output_path, 'WEBP', quality=WEBP_QUALITY, method=6)
        img.close()

    def create_preview(self, image: Image.Image, output_path: Path) -> None:
        """Create a high-quality preview image."""
        img = image.copy()
        img.thumbnail((PREVIEW_SIZE, PREVIEW_SIZE), Image.Resampling.LANCZOS)

        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        img.save(output_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
        img.close()

    def copy_master(self, filepath: Path, output_path: Path) -> int:
        """Copy the master file and return its size."""
        shutil.copy2(filepath, output_path)
        return output_path.stat().st_size

    def process_image(self, filepath: Path, index: int, total: int) -> Optional[Dict[str, Any]]:
        """Process a single image file."""
        print(f"[{index}/{total}] Processing: {filepath.name}")

        try:
            # Generate unique ID
            image_id = self.generate_id(filepath)

            # Parse filename
            name_info = self.parse_filename(filepath)
            collection = self.get_collection(filepath)

            # Open image with Pillow for metadata and resizing
            with Image.open(filepath) as img:
                width, height = img.size
                aspect_ratio = width / height

                # Extract metadata
                metadata = self.extract_metadata(img, filepath)

                # Create thumbnail
                thumb_path = self.thumbnails_dir / f"{image_id}.webp"
                self.create_thumbnail(img, thumb_path)
                print(f"        -> Thumbnail created")

                # Create preview
                preview_path = self.previews_dir / f"{image_id}.jpg"
                self.create_preview(img, preview_path)
                print(f"        -> Preview created")

            # Create DZI tiles
            tiles_folder = self.tiles_dir / image_id
            tiles_folder.mkdir(exist_ok=True)
            dzi_info = self.dzi_generator.create_tiles(filepath, tiles_folder)
            print(f"        -> DZI tiles created ({dzi_info['num_levels']} levels)")

            # Copy master file
            master_ext = filepath.suffix.lower()
            master_path = self.masters_dir / f"{image_id}{master_ext}"
            master_size = self.copy_master(filepath, master_path)
            print(f"        -> Master copied ({master_size / (1024*1024):.1f} MB)")

            # Build image data
            image_data = {
                'id': image_id,
                'title': name_info['title'],
                'filename': filepath.name,
                'collection': collection,
                'width': width,
                'height': height,
                'aspectRatio': round(aspect_ratio, 4),
                'thumbnail': f"thumbnails/{image_id}.webp",
                'preview': f"previews/{image_id}.jpg",
                'tiles': f"tiles/{image_id}",
                'master': f"masters/{image_id}{master_ext}",
                'masterSize': master_size,
                'masterFormat': master_ext.lstrip('.'),
                **name_info,
                **metadata
            }

            # Clean up None values
            image_data = {k: v for k, v in image_data.items() if v is not None}

            print(f"        [OK] Complete")
            return image_data

        except Exception as e:
            print(f"        [ERROR] {e}")
            import traceback
            traceback.print_exc()
            return None

    def process_all(self, max_workers: int = 4) -> None:
        """Process all images in the input directory."""
        # Find all supported images
        image_files = []
        for ext in SUPPORTED_FORMATS:
            image_files.extend(self.input_dir.rglob(f'*{ext}'))
            image_files.extend(self.input_dir.rglob(f'*{ext.upper()}'))

        image_files = sorted(set(image_files))

        if not image_files:
            print(f"No images found in {self.input_dir}")
            return

        print(f"\n{'='*60}")
        print(f"  Portfolio Image Processor")
        print(f"{'='*60}")
        print(f"  Input:  {self.input_dir}")
        print(f"  Output: {self.output_dir}")
        print(f"  Images: {len(image_files)}")
        print(f"{'='*60}\n")

        # Process images
        results = []
        for i, filepath in enumerate(image_files, 1):
            result = self.process_image(filepath, i, len(image_files))
            if result:
                results.append(result)
            print()

        # Sort by date if available, otherwise by title
        results.sort(key=lambda x: (x.get('dateSort', ''), x.get('title', '')), reverse=True)

        # Remove dateSort from output (internal use only)
        for r in results:
            r.pop('dateSort', None)

        # Update gallery data
        self.gallery_data['images'] = results
        self.gallery_data['collections'] = sorted(set(
            img['collection'] for img in results if img.get('collection')
        ))
        self.gallery_data['lastUpdated'] = datetime.now().isoformat()

        # Write gallery.json
        gallery_json_path = self.output_dir / 'data' / 'gallery.json'
        gallery_json_path.parent.mkdir(exist_ok=True)
        with open(gallery_json_path, 'w', encoding='utf-8') as f:
            json.dump(self.gallery_data, f, indent=2, ensure_ascii=False)

        print(f"{'='*60}")
        print(f"  Processing Complete!")
        print(f"{'='*60}")
        print(f"  Total images: {len(results)}")
        print(f"  Collections:  {', '.join(self.gallery_data['collections']) or 'None'}")
        print(f"  Output:       {self.output_dir}")
        print(f"  Manifest:     {gallery_json_path}")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Process images for the portfolio gallery',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic usage
    python process_images.py -i ./exports -o ./public

    # With cloud storage URL
    python process_images.py -i ./exports -o ./public --storage-url https://my-bucket.r2.cloudflarestorage.com

File naming:
    Use "Title - Location.tiff" format for automatic parsing
    Or just "Title.tiff" if no location

Collections:
    Organize into subfolders:
        exports/
            street/
                image1.tiff
            architecture/
                image2.tiff
"""
    )

    parser.add_argument(
        '-i', '--input',
        type=Path,
        required=True,
        help='Input directory containing images'
    )

    parser.add_argument(
        '-o', '--output',
        type=Path,
        required=True,
        help='Output directory for processed files'
    )

    parser.add_argument(
        '--storage-url',
        type=str,
        default='',
        help='Base URL for cloud storage (used in gallery.json)'
    )

    parser.add_argument(
        '--workers',
        type=int,
        default=4,
        help='Number of parallel workers (default: 4)'
    )

    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: Input directory does not exist: {args.input}")
        sys.exit(1)

    processor = ImageProcessor(
        args.input,
        args.output,
        args.storage_url
    )

    processor.process_all(args.workers)


if __name__ == '__main__':
    main()
