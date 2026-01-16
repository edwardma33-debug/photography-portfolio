#!/usr/bin/env python3
"""
Set CORS configuration on Cloudflare R2 bucket to allow browser access.
"""

import boto3
from botocore.config import Config
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# R2 Configuration
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
BUCKET_NAME = 'photography-portfolio'

# R2 endpoint
R2_ENDPOINT = f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com'

def main():
    print("Setting CORS configuration on R2 bucket...")

    # Create S3 client for R2
    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

    # CORS configuration
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedOrigins': [
                    'https://edward-ma-photography.vercel.app',
                    'https://*.vercel.app',
                    'http://localhost:3000',
                    'http://localhost:3001',
                    '*'  # Allow all origins for public bucket
                ],
                'ExposeHeaders': ['ETag', 'Content-Length', 'Content-Type'],
                'MaxAgeSeconds': 86400
            }
        ]
    }

    try:
        s3.put_bucket_cors(
            Bucket=BUCKET_NAME,
            CORSConfiguration=cors_configuration
        )
        print("✓ CORS configuration set successfully!")

        # Verify the configuration
        response = s3.get_bucket_cors(Bucket=BUCKET_NAME)
        print("\nCurrent CORS rules:")
        for rule in response['CORSRules']:
            print(f"  AllowedOrigins: {rule['AllowedOrigins']}")
            print(f"  AllowedMethods: {rule['AllowedMethods']}")
            print(f"  AllowedHeaders: {rule['AllowedHeaders']}")

    except Exception as e:
        print(f"✗ Error setting CORS: {e}")
        raise

if __name__ == '__main__':
    main()
