#!/usr/bin/env python3
"""
Upload processed images to Cloudflare R2.

Requirements:
    pip install boto3

Usage:
    python upload_to_r2.py --bucket your-bucket-name ./public

Environment variables required:
    R2_ACCOUNT_ID       Your Cloudflare account ID
    R2_ACCESS_KEY_ID    R2 API token access key
    R2_SECRET_ACCESS_KEY R2 API token secret key
"""

import os
import sys
import argparse
import mimetypes
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import boto3
    from botocore.config import Config
except ImportError:
    print("boto3 required. Install with: pip install boto3")
    sys.exit(1)


# Folders to upload (relative to public/)
UPLOAD_FOLDERS = ['thumbnails', 'previews', 'tiles', 'masters']


def get_content_type(filepath: Path) -> str:
    """Determine content type for a file."""
    content_type, _ = mimetypes.guess_type(str(filepath))
    if content_type:
        return content_type
    
    ext = filepath.suffix.lower()
    types = {
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.png': 'image/png',
        '.dzi': 'application/xml',
        '.xml': 'application/xml',
    }
    return types.get(ext, 'application/octet-stream')


def upload_file(s3_client, bucket: str, local_path: Path, key: str) -> bool:
    """Upload a single file to R2."""
    try:
        content_type = get_content_type(local_path)
        
        # Set cache headers for different file types
        if local_path.suffix in ('.tiff', '.tif'):
            cache_control = 'public, max-age=31536000'  # 1 year for masters
        else:
            cache_control = 'public, max-age=86400'  # 1 day for thumbnails/previews
        
        s3_client.upload_file(
            str(local_path),
            bucket,
            key,
            ExtraArgs={
                'ContentType': content_type,
                'CacheControl': cache_control,
            }
        )
        return True
    except Exception as e:
        print(f"  Error uploading {key}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Upload processed images to Cloudflare R2')
    parser.add_argument('source', type=Path, help='Source directory (usually ./public)')
    parser.add_argument('--bucket', '-b', required=True, help='R2 bucket name')
    parser.add_argument('--prefix', '-p', default='', help='Key prefix in bucket')
    parser.add_argument('--workers', '-w', type=int, default=8, help='Parallel upload workers')
    parser.add_argument('--dry-run', action='store_true', help='List files without uploading')
    
    args = parser.parse_args()
    
    # Check environment variables
    account_id = os.environ.get('R2_ACCOUNT_ID')
    access_key = os.environ.get('R2_ACCESS_KEY_ID')
    secret_key = os.environ.get('R2_SECRET_ACCESS_KEY')
    
    if not all([account_id, access_key, secret_key]):
        print("Error: Missing environment variables.")
        print("Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
        print("\nGet these from Cloudflare dashboard → R2 → Manage R2 API Tokens")
        sys.exit(1)
    
    # Create S3 client for R2
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            signature_version='s3v4',
            retries={'max_attempts': 3}
        )
    )
    
    # Collect files to upload
    files_to_upload = []
    
    for folder in UPLOAD_FOLDERS:
        folder_path = args.source / folder
        if not folder_path.exists():
            print(f"Warning: {folder_path} does not exist, skipping")
            continue
        
        for filepath in folder_path.rglob('*'):
            if filepath.is_file():
                # Build the key (path in bucket)
                relative_path = filepath.relative_to(args.source)
                key = f"{args.prefix}/{relative_path}" if args.prefix else str(relative_path)
                key = key.replace('\\', '/')  # Windows compatibility
                
                files_to_upload.append((filepath, key))
    
    if not files_to_upload:
        print("No files to upload!")
        return
    
    print(f"Found {len(files_to_upload)} files to upload")
    
    if args.dry_run:
        print("\nDry run - files that would be uploaded:")
        for filepath, key in files_to_upload[:20]:
            print(f"  {key}")
        if len(files_to_upload) > 20:
            print(f"  ... and {len(files_to_upload) - 20} more")
        return
    
    # Calculate total size
    total_size = sum(f[0].stat().st_size for f in files_to_upload)
    print(f"Total size: {total_size / (1024**3):.2f} GB")
    print(f"\nUploading to bucket: {args.bucket}")
    print("=" * 60)
    
    # Upload with progress
    uploaded = 0
    failed = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(upload_file, s3, args.bucket, fp, key): (fp, key)
            for fp, key in files_to_upload
        }
        
        for i, future in enumerate(as_completed(futures), 1):
            filepath, key = futures[future]
            success = future.result()
            
            if success:
                uploaded += 1
                # Progress indicator
                if i % 10 == 0 or i == len(files_to_upload):
                    print(f"  Progress: {i}/{len(files_to_upload)} ({i*100//len(files_to_upload)}%)")
            else:
                failed += 1
    
    print("=" * 60)
    print(f"Complete! Uploaded: {uploaded}, Failed: {failed}")
    
    if failed == 0:
        print(f"\nYour files are available at:")
        print(f"  https://{args.bucket}.{account_id}.r2.cloudflarestorage.com/")
        print(f"\nOr set up a custom domain in Cloudflare dashboard.")


if __name__ == '__main__':
    main()
