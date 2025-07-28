#!/bin/bash

# Build script for Chrome Extension

echo "🚀 Building Octra Wallet Chrome Extension..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Copy extension files
echo "📋 Copying extension files..."
cp manifest.json dist/
cp background.js dist/
cp popup.html dist/
cp expanded.html dist/

# Copy icons
echo "🎨 Copying icons..."
cp -r icons dist/

# Create extension package info
echo "📄 Creating package info..."
cat > dist/README.md << EOF
# Octra Wallet Chrome Extension

## Installation Instructions

1. Open Chrome and navigate to \`chrome://extensions/\`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this \`dist\` folder
4. The Octra Wallet extension should now be installed and visible in your extensions toolbar

## Features

- **Popup View**: Quick access to wallet functions in a compact 400x600px popup
- **Expanded View**: Full-featured wallet interface in a new tab
- **State Synchronization**: Changes made in popup are reflected in expanded view and vice versa
- **Secure Storage**: Uses Chrome's extension storage API for enhanced security
- **dApp Integration**: Support for dApp connection and transaction requests

## Usage

- Click the extension icon to open the popup view
- Click the "Open Full View" button to access all features in an expanded tab
- The extension automatically opens the expanded view when first installed

## Security

- All private keys and sensitive data are stored using Chrome's secure storage API
- Password protection is available for additional security
- No data is transmitted to external servers except for blockchain interactions

## Support

For support and updates, visit: https://github.com/m-tq/Octra-Web-Wallet
EOF

echo "✅ Chrome Extension build completed!"
echo "📁 Extension files are in the 'dist' directory"
echo "🔧 To install: Open chrome://extensions/, enable Developer mode, and click 'Load unpacked' to select the 'dist' folder"

# Create a zip file for distribution
echo "📦 Creating distribution package..."
cd dist
zip -r ../octra-wallet-extension.zip .
cd ..

echo "📦 Distribution package created: octra-wallet-extension.zip"
echo "🎉 Build process completed successfully!"