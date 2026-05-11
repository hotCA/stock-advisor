#!/bin/bash
set -e

echo "=== Stock Advisor Setup ==="

# Check .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — please add your ANTHROPIC_API_KEY"
fi

echo ""
echo "--- Setting up Python backend ---"
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "Backend ready."
cd ..

echo ""
echo "--- Setting up Next.js frontend ---"
cd frontend
npm install
echo "Frontend ready."
cd ..

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start:"
echo "  Terminal 1: cd backend && source venv/bin/activate && python main.py"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Dashboard: http://localhost:3000"
