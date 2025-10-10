#!/bin/bash

# Temporarily remove "type": "module" from package.json files before publishing

DIRECTORIES=("packages/*")

remove_type_field() {
    local dir=$1
    local package_file="$dir/package.json"

    if [ -f "$package_file" ]; then
        if TYPE=$(jq -r '.type // empty' "$package_file"); then
            if [ -n "$TYPE" ]; then
                echo "📦 Removing type field from $package_file"
                jq 'to_entries | map(select(.key != "type")) | from_entries' "$package_file" > "$package_file.tmp" && mv "$package_file.tmp" "$package_file"
                echo "$TYPE" > "$package_file.type"
            fi
        fi
    fi
}

# Process all packages
for DIR in ${DIRECTORIES[@]}; do
    for SUBDIR in $DIR; do
        if [ -d "$SUBDIR" ]; then
            remove_type_field "$SUBDIR"
        fi
    done
done

echo "✅ Type fields removed"
