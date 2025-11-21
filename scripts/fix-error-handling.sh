#!/bin/bash

# This script adds proper error handling imports and replaces error: any with proper error handling
# for simple API routes that don't need complex error type replacements

# List of files to update (simple catch blocks only)
files=(
  "app/api/resources/route.ts"
  "app/api/resources/[id]/route.ts"
  "app/api/resources/[id]/availability/route.ts"
  "app/api/admin/blocks/route.ts"
  "app/api/admin/blocks/[id]/route.ts"
  "app/api/admin/penalties/route.ts"
  "app/api/admin/equipment/route.ts"
  "app/api/admin/equipment/[id]/route.ts"
  "app/api/admin/lab-approvals/route.ts"
  "app/api/admin/approvals/[id]/route.ts"
  "app/api/admin/group-bookings/route.ts"
  "app/api/guard/history/route.ts"
  "app/api/guard/issued-equipment/route.ts"
  "app/api/guard/issued-library/route.ts"
  "app/api/guard/return-equipment/route.ts"
  "app/api/bookings/[id]/cancel/route.ts"
  "app/api/bookings/[id]/qr/route.ts"
  "app/api/scanner/return/route.ts"
  "app/api/group-bookings/invitations/route.ts"
  "app/api/approve/[token]/route.ts"
  "app/api/cron/route.ts"
)

echo "Updating ${#files[@]} API route files with proper error handling..."

for file in "${files[@]}"; do
  filepath="/Users/sarthakpandey/Coding/SST-Borrowing-equipments/$file"
  
  if [ -f "$filepath" ]; then
    echo "Processing: $file"
    
    # Check if handleApiError is already imported
    if ! grep -q "handleApiError" "$filepath"; then
      # Add import after the last existing import line
      # Find the last import line number
      last_import_line=$(grep -n "^import" "$filepath" | tail -1 | cut -d: -f1)
      
      if [ -n "$last_import_line" ]; then
        # Add the new import after the last import
        sed -i.bak "${last_import_line}a\\
import { handleApiError } from '@/lib/errors';
" "$filepath"
        echo "  ✓ Added handleApiError import"
      fi
    fi
    
    # Replace } catch (error: any) { with } catch (error) {
    sed -i.bak 's/} catch (error: any) {/} catch (error) {/g' "$filepath"
    
    # Replace simple error returns with handleApiError
    # This is a simplified pattern - might need manual review for complex cases
    perl -i.bak -0pe 's/return NextResponse\.json\(\s*\{ error: error\.message \|\| [^}]+ \},\s*\{ status: 500 \}\s*\);/return handleApiError(error);/gs' "$filepath"
    
    echo "  ✓ Updated error handling"
    
    # Remove backup files
    rm -f "${filepath}.bak"
  else
    echo "  ✗ File not found: $file"
  fi
done

echo ""
echo "Done! Please review the changes and test the API routes."
