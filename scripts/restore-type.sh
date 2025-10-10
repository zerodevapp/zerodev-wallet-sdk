#!/bin/bash

# Restore "type": "module" to package.json files after publishing
# Reverses changes made by remove-type.sh

DIRECTORIES=("packages/*")

restore_type_field() {
    local dir=$1
    local package_file="$dir/package.json"
    local type_file="$package_file.type"

    if [ -f "$type_file" ]; then
        TYPE=$(cat "$type_file")
        echo "📦 Restoring type field to $package_file"
        jq --arg type "$TYPE" '. + {"type": $type}' "$package_file" > "$package_file.tmp" && mv "$package_file.tmp" "$package_file"
        rm "$type_file"
    fi
}

# Process all packages
for DIR in ${DIRECTORIES[@]}; do
    for SUBDIR in $DIR; do
        if [ -d "$SUBDIR" ]; then
            restore_type_field "$SUBDIR"
        fi
    done
done

echo "✅ Type fields restored"
