#!/bin/bash

# FluxStream - Prowlarr Setup Script
# This script installs and configures Prowlarr for torrent indexing

set -e

echo "🚀 FluxStream - Prowlarr Setup"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Please do not run as root. Run as your regular user."
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS"
    exit 1
fi

echo "📋 Detected OS: $OS"
echo ""

# Install Prowlarr based on OS
case $OS in
    ubuntu|debian|linuxmint|pop)
        echo "📦 Installing Prowlarr for Debian/Ubuntu/Mint..."
        
        # Add Prowlarr repository
        sudo apt-get update
        sudo apt-get install -y curl sqlite3
        
        # Download and install Prowlarr
        ARCH=$(dpkg --print-architecture)
        PROWLARR_VERSION=$(curl -s https://api.github.com/repos/Prowlarr/Prowlarr/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
        
        echo "📥 Downloading Prowlarr $PROWLARR_VERSION..."
        cd /tmp
        wget --content-disposition "https://github.com/Prowlarr/Prowlarr/releases/download/${PROWLARR_VERSION}/Prowlarr.master.${PROWLARR_VERSION#v}.linux-core-${ARCH}.tar.gz"
        
        # Extract to /opt
        sudo tar -xvzf Prowlarr*.tar.gz -C /opt/
        sudo chown -R $USER:$USER /opt/Prowlarr
        
        echo "✅ Prowlarr installed to /opt/Prowlarr"
        ;;
        
    arch|manjaro)
        echo "📦 Installing Prowlarr for Arch Linux..."
        
        # Install from AUR (if yay is available)
        if command -v yay &> /dev/null; then
            yay -S prowlarr-bin
        else
            echo "⚠️  Please install yay first or manually install Prowlarr from AUR"
            exit 1
        fi
        ;;
        
    fedora|rhel|centos)
        echo "📦 Installing Prowlarr for Fedora/RHEL..."
        
        sudo dnf install -y curl sqlite
        
        # Download and install Prowlarr
        PROWLARR_VERSION=$(curl -s https://api.github.com/repos/Prowlarr/Prowlarr/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
        
        echo "📥 Downloading Prowlarr $PROWLARR_VERSION..."
        cd /tmp
        wget --content-disposition "https://github.com/Prowlarr/Prowlarr/releases/download/${PROWLARR_VERSION}/Prowlarr.master.${PROWLARR_VERSION#v}.linux-core-x64.tar.gz"
        
        sudo tar -xvzf Prowlarr*.tar.gz -C /opt/
        sudo chown -R $USER:$USER /opt/Prowlarr
        
        echo "✅ Prowlarr installed to /opt/Prowlarr"
        ;;
        
    *)
        echo "❌ Unsupported OS: $OS"
        echo "Please install Prowlarr manually from: https://github.com/Prowlarr/Prowlarr/releases"
        exit 1
        ;;
esac

echo ""
echo "🔧 Creating systemd service..."

# Create systemd service file
sudo tee /etc/systemd/system/prowlarr.service > /dev/null <<EOF
[Unit]
Description=Prowlarr Daemon
After=network.target

[Service]
User=$USER
Group=$USER
Type=simple
ExecStart=/opt/Prowlarr/Prowlarr -nobrowser -data=/home/$USER/.config/Prowlarr
Restart=on-failure
RestartSec=5
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd service created"
echo ""

# Enable and start service
echo "🚀 Starting Prowlarr service..."
sudo systemctl daemon-reload
sudo systemctl enable prowlarr
sudo systemctl start prowlarr

echo ""
echo "⏳ Waiting for Prowlarr to start (this may take 30 seconds)..."
sleep 30

# Check if Prowlarr is running
if systemctl is-active --quiet prowlarr; then
    echo "✅ Prowlarr is running!"
else
    echo "⚠️  Prowlarr service may not have started. Check with: sudo systemctl status prowlarr"
fi

echo ""
echo "📝 Getting API Key..."

# Wait for config file to be created
CONFIG_FILE="/home/$USER/.config/Prowlarr/config.xml"
for i in {1..30}; do
    if [ -f "$CONFIG_FILE" ]; then
        break
    fi
    sleep 1
done

if [ -f "$CONFIG_FILE" ]; then
    API_KEY=$(grep -oP '<ApiKey>\K[^<]+' "$CONFIG_FILE" 2>/dev/null || echo "")
    
    if [ -n "$API_KEY" ]; then
        echo "✅ API Key found: $API_KEY"
        echo ""
        echo "📋 Add this to your FluxStream server environment:"
        echo "export PROWLARR_URL=\"http://localhost:9696\""
        echo "export PROWLARR_API_KEY=\"$API_KEY\""
        echo ""
        
        # Optionally add to server .env file
        read -p "Add to server/.env file? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            SERVER_DIR="$(dirname "$(readlink -f "$0")")/../server"
            if [ -d "$SERVER_DIR" ]; then
                echo "PROWLARR_URL=http://localhost:9696" >> "$SERVER_DIR/.env"
                echo "PROWLARR_API_KEY=$API_KEY" >> "$SERVER_DIR/.env"
                echo "✅ Added to server/.env"
            fi
        fi
    else
        echo "⚠️  Could not extract API key automatically"
        echo "You can find it in Prowlarr UI: Settings > General > Security > API Key"
    fi
else
    echo "⚠️  Config file not found yet. Prowlarr may still be initializing."
fi

echo ""
echo "🎉 Prowlarr Setup Complete!"
echo ""
echo "📍 Access Prowlarr at: http://localhost:9696"
echo ""
echo "📖 Next Steps:"
echo "1. Open http://localhost:9696 in your browser"
echo "2. Complete the initial setup wizard"
echo "3. Add indexers (Settings > Indexers > Add Indexer)"
echo "   - Popular options: 1337x, RARBG, The Pirate Bay, YTS, EZTV, Nyaa"
echo "4. The API key has been displayed above"
echo "5. Restart your FluxStream server to use Prowlarr"
echo ""
echo "💡 Useful Commands:"
echo "   sudo systemctl status prowlarr  - Check status"
echo "   sudo systemctl restart prowlarr - Restart service"
echo "   sudo systemctl stop prowlarr    - Stop service"
echo "   sudo journalctl -u prowlarr -f  - View logs"
echo ""
