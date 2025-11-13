#!/bin/bash
# Quick script to check batch processing progress

echo "==================================="
echo "Batch Processing Status"
echo "==================================="
echo ""

# Check if process is running
if pgrep -f "process_all_users.py" > /dev/null; then
    echo "✅ Process is RUNNING"
else
    echo "❌ Process is NOT running"
fi

echo ""
echo "-----------------------------------"
echo "Recent Log Output:"
echo "-----------------------------------"
tail -40 /Users/levit/Desktop/mvp/batch_processing.log

echo ""
echo "-----------------------------------"
echo "Progress Summary:"
echo "-----------------------------------"

# Count successes and failures
SUCCESS=$(grep -c "✅ SUCCESS" /Users/levit/Desktop/mvp/batch_processing.log 2>/dev/null || echo "0")
FAILED=$(grep -c "❌ FAILED" /Users/levit/Desktop/mvp/batch_processing.log 2>/dev/null || echo "0")
TOTAL=41

echo "Completed: $((SUCCESS + FAILED))/$TOTAL"
echo "Success: $SUCCESS"
echo "Failed: $FAILED"

echo ""
echo "To watch live updates, run:"
echo "  tail -f /Users/levit/Desktop/mvp/batch_processing.log"

