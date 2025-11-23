#!/bin/bash
# Monitor batch 4 processing progress

LOG_FILE="/Users/levit/Desktop/mvp/batch4_full_processing.log"
RESULTS_DIR="/Users/levit/Desktop/mvp/batch4_results"

echo "=========================================="
echo "BATCH 4 LIVE MONITOR"
echo "=========================================="
echo ""

while true; do
    clear
    echo "=========================================="
    echo "BATCH 4 PROCESSING - LIVE UPDATES"
    echo "$(date)"
    echo "=========================================="
    echo ""
    
    # Count completed users
    completed=$(ls -1 "$RESULTS_DIR"/*_result.json 2>/dev/null | wc -l | tr -d ' ')
    echo "✅ Completed: $completed / 89 users"
    echo ""
    
    # Show last 40 lines of log
    echo "--- Recent Activity ---"
    tail -40 "$LOG_FILE"
    echo ""
    echo "=========================================="
    echo "Press Ctrl+C to stop monitoring"
    echo "=========================================="
    
    sleep 10
done





