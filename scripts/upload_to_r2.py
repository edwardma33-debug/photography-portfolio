#!/usr/bin/env python3
"""
Upload processed images to Cloudflare R2 storage.
Uses boto3 (S3-compatible API) to upload all image assets.
Uploads in batches to avoid memory issues with large file counts.
Skips files that already exist on R2 (by key) for resumability.
"""

import os
import sys
import json
import mimetypes
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import boto3
    from botocore.config import Config
except ImportError:
    print("Missing boto3. Install with: pip install boto3")
    sys.exit(1)

# Load environment variables from .env file
def load_env():
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# Configuration from environment
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
R2_BUCKET_NAME = 'edward-ma-photography'

if not all([R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID]):
    print("Error: Missing R2 credentials in .env file")
    print("Required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID")
    sys.exit(1)

# R2 endpoint
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Initialize S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(
        signature_version='s3v4',
        retries={'max_attempts': 3, 'mode': 'adaptive'}
    )
)

# Directories to upload
PUBLIC_DIR = Path(__file__).parent.parent / 'public'
UPLOAD_DIRS = ['thumbnails', 'previews', 'tiles', 'masters']

def get_content_type(filepath: Path) -> str:
    """Get the MIME type for a file."""
    content_type, _ = mimetypes.guess_type(str(filepath))
    if content_type:
        return content_type

    # Fallback based on extension
    ext = filepath.suffix.lower()
    type_map = {
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.dzi': 'application/xml',
        '.json': 'application/json',
    }
    return type_map.get(ext, 'application/octet-stream')

def upload_file(filepath: Path, key: str) -> dict:
    """Upload a single file to R2."""
    try:
        content_type = get_content_type(filepath)
        file_size = filepath.stat().st_size

        # Set cache headers for immutable content
        cache_control = 'public, max-age=31536000, immutable'

        with open(filepath, 'rb') as f:
            s3_client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Body=f,
                ContentType=content_type,
                CacheControl=cache_control
            )

        return {
            'success': True,
            'key': key,
            'size': file_size
        }
    except Exception as e:
        return {
            'success': False,
            'key': key,
            'error': str(e)
        }

def list_existing_keys(prefix: str = '') -> set:
    """List all existing keys in the R2 bucket."""
    existing = set()
    paginator = s3_client.get_paginator('list_objects_v2')
    try:
        for page in paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix=prefix):
            for obj in page.get('Contents', []):
                existing.add(obj['Key'])
    except Exception as e:
        print(f"Warning: Could not list existing keys: {e}")
    return existing

def collect_files() -> list:
    """Collect all files to upload."""
    files = []

    for dir_name in UPLOAD_DIRS:
        dir_path = PUBLIC_DIR / dir_name
        if not dir_path.exists():
            print(f"Warning: {dir_name}/ directory not found, skipping...")
            continue

        for filepath in dir_path.rglob('*'):
            if filepath.is_file():
                # Create the R2 key (relative path from public/)
                key = str(filepath.relative_to(PUBLIC_DIR)).replace('\\', '/')
                files.append((filepath, key))

    # Also upload gallery.json
    gallery_json = PUBLIC_DIR / 'data' / 'gallery.json'
    if gallery_json.exists():
        files.append((gallery_json, 'data/gallery.json'))

    return files

def upload_batch(batch, batch_num, total_batches, global_offset, total_files):
    """Upload a batch of files using thread pool."""
    uploaded = 0
    failed = 0
    uploaded_size = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(upload_file, filepath, key): (filepath, key)
            for filepath, key in batch
        }

        for i, future in enumerate(as_completed(futures), 1):
            filepath, key = futures[future]
            result = future.result()

            if result['success']:
                uploaded += 1
                uploaded_size += result['size']
                status = "OK"
            else:
                failed += 1
                status = f"FAILED: {result['error']}"

            global_i = global_offset + i
            progress = global_i / total_files * 100
            print(f"[{progress:5.1f}%] {global_i}/{total_files} - {key[-55:]:<55} [{status}]")

            # Flush output so progress is visible
            sys.stdout.flush()

    return uploaded, failed, uploaded_size

def main():
    print("=" * 60)
    print("Cloudflare R2 Upload Script")
    print("=" * 60)
    print(f"\nBucket: {R2_BUCKET_NAME}")
    print(f"Endpoint: {R2_ENDPOINT}")

    # Collect files
    print("\nCollecting files to upload...")
    all_files = collect_files()

    if not all_files:
        print("No files found to upload!")
        return

    # Check what already exists on R2
    print("Checking existing files on R2 (for resumability)...")
    sys.stdout.flush()
    existing_keys = list_existing_keys()
    print(f"Found {len(existing_keys)} existing files on R2")

    # Filter to only new files
    files = [(fp, key) for fp, key in all_files if key not in existing_keys]
    skipped = len(all_files) - len(files)

    if skipped > 0:
        print(f"Skipping {skipped} files already on R2")

    if not files:
        print("\nAll files already uploaded! Nothing to do.")
        return

    # Calculate total size
    total_size = sum(f[0].stat().st_size for f in files)
    print(f"\nWill upload {len(files)} new files ({total_size / (1024*1024):.1f} MB)")

    # Group by directory for display
    by_dir = {}
    for filepath, key in files:
        dir_name = key.split('/')[0]
        by_dir.setdefault(dir_name, []).append((filepath, key))

    print("\nBreakdown:")
    for dir_name, dir_files in sorted(by_dir.items()):
        dir_size = sum(f[0].stat().st_size for f in dir_files)
        print(f"  {dir_name}/: {len(dir_files)} files ({dir_size / (1024*1024):.1f} MB)")

    print(f"\nStarting upload...")
    sys.stdout.flush()

    # Upload in batches of 500 to avoid memory issues
    BATCH_SIZE = 500
    total_uploaded = 0
    total_failed = 0
    total_uploaded_size = 0

    for batch_start in range(0, len(files), BATCH_SIZE):
        batch = files[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(files) + BATCH_SIZE - 1) // BATCH_SIZE

        uploaded, failed, uploaded_size = upload_batch(
            batch, batch_num, total_batches, batch_start, len(files)
        )
        total_uploaded += uploaded
        total_failed += failed
        total_uploaded_size += uploaded_size

    print("\n" + "=" * 60)
    print("Upload Complete!")
    print("=" * 60)
    print(f"\nSuccessful: {total_uploaded} files ({total_uploaded_size / (1024*1024*1024):.2f} GB)")
    if skipped:
        print(f"Skipped (already on R2): {skipped} files")
    if total_failed:
        print(f"Failed: {total_failed} files")

if __name__ == '__main__':
    main()
