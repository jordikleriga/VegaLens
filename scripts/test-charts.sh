#!/bin/bash

# Chart Types Test Runner
# Run this script after making changes to verify all chart types work correctly
# Usage: ./scripts/test-charts.sh

API_BASE="${API_BASE:-http://localhost:3001/api}"
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}🧪 Chart Types Quick Test${NC}\n"
echo "Testing API at: $API_BASE"
echo "================================================"

# Check if API is running (health endpoint is at root, not /api)
HEALTH_URL="${API_BASE%/api}/health"
if ! curl -s "$HEALTH_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ API is not running${NC}"
    echo "Please start the backend server first: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ API is running${NC}"

# Test function
test_endpoint() {
    local name=$1
    local endpoint=$2
    local data=$3
    local expected_status=${4:-200}
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    status=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $name${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $name (expected $expected_status, got $status)${NC}"
        echo "   Response: $(echo "$body" | head -c 100)"
        ((FAILED++))
    fi
}

# Sample data
DATA='[{"category":"A","value":100,"date":"2024-01-01"},{"category":"B","value":200,"date":"2024-01-02"},{"category":"C","value":150,"date":"2024-01-03"}]'
AGG_DATA='[{"key":"NYC","_count":100,"avg_val":50},{"key":"LA","_count":80,"avg_val":45}]'
SANKEY_DATA='[{"source":"A","target":"X","value":10},{"source":"A","target":"Y","value":15},{"source":"B","target":"X","value":20},{"source":"B","target":"Y","value":25}]'
WORDCLOUD_DATA='[{"word":"hello","count":50},{"word":"world","count":30},{"word":"test","count":20}]'
WATERFALL_DATA='[{"label":"Start","amount":1000},{"label":"Jan","amount":200},{"label":"Feb","amount":-150},{"label":"Mar","amount":300},{"label":"Apr","amount":-100}]'
ROLLING_AVG_DATA='[{"date":"2024-01-01","temp_max":12},{"date":"2024-01-02","temp_max":15},{"date":"2024-01-03","temp_max":10},{"date":"2024-01-04","temp_max":18},{"date":"2024-01-05","temp_max":14},{"date":"2024-01-06","temp_max":11},{"date":"2024-01-07","temp_max":16}]'
TERNARY_DATA='[{"City":"NYC","High":30,"Medium":50,"Low":20},{"City":"LA","High":15,"Medium":25,"Low":60},{"City":"SF","High":45,"Medium":35,"Low":20}]'
COMET_DATA='[{"variety":"Alpha","year":"2022","yield":30},{"variety":"Alpha","year":"2023","yield":45},{"variety":"Beta","year":"2022","yield":25},{"variety":"Beta","year":"2023","yield":20},{"variety":"Gamma","year":"2022","yield":40},{"variety":"Gamma","year":"2023","yield":55}]'
HEATLANE_DATA='[{"horsepower":100},{"horsepower":120},{"horsepower":130},{"horsepower":140},{"horsepower":150},{"horsepower":155},{"horsepower":160},{"horsepower":165},{"horsepower":170},{"horsepower":180},{"horsepower":190},{"horsepower":200},{"horsepower":210},{"horsepower":220}]'

echo -e "\n${YELLOW}📊 Vega Spec Generator${NC}\n"

test_endpoint "Bar Chart" "/vega/generate" \
    '{"type":"bar","config":{"xField":"category","yField":"value","title":"Test"},"data":'"$DATA"'}'

test_endpoint "Line Chart" "/vega/generate" \
    '{"type":"line","config":{"xField":"date","yField":"value","title":"Test"},"data":'"$DATA"'}'

test_endpoint "Area Chart" "/vega/generate" \
    '{"type":"area","config":{"xField":"date","yField":"value","title":"Test"},"data":'"$DATA"'}'

test_endpoint "Pie Chart" "/vega/generate" \
    '{"type":"pie","config":{"categoryField":"category","valueField":"value","title":"Test"},"data":'"$DATA"'}'

test_endpoint "Scatter Chart" "/vega/generate" \
    '{"type":"scatter","config":{"xField":"value","yField":"value","title":"Test"},"data":'"$DATA"'}'

test_endpoint "Sankey Chart" "/vega/generate" \
    '{"type":"sankey","config":{"sourceField":"source","targetField":"target","valueField":"value","title":"Test"},"data":'"$SANKEY_DATA"'}'

test_endpoint "Wordcloud Chart" "/vega/generate" \
    '{"type":"wordcloud","config":{"textField":"word","sizeField":"count","title":"Test"},"data":'"$WORDCLOUD_DATA"'}'

test_endpoint "Waterfall Chart" "/vega/generate" \
    '{"type":"waterfall","config":{"labelField":"label","valueField":"amount","title":"Waterfall Test"},"data":'"$WATERFALL_DATA"'}'

test_endpoint "Rolling Average Chart" "/vega/generate" \
    '{"type":"rolling_average","config":{"xField":"date","yField":"temp_max","windowSize":3,"title":"Rolling Avg Test"},"data":'"$ROLLING_AVG_DATA"'}'

test_endpoint "Ternary Chart" "/vega/generate" \
    '{"type":"ternary","config":{"labelField":"City","topField":"High","leftField":"Medium","rightField":"Low","title":"Ternary Test"},"data":'"$TERNARY_DATA"'}'

test_endpoint "Comet Chart" "/vega/generate" \
    '{"type":"comet","config":{"categoryField":"variety","timeField":"year","valueField":"yield","title":"Comet Test"},"data":'"$COMET_DATA"'}'

test_endpoint "Heat Lane Chart" "/vega/generate" \
    '{"type":"heatlane","config":{"valueField":"horsepower","binCount":10,"title":"Heat Lane Test"},"data":'"$HEATLANE_DATA"'}'

echo -e "\n${YELLOW}📈 Vega-Lite Generator${NC}\n"

test_endpoint "VL Bar Chart" "/vega/vegalite/chart/bar" \
    '{"data":'"$DATA"',"xField":"category","yField":"value"}'

test_endpoint "VL Line Chart" "/vega/vegalite/chart/line" \
    '{"data":'"$DATA"',"xField":"date","yField":"value"}'

test_endpoint "VL Area Chart" "/vega/vegalite/chart/area" \
    '{"data":'"$DATA"',"xField":"date","yField":"value"}'

test_endpoint "VL Pie Chart" "/vega/vegalite/chart/pie" \
    '{"data":'"$DATA"',"categoryField":"category","valueField":"value"}'

test_endpoint "VL Scatter Chart" "/vega/vegalite/chart/scatter" \
    '{"data":'"$DATA"',"xField":"value","yField":"value"}'

test_endpoint "VL Histogram" "/vega/vegalite/chart/histogram" \
    '{"data":'"$DATA"',"field":"value"}'

test_endpoint "VL Boxplot" "/vega/vegalite/chart/boxplot" \
    '{"data":'"$DATA"',"categoryField":"category","valueField":"value"}'

echo -e "\n${YELLOW}📉 Aggregation Data${NC}\n"

test_endpoint "From Aggregation" "/vega/vegalite/from-aggregation" \
    '{"data":'"$AGG_DATA"',"bucketField":"key","valueField":"_count","mark":"bar"}'

echo -e "\n${YELLOW}🎨 Color Config${NC}\n"

test_endpoint "Color Scheme" "/vega/vegalite/chart/bar" \
    '{"data":'"$DATA"',"xField":"category","yField":"value","config":{"colorConfig":{"singleColor":"#ff5733","opacity":0.8}}}'

echo -e "\n${YELLOW}🔍 Validation${NC}\n"

test_endpoint "Missing Data (400)" "/vega/vegalite/chart/bar" \
    '{"xField":"category","yField":"value"}' 400

test_endpoint "Invalid Type (400)" "/vega/vegalite/chart/invalid" \
    '{"data":'"$DATA"',"xField":"category","yField":"value"}' 400

test_endpoint "Missing Fields (400)" "/vega/vegalite/chart/bar" \
    '{"data":'"$DATA"'}' 400

# Summary
echo ""
echo "================================================"
echo -e "${BLUE}📋 RESULTS: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi

