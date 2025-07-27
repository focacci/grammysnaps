# GrammySnaps Network Access Instructions

## Automated Setup (Recommended)

Your GrammySnaps application now includes automated network configuration that handles changing IP addresses!

### Quick Start:

1. **Run the setup script** (this automatically detects your IP and configures everything):

   ```bash
   ./setup-network.sh
   ```

2. **Check status anytime** to see current network info and confirm everything is working:
   ```bash
   ./check-status.sh
   ```

The setup script will:

- ✅ Automatically detect your current network IP
- ✅ Update the configuration files
- ✅ Restart the application with the correct settings
- ✅ Test that everything works
- ✅ Show you the URLs to share

### For Others on Your Network:

After running the setup script, share the Web App URL it displays (e.g., `http://192.168.1.156:8080`) with others on your network.

## Manual Setup (Alternative)

If you prefer to set things up manually:

### Access URLs:

- **Web Application**: http://YOUR_IP:8080
- **API**: http://YOUR_IP:3000

Replace `YOUR_IP` with your actual network IP address.

### Find Your IP Address:

```bash
ip route get 1.1.1.1 | awk '{print $7}' | head -1
```

### Update Configuration:

1. Edit `web/.env` and set: `VITE_API_URL=http://YOUR_IP:3000`
2. Restart: `docker-compose down && docker-compose up -d --build`

## Handling IP Address Changes

### If Your Router Changes Your IP:

Simply run the setup script again:

```bash
./setup-network.sh
```

This will detect the new IP and reconfigure everything automatically.

### Make Your IP Address Static (Recommended):

**Option 1: Router DHCP Reservation**

1. Access your router's admin panel (usually http://192.168.1.1)
2. Find "DHCP" or "LAN" settings
3. Look for "DHCP Reservation" or "Static IP Assignment"
4. Add a reservation for your computer's MAC address to always get the same IP

**Option 2: Static IP on Your Computer**

```bash
# Find your interface name
ip route get 1.1.1.1 | awk '{print $5}' | head -1

# Example for Ubuntu/Debian (replace 'wlo1' with your interface):
sudo nmcli con mod "Your WiFi Name" ipv4.addresses 192.168.1.156/24
sudo nmcli con mod "Your WiFi Name" ipv4.gateway 192.168.1.1
sudo nmcli con mod "Your WiFi Name" ipv4.dns 192.168.1.1
sudo nmcli con mod "Your WiFi Name" ipv4.method manual
sudo nmcli con up "Your WiFi Name"
```

## Troubleshooting

### If Others Can't Access:

1. **Run the status script** to verify everything is working:

   ```bash
   ./check-status.sh
   ```

2. **Check firewall**:

   ```bash
   # Ubuntu/Debian:
   sudo ufw allow 3000
   sudo ufw allow 8080

   # Or temporarily disable:
   sudo ufw disable
   ```

3. **Router AP Isolation**: Some routers prevent device-to-device communication. Check your router's WiFi settings.

4. **Re-run setup** if your IP changed:
   ```bash
   ./setup-network.sh
   ```

### Useful Commands:

- **Stop the application**: `docker-compose down`
- **Start the application**: `docker-compose up -d`
- **View logs**: `docker-compose logs`
- **Check status**: `./check-status.sh`
- **Reconfigure network**: `./setup-network.sh`

## Security Considerations:

- ✅ This setup is for local network use only
- ✅ Don't expose these ports to the internet without proper security
- ✅ All data is stored locally on your computer
- ✅ Users can create accounts and join family groups safely on your network
