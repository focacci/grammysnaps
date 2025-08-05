#!/bin/bash
# CORS Testing Script for GrammySnaps

echo "🧪 Testing CORS Configuration..."
echo ""

# Test local development
echo "Testing local development (should work):"
curl -I -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost:3000/api/health

echo ""
echo "Testing production domain (should work once deployed):"
curl -I -X OPTIONS \
  -H "Origin: https://grammysnaps.dev" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://grammysnaps.dev/api/health

echo ""
echo "Testing unauthorized origin (should fail):"
curl -I -X OPTIONS \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://grammysnaps.dev/api/health
