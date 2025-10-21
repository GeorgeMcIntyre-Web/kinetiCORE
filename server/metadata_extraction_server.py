#!/usr/bin/env python3
"""
Metadata Extraction API Server
Owner: George

AI-assisted metadata extraction service for kinetiCORE asset library.
Automatically scrapes and extracts specifications from manufacturer websites,
datasheets, and supplier APIs.
"""

import os
import sys
import json
import asyncio
import aiohttp
import logging
from typing import Dict, Any, Optional, List
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse
import PyPDF2
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Enable CORS for all routes
CORS(app)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

class MetadataExtractor:
    """Main metadata extraction class"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
    
    async def extract_from_mcmaster(self, part_number: str) -> Dict[str, Any]:
        """Extract metadata from McMaster-Carr"""
        try:
            # McMaster search URL
            search_url = f"https://www.mcmaster.com/products/{part_number}"
            
            response = self.session.get(search_url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract product information
            product_data = {
                'name': self._extract_text(soup, '.product-name'),
                'partNumber': part_number,
                'description': self._extract_text(soup, '.product-description'),
                'category': self._extract_text(soup, '.breadcrumb-item:last-child'),
                'price': self._extract_price(soup),
                'dimensions': self._extract_dimensions(soup),
                'material': self._extract_material(soup),
                'weight': self._extract_weight(soup),
                'images': self._extract_images(soup)
            }
            
            return product_data
            
        except Exception as e:
            logger.error(f"McMaster extraction failed for {part_number}: {e}")
            return {}
    
    async def extract_from_manufacturer(self, url: str) -> Dict[str, Any]:
        """Extract metadata from manufacturer website"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Generic extraction patterns
            product_data = {
                'name': self._extract_product_name(soup),
                'manufacturer': self._extract_manufacturer(soup, url),
                'description': self._extract_description(soup),
                'specifications': self._extract_specifications(soup),
                'images': self._extract_images(soup),
                'documentationUrl': self._extract_documentation_links(soup, url)
            }
            
            return product_data
            
        except Exception as e:
            logger.error(f"Manufacturer extraction failed for {url}: {e}")
            return {}
    
    async def extract_from_pdf(self, pdf_url: str) -> Dict[str, Any]:
        """Extract metadata from PDF datasheet"""
        try:
            response = self.session.get(pdf_url, timeout=30)
            response.raise_for_status()
            
            pdf_file = io.BytesIO(response.content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            # Extract text from all pages
            text_content = ""
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
            
            # Extract metadata
            metadata = pdf_reader.metadata or {}
            
            # Use AI to extract specifications
            specifications = await self._extract_specifications_from_text(text_content)
            
            return {
                'text': text_content,
                'specifications': specifications,
                'metadata': {
                    'title': metadata.get('/Title', ''),
                    'author': metadata.get('/Author', ''),
                    'subject': metadata.get('/Subject', ''),
                    'keywords': metadata.get('/Keywords', '').split(',') if metadata.get('/Keywords') else []
                },
                'pageCount': len(pdf_reader.pages)
            }
            
        except Exception as e:
            logger.error(f"PDF extraction failed for {pdf_url}: {e}")
            return {}
    
    async def extract_specifications_from_text(self, text: str) -> Dict[str, Any]:
        """Extract specifications from text using AI"""
        if not OPENAI_API_KEY:
            return self._extract_specifications_fallback(text)
        
        try:
            # Use OpenAI API to extract specifications
            prompt = f"""
            Extract technical specifications from the following text and return as JSON:
            
            Text: {text[:2000]}  # Limit text length
            
            Return JSON with these fields:
            - hasKinematics: boolean
            - dof: number (degrees of freedom)
            - payload: number (kg)
            - reach: number (mm)
            - dimensions: {{length: number, width: number, height: number}}
            - mass: number (kg)
            - powerRequirement: string
            - precision: number (mm)
            - cycleTime: number (seconds)
            - otherSpecs: object with additional specifications
            
            Only include fields that are explicitly mentioned in the text.
            """
            
            headers = {
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 500,
                'temperature': 0.1
            }
            
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Parse JSON response
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return self._extract_specifications_fallback(text)
            else:
                logger.error(f"OpenAI API error: {response.status_code}")
                return self._extract_specifications_fallback(text)
                
        except Exception as e:
            logger.error(f"AI specification extraction failed: {e}")
            return self._extract_specifications_fallback(text)
    
    def _extract_specifications_fallback(self, text: str) -> Dict[str, Any]:
        """Fallback specification extraction using regex patterns"""
        specs = {}
        
        # Common specification patterns
        patterns = {
            'payload': r'payload[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|pounds?|lbs?)',
            'reach': r'reach[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in)',
            'precision': r'precision[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in)',
            'cycleTime': r'cycle\s*time[:\s]*(\d+(?:\.\d+)?)\s*(?:seconds?|sec|minutes?|min)',
            'powerRequirement': r'power[:\s]*(\d+(?:\.\d+)?)\s*(?:W|kW|V|A)',
            'mass': r'(?:weight|mass)[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|pounds?|lbs?)'
        }
        
        text_lower = text.lower()
        for key, pattern in patterns.items():
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                specs[key] = match.group(1)
        
        return specs
    
    def _extract_text(self, soup: BeautifulSoup, selector: str) -> str:
        """Extract text from HTML element"""
        element = soup.select_one(selector)
        return element.get_text(strip=True) if element else ""
    
    def _extract_price(self, soup: BeautifulSoup) -> Optional[float]:
        """Extract price from HTML"""
        price_element = soup.select_one('.price, .cost, [class*="price"]')
        if price_element:
            price_text = price_element.get_text(strip=True)
            # Extract numeric value
            price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(',', ''))
            if price_match:
                return float(price_match.group())
        return None
    
    def _extract_dimensions(self, soup: BeautifulSoup) -> Optional[Dict[str, float]]:
        """Extract dimensions from HTML"""
        # Look for dimension patterns
        text_content = soup.get_text()
        dimension_patterns = [
            r'(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in)',
            r'length[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in).*width[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in).*height[:\s]*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inches?|in)'
        ]
        
        for pattern in dimension_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                return {
                    'length': float(match.group(1)),
                    'width': float(match.group(2)),
                    'height': float(match.group(3))
                }
        return None
    
    def _extract_material(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract material information"""
        material_keywords = ['steel', 'aluminum', 'plastic', 'carbon fiber', 'titanium', 'brass', 'copper']
        text_content = soup.get_text().lower()
        
        for material in material_keywords:
            if material in text_content:
                return material.title()
        return None
    
    def _extract_weight(self, soup: BeautifulSoup) -> Optional[float]:
        """Extract weight information"""
        text_content = soup.get_text()
        weight_patterns = [
            r'weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|pounds?|lbs?)',
            r'(\d+(?:\.\d+)?)\s*(?:kg|pounds?|lbs?)\s*(?:weight|mass)'
        ]
        
        for pattern in weight_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                return float(match.group(1))
        return None
    
    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract product images"""
        images = []
        img_elements = soup.select('img[src], img[data-src]')
        
        for img in img_elements:
            src = img.get('src') or img.get('data-src')
            if src and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                images.append(src)
        
        return images[:5]  # Limit to 5 images
    
    def _extract_product_name(self, soup: BeautifulSoup) -> str:
        """Extract product name from various selectors"""
        selectors = [
            'h1', '.product-title', '.product-name', 
            '[class*="title"]', '[class*="name"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text(strip=True)
        return ""
    
    def _extract_manufacturer(self, soup: BeautifulSoup, url: str) -> str:
        """Extract manufacturer name"""
        # Try to get from domain
        domain = urlparse(url).netloc
        if domain:
            return domain.replace('www.', '').split('.')[0].title()
        
        # Try to find in page content
        manufacturer_selectors = [
            '.manufacturer', '.brand', '[class*="manufacturer"]',
            '[class*="brand"]'
        ]
        
        for selector in manufacturer_selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text(strip=True)
        
        return ""
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract product description"""
        selectors = [
            '.description', '.product-description', 
            '[class*="description"]', 'p'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if len(text) > 20:  # Only return substantial descriptions
                    return text
        return ""
    
    def _extract_specifications(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract specifications from HTML"""
        specs = {}
        
        # Look for specification tables
        spec_tables = soup.select('table, .specifications, [class*="spec"]')
        
        for table in spec_tables:
            rows = table.select('tr')
            for row in rows:
                cells = row.select('td, th')
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True).lower()
                    value = cells[1].get_text(strip=True)
                    
                    # Map common specification keys
                    if 'payload' in key or 'load' in key:
                        specs['payload'] = self._extract_numeric_value(value)
                    elif 'reach' in key or 'range' in key:
                        specs['reach'] = self._extract_numeric_value(value)
                    elif 'precision' in key or 'accuracy' in key:
                        specs['precision'] = self._extract_numeric_value(value)
                    elif 'power' in key:
                        specs['powerRequirement'] = value
                    elif 'weight' in key or 'mass' in key:
                        specs['mass'] = self._extract_numeric_value(value)
        
        return specs
    
    def _extract_numeric_value(self, text: str) -> Optional[float]:
        """Extract numeric value from text"""
        match = re.search(r'(\d+(?:\.\d+)?)', text.replace(',', ''))
        return float(match.group(1)) if match else None
    
    def _extract_documentation_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract documentation and spec sheet links"""
        links = []
        
        # Look for common documentation link patterns
        link_selectors = [
            'a[href*="manual"]', 'a[href*="datasheet"]', 
            'a[href*="specification"]', 'a[href*="catalog"]',
            'a[href*=".pdf"]'
        ]
        
        for selector in link_selectors:
            elements = soup.select(selector)
            for element in elements:
                href = element.get('href')
                if href:
                    full_url = urljoin(base_url, href)
                    links.append(full_url)
        
        return links[:3]  # Limit to 3 links

# Initialize extractor
extractor = MetadataExtractor()

@app.route('/api/metadata-extraction/mcmaster', methods=['POST'])
def extract_mcmaster():
    """Extract metadata from McMaster-Carr"""
    try:
        data = request.get_json()
        part_number = data.get('partNumber')
        
        if not part_number:
            return jsonify({'error': 'Part number required'}), 400
        
        # Run async extraction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(extractor.extract_from_mcmaster(part_number))
        loop.close()
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"McMaster extraction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata-extraction/manufacturer', methods=['POST'])
def extract_manufacturer():
    """Extract metadata from manufacturer website"""
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL required'}), 400
        
        # Run async extraction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(extractor.extract_from_manufacturer(url))
        loop.close()
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Manufacturer extraction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata-extraction/pdf-extract', methods=['POST'])
def extract_pdf():
    """Extract metadata from PDF datasheet"""
    try:
        data = request.get_json()
        pdf_url = data.get('pdfUrl')
        
        if not pdf_url:
            return jsonify({'error': 'PDF URL required'}), 400
        
        # Run async extraction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(extractor.extract_from_pdf(pdf_url))
        loop.close()
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata-extraction/extract-specs', methods=['POST'])
def extract_specifications():
    """Extract specifications from text using AI"""
    try:
        data = request.get_json()
        text = data.get('text')
        
        if not text:
            return jsonify({'error': 'Text required'}), 400
        
        # Run async extraction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(extractor.extract_specifications_from_text(text))
        loop.close()
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Specification extraction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metadata-extraction/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'features': [
            'mcmaster-extraction',
            'manufacturer-scraping',
            'pdf-extraction',
            'ai-specification-extraction'
        ],
        'ai_enabled': bool(OPENAI_API_KEY)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
